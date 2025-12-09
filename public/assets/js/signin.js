document.addEventListener("DOMContentLoaded", async () => {
  const helpers = window.LogtoHelpers || window.AppBlocksHelpers || window.KratosHelpers;
  const alertContainer = document.getElementById("flow-alerts");
  const status = document.getElementById("auth-status");
  const button = document.getElementById("signin-btn");

  if (!helpers || !button) {
    return;
  }

  const defaultLabel = button.textContent;

  async function checkExistingSession() {
    if (!helpers.fetchSession) {
      return;
    }

    try {
      const session = await helpers.fetchSession();
      const email = session?.identity?.traits?.email;
      if (email) {
        status.classList.remove("d-none");
        status.textContent = `You're already signed in as ${email}.`;
        button.textContent = "Go to dashboard";
        button.dataset.authenticated = "true";
      }
    } catch (error) {
      console.warn("Unable to verify session", error);
    }
  }

  button.addEventListener("click", async () => {
    if (button.dataset.authenticated === "true") {
      window.location.href = "/";
      return;
    }

    if (alertContainer) {
      alertContainer.innerHTML = "";
    }

    button.disabled = true;
    button.textContent = "Redirecting...";

    try {
      await helpers.signIn({
        interactionMode: "signIn",
        returnPath: window.location.origin
      });
    } catch (error) {
      console.error("Unable to start Logto sign-in flow", error);
      if (helpers.renderMessages && alertContainer) {
        helpers.renderMessages(alertContainer, [
          { text: "Unable to contact the identity service. Please try again." }
        ]);
      }
      button.disabled = false;
      button.textContent = defaultLabel;
    }
  });

  await checkExistingSession();
});
