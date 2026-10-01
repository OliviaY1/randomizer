import { useEffect, useState } from "react";
import {
  API_URL,
  createTeam,
  deleteTeam,
  drawNextTeam,
  getSession,
  resetSession,
  updateSettings,
} from "./api";
import AddTeamForm from "./AddTeamForm";
import Timer from "./Timer";
import "./App.css";

function RemoveButton({ team, onRemove, disabled }) {
  return (
    <button
      className="remove-btn"
      onClick={() => onRemove(team)}
      disabled={disabled}
      aria-label={`Remove ${team.name}`}
      title="Remove team"
    >
      ×
    </button>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Changing this key remounts the Timer, which resets it
  const [timerKey, setTimerKey] = useState(0);
  const resetTimer = () => setTimerKey((k) => k + 1);

  useEffect(() => {
    getSession()
      .then(setSession)
      .catch(() =>
        setError(`Can't reach the backend at ${API_URL}. Start it with "uvicorn main:app --reload", then refresh.`)
      );
  }, []);

  // For buttons: show any error in the sidebar
  async function run(action, onSuccess) {
    setBusy(true);
    setError("");
    try {
      setSession(await action());
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // For forms: let the error reach the form so it shows next to the fields
  async function save(action) {
    setBusy(true);
    try {
      setSession(await action());
    } finally {
      setBusy(false);
    }
  }

  const handleAdd = (team) => save(() => createTeam(team));

  const handleSaveSettings = async (settings) => {
    await save(() => updateSettings(settings));
    resetTimer();
  };

  const handleDraw = () => run(drawNextTeam, resetTimer);

  const handleRemove = (team) => {
    const isCurrent = team.id === session.currentId;
    const message = isCurrent
      ? `Remove ${team.name}? They're presenting now, so the timer will reset.`
      : `Remove ${team.name}?`;
    if (window.confirm(message)) {
      run(() => deleteTeam(team.id), isCurrent ? resetTimer : undefined);
    }
  };

  const handleReset = () => {
    if (window.confirm("Clear the presented list and start the session over?")) {
      run(resetSession, resetTimer);
    }
  };

  if (!session) {
    return (
      <main className="app app--message">
        <p>{error || "Loading teams…"}</p>
      </main>
    );
  }

  const { settings, teams, presentedIds, currentId } = session;
  const byId = Object.fromEntries(teams.map((t) => [t.id, t]));
  const current = currentId ? byId[currentId] : null;
  const waiting = teams.filter((t) => !presentedIds.includes(t.id));
  const finished = presentedIds.filter((id) => id !== currentId).map((id) => byId[id]);

  let drawLabel = current ? "Draw next team" : "Draw first team";
  if (teams.length === 0) drawLabel = "Add a team to start";
  else if (waiting.length === 0) drawLabel = "All teams have presented";

  return (
    <main className="app">
      <header className="topbar">
        <h1>{settings.title}</h1>
        <p className="topbar__count">
          {presentedIds.length} of {teams.length} teams called
        </p>
      </header>

      <section className="stage">
        <div className="current" aria-live="polite">
          {current ? (
            <>
              <p className="current__label">Now presenting</p>
              <h2 className="current__name" key={current.id}>
                {current.name}
              </h2>
              {current.project && <p className="current__project">{current.project}</p>}
              {current.members.length ? (
                <ul className="current__members">
                  {current.members.map((m, i) => (
                    <li key={`${m}-${i}`}>{m}</li>
                  ))}
                </ul>
              ) : (
                <p className="current__none">No members listed.</p>
              )}
              <button className="btn btn--quiet current__remove" onClick={() => handleRemove(current)} disabled={busy}>
                Remove this team
              </button>
            </>
          ) : (
            <>
              <p className="current__label">No team yet</p>
              <h2 className="current__name current__name--empty">Who's first?</h2>
              <p className="current__project">
                {teams.length ? "Draw a team to begin." : "Add your teams, then draw one to begin."}
              </p>
            </>
          )}
        </div>

        <Timer key={timerKey} settings={settings} disabled={!current} onSaveSettings={handleSaveSettings} />
      </section>

      <aside className="queue">
        <button className="btn btn--draw" onClick={handleDraw} disabled={busy || waiting.length === 0}>
          {drawLabel}
        </button>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="queue__group">
          <h3>Waiting ({waiting.length})</h3>
          {waiting.length ? (
            <ul>
              {waiting.map((t) => (
                <li key={t.id} className="queue__team">
                  <div className="queue__row">
                    <span>{t.name}</span>
                    <RemoveButton team={t} onRemove={handleRemove} disabled={busy} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="queue__empty">{teams.length ? "Everyone has been called." : "No teams yet."}</p>
          )}
        </div>

        <AddTeamForm onAdd={handleAdd} busy={busy} />

        <div className="queue__group">
          <h3>Done ({finished.length})</h3>
          {finished.length ? (
            <ol>
              {finished.map((t) => (
                <li key={t.id} className="queue__team queue__team--done">
                  <div className="queue__row">
                    <span>{t.name}</span>
                    <RemoveButton team={t} onRemove={handleRemove} disabled={busy} />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="queue__empty">No one yet.</p>
          )}
        </div>

        <button className="btn btn--quiet queue__reset" onClick={handleReset} disabled={busy || presentedIds.length === 0}>
          Reset session
        </button>
      </aside>
    </main>
  );
}
