import { useState } from "react";
import { playEndChime, playWarningChime, unlockAudio } from "./chime";
import TimerSettings from "./TimerSettings";
import { useDualTimer } from "./useDualTimer";

const toMs = (minutes) => minutes * 60 * 1000;

function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const PHASE_NAMES = {
  idle: "Presentation",
  presentation: "Presentation",
  qa: "Q&A",
  done: "Time's up",
};

export default function Timer({ settings, disabled, onSaveSettings }) {
  const { presentationMinutes, qaMinutes, warningMinutes, chime } = settings;
  const [editing, setEditing] = useState(false);

  const timer = useDualTimer({
    presentationMs: toMs(presentationMinutes),
    qaMs: toMs(qaMinutes),
    warningMs: toMs(warningMinutes),
    onWarning: () => chime && playWarningChime(),
    onPhaseEnd: () => chime && playEndChime(),
  });

  const isCounting = timer.phase === "presentation" || timer.phase === "qa";
  const mode = timer.isWarning ? "warning" : timer.phase;
  const plan = `${presentationMinutes} min presentation, then ${qaMinutes} min Q&A.`;

  let status;
  if (isCounting && !timer.running) status = "Paused. Drag the bar to change the time left.";
  else if (timer.phase === "idle") status = disabled ? `Draw a team to start. ${plan}` : plan;
  else if (timer.isWarning) status = "Time to wrap up. Q&A starts when this ends.";
  else if (timer.phase === "presentation") status = "Q&A starts automatically when this ends.";
  else if (timer.phase === "qa") status = "Questions from the audience.";
  else status = "Q&A is over. Draw the next team when ready.";

  // Starting from a click lets the browser play the chime later
  const handleStart = () => {
    unlockAudio();
    timer.start();
  };
  const handleResume = () => {
    unlockAudio();
    timer.resume();
  };

  return (
    <section className={`timer timer--${mode}`} aria-label="Timer">
      <div className="timer__head">
        <p className="timer__phase">{PHASE_NAMES[timer.phase]}</p>
        {timer.isWarning && (
          <p className="timer__badge" role="status">
            Final {warningMinutes} minutes
          </p>
        )}
      </div>

      <p className="timer__clock" role="timer">
        {formatTime(timer.remaining)}
      </p>

      <input
        type="range"
        className="timer__bar"
        min={0}
        max={Math.round(timer.total / 1000)}
        step={1}
        value={Math.ceil(timer.remaining / 1000)}
        disabled={!isCounting}
        style={{ "--fill": `${timer.progress * 100}%` }}
        onPointerDown={timer.startScrub}
        onChange={(e) => timer.seek(Number(e.target.value) * 1000)}
        aria-label="Time left"
        aria-valuetext={`${formatTime(timer.remaining)} left`}
        title={isCounting ? "Drag to change the time left" : undefined}
      />

      <p className="timer__status" aria-live="polite">
        {status}
      </p>

      {editing ? (
        <TimerSettings settings={settings} onSave={onSaveSettings} onCancel={() => setEditing(false)} />
      ) : (
        <div className="timer__controls">
          {timer.phase === "idle" && (
            <button className="btn btn--primary" onClick={handleStart} disabled={disabled}>
              Start presentation
            </button>
          )}
          {isCounting && (
            <button className="btn btn--primary" onClick={timer.running ? timer.pause : handleResume}>
              {timer.running ? "Pause" : "Resume"}
            </button>
          )}
          {timer.phase === "presentation" && (
            <button className="btn" onClick={timer.startQA}>
              Skip to Q&A
            </button>
          )}
          {timer.phase !== "idle" && (
            <button className="btn btn--quiet" onClick={timer.reset}>
              Reset timer
            </button>
          )}
          {!isCounting && (
            <button className="btn btn--quiet" onClick={() => setEditing(true)}>
              Timer settings
            </button>
          )}
        </div>
      )}
    </section>
  );
}
