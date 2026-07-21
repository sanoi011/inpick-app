export function appLogin(): Promise<{
  authorizationCode: string;
  referrer: "DEFAULT" | "SANDBOX";
}>;

export function closeView(): Promise<void>;
