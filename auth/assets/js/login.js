document.addEventListener("DOMContentLoaded", async () => {
  const {
    getSearchParam,
    fetchFlow,
    renderFlowForm,
    handleFlowError,
    renderMessages,
    redirectToFlow,
    fetchSession,
    getHydraLoginRequest,
    acceptHydraLoginRequest,
    getHydraConsentRequest,
    acceptHydraConsentRequest,
    rememberLoginChallenge,
    getStoredLoginChallenge,
    clearStoredLoginChallenge
  } = window.KratosHelpers;

  const alertContainer = document.getElementById("flow-alerts");
  const formContainer = document.getElementById("form-container");

  const flowId = getSearchParam("flow");
  const urlLoginChallenge = getSearchParam("login_challenge");
  if (urlLoginChallenge) {
    rememberLoginChallenge(urlLoginChallenge);
  }
  const loginChallenge = urlLoginChallenge || getStoredLoginChallenge();

  // Preserve the login challenge when navigating to registration or recovery
  // so that, after completing those flows, we can continue the original sign-in.
  if (loginChallenge) {
    const registerLink = document.querySelector('a[href="/register"]');
    if (registerLink) {
      registerLink.href = `/register?login_challenge=${encodeURIComponent(loginChallenge)}`;
    }

    const recoveryLink = document.querySelector('a[href="/recovery"]');
    if (recoveryLink) {
      recoveryLink.href = `/recovery?login_challenge=${encodeURIComponent(loginChallenge)}`;
    }
  }

  async function resolveConsentChallenge() {
    const consentChallenge = getSearchParam("consent_challenge");
    if (!consentChallenge) return false;

    try {
      const consentRequest = await getHydraConsentRequest(consentChallenge);
      const accepted = await acceptHydraConsentRequest(consentChallenge, consentRequest, false);
      if (accepted?.redirect_to) {
        clearStoredLoginChallenge();
        window.location.href = accepted.redirect_to;
        return true;
      }
    } catch (error) {
      renderMessages(
        alertContainer,
        [{ text: error.message || "Unable to continue. Please try again." }],
        "warning"
      );
      return true;
    }

    return false;
  }

  async function resolveLoginChallenge() {
    if (!loginChallenge) return false;

    try {
      const session = await fetchSession();
      if (!session) {
        redirectToFlow("login", { return_to: window.location.href });
        return true;
      }

      const subject = session.identity?.id || session.identity?.traits?.email;
      const loginRequest = await getHydraLoginRequest(loginChallenge);
      const accepted = await acceptHydraLoginRequest(loginChallenge, subject, Boolean(loginRequest?.skip));
      if (accepted?.redirect_to) {
        clearStoredLoginChallenge();
        window.location.href = accepted.redirect_to;
        return true;
      }
    } catch (error) {
      renderMessages(
        alertContainer,
        [{ text: error.message || "Unable to continue. Please try again." }],
        "warning"
      );
      return true;
    }

    return false;
  }

  // If we have a login flow, render the form and stop.
  if (flowId && formContainer) {
    try {
      const flow = await fetchFlow("login", flowId);

      // If this login flow was initiated as part of a client sign-in,
      // the original redirect URL (including any login challenge) is
      // available as "return_to" on the flow. Persist that information
      // so that, even after a refresh, we can continue the sign-in
      // and send the user back to the correct client callback.
      if (flow && typeof flow.return_to === "string") {
        try {
          const rtUrl = new URL(flow.return_to);
          const challengeFromReturnTo = rtUrl.searchParams.get("login_challenge");
          if (challengeFromReturnTo) {
            rememberLoginChallenge(challengeFromReturnTo);
          }
        } catch {
          // ignore parsing errors
        }
      }

      renderMessages(alertContainer, flow.ui?.messages ?? [], "danger");
      renderFlowForm(formContainer, flow, "Sign in");
    } catch (error) {
      handleFlowError("login", error, alertContainer);
    }
    return;
  }

  const loginHandled = await resolveLoginChallenge();
  if (loginHandled) {
    return;
  }

  const consentHandled = await resolveConsentChallenge();
  if (consentHandled) {
    return;
  }

  // Fallback: if the user is not signed in, start a fresh login flow.
  // If a session already exists and there is no challenge, avoid looping and
  // simply show an informational message.
  try {
    const session = await fetchSession();
    if (!session) {
      redirectToFlow("login", { return_to: window.location.href });
      return;
    }

    renderMessages(
      alertContainer,
      [{ text: "You are already signed in. You can close this window." }],
      "info"
    );
  } catch (error) {
    renderMessages(
      alertContainer,
      [{ text: "We couldn't check your session. Please try again later." }],
      "warning"
    );
  }
});
