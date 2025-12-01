document.addEventListener("DOMContentLoaded", async () => {
  const { startHydraLogin, handleOAuthCallback, renderMessages } = window.KratosHelpers;
  const { redirectToFlow, fetchSession, getHydraLoginRequest, acceptHydraLoginRequest, getSearchParam } =
    window.KratosHelpers;

  const alertContainer = document.getElementById("flow-alerts");
  const signInButton = document.getElementById("oauth-signin-btn");

  async function resolveHydraLoginChallenge() {
    const loginChallenge = getSearchParam("login_challenge");
    if (!loginChallenge) return false;

    try {
      const loginRequest = await getHydraLoginRequest(loginChallenge);
      if (loginRequest?.skip && loginRequest.subject) {
        const accepted = await acceptHydraLoginRequest(loginChallenge, loginRequest.subject);
        if (accepted?.redirect_to) {
          window.location.href = accepted.redirect_to;
          return true;
        }
      }

      const session = await fetchSession();
      if (!session) {
        redirectToFlow("login", { return_to: window.location.href });
        return true;
      }

      const subject = session.identity?.id || session.identity?.traits?.email;
      const accepted = await acceptHydraLoginRequest(loginChallenge, subject);
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

  if (signInButton) {
    signInButton.addEventListener("click", () => startHydraLogin());
  }
});
