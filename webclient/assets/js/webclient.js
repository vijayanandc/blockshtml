const STATE_STORAGE_KEY = "appblocks_webclient_state";
const TOKENS_STORAGE_KEY = "appblocks_webclient_tokens";
let callbackInitialized = false;
let currentAdminBaseUrl = null;
let latestAdminClients = [];

function showAlert(target, text, variant = "danger") {
  const container = document.getElementById(target);
  if (!container) return;
  container.innerHTML = "";
  if (!text) return;
  const alert = document.createElement("div");
  alert.className = `alert alert-${variant}`;
  alert.setAttribute("role", "alert");
  alert.textContent = text;
  container.appendChild(alert);
}

function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomState() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function createPkcePair() {
  const verifierArray = new Uint8Array(64);
  crypto.getRandomValues(verifierArray);
  const verifier = base64UrlEncode(verifierArray);
  const encoder = new TextEncoder();
  const challengeData = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(challengeData));
  return { verifier, challenge };
}

function storeAuthState(payload) {
  sessionStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(payload));
}

function getAuthState() {
  const raw = sessionStorage.getItem(STATE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(STATE_STORAGE_KEY);
    return null;
  }
}

function clearAuthState() {
  sessionStorage.removeItem(STATE_STORAGE_KEY);
}

function storeTokens(tokenSet) {
  if (!tokenSet) return;
  try {
    sessionStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(tokenSet));
  } catch {
    // ignore storage failures
  }
}

function getStoredTokens() {
  const raw = sessionStorage.getItem(TOKENS_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(TOKENS_STORAGE_KEY);
    return null;
  }
}

function clearStoredTokens() {
  sessionStorage.removeItem(TOKENS_STORAGE_KEY);
}

function getBackendAccessToken() {
  const tokens = getStoredTokens();
  if (!tokens || !tokens.access_token) {
    return null;
  }
  return tokens.access_token;
}

async function startLogout() {
  clearAuthState();
  clearStoredTokens();

  const accountsBaseUrl =
    window.APPBLOCKS_ACCOUNTS_BASE_URL || "http://127.0.0.1:4433";

  try {
    const browserEndpoint = new URL("/self-service/logout/browser", accountsBaseUrl);

    // Prefer calling the endpoint via fetch so we can follow the logout_url
    // instead of showing the raw JSON payload in the browser.
    try {
      const response = await fetch(browserEndpoint.toString(), {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json"
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.logout_url) {
          window.location.href = data.logout_url;
          return;
        }
      }
    } catch {
      // If fetch fails (for example due to CORS), fall back to a direct redirect.
    }

    // Fallback: navigate directly to the browser endpoint.
    window.location.href = browserEndpoint.toString();
  } catch {
    window.location.href = "/";
  }
}

async function startLoginFlow() {
  const authServerUrl = window.APPBLOCKS_AUTH_SERVER_URL;
  const clientId = window.APPBLOCKS_CLIENT_ID;
  const scopes = window.APPBLOCKS_SCOPES;
  const redirectUri = window.APPBLOCKS_REDIRECT_URI;

  if (!authServerUrl || !clientId || !redirectUri) {
    showAlert("home-alerts", "Sign-in is not configured correctly. Please check the client settings.");
    return;
  }

  try {
    const { verifier, challenge } = await createPkcePair();
    const state = randomState();

    storeAuthState({
      state,
      verifier,
      redirectUri,
      createdAt: Date.now()
    });

    const url = new URL("/oauth2/auth", authServerUrl);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");

    window.location.href = url.toString();
  } catch (error) {
    showAlert("home-alerts", error.message || "Unable to start sign-in. Please try again.");
  }
}

async function exchangeCodeForTokens(code, stateParam) {
  const authState = getAuthState();
  if (!authState || !authState.state || authState.state !== stateParam) {
    clearAuthState();
    throw new Error("State verification failed. Please start sign-in again.");
  }

  const authServerUrl = window.APPBLOCKS_AUTH_SERVER_URL;
  const clientId = window.APPBLOCKS_CLIENT_ID;
  const redirectUri = authState.redirectUri || window.APPBLOCKS_REDIRECT_URI;

  const tokenUrl = new URL("/oauth2/token", authServerUrl);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: authState.verifier,
    client_id: clientId
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    credentials: "omit"
  });

  if (!response.ok) {
    clearAuthState();
    clearStoredTokens();
    let message = "Unable to exchange the sign-in code.";
    try {
      const err = await response.json();
      if (err.error_description) {
        message = err.error_description;
      } else if (err.error) {
        message = err.error;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const tokenSet = await response.json();
  clearAuthState();
  clearStoredTokens();
  storeTokens(tokenSet);
  return tokenSet;
}

function renderTokens(tokenSet) {
  const container = document.getElementById("tokens-container");
  if (!container) return;

  container.innerHTML = "";

  const cards = [];

  cards.push({
    title: "Access token",
    badge: "Active",
    value: tokenSet.access_token || "(none returned)"
  });

  cards.push({
    title: "Refresh token",
    badge: tokenSet.refresh_token ? "Stored" : "Not issued",
    value: tokenSet.refresh_token || "(none returned)"
  });

  cards.push({
    title: "ID token",
    badge: tokenSet.id_token ? "Available" : "Not issued",
    value: tokenSet.id_token || "(none returned)"
  });

  cards.forEach((card, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "token-card";

    const header = document.createElement("div");
    header.className = "token-card-header";

    const title = document.createElement("h2");
    title.className = "token-card-title";
    title.textContent = card.title;

    const right = document.createElement("div");
    right.className = "d-flex align-items-center gap-2";

    const badge = document.createElement("span");
    badge.className = "badge-soft";
    badge.textContent = card.badge;

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "token-copy-btn";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(card.value || "");
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.textContent = "Copy";
        }, 1500);
      } catch {
        // ignore clipboard errors
      }
    });

    right.appendChild(badge);
    right.appendChild(copyBtn);

    header.appendChild(title);
    header.appendChild(right);

    const body = document.createElement("div");
    body.className = "token-card-body";

    const codeBlock = document.createElement("pre");
    codeBlock.className = "token-code";
    codeBlock.textContent = card.value || "";

    body.appendChild(codeBlock);

    wrapper.appendChild(header);
    wrapper.appendChild(body);

    container.appendChild(wrapper);
  });

  const metaGrid = document.createElement("div");
  metaGrid.className = "meta-grid mt-3";

  const metaItems = [
    { label: "Token type", value: tokenSet.token_type || "bearer" },
    { label: "Scope", value: tokenSet.scope || "" }
  ];

  if (typeof tokenSet.expires_in === "number") {
    metaItems.push({
      label: "Expires in",
      value: `${tokenSet.expires_in} seconds`
    });
  }

  metaItems.forEach((item) => {
    const block = document.createElement("div");
    const label = document.createElement("div");
    label.className = "meta-item-label";
    label.textContent = item.label;
    const value = document.createElement("div");
    value.className = "meta-item-value";
    value.textContent = item.value || "-";
    block.appendChild(label);
    block.appendChild(value);
    metaGrid.appendChild(block);
  });

  container.appendChild(metaGrid);
}

function initCallbackNav() {
  const navRight = document.getElementById("webclient-navbar-right");
  if (!navRight) return;

  navRight.innerHTML = `
    <li class="nav-item dropdown">
      <button
        class="btn btn-link nav-link dropdown-toggle text-white px-2 fs-5 lh-1"
        type="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        aria-label="Session menu"
      >
        &#8942;
      </button>
      <ul class="dropdown-menu dropdown-menu-end shadow-sm">
        <li><button class="dropdown-item" type="button" id="webclient-logout-btn">Log out</button></li>
      </ul>
    </li>
  `;

  const logoutBtn = document.getElementById("webclient-logout-btn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", () => {
    logoutBtn.disabled = true;
    logoutBtn.textContent = "Logging out...";
    startLogout();
  });
}

function showClientDetails(client) {
  if (!client) return;

  const clientsContainer = document.getElementById("admin-clients");
  const createContainer = document.getElementById("admin-create-container");
  const detailContainer = document.getElementById("admin-client-details");
  const titleEl = document.getElementById("admin-client-title");
  const idEl = document.getElementById("admin-client-id-label");
  const summaryEl = document.getElementById("admin-client-summary");
  const jsonEl = document.getElementById("admin-client-json");

  if (!detailContainer || !titleEl || !idEl || !summaryEl || !jsonEl) {
    return;
  }

  if (clientsContainer) {
    clientsContainer.classList.add("d-none");
  }
  if (createContainer) {
    createContainer.classList.add("d-none");
  }

  const title = client.client_name || client.client_id || "Client details";
  const clientId = client.client_id || "";

  titleEl.textContent = title;
  idEl.textContent = clientId ? `Client ID: ${clientId}` : "";

  // Clear any previous secret alert.
  const existingSecretAlert = detailContainer.querySelector(".admin-client-secret-alert");
  if (existingSecretAlert && existingSecretAlert.parentNode) {
    existingSecretAlert.parentNode.removeChild(existingSecretAlert);
  }

  summaryEl.innerHTML = "";

  const summaryItems = [];

  if (Array.isArray(client.redirect_uris) && client.redirect_uris.length > 0) {
    summaryItems.push({
      label: "Redirect URIs",
      value: client.redirect_uris.join(", ")
    });
  }

  if (typeof client.scope === "string" && client.scope) {
    summaryItems.push({
      label: "Scopes",
      value: client.scope
    });
  }

  if (Array.isArray(client.grant_types) && client.grant_types.length > 0) {
    summaryItems.push({
      label: "Grant types",
      value: client.grant_types.join(" ")
    });
  }

  if (Array.isArray(client.response_types) && client.response_types.length > 0) {
    summaryItems.push({
      label: "Response types",
      value: client.response_types.join(" ")
    });
  }

  if (Array.isArray(client.audience) && client.audience.length > 0) {
    summaryItems.push({
      label: "Audience",
      value: client.audience.join(" ")
    });
  }

  if (client.token_endpoint_auth_method) {
    summaryItems.push({
      label: "Token auth method",
      value: client.token_endpoint_auth_method
    });
  }

  if (typeof client.owner === "string" && client.owner) {
    summaryItems.push({
      label: "Owner",
      value: client.owner
    });
  }

  // If this client has a secret in the payload (only returned at creation time),
  // surface it prominently so it can be copied once.
  if (client.client_secret) {
    const secretAlert = document.createElement("div");
    secretAlert.className = "alert alert-warning mb-3 admin-client-secret-alert";
    secretAlert.textContent = "Client secret: " + client.client_secret;
    secretAlert.title =
      "This value is shown only once. Copy and store it in a secure place; it cannot be retrieved later.";
    if (summaryEl.parentNode) {
      summaryEl.parentNode.insertBefore(secretAlert, summaryEl);
    } else {
      detailContainer.insertBefore(secretAlert, detailContainer.firstChild);
    }
  }

  summaryItems.forEach((item) => {
    const block = document.createElement("div");
    const label = document.createElement("div");
    label.className = "meta-item-label";
    label.textContent = item.label;
    const value = document.createElement("div");
    value.className = "meta-item-value";
    value.textContent = item.value || "-";
    block.appendChild(label);
    block.appendChild(value);
    summaryEl.appendChild(block);
  });

  jsonEl.textContent = JSON.stringify(client, null, 2);

  detailContainer.classList.remove("d-none");
}

function renderAdminClients(clients) {
  const container = document.getElementById("admin-clients");
  if (!container) return;

  container.innerHTML = "";

  if (!Array.isArray(clients) || clients.length === 0) {
    container.innerHTML =
      '<p class="text-muted mb-0">No clients found for this admin endpoint.</p>';
    return;
  }

  const list = document.createElement("div");
  list.className = "list-group";

  const currentClientId = window.APPBLOCKS_CLIENT_ID || "";

  clients.forEach((client) => {
    const clientId = client.client_id || "";
    const item = document.createElement("div");
    item.className = "list-group-item list-group-item-action py-3 admin-client-item";
    if (clientId) {
      item.dataset.clientId = clientId;
    }

    const title = client.client_name || client.client_id || "(unnamed client)";
    const redirectUris = Array.isArray(client.redirect_uris)
      ? client.redirect_uris.join(", ")
      : "";

    const scopes = typeof client.scope === "string" ? client.scope : "";

    const isCurrentClient = currentClientId && clientId === currentClientId;
    const deleteButtonHtml = clientId
      ? isCurrentClient
        ? `<button type="button" class="btn btn-sm btn-outline-secondary" disabled title="This is the current client and cannot be deleted.">
             Delete
           </button>`
        : `<button type="button" class="btn btn-sm btn-outline-danger admin-delete-client" data-client-id="${clientId}">
             Delete
           </button>`
      : "";

    item.innerHTML = `
      <div class="d-flex flex-column gap-1">
        <div class="d-flex justify-content-between align-items-center gap-2">
          <div>
            <div class="fw-semibold">${title}</div>
            <div class="text-muted small">${clientId}</div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="badge bg-light text-muted border">
              ${Array.isArray(client.grant_types) ? client.grant_types.join(" ") : ""}
            </span>
            ${deleteButtonHtml}
          </div>
        </div>
        ${
          redirectUris
            ? `<div class="small text-muted">Redirect URIs: ${redirectUris}</div>`
            : ""
        }
        ${scopes ? `<div class="small text-muted">Scopes: ${scopes}</div>` : ""}
      </div>
    `;

    list.appendChild(item);
  });

  container.appendChild(list);
}

async function loadAdminClients() {
  const statusEl = document.getElementById("admin-status");
  const baseUrl =
    window.APPBLOCKS_BACKEND_BASE_URL || "http://127.0.0.1:8080";
  currentAdminBaseUrl = baseUrl;

  const accessToken = getBackendAccessToken();
  if (!accessToken) {
    if (statusEl) {
      statusEl.textContent =
        "Unable to load clients because the session has no access token. Please sign in again.";
    }
    return;
  }

  if (statusEl) {
    statusEl.textContent = "Loading clients…";
  }

  const adminClientsUrl = new URL("/iam/clients", baseUrl);

  try {
    const response = await fetch(adminClientsUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      credentials: "include"
    });

    if (!response.ok) {
      if (statusEl) {
        statusEl.textContent =
          "Unable to load clients. Please check the admin endpoint and CORS settings.";
      }
      return;
    }

    const clients = await response.json();
    latestAdminClients = Array.isArray(clients) ? clients : [];
    renderAdminClients(latestAdminClients);
    if (statusEl) {
      statusEl.textContent = `Loaded ${Array.isArray(clients) ? clients.length : 0} clients.`;
    }
  } catch (error) {
    if (statusEl) {
      statusEl.textContent =
        "Unable to reach the admin endpoint. Please check that it is running and accessible.";
    }
  }
}

function initAdminUi() {
  const homePane = document.getElementById("webclient-home-pane");
  const adminPane = document.getElementById("webclient-admin-pane");
  const tabHome = document.getElementById("webclient-tab-home");
  const tabAdmin = document.getElementById("webclient-tab-admin");
  const clientsContainer = document.getElementById("admin-clients");
  const detailContainer = document.getElementById("admin-client-details");

  if (tabHome && tabAdmin && homePane && adminPane) {
    tabHome.addEventListener("click", () => {
      tabHome.classList.add("active");
      tabAdmin.classList.remove("active");
      homePane.classList.remove("d-none");
      adminPane.classList.add("d-none");
    });

    tabAdmin.addEventListener("click", () => {
      tabAdmin.classList.add("active");
      tabHome.classList.remove("active");
      homePane.classList.add("d-none");
      adminPane.classList.remove("d-none");
    });
  }

  const applyBtn = document.getElementById("admin-apply-btn");
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      if (createContainer) {
        createContainer.classList.add("d-none");
      }
      if (detailContainer) {
        detailContainer.classList.add("d-none");
      }
      if (clientsContainer) {
        clientsContainer.classList.remove("d-none");
      }
      loadAdminClients();
    });
  }

  const showCreateBtn = document.getElementById("admin-show-create-btn");
  const createContainer = document.getElementById("admin-create-container");
  const createForm = document.getElementById("admin-create-form");
  const createCancel = document.getElementById("admin-create-cancel");
  const createMessages = document.getElementById("admin-create-messages");

  if (showCreateBtn && createContainer && clientsContainer) {
    showCreateBtn.addEventListener("click", () => {
      createContainer.classList.remove("d-none");
      clientsContainer.classList.add("d-none");
      if (detailContainer) {
        detailContainer.classList.add("d-none");
      }
      if (createMessages) {
        createMessages.innerHTML = "";
      }
    });
  }

  if (createCancel && createContainer && clientsContainer) {
    createCancel.addEventListener("click", () => {
      createContainer.classList.add("d-none");
      clientsContainer.classList.remove("d-none");
      if (detailContainer) {
        detailContainer.classList.add("d-none");
      }
      if (createMessages) {
        createMessages.innerHTML = "";
      }
    });
  }

  // Load clients once when the Admin UI initializes.
  if (clientsContainer) {
    loadAdminClients();
  }

  if (createForm) {
    createForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (createMessages) {
        createMessages.innerHTML = "";
      }

      const baseUrl =
        currentAdminBaseUrl ||
        window.APPBLOCKS_BACKEND_BASE_URL ||
        "http://127.0.0.1:8080";

      const accessToken = getBackendAccessToken();
      if (!accessToken) {
        if (createMessages) {
          createMessages.innerHTML =
            '<div class="alert alert-warning mb-0">No access token available. Please sign in again before creating clients.';
        }
        return;
      }

      const name = document.getElementById("client-name")?.value.trim() || "";
      const clientId = document.getElementById("client-id")?.value.trim() || "";
      const clientSecret = document.getElementById("client-secret")?.value.trim() || "";
      const redirectRaw =
        document.getElementById("client-redirect-uris")?.value || "";
      const scopes =
        document.getElementById("client-scopes")?.value.trim() ||
        "openid offline offline_access profile email";
      const grantTypesRaw =
        document.getElementById("client-grant-types")?.value.trim() ||
        "authorization_code refresh_token";
      const responseTypesRaw =
        document.getElementById("client-response-types")?.value.trim() || "code";
      const audienceRaw =
        document.getElementById("client-audience")?.value.trim() || "";
      const authMethod =
        document.getElementById("client-auth-method")?.value || "none";

      const redirectUris = redirectRaw
        .split(/\r?\n/)
        .map((v) => v.trim())
        .filter(Boolean);
      const grantTypes = grantTypesRaw
        .split(/\s+/)
        .map((v) => v.trim())
        .filter(Boolean);
      const responseTypes = responseTypesRaw
        .split(/\s+/)
        .map((v) => v.trim())
        .filter(Boolean);
      const audience = audienceRaw
        .split(/\s+/)
        .map((v) => v.trim())
        .filter(Boolean);

      const payload = {
        client_name: name || undefined,
        scope: scopes,
        grant_types: grantTypes,
        response_types: responseTypes,
        redirect_uris: redirectUris
      };

      if (clientId) {
        payload.client_id = clientId;
      }
      if (clientSecret) {
        payload.client_secret = clientSecret;
      }
      if (audience.length > 0) {
        payload.audience = audience;
      }
      if (authMethod) {
        payload.token_endpoint_auth_method = authMethod;
      }

      const adminClientsUrl = new URL("/iam/clients", baseUrl);

      const submitButton = createForm.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Creating…";
      }

      try {
        const response = await fetch(adminClientsUrl.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`
          },
          credentials: "include",
          body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          if (createMessages) {
            const message =
              data?.error_description ||
              data?.error ||
              "Unable to create client. Please check the values and try again.";
            createMessages.innerHTML = `<div class="alert alert-danger mb-0">${message}</div>`;
          }
          return;
        }

        if (createMessages) {
          createMessages.innerHTML =
            '<div class="alert alert-success mb-2">Client created successfully.</div>';

          if (data?.client_secret) {
            const secretNote = document.createElement("div");

            secretNote.className = "alert alert-warning mb-2";
            secretNote.textContent = "Client secret: " + data.client_secret;
            secretNote.title =
              "This value is shown only once. Copy and store it in a secure place; it cannot be retrieved later.";
            createMessages.appendChild(secretNote);
          }

          if (data?.client_id) {
            const extra = document.createElement("pre");
            extra.className = "token-code mt-2";
            extra.textContent = JSON.stringify(data, null, 2);
            createMessages.appendChild(extra);
          }
        }

        // Refresh the client list so the new client appears.
        await loadAdminClients();

        // Show the newly created client details view, preserving any secret
        // returned in the create response.
        if (createContainer) {
          createContainer.classList.add("d-none");
        }
        const fromList =
          data && data.client_id
            ? latestAdminClients.find((c) => c.client_id === data.client_id)
            : null;
        const createdClient = fromList ? { ...fromList, ...data } : data;
        showClientDetails(createdClient);
      } catch (error) {
        if (createMessages) {
          createMessages.innerHTML =
            '<div class="alert alert-danger mb-0">Unexpected error while creating client.</div>';
        }
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Create";
        }
      }
    });
  }

  if (clientsContainer) {
    clientsContainer.addEventListener("click", async (event) => {
      const target = event.target;
      const deleteButton = target.closest(".admin-delete-client");
      const item = target.closest(".admin-client-item");

      // Handle delete clicks first.
      if (deleteButton) {
        const clientId = deleteButton.getAttribute("data-client-id");
        if (!clientId) return;

        const baseUrl =
          currentAdminBaseUrl ||
          window.APPBLOCKS_BACKEND_BASE_URL ||
          "http://127.0.0.1:8080";
        const statusEl = document.getElementById("admin-status");

        const accessToken = getBackendAccessToken();
        if (!accessToken) {
          if (statusEl) {
            statusEl.textContent =
              "No access token available. Please sign in again before deleting clients.";
          }
          return;
        }

        if (!window.confirm(`Delete client "${clientId}"? This cannot be undone.`)) {
          return;
        }

        deleteButton.disabled = true;
        deleteButton.textContent = "Deleting…";

        const deleteUrl = new URL(`/iam/clients/${encodeURIComponent(clientId)}`, baseUrl);

        try {
          const response = await fetch(deleteUrl.toString(), {
            method: "DELETE",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${accessToken}`
            },
            credentials: "include"
          });

          if (!response.ok && response.status !== 204) {
            if (statusEl) {
              statusEl.textContent =
                "Unable to delete client. Please check the admin endpoint and try again.";
            }
            return;
          }

          if (statusEl) {
            statusEl.textContent = `Client "${clientId}" deleted.`;
          }

          // Reload the client list to reflect the deletion.
          await loadAdminClients();
        } catch (error) {
          if (statusEl) {
            statusEl.textContent = "Unexpected error while deleting client.";
          }
        } finally {
          deleteButton.disabled = false;
          deleteButton.textContent = "Delete";
        }

        return;
      }

      // Otherwise, treat the click as a "view details" action.
      if (item && item.dataset.clientId) {
        const clientId = item.dataset.clientId;
        const client =
          latestAdminClients.find((c) => c.client_id === clientId) || null;
        if (client) {
          showClientDetails(client);
        }
      }
    });
  }

  const backButton = document.getElementById("admin-client-back");
  if (backButton && detailContainer && clientsContainer) {
    backButton.addEventListener("click", () => {
      detailContainer.classList.add("d-none");
      clientsContainer.classList.remove("d-none");
    });
  }
}

function initHome() {
  const button = document.getElementById("start-login-btn");
  if (button) {
    button.addEventListener("click", () => {
      startLoginFlow();
    });
  }

  // Start the flow automatically after a short delay,
  // while still letting the user click the button if needed.
  setTimeout(() => {
    startLoginFlow();
  }, 500);
}

async function initCallback() {
  if (callbackInitialized) {
    return;
  }
  callbackInitialized = true;

  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  initCallbackNav();

  const hasCode = Boolean(code);
  const hasState = Boolean(state);

  // If this is a plain refresh (no code/state) but we still have tokens
  // in session storage, just render them again without treating it as
  // an OAuth callback error. If there are no tokens, send the user
  // back to the public client home page.
  if (!hasCode || !hasState) {
    const stored = getStoredTokens();
    if (stored) {
      renderTokens(stored);
      initAdminUi();
      return;
    }

    // No active sign-in result; go back to the home page.
    window.location.replace("/");
    return;
  }

  try {
    const tokenSet = await exchangeCodeForTokens(code, state);

    // Clean up the URL so tokens are not tied to the query string.
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    url.searchParams.delete("session_state");
    const cleaned = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, document.title, cleaned);

    renderTokens(tokenSet);
    initAdminUi();
  } catch (error) {
    showAlert("callback-alerts", error.message || "Unable to complete sign-in.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  if (path === "/") {
    initHome();
  } else if (path === "/callback") {
    initCallback();
  }
});

// Handle browser back/forward cache restores so that we don't
// re-display stale tokens after logout.
window.addEventListener("pageshow", (event) => {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path !== "/callback") {
    return;
  }

  if (event.persisted) {
    // Re-run the callback initialization logic on BFCache restore.
    callbackInitialized = false;
    initCallback();
  }
});
