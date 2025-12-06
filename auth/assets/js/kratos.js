const APPBLOCKS_ACCOUNTS_BASE_URL =
  (typeof window !== "undefined" &&
    (window.APPBLOCKS_ACCOUNTS_BASE_URL || window.KRATOS_PUBLIC_URL)) ||
  "https://accounts.appblocks.in";

const KRATOS_PUBLIC_URL =
  (typeof window !== "undefined" && window.KRATOS_PUBLIC_URL) || APPBLOCKS_ACCOUNTS_BASE_URL;

const HYDRA_PUBLIC_URL =
  (typeof window !== "undefined" && window.HYDRA_PUBLIC_URL) || "https://hydra.appblocks.in";

const HYDRA_ADMIN_URL =
  (typeof window !== "undefined" && window.HYDRA_ADMIN_URL) || HYDRA_PUBLIC_URL?.replace(":4444", ":4445");

const TOKEN_STORAGE_KEY = "hydra_oauth_tokens";
const STATE_STORAGE_KEY = "hydra_oauth_state";
const LOGIN_CHALLENGE_STORAGE_KEY = "appblocks_login_challenge";

(function normalizeAuthPaths() {
  if (typeof window === "undefined") return;

  try {
    const path = window.location.pathname;
    const normalized = {
      "/signin/": "/signin",
      "/register/": "/register",
      "/recovery/": "/recovery",
      "/settings/": "/settings"
    }[path];

    if (!normalized) {
      return;
    }

    const url = new URL(window.location.href);
    url.pathname = normalized;
    window.history.replaceState({}, document.title, url.toString());
  } catch {
    // ignore
  }
})();

function getSearchParam(name) {
  return new URL(window.location.href).searchParams.get(name);
}

function rememberLoginChallenge(challenge) {
  if (!challenge) return;
  try {
    sessionStorage.setItem(LOGIN_CHALLENGE_STORAGE_KEY, challenge);
  } catch {
    // ignore storage failures
  }
}

function getStoredLoginChallenge() {
  try {
    return sessionStorage.getItem(LOGIN_CHALLENGE_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function clearStoredLoginChallenge() {
  try {
    sessionStorage.removeItem(LOGIN_CHALLENGE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function getHydraLoginRequest(loginChallenge) {
  if (!loginChallenge || !HYDRA_ADMIN_URL) return null;
  const url = new URL(`/oauth2/auth/requests/login`, HYDRA_ADMIN_URL);
  url.searchParams.set("login_challenge", loginChallenge);

  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) {
    throw new Error("Unable to fetch login request.");
  }

  return response.json();
}

async function getHydraConsentRequest(consentChallenge) {
  if (!consentChallenge || !HYDRA_ADMIN_URL) return null;

  const url = new URL(`/oauth2/auth/requests/consent`, HYDRA_ADMIN_URL);
  url.searchParams.set("consent_challenge", consentChallenge);

  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) {
    throw new Error("Unable to fetch consent request.");
  }

  return response.json();
}

async function acceptHydraLoginRequest(loginChallenge, subject, remember = false) {
  if (!loginChallenge || !HYDRA_ADMIN_URL) return null;

  const url = new URL(`/oauth2/auth/requests/login/accept`, HYDRA_ADMIN_URL);
  url.searchParams.set("login_challenge", loginChallenge);

  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    body: JSON.stringify({
      subject,
      remember,
      remember_for: remember ? 3600 : 0
    })
  });

  if (!response.ok) {
    throw new Error("Unable to complete sign-in.");
  }

  return response.json();
}

async function acceptHydraConsentRequest(consentChallenge, consentRequest, remember = false) {
  if (!consentChallenge || !HYDRA_ADMIN_URL) return null;

  const url = new URL(`/oauth2/auth/requests/consent/accept`, HYDRA_ADMIN_URL);
  url.searchParams.set("consent_challenge", consentChallenge);

  const body = {
    grant_scope: consentRequest?.requested_scope ?? [],
    grant_access_token_audience: consentRequest?.requested_access_token_audience ?? [],
    remember,
    remember_for: remember ? 3600 : 0,
    session: {
      access_token: {},
      id_token: {}
    }
  };

  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error("Unable to continue.");
  }

  return response.json();
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

  const error = new Error("Failed to load form.");
  error.status = response.status;
  try {
    error.data = await response.json();
  } catch (e) {
    error.data = null;
  }
  throw error;
}

function renderMessages(target, messages = [], fallbackVariant = "danger") {
  if (!target) return;
  target.innerHTML = "";
  if (!messages || messages.length === 0) {
    return;
  }

  const types = Array.from(new Set(messages.map((message) => message.type).filter(Boolean)));
  let variant = fallbackVariant;
  if (types.includes("error")) variant = "danger";
  else if (types.includes("success")) variant = "success";
  else if (types.includes("warning")) variant = "warning";
  else if (types.includes("info")) variant = "info";

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
  if (!container) return;
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
}

function handleFlowError(flowType, error, messageTarget) {
  if (!messageTarget) return;

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
    const error = new Error("Unable to check session.");
    error.status = response.status;
    throw error;
  }

  return response.json();
}

function redirectToFlow(flowType, options = {}) {
  const params = new URLSearchParams(options);
  window.location.href = `${KRATOS_PUBLIC_URL}/self-service/${flowType}/browser${params.toString() ? `?${params}` : ""}`;
}

window.KratosHelpers = {
  KRATOS_PUBLIC_URL,
  APPBLOCKS_ACCOUNTS_BASE_URL,
  HYDRA_PUBLIC_URL,
  getSearchParam,
  fetchFlow,
  redirectToFlow,
  renderMessages,
  renderFlowForm,
  handleFlowError,
  fetchSession,
  getHydraLoginRequest,
  acceptHydraLoginRequest,
  getHydraConsentRequest,
  acceptHydraConsentRequest,
  rememberLoginChallenge,
  getStoredLoginChallenge,
  clearStoredLoginChallenge
};
