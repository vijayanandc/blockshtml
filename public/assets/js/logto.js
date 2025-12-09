const DEFAULT_BACKEND_BASE_URL =
  (typeof window !== "undefined" && window.APPBLOCKS_BACKEND_BASE_URL) || "http://127.0.0.1:8080";

const DEFAULT_ACCOUNTS_BASE_URL =
  (typeof window !== "undefined" && window.APPBLOCKS_ACCOUNTS_BASE_URL) || "https://5dffq2.logto.app";

const LOGTO_BROWSER_SDK_URL =
  (typeof window !== "undefined" && window.LOGTO_BROWSER_SDK_URL) ||
  "https://cdn.jsdelivr.net/npm/@logto/browser@3.0.9/+esm";

function toArray(value, fallback = []) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    return value
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return fallback.slice();
}

function normalizeResourceEntry(entry) {
  if (!entry) {
    return null;
  }
  if (typeof entry === "string") {
    return entry.trim();
  }
  if (typeof entry === "object" && typeof entry.resource === "string") {
    return entry.resource.trim();
  }
  return null;
}

function collectResourceIdentifiers() {
  const entries = [];

  if (window.LOGTO_RESOURCE_CONFIGS) {
    const configs = Array.isArray(window.LOGTO_RESOURCE_CONFIGS)
      ? window.LOGTO_RESOURCE_CONFIGS
      : [window.LOGTO_RESOURCE_CONFIGS];
    entries.push(...configs);
  } else {
    entries.push(
      window.LOGTO_RESOURCE_ID,
      ...toArray(window.LOGTO_RESOURCES),
      ...toArray(window.LOGTO_ADDITIONAL_RESOURCES)
    );
  }

  const normalized = entries.map(normalizeResourceEntry).filter(Boolean);
  const defaultRequested = typeof window.LOGTO_RESOURCE_ID === "undefined" || window.LOGTO_RESOURCE_ID !== null;

  if (normalized.length === 0 && defaultRequested) {
    normalized.push(DEFAULT_BACKEND_BASE_URL);
  }

  return Array.from(new Set(normalized));
}

const LOGTO_SCOPES = (() => {
  const defaults = ["openid", "profile", "offline_access", "email"];
  const scopes = new Set(toArray(window.LOGTO_SCOPES, []));
  defaults.forEach((scope) => scopes.add(scope));
  return Array.from(scopes);
})();
const LOGTO_RESOURCES = collectResourceIdentifiers();
const LOGTO_PRIMARY_RESOURCE = LOGTO_RESOURCES[0] || null;

const LOGTO_CONFIG = {
  endpoint: window.LOGTO_ENDPOINT || DEFAULT_ACCOUNTS_BASE_URL,
  appId: window.LOGTO_APP_ID || "appblocks-traditional-web",
  scopes: LOGTO_SCOPES,
  resources: LOGTO_RESOURCES
};

const LOGTO_DEFAULT_REDIRECT_URI =
  window.LOGTO_DEFAULT_REDIRECT_URI ||
  new URL("/callback", window.location.origin).toString();

const LOGTO_POST_LOGOUT_REDIRECT_URI =
  window.LOGTO_POST_LOGOUT_REDIRECT_URI || window.location.origin;

let logtoClientPromise = null;

async function loadLogtoClient() {
  if (logtoClientPromise) {
    return logtoClientPromise;
  }

  logtoClientPromise = import(LOGTO_BROWSER_SDK_URL)
    .then(({ default: LogtoClient }) => new LogtoClient(LOGTO_CONFIG))
    .catch((error) => {
      logtoClientPromise = null;
      console.error("Unable to load Logto browser SDK", error);
      throw error;
    });

  return logtoClientPromise;
}

function resolveAbsoluteUrl(target, base = window.location.origin) {
  if (!target) {
    return base;
  }

  if (target instanceof URL) {
    return target.toString();
  }

  try {
    return new URL(target, base).toString();
  } catch (error) {
    console.warn("Invalid URL provided. Falling back to base.", target, error);
    return base;
  }
}

function buildBackendUrl(path, params = {}) {
  const url = new URL(path, DEFAULT_BACKEND_BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    url.searchParams.set(key, value);
  });
  return url;
}

function resolveVariant(messages, fallback) {
  const types = Array.from(new Set((messages || []).map((message) => message.type).filter(Boolean)));
  if (types.includes("error")) return "danger";
  if (types.includes("success")) return "success";
  if (types.includes("warning")) return "warning";
  if (types.includes("info")) return "info";
  return fallback;
}

function renderMessages(target, messages = [], fallbackVariant = "danger") {
  if (!target) {
    return;
  }

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

async function fetchSession() {
  try {
    const client = await loadLogtoClient();
    const isAuthenticated = await client.isAuthenticated();
    if (!isAuthenticated) {
      return null;
    }

    const userInfo = await client.fetchUserInfo();
    const email =
      userInfo.email || userInfo.username || userInfo.name || userInfo.sub || userInfo.id || "";

    return {
      identity: {
        traits: {
          email
        }
      },
      user: userInfo
    };
  } catch (error) {
    console.error("Unable to fetch Logto session.", error);
    return null;
  }
}

async function signIn(options = {}) {
  const client = await loadLogtoClient();
  const redirectUri = resolveAbsoluteUrl(options.redirectUri || LOGTO_DEFAULT_REDIRECT_URI);
  const postRedirectUri = resolveAbsoluteUrl(
    options.postRedirectUri || options.returnPath || window.location.origin
  );

  const signInOptions = {
    redirectUri,
    postRedirectUri
  };

  if (options.interactionMode) {
    signInOptions.interactionMode = options.interactionMode;
  }

  if (options.directSignIn) {
    signInOptions.directSignIn = options.directSignIn;
  }

  if (options.loginHint) {
    signInOptions.loginHint = options.loginHint;
  }

  if (options.firstScreen) {
    signInOptions.firstScreen = options.firstScreen;
  }

  await client.signIn(signInOptions);
}

async function signOut(postLogoutRedirectUri) {
  const client = await loadLogtoClient();
  const redirectTarget = resolveAbsoluteUrl(
    postLogoutRedirectUri || LOGTO_POST_LOGOUT_REDIRECT_URI
  );
  await client.signOut(redirectTarget);
}

async function getAccessToken(resource) {
  const client = await loadLogtoClient();
  const resolvedResource = resource || LOGTO_PRIMARY_RESOURCE || undefined;
  if (resolvedResource) {
    return client.getAccessToken(resolvedResource);
  }
  return client.getAccessToken();
}

async function refreshAccessToken(resource) {
  const client = await loadLogtoClient();
  if (typeof client.clearAccessToken === "function") {
    await client.clearAccessToken();
  }
  const resolvedResource = resource || LOGTO_PRIMARY_RESOURCE || undefined;
  if (resolvedResource) {
    return client.getAccessToken(resolvedResource);
  }
  return client.getAccessToken();
}

async function getRefreshToken() {
  const client = await loadLogtoClient();
  return client.getRefreshToken();
}

async function handleSignInCallback(url = window.location.href) {
  const client = await loadLogtoClient();
  const shouldHandle = await client.isSignInRedirected(url);

  if (!shouldHandle) {
    return { handled: false };
  }

  await client.handleSignInCallback(url);
  return { handled: true };
}

const LogtoHelpers = {
  APPBLOCKS_BACKEND_BASE_URL: DEFAULT_BACKEND_BASE_URL,
  APPBLOCKS_ACCOUNTS_BASE_URL: DEFAULT_ACCOUNTS_BASE_URL,
  LOGTO_CONFIG,
  LOGTO_RESOURCES,
  LOGTO_SCOPES,
  LOGTO_PRIMARY_RESOURCE,
  getDefaultRedirectUri: () => LOGTO_DEFAULT_REDIRECT_URI,
  getPostLogoutRedirectUri: () => LOGTO_POST_LOGOUT_REDIRECT_URI,
  renderMessages,
  buildBackendUrl,
  fetchSession,
  signIn,
  signOut,
  getAccessToken,
  refreshAccessToken,
  getRefreshToken,
  handleSignInCallback,
  loadLogtoClient
};

window.LogtoHelpers = LogtoHelpers;
window.AppBlocksHelpers = LogtoHelpers;
window.KratosHelpers = LogtoHelpers;
