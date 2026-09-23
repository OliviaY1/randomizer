import { useState } from "react";

const isValidMinutes = (n) => Number.isInteger(n) && n >= 1 && n <= 60;

export default function TimerSettings({ settings, onSave, onCancel }) {
  const [presentation, setPresentation] = useState(String(settings.presentationMinutes));
  const [qa, setQa] = useState(String(settings.qaMinutes));
  const [chime, setChime] = useState(settings.chime);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const presentationMinutes = Number(presentation);
    const qaMinutes = Number(qa);
    if (!isValidMinutes(presentationMinutes) || !isValidMinutes(qaMinutes)) {
      return setError("Enter whole minutes between 1 and 60.");
    }

    setSaving(true);
    setError("");
    try {
      await onSave({ presentationMinutes, qaMinutes, chime });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="timer-settings" onSubmit={handleSubmit} noValidate>
      <div className="timer-settings__fields">
        <label>
          Presentation
          <span className="timer-settings__minutes">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="60"
              value={presentation}
              onChange={(e) => setPresentation(e.target.value)}
              autoFocus
            />
            min
          </span>
        </label>
        <label>
          Q&A
          <span className="timer-settings__minutes">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="60"
              value={qa}
              onChange={(e) => setQa(e.target.value)}
            />
            min
          </span>
        </label>
      </div>

      <label className="timer-settings__check">
        <input type="checkbox" checked={chime} onChange={(e) => setChime(e.target.checked)} />
        Play a chime at the {settings.warningMinutes}-minute warning and when time is up
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={saving}>
          Save settings
        </button>
        <button type="button" className="btn btn--quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
