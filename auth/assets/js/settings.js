document.addEventListener("DOMContentLoaded", async () => {
  const { getSearchParam, fetchFlow, renderFlowForm, handleFlowError, redirectToFlow, renderMessages } =
    window.KratosHelpers;

  const flowId = getSearchParam("flow");
  const formContainer = document.getElementById("form-container");
  const alertContainer = document.getElementById("flow-alerts");

  if (!flowId) {
    redirectToFlow("settings");
    return;
  }

  try {
    const flow = await fetchFlow("settings", flowId);
    renderMessages(alertContainer, flow.ui?.messages ?? [], "danger");
    renderFlowForm(formContainer, flow, "Save changes");
  } catch (error) {
    handleFlowError("settings", error, alertContainer);
  }
});

