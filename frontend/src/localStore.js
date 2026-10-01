import { sanitizeSetup } from "./setup";

// Saves the setup in this browser so it survives refreshes and closed tabs.
// `owner` is the signed-in account it belongs to, or null when signed out.
const KEY = "presentation-randomizer:v1";

export function loadLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    const setup = sanitizeSetup(raw?.setup);
    if (!setup) return null;
    return { owner: typeof raw.owner === "string" ? raw.owner : null, setup };
  } catch {
    return null;
  }
}

export function saveLocal(owner, setup) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ owner, setup }));
  } catch {
    // Storage is full or blocked (some private windows). The app still works for this visit.
  }
}

export function clearLocal() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear
  }
}
