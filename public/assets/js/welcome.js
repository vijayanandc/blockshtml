document.addEventListener("DOMContentLoaded", async () => {
  const { fetchSession, renderMessages, getLogoutUrl } = window.KratosHelpers;
  const sessionContainer = document.getElementById("session-content");
  const alerts = document.getElementById("session-alerts");
  const navbarLinks = document.getElementById("navbar-links");

  function showLoggedOut() {
    sessionContainer.innerHTML = `
      <div class="text-center w-100">
        <h1 class="display-6 fw-semibold mb-3">Welcome!</h1>
        <p class="text-muted mb-4">Sign in or create an account to manage your identity with Ory Kratos.</p>
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
    }
  }

  try {
    const session = await fetchSession();

    if (!session) {
      showLoggedOut();
      return;
    }

    const identity = session.identity ?? {};
    const traits = identity.traits ?? {};
    const fullName = [traits.name?.first, traits.name?.last].filter(Boolean).join(" ") || traits.email;

    if (navbarLinks) {
      navbarLinks.innerHTML = `
        <li class="nav-item"><span class="nav-link active">${traits.email ?? "Signed in"}</span></li>
        <li class="nav-item"><button class="btn btn-light btn-sm ms-lg-3" id="logout-btn">Log out</button></li>
      `;
    }

    sessionContainer.innerHTML = `
      <div class="d-flex flex-column gap-3 w-100">
        <div>
          <p class="text-uppercase text-muted mb-1">Signed in as</p>
          <h1 class="h2 fw-bold mb-0">${fullName ?? "Authenticated"}</h1>
        </div>
        <div class="row g-3">
          <div class="col-12 col-md-6">
            <div class="info-tile">
              <span class="info-label">Email</span>
              <span class="info-value">${traits.email ?? "-"}</span>
            </div>
          </div>
          <div class="col-12 col-md-6">
            <div class="info-tile">
              <span class="info-label">Session ID</span>
              <span class="info-value text-truncate" title="${session.id}">${session.id}</span>
            </div>
          </div>
          <div class="col-12 col-md-6">
            <div class="info-tile">
              <span class="info-label">Authentication Level</span>
              <span class="info-value text-capitalize">${session.authenticator_assurance_level ?? "n/a"}</span>
            </div>
          </div>
          <div class="col-12 col-md-6">
            <div class="info-tile">
              <span class="info-label">Issued</span>
              <span class="info-value">${new Date(session.issued_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const logoutButton = document.getElementById("logout-btn");
    if (logoutButton) {
      logoutButton.addEventListener("click", async () => {
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
  } catch (error) {
    showLoggedOut();
    renderMessages(alerts, [{ text: "We couldn't check your session. Please try again." }], "warning");
  }
});
