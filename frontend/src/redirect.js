// Runs inside the sign-in popup after Microsoft sends the user back.
// It passes the result to the main window, which then closes the popup.
import { broadcastResponseToMainFrame } from "@azure/msal-browser/redirect-bridge";

broadcastResponseToMainFrame().catch(() => {
  // Opened directly (not as a sign-in popup): nothing to pass back
});
