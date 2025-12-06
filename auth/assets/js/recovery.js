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
    redirectToFlow("recovery", options);
    return;
  }

  try {
    const flow = await fetchFlow("recovery", flowId);

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

    const nodes = Array.isArray(flow.ui?.nodes) ? [...flow.ui.nodes] : [];

    // If a recovery code field is present, adjust the primary button label
    // so it is clear that the form submits the code instead of sending a new link.
    const hasCodeField = nodes.some((node) => {
      const name = node?.attributes?.name;
      return typeof name === "string" && name.toLowerCase().includes("code");
    });

    const submitLabel = hasCodeField ? "Continue" : "Send recovery link";

    // Filter out any "Resend code" submit actions which currently lead to an error.
    const filteredNodes = nodes.filter((node) => {
      const label = node?.meta?.label?.text;
      if (!label) return true;
      return label.trim().toLowerCase() !== "resend code";
    });

    const patchedFlow = {
      ...flow,
      ui: {
        ...(flow.ui || {}),
        nodes: filteredNodes
      }
    };

    renderFlowForm(formContainer, patchedFlow, submitLabel);
  } catch (error) {
    handleFlowError("recovery", error, alertContainer);
  }
});
