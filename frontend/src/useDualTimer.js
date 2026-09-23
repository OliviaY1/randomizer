import { useCallback, useEffect, useRef, useState } from "react";

// Phases: "idle" -> "presentation" -> "qa" -> "done"
// The clock is based on a target end time, not on counting ticks,
// so it stays accurate even if the browser delays the interval.
export function useDualTimer({ presentationMs, qaMs, warningMs, onWarning, onPhaseEnd }) {
  const [phase, setPhase] = useState("idle");
  const [endTime, setEndTime] = useState(null); // null means paused or stopped
  const [remaining, setRemaining] = useState(presentationMs);
  const [scrubbing, setScrubbing] = useState(false); // true while dragging the bar

  // Time left at the last update, used to detect crossing the warning line
  const lastLeft = useRef(presentationMs);

  // Keep the latest callbacks without restarting the interval
  const callbacks = useRef({ onWarning, onPhaseEnd });
  useEffect(() => {
    callbacks.current = { onWarning, onPhaseEnd };
  });

  const total = phase === "qa" ? qaMs : presentationMs;

  useEffect(() => {
    // Don't tick while the bar is being dragged, so dragging to 0
    // can't jump into the next phase until the mouse is released
    if (endTime === null || scrubbing) return;
    let finished = false;

    const tick = () => {
      if (finished) return;
      const left = endTime - Date.now();

      if (phase === "presentation" && lastLeft.current > warningMs && left <= warningMs && left > 0) {
        callbacks.current.onWarning?.();
      }
      lastLeft.current = left;

      if (left > 0) {
        setRemaining(left);
        return;
      }

      finished = true;
      callbacks.current.onPhaseEnd?.(phase);
      if (phase === "presentation") {
        // Presentation is over: Q&A starts automatically
        lastLeft.current = qaMs;
        setPhase("qa");
        setEndTime(Date.now() + qaMs);
        setRemaining(qaMs);
      } else {
        setPhase("done");
        setEndTime(null);
        setRemaining(0);
      }
    };

    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [endTime, phase, qaMs, warningMs, scrubbing]);

  const start = useCallback(() => {
    lastLeft.current = presentationMs;
    setPhase("presentation");
    setEndTime(Date.now() + presentationMs);
    setRemaining(presentationMs);
  }, [presentationMs]);

  const pause = useCallback(() => {
    if (endTime === null) return;
    setRemaining(Math.max(endTime - Date.now(), 0));
    setEndTime(null);
  }, [endTime]);

  const resume = useCallback(() => {
    lastLeft.current = remaining;
    setEndTime(Date.now() + remaining);
  }, [remaining]);

  const startQA = useCallback(() => {
    lastLeft.current = qaMs;
    setPhase("qa");
    setEndTime(Date.now() + qaMs);
    setRemaining(qaMs);
  }, [qaMs]);

  const reset = useCallback(() => {
    lastLeft.current = presentationMs;
    setPhase("idle");
    setEndTime(null);
    setRemaining(presentationMs);
  }, [presentationMs]);

  // Jump to a new amount of time left (from dragging the bar)
  const seek = useCallback(
    (ms) => {
      const clamped = Math.min(Math.max(ms, 0), total);
      lastLeft.current = clamped;
      setRemaining(clamped);
      if (endTime !== null) setEndTime(Date.now() + clamped);
    },
    [endTime, total]
  );

  const startScrub = useCallback(() => {
    setScrubbing(true);
    const stop = () => {
      setScrubbing(false);
      // Continue counting from exactly where the bar was let go
      setEndTime((end) => (end === null ? null : Date.now() + lastLeft.current));
    };
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  }, []);

  const progress = phase === "done" ? 0 : Math.min(remaining / total, 1);

  return {
    phase,
    remaining,
    total,
    progress,
    running: endTime !== null,
    isWarning: phase === "presentation" && remaining <= warningMs,
    start,
    pause,
    resume,
    startQA,
    reset,
    seek,
    startScrub,
  };
}
