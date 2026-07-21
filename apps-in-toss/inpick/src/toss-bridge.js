// Keep the Apps in Toss SDK's React 19 development types out of the React 18
// InPick application type graph. The web bridge itself is framework agnostic.
import {
  appLogin,
  checkoutPayment,
  closeView,
} from "@apps-in-toss/web-framework";

export { appLogin, closeView };

export function checkoutTossPay(payToken) {
  return checkoutPayment({ params: { payToken } });
}
