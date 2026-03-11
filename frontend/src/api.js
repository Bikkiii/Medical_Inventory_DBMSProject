const BASE = "http://localhost:3000/api";

export async function apiFetch(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.message || data.error || `HTTP ${res.status}`);
  return Array.isArray(data) ? data : (data.data ?? data);
}
