// frontend/src/lib/api.js

export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

/** Lấy token lưu trữ (localStorage > sessionStorage) */
function token() {
  return (
    localStorage.getItem("bua_token") ||
    sessionStorage.getItem("bua_token") ||
    ""
  );
}

/**
 * request(path, { method, body, headers })
 * - Tự gắn Authorization nếu có token
 * - Tự set Content-Type cho JSON body
 * - ❗ Tắt cache cho GET bằng cache: 'no-store' (fix vụ 304 không thấy item mới)
 */
async function request(
  path,
  { method = "GET", body, headers = {} } = {}
) {
  const m = (method || "GET").toUpperCase();
  const isGet = m === "GET";

  const h = {
    Accept: "application/json",
    // thêm mấy header nhẹ để hạn chế cache từ proxy/browse
    ...(isGet ? { "Cache-Control": "no-cache", Pragma: "no-cache" } : {}),
    ...headers,
  };

  const t = token();
  if (t) h["Authorization"] = `Bearer ${t}`;
  if (body && !(body instanceof FormData)) h["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method: m,
    headers: h,
    body: body && !(body instanceof FormData) ? JSON.stringify(body) : body,
    // 🔥 FIX chính: không cho cache với GET để list luôn thấy dữ liệu mới
    cache: isGet ? "no-store" : "default",
  });

  if (!res.ok) {
    let msg = "";
    try {
      const j = await res.clone().json();
      msg = j?.message || j?.error || JSON.stringify(j);
    } catch {
      try {
        msg = await res.clone().text();
      } catch {
        /* ignore */
      }
    }
    // thêm mã lỗi cho dễ debug
    throw new Error(msg || `${res.status} ${res.statusText}`);
  }

  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

export const apiGet    = (p)         => request(p);
export const apiPost   = (p, body)   => request(p, { method: "POST", body });
export const apiPatch  = (p, body)   => request(p, { method: "PATCH", body });
export const apiDelete = (p)         => request(p, { method: "DELETE" });

export function useApi() {
  return { apiGet, apiPost, apiPatch, apiDelete };
}
