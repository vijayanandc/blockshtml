document.addEventListener("DOMContentLoaded", async () => {
  const { fetchSession, renderMessages, getLogoutUrl, buildAppblocksUrl } = window.KratosHelpers;

  const sessionContainer = document.getElementById("session-content");
  const alerts = document.getElementById("session-alerts");
  const navbarLinks = document.getElementById("navbar-links");
  const navbarBrand = document.getElementById("navbar-brand-label");

  const DEFAULT_BRAND_NAME = navbarBrand?.textContent?.trim() || "Kratos Client";

  let organizations = [];
  let selectedOrg = null;
  let modules = [];

  let changeOrgMenuButton = null;
  let logoutButton = null;

  let modulesListElement = null;
  let moduleTitleElement = null;
  let moduleSubtitleElement = null;
  let moduleDataElement = null;

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
    selectedOrg = null;
    setNavbarOrgName(DEFAULT_BRAND_NAME);
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
        logoutButton.textContent = "Logging out...";
        try {
          const logoutUrl = await getLogoutUrl();
          window.location.href = logoutUrl;
        } catch (error) {
          renderMessages(alerts, [{ text: "Unable to log out. Please try again." }], "warning");
          logoutButton.disabled = false;
          logoutButton.textContent = "Log out";
        }
      });
    }

    updateChangeOrgMenuState(Boolean(selectedOrg));
  }

  function renderPrimaryLoading(message) {
    if (!sessionContainer) return;
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
    const { headers = {}, params } = options;
    const url = buildAppblocksUrl(path, params);
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...headers
      }
    });

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
      sessionContainer.innerHTML = `
        <div class="text-center py-5">
          <h2 class="h4 fw-semibold mb-2">No organizations found</h2>
          <p class="text-muted mb-4">Your account is not associated with any organizations yet.</p>
        </div>
      `;
      return;
    }

    renderOrgSelection(organizations);
  }

  function renderOrgSelection(orgs) {
    if (!sessionContainer) return;
    clearAlerts();
    updateChangeOrgMenuState(Boolean(selectedOrg));
    setNavbarOrgName(selectedOrg?.org_name ?? DEFAULT_BRAND_NAME);

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
    setNavbarOrgName(org.org_name);
    updateChangeOrgMenuState(true);

    sessionContainer.innerHTML = `
      <div class="d-flex flex-column gap-4 w-100">
        <div class="row g-4">
          <div class="col-12 col-lg-3">
            <div class="card shadow-sm border-0 h-100">
              <div class="card-header bg-white py-3">
                <div class="d-flex flex-column">
                  <h2 class="h6 mb-1 text-uppercase text-muted">Modules</h2>
                  <span class="text-muted small">Timezone: ${org.timezone}</span>
                </div>
              </div>
              <div class="list-group list-group-flush" id="modules-list"></div>
            </div>
          </div>
          <div class="col-12 col-lg-9">
            <div class="card shadow-sm border-0 h-100">
              <div class="card-body p-4 d-flex flex-column gap-3">
                <div>
                  <h2 class="h4 fw-semibold mb-1" id="module-title"></h2>
                  <p class="text-muted mb-0" id="module-subtitle"></p>
                </div>
                <div id="module-data" class="flex-grow-1 d-flex flex-column"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    modulesListElement = document.getElementById("modules-list");
    moduleTitleElement = document.getElementById("module-title");
    moduleSubtitleElement = document.getElementById("module-subtitle");
    moduleDataElement = document.getElementById("module-data");

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
      const button = document.createElement("button");
      button.type = "button";
      button.className = "list-group-item list-group-item-action py-3 text-start";
      button.dataset.apiName = module.api_name;
      button.innerHTML = `
        <div class="d-flex flex-column">
          <span class="fw-semibold">${module.name}</span>
          <small class="text-muted">${module.api_name}</small>
        </div>
      `;
      button.addEventListener("click", () => activateModule(module));
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
    clearAlerts();
    setActiveModuleButton(module.api_name);
    moduleTitleElement.textContent = module.name;
    moduleSubtitleElement.textContent = `API: ${module.api_name}`;
    moduleDataElement.innerHTML = createInlineSpinner("Loading data...");

    try {
      const endpoint = `/api/${encodeURIComponent(module.api_name)}`;
      const records = await fetchAppblocks(endpoint, {
        headers: { "X-Org-ID": selectedOrg.org_id },
        params: { limit: 50, offset: 0 }
      });
      const countLabel = `${records?.length ?? 0} ${records?.length === 1 ? "record" : "records"}`;
      moduleSubtitleElement.textContent = `API: ${module.api_name} · ${countLabel}`;
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
