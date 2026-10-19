import { appConfig } from "../config/app";
import { request } from "./client";

export type PaymentSubscription = {
  planId: string;
  status: "active" | "expired";
  startsAt: string;
  endsAt: string;
};
export type PaymentPlan = {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  description: string;
  features: string[];
};
export type PaymentTransaction = {
  id: string;
  reference: string;
  purpose: "rent" | "subscription";
  invoiceId?: string;
  planId?: string;
  ownerId: string;
  payerId: string;
  amount: number;
  status: "pending" | "succeeded" | "failed" | "expired";
  createdAt: string;
  expiresAt: string;
  paidAt?: string;
  responseCode?: string;
  bankCode?: string;
  transactionNo?: string;
};
export type PaymentCatalog = {
  sandbox: true;
  enabled: boolean;
  reason?: string;
  plans: PaymentPlan[];
  subscription: PaymentSubscription | null;
  merchant: { scope: "platform"; note: string };
};
export type PaymentHistoryResult = {
  transactions: PaymentTransaction[];
  subscription: PaymentSubscription | null;
};
export type PaymentDetail = {
  transaction: PaymentTransaction;
  invoice?: { id: string; period: string; roomName: string };
  subscription: PaymentSubscription | null;
};
export type CheckoutInput =
  | { purpose: "rent"; invoiceId: string }
  | { purpose: "subscription"; planId: string };
export type PaymentCheckout = {
  transactionId: string;
  redirectUrl: string;
  expiresAt: string;
  sandbox: true;
};
function requireBackend() {
  if (appConfig.dataSource !== "api")
    throw new Error("Thanh toán cần kết nối backend và MySQL. Chế độ dữ liệu cục bộ chưa hỗ trợ VNPay.");
}
export const paymentApi = {
  catalog() {
    requireBackend();
    return request<PaymentCatalog>("/payments/catalog");
  },
  history() {
    requireBackend();
    return request<PaymentHistoryResult>("/payments/history");
  },
  transaction(id: string) {
    requireBackend();
    return request<PaymentDetail>(`/payments/transactions/${encodeURIComponent(id)}`);
  },
  async checkout(input: CheckoutInput, idempotencyKey = crypto.randomUUID()) {
    requireBackend();
    const options = {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    };
    try {
      return await request<PaymentCheckout>("/payments/checkout", options);
    } catch (error) {
      if (error instanceof TypeError || (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)))
        return request<PaymentCheckout>("/payments/checkout", options);
      throw error;
    }
  },
};

/** Keep the gateway allowlist aligned with the server; never navigate to an arbitrary API URL. */
export function redirectToVnpay(checkout: PaymentCheckout) {
  const target = new URL(checkout.redirectUrl);
  if (
    checkout.sandbox !== true ||
    target.protocol !== "https:" ||
    target.hostname !== "sandbox.vnpayment.vn" ||
    target.port || target.username || target.password ||
    !target.pathname.startsWith("/paymentv2/")
  ) throw new Error("Địa chỉ thanh toán Sandbox không hợp lệ. Vui lòng tải lại trang.");
  window.location.assign(target.href);
}
