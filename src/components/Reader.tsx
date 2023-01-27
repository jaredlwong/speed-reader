import React, { useCallback, useEffect, useRef, useState } from "react";
import { Article } from "../messages";
import { base64UrlDecode } from "../shared/encoder";
import { useLocation } from "react-router-dom";

import tokenizer from "sbd";

import "./reader.css";
import { sentenceTimes } from "../shared/speeder";

interface Word {
  id: string;
  text: string;
}

interface Sentence {
  id: string;
  words: Word[];
}

function parseHTML(html: string): { sentences: Sentence[]; html: string } {
  const div = document.createElement("div");
  div.innerHTML = html;

  // nytimes
  div.querySelectorAll('div[data-testid="placeholder"]').forEach((el) => {
    el.remove();
  });
  // dropbox paper and such
  div.querySelectorAll("div[contenteditable='true']").forEach((el) => {
    el.setAttribute("contenteditable", "false");
  });

  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
  const changes: { node: Text; parent: ParentNode | null; frag: DocumentFragment }[] = [];
  const sentenceElems: Sentence[] = [];
  let wordIndex = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentNode;

    const text = node.textContent;
    const sentences: string[] = tokenizer.sentences(text, {
      preserve_whitespace: true,
    });
    const frag = document.createDocumentFragment();
    for (const sentence of sentences) {
      const sentenceIndex = sentences.length;
      const sentenceSpan = document.createElement("span");
      sentenceSpan.classList.add("sentence");
      sentenceSpan.setAttribute("id", `sentence-${sentenceIndex}`);
      const words = sentence.split(/(\s+)/);
      const sentenceElem: Sentence = { id: `sentence-${sentenceIndex}`, words: [] };
      sentenceElems.push(sentenceElem);
      for (const word of words) {
        if (word.length === 0) {
          continue;
        }
        if (word.trim().length === 0) {
          sentenceSpan.appendChild(document.createTextNode(word));
        } else {
          const span = document.createElement("span");
          span.classList.add("unread");
          span.classList.add("word");
          span.setAttribute("id", `word-${wordIndex}`);
          span.textContent = word;
          sentenceSpan.appendChild(span);
          sentenceElem.words.push({ id: `word-${wordIndex}`, text: word });
          wordIndex += 1;
        }
      }
      frag.appendChild(sentenceSpan);
    }
    changes.push({ node, parent, frag });
  }
  for (const { node, parent, frag } of changes) {
    parent?.replaceChild(frag, node);
  }

  return { sentences: sentenceElems, html: div.innerHTML };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface Controller {
  stop: () => void;
  curIndex: string;
  minutesRemaining: number;
}

function markAsRead(
  sentences: Sentence[],
  wordsPerMinute: number,
  pauseMs: number,
  startIndex: string,
): { promise: Promise<void>; controller: Controller } {
  const stopped = { current: false };
  const controller: Controller = {
    stop: () => {
      stopped.current = true;
    },
    curIndex: startIndex,
    minutesRemaining: 0,
  };
  const wordToIndex = new Map<string, [number, number]>();
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    for (let j = 0; j < sentence.words.length; j++) {
      const word = sentence.words[j];
      wordToIndex.set(word.id, [i, j]);
    }
  }
  const promise = (async () => {
    const sentenceTiming = sentenceTimes(
      sentences.map((s) => s.words.length),
      wordsPerMinute,
      pauseMs,
    );
    const [startSentenceIndex, startWordIndex] = wordToIndex.get(startIndex) ?? [0, 0];
    controller.minutesRemaining = sentenceTiming.slice(startSentenceIndex).reduce((a, b) => a + b, 0) / 1000 / 60;

    for (let i = startSentenceIndex; i < sentences.length; i++) {
      const sentence = sentences[i];
      const timing = sentenceTiming[i];
      const msPerWord = timing / sentence.words.length;
      const startTime = performance.now();
      // offset by start word index
      const startJ = startSentenceIndex === i ? startWordIndex : 0;
      for (let j = startJ; j < sentence.words.length; j++) {
        if (stopped.current) {
          return;
        }
        const word = sentence.words[j];
        const el = document.getElementById(word.id);
        el?.classList.remove("unread");
        el?.classList.add("read");
        const now = performance.now();
        const elapsed = now - startTime;
        const expected = msPerWord * (j - startJ + 1);
        controller.curIndex = word.id;
        await sleep(expected - elapsed);
      }
      const elapsed = performance.now() - startTime;
      // multiply timing by percent of words in sentence read
      const expected = timing * ((sentence.words.length - startJ) / sentence.words.length) + pauseMs;
      await sleep(expected - elapsed);
    }
  })();
  return { promise, controller };
}

export const Reader: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);
  const controller = useRef<Controller | null>(null);
  const curIndex = useRef<string>("");
  const wordsPerMinute = useRef<number>(450);
  const timer = useRef<number | null>(null);

  const { search } = useLocation();
  const encoded = new URLSearchParams(search).get("doc");
  const decoded: Article | null = encoded ? (JSON.parse(base64UrlDecode(encoded)) as Article) : null;
  document.title = decoded?.title || "Reader";

  const { sentences, html } = parseHTML(decoded?.content || "");

  const numWords = sentences.map((s) => s.words.length).reduce((a, b) => a + b, 0);
  const [minutesRemaining, setMinutesRemaining] = useState<number>(numWords / wordsPerMinute.current);

  const onClick = useCallback(async () => {
    if (!isRunning) {
      document.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"));
      if (curIndex.current == "") {
        curIndex.current = sentences[0].words[0].id;
      }
      const { controller: c } = markAsRead(sentences, wordsPerMinute.current, 200, curIndex.current);
      controller.current = c;
      setMinutesRemaining(c.minutesRemaining);
      // timer.current = window.setInterval(() => {
      //   setMinutesRemaining(minutesRemaining - 0.5);
      // }, 500);
    } else {
      // if (timer.current) {
      //   window.clearInterval(timer.current);
      // }
      controller.current?.stop();
      curIndex.current = controller.current?.curIndex || "";
    }
    setIsRunning(!isRunning);
    isRunningRef.current = !isRunning;
  }, [setIsRunning, isRunning, setMinutesRemaining]);

  const updateWordsPerMinute = (e: React.ChangeEvent<HTMLInputElement>) => {
    const wpm = parseFloat(e.target.value);
    if (!isNaN(wpm) && wpm > 0) {
      wordsPerMinute.current = wpm;
      setMinutesRemaining(numWords / wordsPerMinute.current);
    }
  };

  useEffect(() => {
    function wordClick(id: string) {
      return (e: any) => {
        console.log(id);
        if (isRunningRef.current) {
          controller.current?.stop();
          curIndex.current = id;
          setIsRunning(false);
        } else {
          curIndex.current = id;
        }
        document.getElementById(id)?.classList.add("selected");
      };
    }

    document.querySelectorAll(".word").forEach((el) => {
      (el as HTMLElement).ondblclick = wordClick(el.id);
    });
  }, []);

  //  xl:max-w-7xl
  return (
    <div className="grid h-full grid-cols-1 p-4 bg-gray-200 justify-items-center gap-y-4">
      <div className="fixed top-0 left-0 flex flex-col w-64 h-32 gap-4 p-8 bg-slate-200">
        <input
          className="px-4 py-2 text-lg bg-indigo-200 rounded-xl"
          placeholder={wordsPerMinute.current.toString()}
          onChange={updateWordsPerMinute}
        />
        <button className="px-4 py-2 text-lg bg-indigo-200 rounded-xl" onClick={onClick}>
          {!isRunning ? "Start" : "Pause"}
        </button>
        <div>Minutes Remaining: {Math.round(minutesRemaining)} minutes</div>
      </div>
      <div className="container bg-white border lg:max-w-5xl">
        <div className="p-10 prose max-w-none">
          {decoded && <h1>{decoded?.title}</h1>}
          {/* <div contentEditable={true}></div> */}
          {decoded && <div dangerouslySetInnerHTML={{ __html: html }} />}
        </div>
      </div>
    </div>
  );
};
