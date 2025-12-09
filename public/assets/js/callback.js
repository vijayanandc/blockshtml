document.addEventListener("DOMContentLoaded", async () => {
  const helpers = window.LogtoHelpers || window.AppBlocksHelpers || window.KratosHelpers;
  const alerts = document.getElementById("callback-alerts");
  const status = document.getElementById("callback-status");
  const homeLink = document.getElementById("callback-home");

  if (!helpers || !helpers.handleSignInCallback) {
    if (status) {
      status.textContent = "Missing authentication helpers on this page.";
    }
    if (homeLink) {
      homeLink.classList.remove("d-none");
    }
    return;
  }

  try {
    const result = await helpers.handleSignInCallback(window.location.href);

    if (!result?.handled && status) {
      status.textContent = "No pending sign-in request was found. You can safely return home.";
      if (homeLink) {
        homeLink.classList.remove("d-none");
      }
    }
  } catch (error) {
    console.error("Unable to finish Logto callback", error);
    if (helpers.renderMessages && alerts) {
      helpers.renderMessages(alerts, [
        { text: "We couldn't complete the sign-in flow. Please try again." }
      ]);
    }
    if (status) {
      status.classList.add("text-danger");
      status.textContent = "An error occurred while finalizing the sign-in flow.";
    }
    if (homeLink) {
      homeLink.classList.remove("d-none");
    }
  }
});
