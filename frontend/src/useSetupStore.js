import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSavedSetup, saveSetup } from "./api";
import { authEnabled, currentAccount, forgetAccount, getIdToken, isUserCancel, needsSignInAgain, signIn, signOut } from "./auth";
import { clearLocal, loadLocal, saveLocal } from "./localStore";
import { emptySetup, hasChanges, sameContent, sanitizeSetup } from "./setup";

export const REPLACED_NOTICE = "Loaded your saved setup. Changes made on this device before signing in were replaced.";

// Holds the setup and keeps it saved:
//   signed out -> this browser's localStorage
//   signed in  -> the user's account (and localStorage, as a copy)
//
// status: "local-only" (sign-in not configured), "checking", "signed-out",
//         "signing-in", "loading", "signed-in"
export function useSetupStore() {
  // A copy saved by a signed-in user stays hidden until we confirm they're still signed in
  const [startLocal] = useState(loadLocal);
  const [setup, setSetup] = useState(() =>
    startLocal && !startLocal.owner ? startLocal.setup : emptySetup()
  );
  const [status, setStatus] = useState(authEnabled ? "checking" : "local-only");
  const [account, setAccount] = useState(null);
  const [authError, setAuthError] = useState("");
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [notice, setNotice] = useState("");
  const [loadCount, setLoadCount] = useState(0); // goes up whenever a loaded setup replaces the current one
  const [retry, setRetry] = useState(0);

  const setupRef = useRef(setup);
  const ownerRef = useRef(null); // account id while signed in, else null
  const lastSynced = useRef(null); // JSON of the setup the server has
  const saveChain = useRef(Promise.resolve()); // saves run one at a time, in order

  useEffect(() => {
    setupRef.current = setup;
  }, [setup]);

  // Replace the whole setup with one loaded from somewhere else
  const replaceSetup = useCallback((next) => {
    setupRef.current = next;
    setSetup(next);
    setLoadCount((n) => n + 1);
  }, []);

  // Every edit goes through here and is copied to this browser immediately
  const commit = useCallback((next) => {
    setupRef.current = next;
    setSetup(next);
    saveLocal(ownerRef.current, next);
  }, []);

  // Connect to an account and decide which setup wins.
  //   fresh: the user just clicked "Sign in" (the notice may show)
  //   localCopy: this browser's copy of this same account's setup, if any
  const connect = useCallback(
    async (acc, { fresh, localCopy }) => {
      setStatus("loading");
      setAuthError("");
      const token = await getIdToken(acc);
      const saved = sanitizeSetup(await fetchSavedSetup(token));
      const current = localCopy ?? setupRef.current;

      let next;
      if (!saved) {
        // Nothing saved yet: what's on screen becomes the saved setup
        next = current;
        await saveSetup(token, next);
      } else if (localCopy && localCopy.updatedAt > saved.updatedAt) {
        // This browser has newer edits for this account that didn't reach the server
        next = localCopy;
        await saveSetup(token, next);
      } else {
        // The saved setup wins
        next = saved;
        if (fresh && hasChanges(current) && !sameContent(current, saved)) setNotice(REPLACED_NOTICE);
      }

      ownerRef.current = acc.homeAccountId;
      lastSynced.current = JSON.stringify(next);
      if (next !== setupRef.current) replaceSetup(next);
      saveLocal(acc.homeAccountId, next);
      setAccount(acc);
      setSaveState("saved");
      setStatus("signed-in");
    },
    [replaceSetup]
  );

  // On page load: is someone still signed in from last time?
  const started = useRef(false);
  useEffect(() => {
    if (!authEnabled || started.current) return;
    started.current = true;
    (async () => {
      const acc = await currentAccount().catch(() => null);
      if (!acc) {
        if (startLocal?.owner) clearLocal(); // left behind by a signed-in user
        setStatus("signed-out");
        return;
      }
      const localCopy = startLocal?.owner === acc.homeAccountId ? startLocal.setup : null;
      try {
        await connect(acc, { fresh: false, localCopy });
      } catch (err) {
        if (needsSignInAgain(err)) {
          await forgetAccount(acc).catch(() => {});
          clearLocal();
          setAuthError("Your sign-in expired. Sign in again to load your saved setup.");
        } else {
          setAuthError(`Couldn't load your saved setup: ${err.message} Refresh to try again.`);
        }
        setStatus("signed-out");
      }
    })();
  }, [connect, startLocal]);

  // While signed in, save each change to the account (after a short pause in typing)
  useEffect(() => {
    if (status !== "signed-in" || !account) return;
    const json = JSON.stringify(setup);
    if (json === lastSynced.current) return;
    setSaveState("saving");
    const timer = setTimeout(() => {
      saveChain.current = saveChain.current.then(async () => {
        try {
          const token = await getIdToken(account);
          await saveSetup(token, JSON.parse(json));
          lastSynced.current = json;
          if (JSON.stringify(setupRef.current) === json) setSaveState("saved");
        } catch {
          setSaveState("error");
          setTimeout(() => setRetry((n) => n + 1), 10000); // try again in 10 s
        }
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [setup, status, account, retry]);

  const signInNow = useCallback(async () => {
    setStatus("signing-in");
    setAuthError("");
    let acc;
    try {
      acc = await signIn();
    } catch (err) {
      setStatus("signed-out");
      if (!isUserCancel(err)) setAuthError(`Sign-in didn't finish: ${err.message}`);
      return;
    }
    try {
      await connect(acc, { fresh: true, localCopy: null });
    } catch (err) {
      await forgetAccount(acc).catch(() => {});
      setStatus("signed-out");
      setAuthError(`Signed in, but couldn't load your saved setup: ${err.message}`);
    }
  }, [connect]);

  const signOutNow = useCallback(async () => {
    const acc = account;
    // Send any change that hasn't been saved yet (give up after 2 s)
    const pending = JSON.stringify(setupRef.current);
    if (pending !== lastSynced.current) {
      const save = getIdToken(acc).then((token) => saveSetup(token, JSON.parse(pending)));
      await Promise.race([save, new Promise((resolve) => setTimeout(resolve, 2000))]).catch(() => {});
    }
    // Clear this browser so the class list isn't left on a shared computer
    ownerRef.current = null;
    lastSynced.current = null;
    clearLocal();
    replaceSetup(emptySetup());
    setAccount(null);
    setSaveState("idle");
    setStatus("signed-out");
    await signOut(acc);
  }, [account, replaceSetup]);

  const dismissNotice = useCallback(() => setNotice(""), []);

  return {
    setup,
    commit,
    loadCount,
    status,
    account,
    authError,
    saveState,
    notice,
    dismissNotice,
    signIn: signInNow,
    signOut: signOutNow,
  };
}
