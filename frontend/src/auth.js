import { InteractionRequiredAuthError, PublicClientApplication } from "@azure/msal-browser";

// Sign in with Microsoft. Without a client ID in .env, sign-in is turned off
// and the app works with this browser's storage only.
const clientId = import.meta.env.VITE_MSAL_CLIENT_ID;
export const authEnabled = Boolean(clientId);

// The popup returns to redirect.html, which hands the result back to the app
const redirectUri = `${window.location.origin}/redirect.html`;

const msal = authEnabled
  ? new PublicClientApplication({
      auth: {
        clientId,
        authority: "https://login.microsoftonline.com/common", // any Microsoft account
        redirectUri,
        postLogoutRedirectUri: redirectUri,
      },
      cache: { cacheLocation: "localStorage" }, // stay signed in until "Sign out"
    })
  : null;
const ready = msal ? msal.initialize() : Promise.resolve();

// Only basic sign-in info: no access to mail, files, or anything else
const SCOPES = ["openid", "profile", "email"];

export async function currentAccount() {
  if (!msal) return null;
  await ready;
  return msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;
}

export async function signIn() {
  await ready;
  const result = await msal.loginPopup({ scopes: SCOPES, prompt: "select_account" });
  msal.setActiveAccount(result.account);
  return result.account;
}

// The backend checks this token to know who is calling. Refresh it if it's
// about to expire, so a save never goes out with a stale token.
export async function getIdToken(account) {
  await ready;
  let result = await msal.acquireTokenSilent({ scopes: SCOPES, account });
  const expiresAt = (result.idTokenClaims?.exp ?? 0) * 1000;
  if (expiresAt < Date.now() + 5 * 60 * 1000) {
    result = await msal.acquireTokenSilent({ scopes: SCOPES, account, forceRefresh: true });
  }
  return result.idToken;
}

// Signs out of Microsoft too, so the next person on a shared computer can't reuse the session
export async function signOut(account) {
  await ready;
  try {
    await msal.logoutPopup({ account });
  } catch {
    await msal.clearCache({ account }); // popup blocked: at least forget the account here
  }
}

// Forget the account in this browser only (used when a sign-in has expired)
export async function forgetAccount(account) {
  await ready;
  await msal.clearCache({ account });
}

export const isUserCancel = (err) => err?.errorCode === "user_cancelled";
export const needsSignInAgain = (err) => err instanceof InteractionRequiredAuthError;
