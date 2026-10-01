// All backend calls go through here. The URL comes from .env,
// so moving to the cloud only means changing VITE_API_URL.
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// FastAPI sends errors as { detail: "message" } or, for validation
// errors, { detail: [{ msg: "..." }, ...] }. Turn either into one string.
function errorMessage(body, status) {
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail)) return body.detail.map((e) => e.msg).join(" ");
  return `Request failed with status ${status}`;
}

async function request(path, token, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
    });
  } catch {
    throw new Error(`Can't reach the server at ${API_URL}.`);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(body, response.status));
  return body;
}

// The signed-in user's saved setup, or null if they have none yet
export const fetchSavedSetup = (token) => request("/api/me/setup", token).then((body) => body.setup ?? null);

export const saveSetup = (token, setup) =>
  request("/api/me/setup", token, { method: "PUT", body: JSON.stringify(setup) });
