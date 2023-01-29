declare module "sbd" {
  export type UserOptions = {
    newline_boundaries?: boolean;
    html_boundaries?: boolean;
    html_boundaries_tags?: string[];
    sanitize?: boolean;
    allowed_tags?: boolean;
    preserve_whitespace?: boolean;
    abbreviations?: string;
  };

  export function sentences(text: string, user_options: UserOptions): string[];
}
