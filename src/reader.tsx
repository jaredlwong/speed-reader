import React, { useEffect, useState } from "react";
import ReactDOM from 'react-dom/client';
import { sendReady, readerStream, Article } from "./messages";

// const styles = require("./reader.css");
import styles from './reader.css';

import { HighResolutionTimer } from "./timer";

interface ReaderArticle {
  numWords: number,
  html: string,
}

function parseHTML(html: string): ReaderArticle {
  const div = document.createElement('div');
  div.innerHTML = html;

  let id = 0;
  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
  const changes: { node: Text, parent: ParentNode | null, frag: DocumentFragment}[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentNode;
    // if (!parent || parent.nodeName === 'SCRIPT' || parent.nodeName === 'STYLE') {
    //   continue;
    // }

    const words = node.textContent?.split(/\b/);
    const frag = document.createDocumentFragment();
    words?.forEach((word) => {
      if (word.length === 0) {
        return;
      }
      const span = document.createElement('span');
      span.setAttribute('id', `word-${id}`);
      span.classList.add(styles.unread);
      span.textContent = word;
      frag.appendChild(span);
      id += 1;
    });
    changes.push({node, parent, frag});
  }
  for (const {node, parent, frag} of changes) {
    parent?.replaceChild(frag, node);
  }

  return { numWords: id, html: div.innerHTML };
}

function markAsRead(numWords: number) {
  function processElements(i: number) {
    if (i >= numWords) {
      return; // stop the recursion when we reach the end of the list
    }
  
    const elementId = `word-${i}`;
    const element = document.getElementById(elementId);
  
    element?.classList.remove(styles.unread);
    element?.classList.add(styles.read);
  
    setTimeout(() => {
      processElements(i + 1); // call the function again with the next element
    }, 50);
  }
  processElements(0);
}

const Reader: React.FC = () => {
  const [doc, setDoc] = useState<Article | null>(null);
  const [content, setContent] = useState<ReaderArticle | null>(null);

  // run only on first render
  useEffect(() => {
    readerStream.subscribe(([{ doc }, sender]) => {
      setDoc(doc);
      if (doc?.content) {
        const newContent = parseHTML(doc.content)
        setContent(newContent);
        markAsRead(newContent.numWords);
      }
    });

    sendReady();
  }, []);

      // {doc?.content && <div dangerouslySetInnerHTML={{ __html: doc.content }} />}
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {doc?.title && <h1>{doc.title}</h1>}
        {content && <div dangerouslySetInnerHTML={{ __html: content.html }} />}
      </div>
    </div>
  )
}

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <Reader />
  </React.StrictMode>
);