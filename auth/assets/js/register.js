document.addEventListener("DOMContentLoaded", async () => {
  const {
    getSearchParam,
    fetchFlow,
    renderFlowForm,
    handleFlowError,
    redirectToFlow,
    renderMessages,
    rememberLoginChallenge,
    getStoredLoginChallenge
  } = window.KratosHelpers;

  const flowId = getSearchParam("flow");
  const urlLoginChallenge = getSearchParam("login_challenge");
  if (urlLoginChallenge) {
    rememberLoginChallenge(urlLoginChallenge);
  }
  const loginChallenge = urlLoginChallenge || getStoredLoginChallenge();

  const formContainer = document.getElementById("form-container");
  const alertContainer = document.getElementById("flow-alerts");

  if (!flowId) {
    const options = {};
    if (loginChallenge) {
      options.return_to = `${window.location.origin}/signin?login_challenge=${encodeURIComponent(
        loginChallenge
      )}`;
    }
    redirectToFlow("registration", options);
    return;
  }

  try {
    const flow = await fetchFlow("registration", flowId);

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
    renderFlowForm(formContainer, flow, "Create account");
  } catch (error) {
    handleFlowError("registration", error, alertContainer);
  }
});
