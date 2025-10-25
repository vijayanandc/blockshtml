const KRATOS_PUBLIC_URL = "http://127.0.0.1:4433";

function getSearchParam(name) {
  return new URL(window.location.href).searchParams.get(name);
}

function redirectToFlow(flowType, options = {}) {
  const params = new URLSearchParams(options);
  window.location.href = `${KRATOS_PUBLIC_URL}/self-service/${flowType}/browser${params.toString() ? `?${params}` : ""}`;
}

async function fetchFlow(flowType, flowId) {
  const url = new URL(`/self-service/${flowType}/flows`, KRATOS_PUBLIC_URL);
  url.searchParams.set("id", flowId);

  const response = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json"
    }
  });

  if (response.ok) {
    return response.json();
  }

  const error = new Error("Failed to fetch flow");
  error.status = response.status;
  try {
    error.data = await response.json();
  } catch (e) {
    error.data = null;
  }
  throw error;
}

function resolveVariant(messages, fallback) {
  const types = Array.from(new Set(messages.map((message) => message.type).filter(Boolean)));
  if (types.includes("error")) return "danger";
  if (types.includes("success")) return "success";
  if (types.includes("warning")) return "warning";
  if (types.includes("info")) return "info";
  return fallback;
}

function renderMessages(target, messages = [], fallbackVariant = "danger") {
  target.innerHTML = "";
  if (!messages || messages.length === 0) {
    return;
  }

  const variant = resolveVariant(messages, fallbackVariant);
  const alert = document.createElement("div");
  alert.className = `alert alert-${variant}`;
  alert.setAttribute("role", "alert");

  const list = document.createElement("ul");
  list.className = "mb-0 ps-3";
  messages.forEach((message) => {
    const item = document.createElement("li");
    item.textContent = message.text ?? message;
    list.appendChild(item);
  });

  alert.appendChild(list);
  target.appendChild(alert);
}

function createNodeInput(node) {
  const attr = node.attributes;

  if (attr.type === "hidden") {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = attr.name;
    input.value = attr.value ?? "";
    return input;
  }

  if (attr.type === "submit") {
    const button = document.createElement("button");
    button.type = "submit";
    button.className = "btn btn-primary w-100";
    if (attr.name) {
      button.name = attr.name;
    }
    if (attr.value) {
      button.value = attr.value;
    }
    if (attr.disabled) {
      button.disabled = Boolean(attr.disabled);
    }
    button.textContent = node.meta?.label?.text ?? attr.value ?? "Continue";
    return button;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "mb-3";

  const label = document.createElement("label");
  label.className = "form-label";
  label.setAttribute("for", attr.name);
  label.textContent = node.meta?.label?.text ?? attr.name;

  const input = document.createElement("input");
  input.id = attr.name;
  input.type = attr.type ?? "text";
  input.name = attr.name;
  input.className = "form-control form-control-lg";
  input.placeholder = node.meta?.label?.text ?? attr.name;
  input.autocomplete = attr.autocomplete ?? "";
  input.required = Boolean(attr.required);
  input.disabled = Boolean(attr.disabled);
  if (attr.pattern) {
    input.pattern = attr.pattern;
  }
  if (attr.maxLength) {
    input.maxLength = attr.maxLength;
  }
  if (attr.minLength) {
    input.minLength = attr.minLength;
  }
  if (attr.value) {
    input.value = attr.value;
  }

  if (attr.type === "checkbox") {
    wrapper.className = "form-check mb-3";
    input.className = "form-check-input";
    label.className = "form-check-label";
    input.checked = Boolean(attr.value);
    wrapper.appendChild(input);
    wrapper.appendChild(label);
  } else {
    wrapper.appendChild(label);
    wrapper.appendChild(input);
  }

  if (node.messages && node.messages.length > 0) {
    const feedback = document.createElement("div");
    feedback.className = "form-text text-danger";
    feedback.textContent = node.messages.map((m) => m.text).join(" ");
    wrapper.appendChild(feedback);
  }

  return wrapper;
}

function renderFlowForm(container, flow, submitLabel) {
  container.innerHTML = "";

  const form = document.createElement("form");
  form.className = "d-flex flex-column gap-3";
  form.method = flow.ui?.method ?? "POST";
  form.action = flow.ui?.action ?? "";
  form.noValidate = true;

  const nodes = [...(flow.ui?.nodes ?? [])].sort((a, b) => {
    const aOrder = a.meta?.order ?? 0;
    const bOrder = b.meta?.order ?? 0;
    return aOrder - bOrder;
  });

  nodes.forEach((node) => {
    const element = createNodeInput(node);
    if (!element) return;
    if (element.tagName === "BUTTON" && submitLabel) {
      element.textContent = submitLabel;
    }
    form.appendChild(element);
  });

  container.appendChild(form);
}

function handleFlowError(flowType, error, messageTarget) {
  if (!error || typeof error.status !== "number") {
    renderMessages(messageTarget, [{ text: "Unexpected error, please try again." }]);
    return;
  }

  if ([403, 404, 410, 422].includes(error.status)) {
    redirectToFlow(flowType);
    return;
  }

  const messages = error.data?.ui?.messages ?? [{ text: "Unable to complete the request." }];
  renderMessages(messageTarget, messages);
}

async function fetchSession() {
  const url = new URL("/sessions/whoami", KRATOS_PUBLIC_URL);
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json"
    }
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    const error = new Error("Unable to fetch session");
    error.status = response.status;
    throw error;
  }

  return response.json();
}

async function getLogoutUrl() {
  const url = new URL("/self-service/logout/browser", KRATOS_PUBLIC_URL);
  const response = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    const error = new Error("Unable to fetch logout URL");
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  return data.logout_url;
}

window.KratosHelpers = {
  KRATOS_PUBLIC_URL,
  getSearchParam,
  fetchFlow,
  redirectToFlow,
  renderMessages,
  renderFlowForm,
  handleFlowError,
  fetchSession,
  getLogoutUrl
};
