// Short beeps made with the Web Audio API, so no sound files are needed.
let audioContext = null;

// Browsers only allow sound after the user clicks something,
// so call this from a click handler (like the Start button).
export function unlockAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  audioContext ??= new AudioCtx();
  if (audioContext.state === "suspended") audioContext.resume();
}

function beep(frequency, delay, duration) {
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

// Two quick high beeps: "time to wrap up"
export function playWarningChime() {
  if (!audioContext) return;
  beep(880, 0, 0.25);
  beep(880, 0.35, 0.25);
}

// Two falling tones: "this part is over"
export function playEndChime() {
  if (!audioContext) return;
  beep(784, 0, 0.4);
  beep(523, 0.35, 0.7);
}
