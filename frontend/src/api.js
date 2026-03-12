const BASE = "http://localhost:5000/api";

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  return data;
}

export async function apiPost(path, body) {
  return apiFetch(path, { method: "POST", body: JSON.stringify(body) });
}
export async function apiPut(path, body) {
  return apiFetch(path, { method: "PUT", body: JSON.stringify(body) });
}
export async function apiPatch(path, body = {}) {
  return apiFetch(path, { method: "PATCH", body: JSON.stringify(body) });
}
