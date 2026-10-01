// Everything the app saves: settings, teams, and who has presented.
// Each change returns a new setup and stamps when it happened.

export const DEFAULT_SETTINGS = {
  title: "Final project presentations",
  presentationMinutes: 7,
  qaMinutes: 3,
  warningMinutes: 2,
  chime: true,
};

export const emptySetup = () => ({
  version: 1,
  settings: { ...DEFAULT_SETTINGS },
  teams: [],
  presentedIds: [],
  currentId: null,
  updatedAt: 0,
});

const touch = (setup) => ({ ...setup, updatedAt: Date.now() });

const newId = () =>
  crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function addTeam(setup, { name, project = "", members = [] }) {
  const teamName = name.trim();
  if (!teamName) throw new Error("Enter a team name.");
  if (setup.teams.some((t) => t.name.toLowerCase() === teamName.toLowerCase())) {
    throw new Error(`A team named "${teamName}" already exists.`);
  }
  const team = { id: newId(), name: teamName, project: project.trim(), members };
  return touch({ ...setup, teams: [...setup.teams, team] });
}

export function removeTeam(setup, id) {
  return touch({
    ...setup,
    teams: setup.teams.filter((t) => t.id !== id),
    presentedIds: setup.presentedIds.filter((x) => x !== id),
    currentId: setup.currentId === id ? null : setup.currentId,
  });
}

export function drawNextTeam(setup) {
  const waiting = setup.teams.filter((t) => !setup.presentedIds.includes(t.id));
  if (waiting.length === 0) throw new Error("Every team has presented. Reset the session to start over.");
  const pick = waiting[Math.floor(Math.random() * waiting.length)];
  return touch({ ...setup, presentedIds: [...setup.presentedIds, pick.id], currentId: pick.id });
}

export const resetProgress = (setup) => touch({ ...setup, presentedIds: [], currentId: null });

export const updateSettings = (setup, changes) => touch({ ...setup, settings: { ...setup.settings, ...changes } });

// Has the user changed anything compared to a fresh, empty setup?
export function hasChanges(setup) {
  return (
    setup.teams.length > 0 ||
    setup.presentedIds.length > 0 ||
    JSON.stringify(setup.settings) !== JSON.stringify(DEFAULT_SETTINGS)
  );
}

// Same content, ignoring when it was last changed
export const sameContent = (a, b) =>
  JSON.stringify({ ...a, updatedAt: 0 }) === JSON.stringify({ ...b, updatedAt: 0 });

// Data from localStorage or the server can't be trusted blindly: keep only valid
// parts, in a fixed shape, or return null if it isn't a setup at all.
export function sanitizeSetup(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.teams)) return null;
  const s = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
  const minutes = (value, fallback) => (Number.isInteger(value) && value >= 1 && value <= 60 ? value : fallback);
  const text = (value, fallback = "") => (typeof value === "string" ? value : fallback);

  const teams = raw.teams
    .filter((t) => t && typeof t.id === "string" && typeof t.name === "string" && t.name.trim())
    .map((t) => ({
      id: t.id,
      name: t.name,
      project: text(t.project),
      members: Array.isArray(t.members) ? t.members.filter((m) => typeof m === "string") : [],
    }));
  const ids = new Set(teams.map((t) => t.id));
  const presentedIds = Array.isArray(raw.presentedIds) ? raw.presentedIds.filter((id) => ids.has(id)) : [];

  return {
    version: 1,
    settings: {
      title: text(s.title, DEFAULT_SETTINGS.title),
      presentationMinutes: minutes(s.presentationMinutes, DEFAULT_SETTINGS.presentationMinutes),
      qaMinutes: minutes(s.qaMinutes, DEFAULT_SETTINGS.qaMinutes),
      warningMinutes: minutes(s.warningMinutes, DEFAULT_SETTINGS.warningMinutes),
      chime: typeof s.chime === "boolean" ? s.chime : DEFAULT_SETTINGS.chime,
    },
    teams,
    presentedIds,
    currentId: presentedIds.includes(raw.currentId) ? raw.currentId : null,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
  };
}
