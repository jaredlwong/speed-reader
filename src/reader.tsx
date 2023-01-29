import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { sendReady, readerStream, Article } from "./messages";

// const styles2 = require("./reader.module.css");
import styles from "./reader.module.css";

// var styles = {
//   container: 'container',
//   unread: 'unread ',
//   read: 'read ',
//   sentence: 'sentence ',
//   word: 'word ',
//   sentence_boundary: 'sentence_boundary ',
//   content: 'content ',
//   article: 'article ',
// }

import { HighResolutionTimer } from "./timer";

import tokenizer from "sbd";

interface ReaderArticle {
  numWords: number;
  html: string;
}

function computeTimings(wpm: number, sentences: string[][], pauseTime: number): number[] {
  let totalTime = 0;
  const timings: number[] = [];
  const totalPauseTime = pauseTime * (sentences.length - 1);
  const wordsPerMinuteIncludingPauses = wpm - totalPauseTime / 60000;

  for (const sentence of sentences) {
    for (const word of sentence) {
      totalTime += 60000 / wordsPerMinuteIncludingPauses;
      timings.push(totalTime);
    }
    totalTime += pauseTime;
  }

  return timings;
}

function parseHTML(html: string): ReaderArticle {
  const div = document.createElement("div");
  div.innerHTML = html;

  // nytimes
  div.querySelectorAll('div[data-testid="placeholder"]').forEach((el) => {
    el.remove();
  });

  let id = 0;
  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
  const changes: { node: Text; parent: ParentNode | null; frag: DocumentFragment }[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentNode;
    // if (!parent || parent.nodeName === 'SCRIPT' || parent.nodeName === 'STYLE') {
    //   continue;
    // }

    const text = node.textContent;
    const sentences: string[] = tokenizer.sentences(text || "", {
      preserve_whitespace: true,
    });
    const frag = document.createDocumentFragment();
    for (const sentence of sentences) {
      const sentenceSpan = document.createElement("span");
      sentenceSpan.classList.add(styles.sentence);

      const words = sentence.split(/(\s+)/);
      words?.forEach((word) => {
        if (word.length === 0) {
          return;
        }
        if (word.trim().length === 0) {
          // const span = document.createElement('span');
          // span.textContent = word;
          // frag.appendChild(span);

          // frag.appendChild(document.createTextNode(word));

          sentenceSpan.appendChild(document.createTextNode(word));
        } else {
          const span = document.createElement("span");
          span.setAttribute("id", `word-${id}`);
          span.classList.add(styles.unread);
          span.classList.add(styles.word);
          span.textContent = word;

          sentenceSpan.appendChild(span);

          // frag.appendChild(span);

          id += 1;
        }
      });

      const span = document.createElement("span");
      span.classList.add(styles.sentence_boundary);
      sentenceSpan.appendChild(span);

      frag.appendChild(sentenceSpan);
      // frag.appendChild(document.createTextNode(' '));
    }
    changes.push({ node, parent, frag });
  }
  for (const { node, parent, frag } of changes) {
    parent?.replaceChild(frag, node);
  }

  return { numWords: id, html: div.innerHTML };
}

function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function convertWpmToMsw(wpm: number): number {
  // 1 minute = 60000 milliseconds
  const millisecondsPerMinute = 60000;
  // 1 word = 1/wpm minutes
  const minutesPerWord = 1 / wpm;
  // 1 word = (1/wpm) * 60000 milliseconds
  const millisecondsPerWord = minutesPerWord * millisecondsPerMinute;

  return millisecondsPerWord;
}

async function markAsRead(wordsPerMinute: number) {
  const msPerWord = convertWpmToMsw(wordsPerMinute);

  const elements = document.querySelectorAll(`.${styles.word}, .${styles.sentence_boundary}`);
  let wordsRead = 0;
  const startTime = performance.now() - msPerWord;
  for (const el of elements) {
    if (el.classList.contains(styles.sentence_boundary)) {
      await timeout(200);
    }
    if (el.classList.contains(styles.word)) {
      el.classList.remove(styles.unread);
      el.classList.add(styles.read);
      wordsRead += 1;
      const elapsed = performance.now() - startTime;
      const expected = wordsRead * msPerWord;
      const diff = expected - elapsed;
      console.log(diff);
      if (diff > 0) {
        await timeout(diff);
      }
      // await timeout(50);
    }
  }

  // function processElements(i: number) {
  //   if (i >= numWords) {
  //     return; // stop the recursion when we reach the end of the list
  //   }

  //   const elementId = `word-${i}`;
  //   const element = document.getElementById(elementId);

  //   element?.classList.remove(styles.unread);
  //   element?.classList.add(styles.read);

  //   setTimeout(() => {
  //     processElements(i + 1); // call the function again with the next element
  //   }, 50);
  // }
  // processElements(0);
}

const Reader: React.FC = () => {
  const [doc, setDoc] = useState<Article | null>(null);
  const [content, setContent] = useState<ReaderArticle | null>(null);

  // run only on first render
  useEffect(() => {
    readerStream.subscribe(([{ doc }, sender]) => {
      setDoc(doc);
      if (doc?.content) {
        const newContent = parseHTML(doc.content);
        setContent(newContent);
      }
    });

    sendReady();
  }, []);

  useEffect(() => {
    if (content?.html) {
      markAsRead(400);
    }
  }, [content]);

  // {doc?.content && <div dangerouslySetInnerHTML={{ __html: doc.content }} />}
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {doc?.title && <h1>{doc.title}</h1>}
        {content && <div dangerouslySetInnerHTML={{ __html: content.html }} />}
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <Reader />
  </React.StrictMode>,
);
