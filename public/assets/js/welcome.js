window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  const helpers = window.LogtoHelpers || window.AppBlocksHelpers || window.KratosHelpers;

  if (!helpers) {
    return;
  }

  const {
    fetchSession,
    renderMessages,
    buildBackendUrl,
    getRefreshToken,
    refreshAccessToken
  } = helpers;
  const signOut = helpers.signOut;
  const acquireAccessToken = helpers.getAccessToken;
  const SHOW_TOKEN_SECTION = Boolean(window.APPBLOCKS_SHOW_TOKENS);
  const resolveAccessToken = acquireAccessToken;
  const resolveFreshAccessToken =
    typeof refreshAccessToken === "function" ? refreshAccessToken : acquireAccessToken;
  const resolveRefreshToken =
    typeof getRefreshToken === "function" ? getRefreshToken : async () => null;

  if (typeof fetchSession !== "function") {
    console.error("Unable to load session helpers.");
    return;
  }

  const sessionContainer = document.getElementById("session-content");
  const alerts = document.getElementById("session-alerts");
  const navbarLinks = document.getElementById("navbar-links");
  const navbarBrand = document.getElementById("navbar-brand-label");

  const DEFAULT_BRAND_NAME = navbarBrand?.textContent?.trim() || "AppBlocks Console";

  let organizations = [];
  let selectedOrg = null;
  let modules = [];

  let changeOrgMenuButton = null;
  let logoutButton = null;

  let modulesListElement = null;
  let moduleTitleElement = null;
  let moduleSubtitleElement = null;
  let moduleDataElement = null;
  let tokenPanelElement = null;
  let accessTokenField = null;
  let refreshTokenField = null;
  let tokenStatusElement = null;
  let tokenRefreshButton = null;
  let currentRefreshToken = null;

  const TIMEZONE_OPTIONS = [
    { value: "UTC", label: "UTC" },
    { value: "America/New_York", label: "America/New_York (GMT-05:00)" },
    { value: "America/Los_Angeles", label: "America/Los_Angeles (GMT-08:00)" },
    { value: "Europe/London", label: "Europe/London (GMT+00:00)" },
    { value: "Europe/Berlin", label: "Europe/Berlin (GMT+01:00)" },
    { value: "Asia/Kolkata", label: "Asia/Kolkata (Asia/Calcutta)" },
    { value: "Asia/Singapore", label: "Asia/Singapore (GMT+08:00)" },
    { value: "Australia/Sydney", label: "Australia/Sydney (GMT+10:00)" }
  ];

  function removeTokenPanel() {
    if (tokenPanelElement && tokenPanelElement.parentElement) {
      tokenPanelElement.parentElement.removeChild(tokenPanelElement);
    }
    tokenPanelElement = null;
    accessTokenField = null;
    refreshTokenField = null;
    tokenStatusElement = null;
    tokenRefreshButton = null;
    currentRefreshToken = null;
  }

  function attachTokenPanel(parent) {
    if (!SHOW_TOKEN_SECTION || !parent) {
      return;
    }

    removeTokenPanel();

    tokenPanelElement = document.createElement("div");
    tokenPanelElement.className = "card shadow-sm border-0 mt-4 token-panel";
    tokenPanelElement.innerHTML = `
      <div class="card-body p-4 p-md-5">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3 mb-4">
          <div>
            <h2 class="h5 fw-semibold mb-1">Prototype tokens</h2>
            <p class="text-muted mb-0">Use these temporary tokens to call the backend directly.</p>
          </div>
          <button type="button" class="btn btn-outline-secondary btn-sm" data-action="refresh-tokens">
            Refresh tokens
          </button>
        </div>
        <div class="token-status text-muted small mb-4"></div>
        <div class="mb-4">
          <label class="form-label fw-semibold">Access token</label>
          <div class="input-group">
            <textarea class="form-control form-control-sm" rows="3" readonly data-token-field="access"></textarea>
            <button class="btn btn-outline-secondary" type="button" data-copy-target="access">Copy</button>
          </div>
        </div>
        <div>
          <label class="form-label fw-semibold">Refresh token</label>
          <div class="input-group">
            <textarea class="form-control form-control-sm" rows="2" readonly data-token-field="refresh"></textarea>
            <button class="btn btn-outline-secondary" type="button" data-copy-target="refresh">Copy</button>
          </div>
        </div>
      </div>
    `;

    accessTokenField = tokenPanelElement.querySelector('[data-token-field="access"]');
    refreshTokenField = tokenPanelElement.querySelector('[data-token-field="refresh"]');
    tokenStatusElement = tokenPanelElement.querySelector(".token-status");
    tokenRefreshButton = tokenPanelElement.querySelector('[data-action="refresh-tokens"]');

    tokenPanelElement.addEventListener("click", async (event) => {
      const control = event.target.closest("[data-copy-target]");
      if (!control) {
        return;
      }
      const target =
        control.dataset.copyTarget === "access" ? accessTokenField : refreshTokenField;
      if (!target || !target.value) {
        return;
      }
      try {
        await navigator.clipboard.writeText(target.value);
        control.textContent = "Copied!";
        setTimeout(() => {
          control.textContent = "Copy";
        }, 1500);
      } catch (error) {
        console.warn("Unable to copy token", error);
      }
    });

    if (tokenRefreshButton) {
      tokenRefreshButton.addEventListener("click", (event) => {
        event.preventDefault();
        refreshTokenValues(true);
      });
    }

    parent.appendChild(tokenPanelElement);
    refreshTokenValues();
  }

  async function refreshTokenValues(force = false) {
    if (!tokenPanelElement) {
      return;
    }

    if (tokenStatusElement) {
      tokenStatusElement.textContent = "Generating tokens...";
    }

    try {
      let accessToken;
      if (force) {
        accessToken = await resolveFreshAccessToken();
      } else {
        accessToken = await resolveAccessToken();
      }

      let refreshToken = currentRefreshToken;
      if (!refreshToken || !force) {
        refreshToken = await resolveRefreshToken();
        currentRefreshToken = refreshToken;
      }

      if (accessTokenField) {
        accessTokenField.value = accessToken || "No access token available.";
      }

      if (refreshTokenField) {
        refreshTokenField.value = refreshToken || "No refresh token available.";
      }

      if (tokenStatusElement) {
        tokenStatusElement.textContent = "Tokens copied here are for development only.";
      }
    } catch (error) {
      console.error("Unable to fetch tokens for prototype panel.", error);
      if (tokenStatusElement) {
        tokenStatusElement.textContent = "Unable to fetch tokens. Please try refreshing.";
      }
      if (accessTokenField) {
        accessTokenField.value = "";
      }
      if (refreshTokenField) {
        refreshTokenField.value = "";
      }
    }
  }

  function setModulesPageActive(isActive) {
    document.body.classList.toggle("modules-page-active", Boolean(isActive));

    if (!sessionContainer) {
      return;
    }

    const mainRow = sessionContainer.closest(".row");
    if (mainRow) {
      mainRow.classList.toggle("modules-page-row", Boolean(isActive));
    }

    const column = sessionContainer.closest(".col-12");
    if (column) {
      column.classList.toggle("modules-page-col", Boolean(isActive));
    }

    const card = sessionContainer.closest(".card");
    if (card) {
      card.classList.toggle("modules-page-card", Boolean(isActive));
    }

    const cardBody = sessionContainer.closest(".card-body");
    if (cardBody) {
      cardBody.classList.toggle("modules-page-card-body", Boolean(isActive));
    }

    sessionContainer.classList.toggle("modules-page-content", Boolean(isActive));
  }

  function setNavbarOrgName(name = DEFAULT_BRAND_NAME) {
    if (!navbarBrand) return;
    navbarBrand.textContent = name || DEFAULT_BRAND_NAME;
  }

  function hideNavbarDropdown() {
    if (!navbarLinks) return;
    const toggle = navbarLinks.querySelector(".dropdown-toggle");
    if (toggle && window.bootstrap?.Dropdown) {
      window.bootstrap.Dropdown.getOrCreateInstance(toggle).hide();
    }
  }

  function updateChangeOrgMenuState(enabled) {
    if (!changeOrgMenuButton) return;
    if (enabled) {
      changeOrgMenuButton.disabled = false;
      changeOrgMenuButton.classList.remove("disabled");
      changeOrgMenuButton.removeAttribute("aria-disabled");
    } else {
      changeOrgMenuButton.disabled = true;
      changeOrgMenuButton.classList.add("disabled");
      changeOrgMenuButton.setAttribute("aria-disabled", "true");
    }
  }

  function clearAlerts() {
    if (alerts) {
      alerts.innerHTML = "";
    }
  }

  function showLoggedOut() {
    if (!sessionContainer) return;
    removeTokenPanel();
    selectedOrg = null;
    setNavbarOrgName(DEFAULT_BRAND_NAME);
    setModulesPageActive(false);
    sessionContainer.innerHTML = `
      <div class="text-center w-100 py-5">
        <h1 class="display-6 fw-semibold mb-3">Welcome!</h1>
        <p class="text-muted mb-4">Sign in or create an account to continue.</p>
        <div class="d-flex flex-column flex-sm-row justify-content-center gap-3">
          <a class="btn btn-primary btn-lg" href="/signin">Sign in</a>
          <a class="btn btn-outline-secondary btn-lg" href="/signup">Create account</a>
        </div>
      </div>
    `;

    if (navbarLinks) {
      navbarLinks.innerHTML = `
        <li class="nav-item"><a class="nav-link" href="/signin">Sign In</a></li>
        <li class="nav-item"><a class="nav-link" href="/signup">Create account</a></li>
      `;
      changeOrgMenuButton = null;
      logoutButton = null;
    }
  }

  function setNavbarForUser(email) {
    if (!navbarLinks) return;
    navbarLinks.innerHTML = `
      <li class="nav-item dropdown">
        <button class="btn btn-link nav-link dropdown-toggle text-white px-2 fs-3 lh-1 dropdown-toggle-hide-caret" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="User menu">
          &#8942;
        </button>
        <ul class="dropdown-menu dropdown-menu-end shadow-sm">
          <li><h6 class="dropdown-header">${email ?? "Signed in"}</h6></li>
          <li><button class="dropdown-item" type="button" id="change-org-menu">Change organization</button></li>
          <li><hr class="dropdown-divider" /></li>
          <li><button class="dropdown-item" type="button" id="logout-btn">Log out</button></li>
        </ul>
      </li>
    `;

    changeOrgMenuButton = document.getElementById("change-org-menu");
    logoutButton = document.getElementById("logout-btn");

    if (changeOrgMenuButton) {
      changeOrgMenuButton.addEventListener("click", () => {
        if (changeOrgMenuButton.disabled) return;
        hideNavbarDropdown();
        renderOrgSelection(organizations);
      });
    }

    if (logoutButton) {
      logoutButton.addEventListener("click", async () => {
        hideNavbarDropdown();
        logoutButton.disabled = true;
        const originalLabel = logoutButton.textContent;
        logoutButton.textContent = "Logging out...";
        try {
          if (typeof signOut === "function") {
            await signOut();
          } else {
            window.location.href = "/";
          }
        } catch (error) {
          renderMessages(alerts, [{ text: "Unable to log out. Please try again." }], "warning");
          logoutButton.disabled = false;
          logoutButton.textContent = originalLabel || "Log out";
        }
      });
    }

    updateChangeOrgMenuState(Boolean(selectedOrg));
  }

  function renderPrimaryLoading(message) {
    if (!sessionContainer) return;
    removeTokenPanel();
    setModulesPageActive(false);
    sessionContainer.innerHTML = `
      <div class="d-flex flex-column align-items-center justify-content-center py-5 gap-3">
        <div class="spinner-border text-primary" role="status" aria-hidden="true"></div>
        <div class="text-muted">${message}</div>
      </div>
    `;
  }

  function createInlineSpinner(message) {
    return `
      <div class="d-flex align-items-center gap-3 text-muted py-4">
        <div class="spinner-border text-primary" role="status" aria-hidden="true"></div>
        <span>${message}</span>
      </div>
    `;
  }

  async function fetchAppblocks(path, options = {}) {
    const { headers = {}, params, method = "GET", body, useAccessToken = true, ...rest } = options;
    const url = buildBackendUrl(path, params);
    const fetchOptions = {
      method,
      credentials: options.credentials ?? "include",
      headers: {
        Accept: "application/json",
        ...headers
      },
      ...rest
    };

    if (useAccessToken && typeof acquireAccessToken === "function") {
      try {
        const token = await acquireAccessToken();
        if (token) {
          fetchOptions.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.warn("Unable to retrieve access token for AppBlocks APIs.", error);
      }
    }

    if (body !== undefined) {
      fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
      if (!fetchOptions.headers["Content-Type"]) {
        fetchOptions.headers["Content-Type"] = "application/json";
      }
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const error = new Error(`Request failed with status ${response.status}`);
      error.status = response.status;
      try {
        error.body = await response.json();
      } catch (e) {
        error.body = null;
      }
      throw error;
    }

    return response.json();
  }

  function handleAppblocksError(error, fallbackMessage, variant = "warning") {
    console.error(error);
    const detail = error?.body?.detail || error?.body?.message;
    const parts = [fallbackMessage];
    if (detail) {
      parts.push(detail);
    } else if (error?.status) {
      parts.push(`(status ${error.status})`);
    }
    renderMessages(alerts, [{ text: parts.join(" ") }], variant);
  }

  async function loadOrganizations() {
    clearAlerts();
    renderPrimaryLoading("Loading organizations...");

    try {
      organizations = await fetchAppblocks("/api/orgs");
    } catch (error) {
      handleAppblocksError(error, "Unable to load organizations.");
      sessionContainer.innerHTML = `
        <div class="text-center py-5">
          <p class="text-muted mb-3">We couldn't load your organizations.</p>
          <button class="btn btn-outline-secondary" id="retry-orgs">Try again</button>
        </div>
      `;
      const retryButton = document.getElementById("retry-orgs");
      if (retryButton) {
        retryButton.addEventListener("click", loadOrganizations);
      }
      return;
    }

    if (!Array.isArray(organizations) || organizations.length === 0) {
      renderOrgCreation();
      return;
    }

    renderOrgSelection(organizations);
  }

  function renderOrgCreation() {
    if (!sessionContainer) return;

    clearAlerts();
    selectedOrg = null;
    setNavbarOrgName(DEFAULT_BRAND_NAME);
    setModulesPageActive(false);
    updateChangeOrgMenuState(false);

    sessionContainer.innerHTML = `
      <div class="d-flex flex-column gap-4 w-100">
        <div>
          <h1 class="h3 fw-semibold mb-2">Create your organization</h1>
          <p class="text-muted mb-0">Set up your first organization to start exploring modules.</p>
        </div>
        <div class="card shadow-sm border-0">
          <div class="card-body p-4 p-md-5">
            <form class="d-flex flex-column gap-4" id="org-creation-form" novalidate>
              <div>
                <label class="form-label fw-semibold" for="org-name">Organization name</label>
                <input type="text" class="form-control form-control-lg" id="org-name" name="org-name" placeholder="Acme Corp" required />
              </div>
              <div>
                <label class="form-label fw-semibold" for="org-timezone">Time zone</label>
                <select class="form-select form-select-lg" id="org-timezone" name="org-timezone" required>
                  ${TIMEZONE_OPTIONS.map((tz, index) => `<option value="${tz.value}"${index === 0 ? " selected" : ""}>${tz.label}</option>`).join("")}
                </select>
              </div>
              <div class="d-flex flex-column flex-sm-row gap-3">
                <button type="submit" class="btn btn-primary btn-lg" id="create-org-btn">Create organization</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    attachTokenPanel(sessionContainer);

    const form = document.getElementById("org-creation-form");
    const nameInput = document.getElementById("org-name");
    const timezoneSelect = document.getElementById("org-timezone");
    const submitButton = document.getElementById("create-org-btn");

    if (!form || !nameInput || !timezoneSelect || !submitButton) {
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearAlerts();

      const orgName = nameInput.value.trim();
      const timezone = timezoneSelect.value;

      if (!orgName) {
        renderMessages(alerts, [{ text: "Please enter an organization name." }], "warning");
        nameInput.focus();
        return;
      }

      if (!timezone) {
        renderMessages(alerts, [{ text: "Please select a time zone." }], "warning");
        timezoneSelect.focus();
        return;
      }

      const originalButtonText = submitButton.textContent;
      submitButton.disabled = true;
      submitButton.textContent = "Creating...";

      try {
        const createdOrg = await fetchAppblocks("/api/orgs", {
          method: "POST",
          body: {
            org_name: orgName,
            timezone
          }
        });

        if (createdOrg && createdOrg.org_id) {
          organizations = [createdOrg];
          selectedOrg = createdOrg;
          setNavbarOrgName(createdOrg.org_name);
          renderPrimaryLoading("Loading modules...");
          await loadModulesForOrg(createdOrg);
          return;
        }

        await loadOrganizations();
      } catch (error) {
        handleAppblocksError(error, "Unable to create organization.", "danger");
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    });
  }

  function renderOrgSelection(orgs) {
    if (!sessionContainer) return;
    clearAlerts();
    updateChangeOrgMenuState(Boolean(selectedOrg));
    setNavbarOrgName(selectedOrg?.org_name ?? DEFAULT_BRAND_NAME);
    setModulesPageActive(false);

    sessionContainer.innerHTML = `
      <div class="d-flex flex-column gap-4 w-100">
        <div>
          <h1 class="h3 fw-semibold mb-2">Select your organization</h1>
          <p class="text-muted mb-0">Choose the organization you want to work with.</p>
        </div>
        <div class="card shadow-sm border-0">
          <div class="card-body p-4 p-md-5">
            <form class="d-flex flex-column gap-4" id="org-selection-form">
              <div>
                <label class="form-label fw-semibold" for="org-select">Organization</label>
                <select class="form-select form-select-lg" id="org-select" required>
                  ${orgs
                    .map(
                      (org) =>
                        `<option value="${org.org_id}">${org.org_name} (${org.timezone})</option>`
                    )
                    .join("")}
                </select>
              </div>
              <div class="d-flex flex-column flex-sm-row gap-3">
                <button type="submit" class="btn btn-primary btn-lg">Continue</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    attachTokenPanel(sessionContainer);

    const form = document.getElementById("org-selection-form");
    const select = document.getElementById("org-select");

    if (select && selectedOrg) {
      select.value = String(selectedOrg.org_id);
    }

    if (form && select) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const selectedId = select.value;
        selectedOrg = orgs.find((org) => String(org.org_id) === String(selectedId));

        if (!selectedOrg) {
          renderMessages(alerts, [{ text: "Please choose an organization to continue." }], "warning");
          return;
        }

        clearAlerts();
        setNavbarOrgName(selectedOrg.org_name);
        updateChangeOrgMenuState(true);
        renderPrimaryLoading("Loading modules...");
        await loadModulesForOrg(selectedOrg);
      });
    }
  }

  async function loadModulesForOrg(org) {
    setNavbarOrgName(org.org_name);
    updateChangeOrgMenuState(true);
    try {
      modules = await fetchAppblocks("/api/modules", {
        headers: { "X-Org-ID": org.org_id }
      });
    } catch (error) {
      handleAppblocksError(error, "Unable to load modules.");
      setModulesPageActive(false);
      sessionContainer.innerHTML = `
        <div class="text-center py-5">
          <p class="text-muted mb-4">We ran into a problem while loading modules for ${org.org_name}.</p>
          <div class="d-flex flex-column flex-sm-row gap-3 justify-content-center">
            <button class="btn btn-primary" id="retry-modules">Try again</button>
            <button class="btn btn-outline-secondary" id="change-org">Choose another organization</button>
          </div>
        </div>
      `;

      const retry = document.getElementById("retry-modules");
      if (retry) {
        retry.addEventListener("click", () => {
          clearAlerts();
          renderPrimaryLoading("Loading modules...");
          loadModulesForOrg(org);
        });
      }

      const change = document.getElementById("change-org");
      if (change) {
        change.addEventListener("click", () => renderOrgSelection(organizations));
      }
      return;
    }

    renderAppShell(org, Array.isArray(modules) ? modules : []);
  }

  function renderAppShell(org, moduleList) {
    if (!sessionContainer) return;
    removeTokenPanel();
    setNavbarOrgName(org.org_name);
    updateChangeOrgMenuState(true);
    setModulesPageActive(true);

    sessionContainer.innerHTML = `
      <div class="modules-layout" id="modules-layout">
        <aside class="modules-sidebar" id="modules-sidebar" aria-label="Modules navigation">
          <div class="modules-sidebar-inner">
            <div class="modules-sidebar-header">
              <span class="modules-sidebar-title">Modules</span>
              <span class="modules-sidebar-meta">Timezone: ${org.timezone}</span>
            </div>
            <div class="list-group list-group-flush" id="modules-list"></div>
          </div>
        </aside>
        <div class="modules-content">
          <div class="modules-content-header">
            <button class="modules-menu-toggle d-lg-none" type="button" id="modules-menu-toggle" aria-controls="modules-sidebar" aria-expanded="false" aria-label="Toggle modules navigation">
              <span class="modules-menu-icon"></span>
            </button>
            <div class="modules-content-titles">
              <h1 class="modules-title" id="module-title"></h1>
              <p class="modules-subtitle text-muted" id="module-subtitle"></p>
            </div>
          </div>
          <div id="module-data" class="modules-data"></div>
        </div>
      </div>
    `;

    modulesListElement = document.getElementById("modules-list");
    moduleTitleElement = document.getElementById("module-title");
    moduleSubtitleElement = document.getElementById("module-subtitle");
    moduleDataElement = document.getElementById("module-data");

    const sidebar = document.getElementById("modules-sidebar");
    const toggleButton = document.getElementById("modules-menu-toggle");
    const desktopQuery = typeof window.matchMedia === "function" ? window.matchMedia("(min-width: 992px)") : null;

    const closeSidebarOnMobile = () => {
      if (!sidebar || !toggleButton) return;
      const isDesktop = desktopQuery ? desktopQuery.matches : window.innerWidth >= 992;
      if (isDesktop) return;
      if (sidebar.classList.contains("is-open")) {
        sidebar.classList.remove("is-open");
        toggleButton.setAttribute("aria-expanded", "false");
      }
    };

    if (toggleButton && sidebar) {
      toggleButton.addEventListener("click", () => {
        const isOpen = sidebar.classList.toggle("is-open");
        toggleButton.setAttribute("aria-expanded", String(isOpen));
      });

      if (desktopQuery) {
        const handleDesktopChange = (event) => {
          if (event.matches) {
            sidebar.classList.remove("is-open");
            toggleButton.setAttribute("aria-expanded", "false");
          }
        };

        handleDesktopChange(desktopQuery);
        if (typeof desktopQuery.addEventListener === "function") {
          desktopQuery.addEventListener("change", handleDesktopChange);
        } else if (typeof desktopQuery.addListener === "function") {
          desktopQuery.addListener(handleDesktopChange);
        }
      }
    }

    if (!modulesListElement || !moduleDataElement || !moduleTitleElement || !moduleSubtitleElement) {
      return;
    }

    modulesListElement.innerHTML = "";
    moduleTitleElement.textContent = "";
    moduleSubtitleElement.textContent = "";
    moduleDataElement.innerHTML = "";

    if (!moduleList || moduleList.length === 0) {
      renderModuleEmptyState("No modules are available for this organization yet.");
      return;
    }

    moduleList.forEach((module) => {
      const apiName = module.module_api_name ?? module.api_name;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "list-group-item list-group-item-action py-3 text-start";
      button.dataset.apiName = apiName;
      button.innerHTML = `
        <div class="d-flex flex-column">
          <span class="fw-semibold">${module.name}</span>
          <small class="text-muted">${apiName}</small>
        </div>
      `;
      button.addEventListener("click", () => {
        activateModule(module);
        closeSidebarOnMobile();
      });
      modulesListElement.appendChild(button);
    });

    activateModule(moduleList[0]);
  }

  function renderModuleEmptyState(message) {
    if (!moduleTitleElement || !moduleSubtitleElement || !moduleDataElement) {
      return;
    }
    moduleTitleElement.textContent = "Modules";
    moduleSubtitleElement.textContent = "";
    moduleDataElement.innerHTML = `
      <div class="text-center text-muted py-5">
        <p class="mb-0">${message}</p>
      </div>
    `;
  }

  function setActiveModuleButton(apiName) {
    if (!modulesListElement) return;
    modulesListElement.querySelectorAll("button").forEach((button) => {
      if (button.dataset.apiName === apiName) {
        button.classList.add("active");
        button.setAttribute("aria-current", "true");
      } else {
        button.classList.remove("active");
        button.removeAttribute("aria-current");
      }
    });
  }

  async function activateModule(module) {
    if (!module || !moduleDataElement || !moduleTitleElement || !moduleSubtitleElement) {
      return;
    }

    const apiName = module.module_api_name ?? module.api_name;
    if (!apiName) {
      handleAppblocksError(
        new Error("Module is missing an API name."),
        "Unable to load module data."
      );
      return;
    }

    clearAlerts();
    setActiveModuleButton(apiName);
    moduleTitleElement.textContent = module.name;
    moduleSubtitleElement.textContent = `API: ${apiName}`;
    moduleDataElement.innerHTML = createInlineSpinner("Loading data...");

    try {
      const endpoint = `/api/${encodeURIComponent(apiName)}`;
      const records = await fetchAppblocks(endpoint, {
        headers: { "X-Org-ID": selectedOrg.org_id },
        params: { limit: 50, offset: 0 }
      });
      const countLabel = `${records?.length ?? 0} ${records?.length === 1 ? "record" : "records"}`;
      moduleSubtitleElement.textContent = `API: ${apiName} · ${countLabel}`;
      renderModuleData(records);
    } catch (error) {
      handleAppblocksError(error, `Unable to load ${module.name} data.`);
      moduleDataElement.innerHTML = `
        <div class="text-center text-muted py-5">
          <p class="mb-3">We couldn't load the ${module.name} records.</p>
          <button class="btn btn-outline-secondary" id="retry-module">Try again</button>
        </div>
      `;
      const retryButton = document.getElementById("retry-module");
      if (retryButton) {
        retryButton.addEventListener("click", () => activateModule(module));
      }
    }
  }

  function renderModuleData(records) {
    if (!moduleDataElement) return;

    if (!Array.isArray(records) || records.length === 0) {
      moduleDataElement.innerHTML = `
        <div class="text-center text-muted py-5">
          <p class="mb-0">No records found for this module.</p>
        </div>
      `;
      return;
    }

    const columns = Array.from(
      records.reduce((set, record) => {
        Object.keys(record || {}).forEach((key) => set.add(key));
        return set;
      }, new Set())
    );

    const table = document.createElement("table");
    table.className = "table table-striped table-hover align-middle mb-0";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    columns.forEach((column) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = formatColumnHeader(column);
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    records.forEach((record) => {
      const row = document.createElement("tr");
      columns.forEach((column) => {
        const cell = document.createElement("td");
        const value = record[column];
        if (value === null || value === undefined) {
          cell.textContent = "—";
        } else if (typeof value === "object") {
          cell.textContent = JSON.stringify(value);
        } else {
          cell.textContent = value;
        }
        row.appendChild(cell);
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    const wrapper = document.createElement("div");
    wrapper.className = "table-responsive";
    wrapper.appendChild(table);

    moduleDataElement.innerHTML = "";
    moduleDataElement.appendChild(wrapper);
  }

  function formatColumnHeader(key) {
    return key
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  try {
    const session = await fetchSession();

    if (!session) {
      showLoggedOut();
      return;
    }

    const identity = session.identity ?? {};
    const traits = identity.traits ?? {};
    const email = traits.email ?? "Signed in";

    setNavbarForUser(email);
    await loadOrganizations();
  } catch (error) {
    showLoggedOut();
    renderMessages(alerts, [{ text: "We couldn't check your session. Please try again." }], "warning");
  }
});
