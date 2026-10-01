import { useEffect } from "react";

// A short message at the bottom of the screen that hides itself after 8 seconds
export default function Notice({ text, onDone }) {
  useEffect(() => {
    if (!text) return;
    const timer = setTimeout(onDone, 8000);
    return () => clearTimeout(timer);
  }, [text, onDone]);

  if (!text) return null;
  return (
    <div className="notice" role="status">
      {text}
    </div>
  );
}
