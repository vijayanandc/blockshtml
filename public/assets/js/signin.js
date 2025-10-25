document.addEventListener("DOMContentLoaded", async () => {
  const { getSearchParam, fetchFlow, renderFlowForm, handleFlowError, redirectToFlow, renderMessages } = window.KratosHelpers;

  const flowId = getSearchParam("flow");
  const formContainer = document.getElementById("form-container");
  const alertContainer = document.getElementById("flow-alerts");

  if (!flowId) {
    redirectToFlow("login");
    return;
  }

  try {
    const flow = await fetchFlow("login", flowId);
    renderMessages(alertContainer, flow.ui?.messages ?? [], "danger");
    renderFlowForm(formContainer, flow, "Sign in");
  } catch (error) {
    handleFlowError("login", error, alertContainer);
  }
});
