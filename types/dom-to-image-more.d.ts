declare module 'dom-to-image-more' {
  interface Options {
    width?: number;
    height?: number;
    style?: Record<string, string>;
    cacheBust?: boolean;
  }

  namespace domToImage {
    function toPng(node: HTMLElement, options?: Options): Promise<string>;
    function toJpeg(node: HTMLElement, options?: Options): Promise<string>;
    function toSvg(node: HTMLElement, options?: Options): Promise<string>;
  }

  export default domToImage;
}
