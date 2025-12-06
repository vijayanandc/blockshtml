document.addEventListener("DOMContentLoaded", async () => {
  const {
    startHydraLogin,
    handleOAuthCallback,
    renderMessages,
    redirectToFlow,
    fetchSession,
    getHydraLoginRequest,
    acceptHydraLoginRequest,
    getSearchParam,
    fetchFlow,
    renderFlowForm,
    handleFlowError,
    getHydraConsentRequest,
    acceptHydraConsentRequest
  } = window.KratosHelpers;

  const alertContainer = document.getElementById("flow-alerts");
  const signInButton = document.getElementById("oauth-signin-btn");
  const formContainer = document.getElementById("form-container");
  const oauthContainer = document.getElementById("oauth-container");

  const flowId = getSearchParam("flow");
  const hasLoginChallenge = Boolean(getSearchParam("login_challenge"));
  const hasConsentChallenge = Boolean(getSearchParam("consent_challenge"));
  const hasHydraChallenge = hasLoginChallenge || hasConsentChallenge;
  const isPlainSignin = !flowId && !hasHydraChallenge;

  // Ensure only the relevant section is visible:
  // - Plain /signin: show Hydra CTA
  // - /signin?flow=... or Hydra challenges: hide Hydra CTA
  if (oauthContainer) {
    if (isPlainSignin) {
      oauthContainer.classList.remove("d-none");
      oauthContainer.style.display = "";
    } else {
      oauthContainer.classList.add("d-none");
      oauthContainer.style.display = "none";
    }
  }

  async function resolveHydraConsentChallenge() {
    const consentChallenge = getSearchParam("consent_challenge");
    if (!consentChallenge) return false;

    try {
      const consentRequest = await getHydraConsentRequest(consentChallenge);
      const accepted = await acceptHydraConsentRequest(consentChallenge, consentRequest, false);
      if (accepted?.redirect_to) {
        window.location.href = accepted.redirect_to;
        return true;
      }
    } catch (error) {
      renderMessages(
        alertContainer,
        [{ text: error.message || "Unable to continue the sign-in process." }],
        "warning"
      );
      return true;
    }

    return false;
  }

  // If Kratos redirected us here with a login flow,
  // render the login form and skip Hydra-specific handling.
  if (flowId && formContainer) {
    try {
      const flow = await fetchFlow("login", flowId);
      renderMessages(alertContainer, flow.ui?.messages ?? [], "danger");
      renderFlowForm(formContainer, flow, "Sign in");
    } catch (error) {
      handleFlowError("login", error, alertContainer);
    }
    return;
  }

  async function resolveHydraLoginChallenge() {
    const loginChallenge = getSearchParam("login_challenge");
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
        window.location.href = accepted.redirect_to;
        return true;
      }
    } catch (error) {
      renderMessages(
        alertContainer,
        [{ text: error.message || "Unable to continue the sign-in process." }],
        "warning"
      );
      return true;
    }

    return false;
  }

  try {
    const handled = await handleOAuthCallback();
    if (handled) {
      window.location.href = "/";
      return;
    }
  } catch (error) {
    renderMessages(alertContainer, [{ text: error.message || "Unable to complete sign-in." }], "warning");
  }

  const challengeHandled = await resolveHydraLoginChallenge();
  if (challengeHandled) {
    return;
  }

  const consentHandled = await resolveHydraConsentChallenge();
  if (consentHandled) {
    return;
  }

  if (signInButton && isPlainSignin) {
    signInButton.addEventListener("click", () => startHydraLogin());
  }
});
