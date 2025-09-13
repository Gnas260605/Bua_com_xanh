// backend/src/lib/pay.momo.js
import crypto from "crypto";
import fetch from "node-fetch";

/** Tạo payUrl MoMo (Capture Wallet) */
export async function momoCreatePayment({
  amount,
  orderId,
  orderInfo,
  redirectUrl,
  ipnUrl,
  partnerCode,
  accessKey,
  secretKey,
  endpoint = "https://test-payment.momo.vn/v2/gateway/api/create",
}) {
  const requestId = `${partnerCode}-${Date.now()}`;
  const requestType = "captureWallet"; // hoặc "payWithMethod"
  const raw = [
    `accessKey=${accessKey}`,
    `amount=${amount}`,
    `extraData=`,
    `ipnUrl=${ipnUrl}`,
    `orderId=${orderId}`,
    `orderInfo=${orderInfo}`,
    `partnerCode=${partnerCode}`,
    `redirectUrl=${redirectUrl}`,
    `requestId=${requestId}`,
    `requestType=${requestType}`,
  ].join("&");
  const signature = crypto.createHmac("sha256", secretKey).update(raw).digest("hex");

  const body = {
    partnerCode,
    accessKey,
    requestId,
    amount,
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    requestType,
    extraData: "",
    lang: "vi",
    signature,
  };

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return await resp.json();
}

/** Xác minh chữ ký IPN MoMo */
export function momoVerifyIPN({ data, secretKey }) {
  const {
    partnerCode,
    accessKey,
    requestId,
    amount,
    orderId,
    orderInfo,
    orderType,
    transId,
    resultCode,
    message,
    payType,
    responseTime,
    extraData,
    signature,
  } = data;

  const raw = [
    `accessKey=${accessKey}`,
    `amount=${amount}`,
    `extraData=${extraData || ""}`,
    `message=${message}`,
    `orderId=${orderId}`,
    `orderInfo=${orderInfo}`,
    `orderType=${orderType || ""}`,
    `partnerCode=${partnerCode}`,
    `payType=${payType || ""}`,
    `requestId=${requestId}`,
    `responseTime=${responseTime}`,
    `resultCode=${resultCode}`,
    `transId=${transId}`,
  ].join("&");

  const sig = crypto.createHmac("sha256", secretKey).update(raw).digest("hex");
  return sig === signature;
}
