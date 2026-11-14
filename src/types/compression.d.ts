declare module 'compression' {
  import { RequestHandler } from 'express';

  interface CompressionOptions {
    threshold?: number | string;
    level?: number;
    filter?: RequestHandler;
  }

  function compression(options?: CompressionOptions): RequestHandler;
  export default compression;
}
