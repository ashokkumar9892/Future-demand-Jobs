/// <reference types="vite/client" />

/** Injected by vite.config.ts. True when the SPA runs without a .NET API. */
declare const __DEMO_MODE__: boolean;

declare module '@seed/*.json' {
  const value: unknown;
  export default value;
}
