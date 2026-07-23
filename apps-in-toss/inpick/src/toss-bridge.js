// Keep the Apps in Toss SDK's React 19 development types out of the React 18
// InPick application type graph. The web bridge itself is framework agnostic.
import {
  IAP,
  appLogin,
  checkoutPayment,
  closeView,
} from "@apps-in-toss/web-framework";

export { appLogin, closeView };

export function checkoutTossPay(payToken) {
  return checkoutPayment({ params: { payToken } });
}

export function getIapProductItemList() {
  return IAP.getProductItemList();
}

export function createIapOneTimePurchaseOrder(params) {
  return IAP.createOneTimePurchaseOrder(params);
}

export function getPendingIapOrders() {
  return IAP.getPendingOrders();
}

export function completeIapProductGrant(orderId) {
  return IAP.completeProductGrant({ params: { orderId } });
}

export function getCompletedOrRefundedIapOrders(key) {
  return IAP.getCompletedOrRefundedOrders({ key: key ?? null });
}
