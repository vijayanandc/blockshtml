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

const HYDRA_PUBLIC_URL =
  (typeof window !== "undefined" && window.HYDRA_PUBLIC_URL) || "https://hydra.appblocks.in";

const HYDRA_ADMIN_URL =
  (typeof window !== "undefined" && window.HYDRA_ADMIN_URL) || HYDRA_PUBLIC_URL?.replace(":4444", ":4445");

const HYDRA_OAUTH_CLIENT_ID =
  (typeof window !== "undefined" && window.HYDRA_OAUTH_CLIENT_ID) || "appblocks-public-client";

const HYDRA_OAUTH_SCOPES =
  (typeof window !== "undefined" && window.HYDRA_OAUTH_SCOPES) || "openid offline offline_access profile email";

const HYDRA_OAUTH_REDIRECT_URI =
  (typeof window !== "undefined" && window.HYDRA_OAUTH_REDIRECT_URI) ||
  (typeof window !== "undefined" && window.location?.origin
    ? `${window.location.origin}/`
    : "/");

const TOKEN_STORAGE_KEY = "hydra_oauth_tokens";
const STATE_STORAGE_KEY = "hydra_oauth_state";

function getSearchParam(name) {
  return new URL(window.location.href).searchParams.get(name);
}

function base64URLEncode(buffer) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomState() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

async function createPkcePair() {
  const verifierArray = new Uint8Array(64);
  crypto.getRandomValues(verifierArray);
  const verifier = base64URLEncode(verifierArray);
  const encoder = new TextEncoder();
  const challengeData = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  const challenge = base64URLEncode(new Uint8Array(challengeData));
  return { verifier, challenge };
}

function storeOAuthState(payload) {
  sessionStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(payload));
}

function getOAuthState() {
  const raw = sessionStorage.getItem(STATE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    sessionStorage.removeItem(STATE_STORAGE_KEY);
    return null;
  }
}

function clearOAuthState() {
  sessionStorage.removeItem(STATE_STORAGE_KEY);
}

function normalizeTokenPayload(tokenSet) {
  if (!tokenSet) return null;
  const expiresAt = tokenSet.expires_in ? Date.now() + tokenSet.expires_in * 1000 : null;
  return {
    access_token: tokenSet.access_token,
    refresh_token: tokenSet.refresh_token,
    id_token: tokenSet.id_token,
    token_type: tokenSet.token_type || "bearer",
    scope: tokenSet.scope,
    expires_at: expiresAt
  };
}

function storeTokens(tokenSet) {
  const normalized = normalizeTokenPayload(tokenSet);
  if (!normalized?.access_token) return;
  sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(normalized));
}

function getStoredTokens() {
  const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    return null;
  }
}

function clearStoredTokens() {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

function isTokenExpired(tokenSet) {
  if (!tokenSet?.expires_at) return false;
  const now = Date.now();
  return tokenSet.expires_at - now < 60_000; // refresh one minute before expiry
}

async function refreshTokens(refreshToken) {
  if (!refreshToken) return null;
  const tokenUrl = new URL("/oauth2/token", HYDRA_PUBLIC_URL);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: HYDRA_OAUTH_CLIENT_ID
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    credentials: "omit"
  });

  if (!response.ok) {
    clearStoredTokens();
    return null;
  }

  const tokenSet = await response.json();
  const normalized = normalizeTokenPayload(tokenSet);
  storeTokens(normalized);
  return normalized;
}

async function getAccessToken() {
  const tokenSet = getStoredTokens();
  if (!tokenSet?.access_token) {
    return null;
  }

  if (!isTokenExpired(tokenSet)) {
    return tokenSet.access_token;
  }

  if (tokenSet.refresh_token) {
    const refreshed = await refreshTokens(tokenSet.refresh_token);
    return refreshed?.access_token ?? null;
  }

  clearStoredTokens();
  return null;
}

async function exchangeCodeForTokens(code, verifier, redirectUri) {
  const tokenUrl = new URL("/oauth2/token", HYDRA_PUBLIC_URL);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
    client_id: HYDRA_OAUTH_CLIENT_ID
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    credentials: "omit"
  });

  if (!response.ok) {
    clearOAuthState();
    throw new Error("Unable to complete OAuth2 code exchange");
  }

  const tokenSet = await response.json();
  storeTokens(tokenSet);
  clearOAuthState();
  return tokenSet;
}

async function handleOAuthCallback() {
  const currentUrl = new URL(window.location.href);
  const code = currentUrl.searchParams.get("code");
  const state = currentUrl.searchParams.get("state");

  if (!code) return false;

  const storedState = getOAuthState();
  if (!storedState || !state || storedState.state !== state) {
    clearOAuthState();
    throw new Error("OAuth2 state mismatch. Please try signing in again.");
  }

  await exchangeCodeForTokens(code, storedState.verifier, storedState.redirectUri || HYDRA_OAUTH_REDIRECT_URI);

  ["code", "state", "session_state"].forEach((param) => {
    currentUrl.searchParams.delete(param);
  });
  const cleaned = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
  window.history.replaceState({}, document.title, cleaned);
  return true;
}

async function startHydraLogin(additionalParams = {}) {
  const { verifier, challenge } = await createPkcePair();
  const state = randomState();
  const params = new URLSearchParams({
    client_id: HYDRA_OAUTH_CLIENT_ID,
    response_type: "code",
    scope: HYDRA_OAUTH_SCOPES,
    redirect_uri: HYDRA_OAUTH_REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state
  });

  Object.entries(additionalParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.set(key, value);
    }
  });

  storeOAuthState({
    state,
    verifier,
    redirectUri: HYDRA_OAUTH_REDIRECT_URI,
    requestedAt: Date.now()
  });

  window.location.href = `${HYDRA_PUBLIC_URL}/oauth2/auth?${params}`;
}

async function getHydraLoginRequest(loginChallenge) {
  if (!loginChallenge || !HYDRA_ADMIN_URL) return null;
  const url = new URL(`/oauth2/auth/requests/login`, HYDRA_ADMIN_URL);
  url.searchParams.set("login_challenge", loginChallenge);

  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) {
    throw new Error("Unable to fetch login challenge");
  }

  return response.json();
}

async function acceptHydraLoginRequest(loginChallenge, subject, remember = true) {
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
      remember_for: 3600
    })
  });

  if (!response.ok) {
    throw new Error("Unable to continue login challenge");
  }

  return response.json();
}

async function fetchUserInfo(accessToken) {
  if (!accessToken) return null;
  const userinfoUrl = new URL("/userinfo", HYDRA_PUBLIC_URL);
  const response = await fetch(userinfoUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "omit"
  });

  if (response.status === 401) {
    clearStoredTokens();
    return null;
  }

  if (!response.ok) {
    throw new Error("Unable to fetch user profile");
  }

  return response.json();
}

function redirectToFlow(flowType, options = {}) {
  const params = new URLSearchParams(options);
  window.location.href = `${KRATOS_PUBLIC_URL}/self-service/${flowType}/browser${params.toString() ? `?${params}` : ""}`;
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
  APPBLOCKS_BACKEND_BASE_URL,
  APPBLOCKS_ACCOUNTS_BASE_URL,
  APPBLOCKS_BASE_URL: APPBLOCKS_BACKEND_BASE_URL,
  HYDRA_PUBLIC_URL,
  HYDRA_OAUTH_CLIENT_ID,
  HYDRA_OAUTH_SCOPES,
  HYDRA_OAUTH_REDIRECT_URI,
  getSearchParam,
  fetchFlow,
  redirectToFlow,
  renderMessages,
  renderFlowForm,
  handleFlowError,
  fetchSession,
  getLogoutUrl,
  buildAppblocksUrl,
  startHydraLogin,
  handleOAuthCallback,
  getHydraLoginRequest,
  acceptHydraLoginRequest,
  getAccessToken,
  fetchUserInfo,
  clearStoredTokens
};
