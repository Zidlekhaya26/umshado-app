declare module 'dom-to-image-more' {
  interface Options {
    width?: number;
    height?: number;
    style?: Record<string, string>;
    cacheBust?: boolean;
  }

  export const default: {
    toPng(node: HTMLElement, options?: Options): Promise<string>;
    toJpeg(node: HTMLElement, options?: Options): Promise<string>;
    toSvg(node: HTMLElement, options?: Options): Promise<string>;
  };
}
