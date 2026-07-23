export function appLogin(): Promise<{
  authorizationCode: string;
  referrer: "DEFAULT" | "SANDBOX";
}>;

export function closeView(): Promise<void>;

export function checkoutTossPay(payToken: string): Promise<{
  success: boolean;
  reason?: string;
}>;

export type IapProductListItem = {
  sku: string;
  type: "CONSUMABLE" | "NON_CONSUMABLE" | "SUBSCRIPTION";
  displayAmount: string;
  displayName: string;
  iconUrl: string;
  description: string;
};

export type IapPurchaseSuccess = {
  orderId: string;
  displayName: string;
  displayAmount: string;
  amount: number;
  currency: string;
  fraction: number;
  miniAppIconUrl: string | null;
};

export function getIapProductItemList(): Promise<
  { products: IapProductListItem[] } | undefined
>;

export function createIapOneTimePurchaseOrder(input: {
  options: {
    sku: string;
    processProductGrant: (input: { orderId: string }) => boolean | Promise<boolean>;
  };
  onEvent: (event: {
    type: "success";
    data: IapPurchaseSuccess;
  }) => void | Promise<void>;
  onError: (error: unknown) => void | Promise<void>;
}): () => void;

export function getPendingIapOrders(): Promise<
  | {
      orders: Array<{
        orderId: string;
        sku: string;
        paymentCompletedDate?: string;
      }>;
    }
  | undefined
>;

export function completeIapProductGrant(
  orderId: string,
): Promise<boolean | undefined>;

export function getCompletedOrRefundedIapOrders(
  key?: string | null,
): Promise<
  | {
      hasNext: boolean;
      nextKey?: string | null;
      orders: Array<{
        orderId: string;
        sku: string;
        status: "COMPLETED" | "REFUNDED";
        date: string;
      }>;
    }
  | undefined
>;
