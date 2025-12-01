document.addEventListener("DOMContentLoaded", async () => {
  const { startHydraLogin, handleOAuthCallback, renderMessages } = window.KratosHelpers;

  const alertContainer = document.getElementById("flow-alerts");
  const signInButton = document.getElementById("oauth-signin-btn");

  try {
    const handled = await handleOAuthCallback();
    if (handled) {
      window.location.href = "/";
      return;
    }
  } catch (error) {
    renderMessages(alertContainer, [{ text: error.message || "Unable to complete sign-in." }], "warning");
  }

  if (signInButton) {
    signInButton.addEventListener("click", () => startHydraLogin());
  }
});
