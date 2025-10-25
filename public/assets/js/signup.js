document.addEventListener("DOMContentLoaded", async () => {
  const { getSearchParam, fetchFlow, renderFlowForm, handleFlowError, redirectToFlow, renderMessages } = window.KratosHelpers;

  const flowId = getSearchParam("flow");
  const formContainer = document.getElementById("form-container");
  const alertContainer = document.getElementById("flow-alerts");

  if (!flowId) {
    redirectToFlow("registration");
    return;
  }

  try {
    const flow = await fetchFlow("registration", flowId);
    renderMessages(alertContainer, flow.ui?.messages ?? [], "danger");
    renderFlowForm(formContainer, flow, "Create account");
  } catch (error) {
    handleFlowError("registration", error, alertContainer);
  }
});
