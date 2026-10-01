const SAVE_LABELS = {
  idle: "",
  saving: "Saving…",
  saved: "Saved to your account",
  error: "Couldn't save. Retrying…",
};

function MicrosoftLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export default function AuthBar({ status, account, saveState, error, onSignIn, onSignOut }) {
  if (status === "local-only") return null;

  let content;
  if (status === "signed-in") {
    content = (
      <>
        <span className="auth__user" title={account.username}>
          {account.name || account.username}
        </span>
        <span className={`auth__save auth__save--${saveState}`} role="status">
          {SAVE_LABELS[saveState]}
        </span>
        <button className="btn btn--quiet btn--small" onClick={onSignOut}>
          Sign out
        </button>
      </>
    );
  } else if (status === "checking" || status === "loading") {
    content = (
      <span className="auth__muted" role="status">
        {status === "checking" ? "Checking sign-in…" : "Loading your saved setup…"}
      </span>
    );
  } else {
    content = (
      <button className="btn btn--small btn--ms" onClick={onSignIn} disabled={status === "signing-in"}>
        <MicrosoftLogo />
        {status === "signing-in" ? "Signing in…" : "Sign in with Microsoft"}
      </button>
    );
  }

  return (
    <div className="auth">
      <div className="auth__row">{content}</div>
      {error && (
        <p className="auth__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
