declare namespace ReaderModuleCssNamespace {
  export interface IReaderModuleCss {
    article: string;
    container: string;
    content: string;
    read: string;
    sentence: string;
    sentence_boundary: string;
    unread: string;
    word: string;
  }
}

declare const ReaderModuleCssModule: ReaderModuleCssNamespace.IReaderModuleCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: ReaderModuleCssNamespace.IReaderModuleCss;
};

export = ReaderModuleCssModule;
