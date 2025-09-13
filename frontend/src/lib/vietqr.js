// frontend/src/lib/vietqr.js
export function buildVietQR({ bank="", account="", name="", amount, memo, template="qr_only" } = {}) {
  if (!bank || !account) return "";
  const qs = new URLSearchParams();
  if (name) qs.set("accountName", name);
  if (amount && Number(amount) > 0) qs.set("amount", String(Number(amount)));
  if (memo) qs.set("addInfo", memo);
  return `https://img.vietqr.io/image/${encodeURIComponent(bank)}-${encodeURIComponent(account)}-${template}.png?${qs.toString()}`;
}
