import React, { useRef } from "react";
import { Article } from "../messages";
import { base64UrlEncode } from "../shared/encoder";
import sanitize from "sanitize-html";
import { Readability } from "@mozilla/readability";

function createArticleDocument(html: string) {
  const documentClone = document.cloneNode(true) as Document;
  documentClone.body.innerHTML = `<article>${html}</article>`;
  return documentClone;
}

export const Paste: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);

  const onClick = async () => {
    const content = ref.current?.innerHTML;
    const sanitized = sanitize(content ?? "", { allowedTags: false });
    const articleDoc = createArticleDocument(sanitized ?? "");

    // const article = new Readability(articleDoc).parse();
    const article: Article = { content: sanitized ?? "" };

    const encoded = base64UrlEncode(JSON.stringify(article));
    await chrome.tabs.create({
      url: `chrome-extension://${chrome.runtime.id}/app.html#/reader?doc=${encoded}`,
    });
  };

  return (
    <div className="grid h-full grid-cols-1 p-4 bg-gray-200 justify-items-center gap-y-4">
      <div className="fixed top-0 left-0 flex flex-col w-64 h-32 gap-4 p-8 bg-slate-200">
        <button className="px-4 py-2 text-lg bg-indigo-200 rounded-xl" onClick={onClick}>
          Convert
        </button>
      </div>
      <div className="container bg-white border lg:max-w-5xl">
        <div ref={ref} contentEditable={true}></div>
      </div>
    </div>
  );
};
