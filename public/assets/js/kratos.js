const APPBLOCKS_BACKEND_BASE_URL =
  (typeof window !== "undefined" &&
    (window.APPBLOCKS_BACKEND_BASE_URL || window.APPBLOCKS_BASE_URL)) ||
  "https://appblocks.in";

const APPBLOCKS_ACCOUNTS_BASE_URL =
  (typeof window !== "undefined" &&
    (window.APPBLOCKS_ACCOUNTS_BASE_URL || window.KRATOS_PUBLIC_URL)) ||
  "https://accounts.appblocks.in";

const KRATOS_PUBLIC_URL =
  (typeof window !== "undefined" && window.KRATOS_PUBLIC_URL) || APPBLOCKS_ACCOUNTS_BASE_URL;

const SESSION_TOKEN_STORAGE_KEY = "kratos_session_token";
let inMemorySessionToken = null;

function persistSessionToken(token) {
  if (typeof window === "undefined") {
    inMemorySessionToken = token ?? null;
    return;
  }

  if (!token) {
    clearSessionToken();
    return;
  }

  inMemorySessionToken = token;

  try {
    if (window.sessionStorage) {
      window.sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
    }
  } catch (error) {
    // Ignore storage write failures (e.g. privacy mode)
  }

  try {
    if (window.localStorage) {
      window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
    }
  } catch (error) {
    // Ignore storage write failures (e.g. storage disabled)
  }
}

function getSessionToken() {
  if (inMemorySessionToken) {
    return inMemorySessionToken;
  }

  if (typeof window === "undefined") {
    return null;
  }

  let token = null;

  try {
    if (window.sessionStorage) {
      token = window.sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
    }
  } catch (error) {
    token = null;
  }

  if (!token) {
    try {
      if (window.localStorage) {
        token = window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
      }
    } catch (error) {
      token = null;
    }
  }

  inMemorySessionToken = token;
  return token;
}

function clearSessionToken() {
  inMemorySessionToken = null;

  if (typeof window === "undefined") {
    return;
  }

  try {
    if (window.sessionStorage) {
      window.sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    }
  } catch (error) {
    // Ignore storage access issues
  }

  try {
    if (window.localStorage) {
      window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    }
  } catch (error) {
    // Ignore storage access issues
  }
}

function getSearchParam(name) {
  return new URL(window.location.href).searchParams.get(name);
}

function redirectToFlow(flowType, options = {}) {
  const params = new URLSearchParams(options);
  window.location.href = `${KRATOS_PUBLIC_URL}/self-service/${flowType}/browser${params.toString() ? `?${params}` : ""}`;
}

function normalizeFlowParams(initParams = {}) {
  if (initParams instanceof URLSearchParams) {
    return initParams;
  }

  const params = new URLSearchParams();
  Object.entries(initParams).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    params.set(key, value);
  });
  return params;
}

async function initApiFlow(flowType, initParams = {}) {
  const url = new URL(`/self-service/${flowType}/api`, KRATOS_PUBLIC_URL);
  const params = normalizeFlowParams(initParams);
  params.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json"
    }
  });

  if (response.ok) {
    return response.json();
  }

  const error = new Error("Failed to initialize flow");
  error.status = response.status;
  try {
    error.data = await response.json();
  } catch (e) {
    error.data = null;
  }
  throw error;
}

function normalizeHeaders(headersLike = {}) {
  if (headersLike instanceof Headers) {
    return new Headers(headersLike);
  }

  if (Array.isArray(headersLike)) {
    return new Headers(headersLike);
  }

  const headers = new Headers();
  if (headersLike && typeof headersLike === "object") {
    Object.entries(headersLike).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        headers.set(key, value);
      }
    });
  }
  return headers;
}

function applySessionToken(headers) {
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    return headers;
  }

  if (!headers.has("X-Session-Token")) {
    headers.set("X-Session-Token", sessionToken);
  }

  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${sessionToken}`);
  }

  return headers;
}

async function submitFlow(flowType, flowId, payload = {}, options = {}) {
  const url = options.action
    ? new URL(options.action, KRATOS_PUBLIC_URL)
    : new URL(`/self-service/${flowType}`, KRATOS_PUBLIC_URL);

  if (!options.action && flowId) {
    url.searchParams.set("flow", flowId);
  }

  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: applySessionToken(
      normalizeHeaders({
        Accept: "application/json",
        "Content-Type": "application/json"
      })
    ),
    body: JSON.stringify(payload)
  });

  const sessionTokenHeader = response.headers.get("X-Session-Token");

  if (sessionTokenHeader) {
    persistSessionToken(sessionTokenHeader);
  }

  if (response.status === 204) {
    if (sessionTokenHeader) {
      return { session_token: sessionTokenHeader };
    }
    return null;
  }

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }

  if (!response.ok) {
    const error = new Error("Flow submission failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  if (sessionTokenHeader) {
    if (data && typeof data === "object" && !data.session_token) {
      data.session_token = sessionTokenHeader;
    } else if (!data) {
      return { session_token: sessionTokenHeader };
    }
  }

  if (data && typeof data === "object" && data.session_token) {
    persistSessionToken(data.session_token);
  }

  return data;
}

function buildAppblocksUrl(path, params = {}) {
  const url = new URL(path, APPBLOCKS_BACKEND_BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    url.searchParams.set(key, value);
  });
  return url;
}

async function fetchFlow(flowType, flowId) {
  const url = new URL(`/self-service/${flowType}/flows`, KRATOS_PUBLIC_URL);
  url.searchParams.set("id", flowId);

  const response = await fetch(url, {
    credentials: "include",
    headers: applySessionToken(
      normalizeHeaders({
        Accept: "application/json"
      })
    )
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

  let primaryButtonAssigned = false;

  nodes.forEach((node) => {
    const element = createNodeInput(node);
    if (!element) return;
    if (element.tagName === "BUTTON" && submitLabel && !primaryButtonAssigned) {
      element.textContent = submitLabel;
      primaryButtonAssigned = true;
    }
    form.appendChild(element);
  });

  container.appendChild(form);
  return form;
}

function handleFlowError(flowType, error, messageTarget, onReset) {
  if (!error || typeof error.status !== "number") {
    renderMessages(messageTarget, [{ text: "Unexpected error, please try again." }]);
    return;
  }

  if ([403, 404, 410, 422].includes(error.status)) {
    if (typeof onReset === "function") {
      onReset(error);
    } else {
      redirectToFlow(flowType);
    }
    return;
  }

  const messages = error.data?.ui?.messages ?? [{ text: "Unable to complete the request." }];
  renderMessages(messageTarget, messages);
}

async function fetchSession() {
  const url = new URL("/sessions/whoami", KRATOS_PUBLIC_URL);
  const sessionToken = getSessionToken();
  let headers = normalizeHeaders({ Accept: "application/json" });

  if (sessionToken) {
    headers.set("X-Session-Token", sessionToken);
  }

  headers = applySessionToken(headers);

  const response = await fetch(url, {
    credentials: "include",
    headers
  });

  const refreshedToken = response.headers.get("X-Session-Token");

  if (response.status === 401) {
    if (sessionToken) {
      clearSessionToken();
    }
    return null;
  }

  if (!response.ok) {
    const error = new Error("Unable to fetch session");
    error.status = response.status;
    throw error;
  }

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (refreshedToken) {
    persistSessionToken(refreshedToken);
  }

  if (data && typeof data === "object" && data.session_token) {
    persistSessionToken(data.session_token);
  }

  return data;
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
  clearSessionToken();
  return data.logout_url;
}

window.KratosHelpers = {
  KRATOS_PUBLIC_URL,
  APPBLOCKS_BACKEND_BASE_URL,
  APPBLOCKS_ACCOUNTS_BASE_URL,
  APPBLOCKS_BASE_URL: APPBLOCKS_BACKEND_BASE_URL,
  getSearchParam,
  fetchFlow,
  redirectToFlow,
  renderMessages,
  renderFlowForm,
  handleFlowError,
  fetchSession,
  getLogoutUrl,
  buildAppblocksUrl,
  initApiFlow,
  submitFlow,
  persistSessionToken,
  getSessionToken,
  clearSessionToken,
  applySessionToken,
  normalizeHeaders
};
