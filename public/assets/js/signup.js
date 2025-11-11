document.addEventListener("DOMContentLoaded", () => {
  const {
    getSearchParam,
    fetchFlow,
    renderFlowForm,
    handleFlowError,
    renderMessages,
    initApiFlow,
    submitFlow
  } = window.KratosHelpers;

  const formContainer = document.getElementById("form-container");
  const alertContainer = document.getElementById("flow-alerts");

  let activeFlow = null;
  const initialSearch = new URLSearchParams(window.location.search);

  function updateUrlWithFlow(flowId) {
    const url = new URL(window.location.href);
    url.searchParams.set("flow", flowId);
    window.history.replaceState({}, "", `${url.pathname}?${url.searchParams}`);
  }

  function restoreSubmitButton(button, originalText) {
    if (!button) return;
    if (!document.body.contains(button)) return;
    button.disabled = false;
    if (originalText !== undefined) {
      button.textContent = originalText;
    }
  }

  function serializeForm(form, submitter) {
    let formData;
    try {
      formData = submitter ? new FormData(form, submitter) : new FormData(form);
    } catch (error) {
      formData = new FormData(form);
      if (submitter?.name) {
        formData.append(submitter.name, submitter.value ?? "");
      }
    }
    const result = {};
    formData.forEach((value, key) => {
      if (key in result) {
        if (Array.isArray(result[key])) {
          result[key].push(value);
        } else {
          result[key] = [result[key], value];
        }
      } else {
        result[key] = value;
      }
    });
    return result;
  }

  function handleSuccessfulSubmission(result = {}) {
    const redirectTarget =
      result.redirect_browser_to ||
      activeFlow?.return_to ||
      getSearchParam("return_to") ||
      "/";

    window.location.href = redirectTarget;
  }

  function renderFlow(flow) {
    if (!flow) {
      return;
    }

    activeFlow = flow;
    if (flow.id) {
      updateUrlWithFlow(flow.id);
    }

    renderMessages(alertContainer, flow.ui?.messages ?? [], "danger");
    const form = renderFlowForm(formContainer, flow, "Create account");
    if (!form) {
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!activeFlow) {
        return;
      }

      const submitButton = event.submitter || form.querySelector('button[type="submit"]');
      const originalLabel = submitButton?.textContent;
      try {
        const payload = serializeForm(form, submitButton);

        if (submitButton?.name && !(submitButton.name in payload)) {
          payload[submitButton.name] = submitButton.value ?? "";
        }

        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = "Creating account...";
        }
        const result = await submitFlow("registration", activeFlow.id, payload, {
          action: activeFlow.ui?.action
        });

        if (result?.ui) {
          renderFlow(result);
          return;
        }

        handleSuccessfulSubmission(result);
      } catch (error) {
        if (error?.data?.ui) {
          renderFlow(error.data);
          return;
        }

        handleFlowError("registration", error, alertContainer, initializeFlow);
      } finally {
        restoreSubmitButton(submitButton, originalLabel);
      }
    });
  }

  async function loadExistingFlow(flowId) {
    try {
      const flow = await fetchFlow("registration", flowId);
      renderFlow(flow);
    } catch (error) {
      handleFlowError("registration", error, alertContainer, initializeFlow);
    }
  }

  async function initializeFlow() {
    const params = new URLSearchParams(initialSearch);
    params.delete("flow");

    try {
      const flow = await initApiFlow("registration", params);
      renderFlow(flow);
    } catch (error) {
      if (error?.data?.ui) {
        renderFlow(error.data);
        return;
      }
      handleFlowError("registration", error, alertContainer, initializeFlow);
    }
  }

  const existingFlowId = initialSearch.get("flow");
  if (existingFlowId) {
    loadExistingFlow(existingFlowId);
  } else {
    initializeFlow();
  }
});
