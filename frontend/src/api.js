// All backend calls go through here. The URL comes from .env,
// so moving to the cloud only means changing VITE_API_URL.
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// FastAPI sends errors as { detail: "message" } or, for validation
// errors, { detail: [{ msg: "..." }, ...] }. Turn either into one string.
function errorMessage(body, status) {
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail)) {
    return body.detail.map((e) => e.msg.replace(/^Value error, /, "")).join(" ");
  }
  return `Request failed with status ${status}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(body, response.status));
  return body;
}

export const getSession = () => request("/api/session");
export const drawNextTeam = () => request("/api/next", { method: "POST" });
export const resetSession = () => request("/api/reset", { method: "POST" });

export const createTeam = (team) =>
  request("/api/teams", { method: "POST", body: JSON.stringify(team) });

export const deleteTeam = (id) => request(`/api/teams/${id}`, { method: "DELETE" });

export const updateSettings = (settings) =>
  request("/api/settings", { method: "PUT", body: JSON.stringify(settings) });
