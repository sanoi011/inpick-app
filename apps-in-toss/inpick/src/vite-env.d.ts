interface ImportMeta {
  readonly env: {
    readonly DEV: boolean;
    readonly PROD: boolean;
    readonly MODE: string;
    readonly VITE_INPICK_TOSS_API_ORIGIN?: string;
  };
}
