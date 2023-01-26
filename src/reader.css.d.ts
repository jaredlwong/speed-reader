declare namespace ReaderCssNamespace {
  export interface IReaderCss {
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

declare const ReaderCssModule: ReaderCssNamespace.IReaderCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: ReaderCssNamespace.IReaderCss;
};

export = ReaderCssModule;
