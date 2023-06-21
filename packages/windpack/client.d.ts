interface ImportMetaEnv {
  readonly MODE: "development" | "production";
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ProcessEnv {
  readonly NODE_ENV: "development" | "production";
}

interface Process {
  readonly env: ProcessEnv;
}

declare const process: Process;

declare module '*.svg' {
  const svg: any;
  export default svg
}