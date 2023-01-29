import React, { useCallback, useEffect, useRef, useState } from "react";
import { Article } from "../messages";
import { base64UrlDecode } from "../shared/encoder";
import { useLocation } from "react-router-dom";

import tokenizer from "sbd";

import "./reader.css";
import { sentenceTimes } from "../shared/speeder";
import { convertToHumanReadable } from "../shared/utils";

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
    const sentences: string[] = tokenizer.sentences(text || "", {
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

interface WordProp {
  id: string;
  sentenceIndex: number;
  wordIndex: number;
  nextWordId?: string;
  endOfSentence: boolean;
}
class ReadController {
  private sentences: Sentence[];
  private wordsPerMinute: number;
  private pauseMs: number;
  private curIndex?: string;
  private sentenceTiming: number[];
  private isRunning: boolean;
  private wordProps: Map<string, WordProp>;
  private sentenceStartTime: number;
  private sentenceStartWord?: WordProp;
  private chunkSizeChars: number;

  constructor(sentences: Sentence[], wordsPerMinute: number, pauseMs: number, chunkSizeChars: number) {
    this.sentences = sentences;
    this.wordsPerMinute = wordsPerMinute;
    this.pauseMs = pauseMs;
    this.sentenceTiming = [];
    this.isRunning = false;
    this.updateSentenceTiming();
    this.wordProps = new Map<string, WordProp>();
    let lastWordProp: WordProp = { id: "", sentenceIndex: 0, wordIndex: 0, endOfSentence: true };
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      for (let j = 0; j < sentence.words.length; j++) {
        const word = sentence.words[j];
        lastWordProp.nextWordId = word.id;
        lastWordProp = {
          id: word.id,
          sentenceIndex: i,
          wordIndex: j,
          endOfSentence: j === sentence.words.length - 1,
        };
        this.wordProps.set(word.id, lastWordProp);
      }
    }
    this.sentenceStartTime = performance.now();
    if (this.curIndex) {
      this.sentenceStartWord = this.wordProps.get(this.curIndex);
    }
    this.chunkSizeChars = chunkSizeChars;
    this.curIndex = sentences[0].words[0].id;
  }

  public setWordsPerMinute(wordsPerMinute: number) {
    this.wordsPerMinute = wordsPerMinute;
    this.updateSentenceTiming();
  }

  public setPauseMs(pauseMs: number) {
    this.pauseMs = pauseMs;
    this.updateSentenceTiming();
  }

  public setCurIndex(curIndex: string) {
    this.curIndex = curIndex;
    this.sentenceStartTime = performance.now();
    this.sentenceStartWord = this.wordProps.get(this.curIndex);
    let haveSeenIndex = false;
    document.querySelectorAll(`.word`).forEach(function (element) {
      if (haveSeenIndex) {
        element.classList.remove("read");
        element.classList.add("unread");
      }
      if (element.id === curIndex) {
        haveSeenIndex = true;
      }
    });
  }

  public setChunkSizeChars(chunkSizeChars: number) {
    this.chunkSizeChars = chunkSizeChars;
  }

  private updateSentenceTiming() {
    this.sentenceTiming = sentenceTimes(
      this.sentences.map((s) => s.words.length),
      this.wordsPerMinute,
      this.pauseMs,
    );
  }

  public stop() {
    this.isRunning = false;
  }

  public start() {
    this.isRunning = true;
    // do some common setup, like marking stuff unread
    if (this.curIndex) {
      this.setCurIndex(this.curIndex);
    }
    this.markAsRead();
  }

  public running(): boolean {
    return this.isRunning;
  }

  private getWordLength(word: WordProp): number {
    return this.sentences[word.sentenceIndex].words[word.wordIndex].text.length;
  }

  private async markAsRead() {
    for (;;) {
      if (!this.isRunning || !this.curIndex) {
        break;
      }
      const startWord = this.wordProps.get(this.curIndex);
      console.log(`cur word: ${JSON.stringify(startWord)}`);
      if (!startWord) {
        break;
      }
      const sentenceStartWord = this.sentenceStartWord ?? startWord;
      const sentence = this.sentences[startWord.sentenceIndex];
      const timing = this.sentenceTiming[startWord.sentenceIndex];
      const msPerWord = timing / sentence.words.length;
      const words: WordProp[] = [startWord];
      let endWord = startWord;
      // 1 for ending space
      let totalChars = this.getWordLength(startWord) + 1;
      while (totalChars < this.chunkSizeChars && !endWord.endOfSentence && endWord.nextWordId) {
        const nextWord = this.wordProps.get(endWord.nextWordId);
        if (!nextWord) {
          break;
        }
        if (totalChars + this.getWordLength(nextWord) <= this.chunkSizeChars) {
          words.push(nextWord);
          totalChars += this.getWordLength(nextWord) + 1;
          endWord = nextWord;
        } else {
          break;
        }
        if (!endWord.nextWordId) {
          break;
        }
      }
      for (const word of words) {
        const el = document.getElementById(word.id);
        el?.classList.remove("unread");
        el?.classList.add("read");
      }
      const now = performance.now();
      const elapsed = now - this.sentenceStartTime;
      let expected = msPerWord * (endWord.wordIndex - sentenceStartWord.wordIndex + 1);
      if (endWord.endOfSentence) {
        expected += this.pauseMs;
        this.sentenceStartTime = performance.now();
        if (endWord.nextWordId) {
          this.sentenceStartWord = this.wordProps.get(endWord.nextWordId);
        }
      }
      this.curIndex = endWord.nextWordId;
      // this needs to be at the end because otherwise variables become invalid due to possibly
      // being overwritten by other methods
      await sleep(expected - elapsed);
    }
  }

  public timeRemainingMs() {
    if (!this.curIndex) {
      return this.sentenceTiming.reduce((a, b) => a + b, 0);
    }
    const wordProp = this.wordProps.get(this.curIndex);
    if (!wordProp) {
      return this.sentenceTiming.reduce((a, b) => a + b, 0);
    }
    const timeRemaining =
      this.sentenceTiming[wordProp.sentenceIndex] *
      (1 - wordProp.wordIndex / this.sentences[wordProp.sentenceIndex].words.length);
    return timeRemaining + this.sentenceTiming.slice(wordProp.sentenceIndex + 1).reduce((a, b) => a + b, 0);
  }
}

export const Reader: React.FC = () => {
  const [isRunningState, setIsRunning] = useState(false);
  const wordsPerMinute = useRef<number>(450);
  // const timer = useRef<number | null>(null);

  const { search } = useLocation();
  const encoded = new URLSearchParams(search).get("doc");
  const decoded: Article | null = encoded ? (JSON.parse(base64UrlDecode(encoded)) as Article) : null;
  document.title = decoded?.title || "Reader";

  const { sentences, html } = parseHTML(decoded?.content || "");

  const numWords = sentences.map((s) => s.words.length).reduce((a, b) => a + b, 0);
  const [timeRemainingMs, setTimeRemainingMs] = useState<number>(numWords / wordsPerMinute.current);

  const controller = useRef<ReadController>(new ReadController(sentences, wordsPerMinute.current, 200, 9));

  const onClick = useCallback(async () => {
    setIsRunning((isRunning) => {
      if (!isRunning) {
        document.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"));
        controller.current.start();
        setTimeRemainingMs(controller.current.timeRemainingMs());
      } else {
        controller.current.stop();
      }
      return !isRunning;
    });
  }, []);

  const updateWordsPerMinute = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const wpm = parseFloat(e.target.value);
    if (!isNaN(wpm) && wpm > 0) {
      wordsPerMinute.current = wpm;
      controller.current.setWordsPerMinute(wpm);
      setTimeRemainingMs(controller.current.timeRemainingMs());
    }
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTimeRemainingMs(controller.current.timeRemainingMs());
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);

  // be able to click on a word to advance
  useEffect(() => {
    function wordClick(id: string) {
      return () => {
        setIsRunning((isRunning) => {
          if (isRunning) {
            controller.current.stop();
          }
          controller.current.setCurIndex(id);
          document.getElementById(id)?.classList.add("selected");
          return false;
        });
      };
    }

    const listeners: Array<[Element, () => void]> = [];
    document.querySelectorAll(".word").forEach((el) => {
      const listener = wordClick(el.id);
      listeners.push([el, listener]);
      (el as HTMLElement).addEventListener("dblclick", listener);
    });
    return () => {
      for (const [el, listener] of listeners) {
        (el as HTMLElement).removeEventListener("dblclick", listener);
      }
    };
  }, []);

  const spaceInfo = useRef<{ lastPress?: number; lastState?: "playing" | "paused" }>({});

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === " ") {
      event.preventDefault();
      spaceInfo.current = {
        lastPress: performance.now(),
        lastState: controller.current.running() ? "playing" : "paused",
      };
      controller.current.stop();
      setIsRunning(false);
    }
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (event.key === " ") {
      event.preventDefault();
      const now = performance.now();
      const elapsed = now - (spaceInfo.current.lastPress ?? now);
      if (elapsed <= 200 && spaceInfo.current.lastState === "playing") {
        controller.current.stop();
        setIsRunning(false);
      } else {
        controller.current.start();
        setIsRunning(true);
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

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
          {!isRunningState ? "Start" : "Pause"}
        </button>
        <div>Time Remaining: {convertToHumanReadable(timeRemainingMs)}</div>
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
