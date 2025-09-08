export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function token() {
  return localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token") || "";
}

async function request(path, { method="GET", body, headers={} } = {}) {
  const h = { "Accept":"application/json", ...headers };
  const t = token();
  if (t) h["Authorization"] = `Bearer ${t}`;
  if (body && !(body instanceof FormData)) h["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: h,
    body: body && !(body instanceof FormData) ? JSON.stringify(body) : body
  });

  if (!res.ok) {
    let msg;
    try { const j = await res.json(); msg = j.message || JSON.stringify(j); }
    catch { msg = await res.text(); }
    throw new Error(msg || res.statusText);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

export const apiGet    = (p)           => request(p);
export const apiPost   = (p, body)     => request(p, { method:"POST", body });
export const apiPatch  = (p, body)     => request(p, { method:"PATCH", body });
export const apiDelete = (p)           => request(p, { method:"DELETE" });

export function useApi(){ return { apiGet, apiPost, apiPatch, apiDelete }; }