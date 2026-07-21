export function appLogin(): Promise<{
  authorizationCode: string;
  referrer: "DEFAULT" | "SANDBOX";
}>;

export function closeView(): Promise<void>;

export function checkoutTossPay(payToken: string): Promise<{
  success: boolean;
  reason?: string;
}>;
