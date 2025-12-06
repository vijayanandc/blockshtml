// Central configuration for App Blocks authentication UI.
// Used only for Kratos + Hydra login/consent flows.
(function configureAppBlocksAuthEndpoints() {
  const DEFAULT_ACCOUNTS_URL = "https://iam.appblocks.in";
  const DEFAULT_HYDRA_URL = "https://auth.appblocks.in";

  // Kratos (accounts) public base URL.
  window.APPBLOCKS_ACCOUNTS_BASE_URL =
    window.APPBLOCKS_ACCOUNTS_BASE_URL || DEFAULT_ACCOUNTS_URL;

  // Hydra public base URL (port 4444 in dev).
  window.HYDRA_PUBLIC_URL = window.HYDRA_PUBLIC_URL || DEFAULT_HYDRA_URL;

  // Hydra admin endpoint for handling login and consent challenges.
  window.HYDRA_ADMIN_URL =
    window.HYDRA_ADMIN_URL || window.HYDRA_PUBLIC_URL?.replace(":4444", ":4445");

  // Default Kratos public URL if not explicitly set.
  if (!window.KRATOS_PUBLIC_URL) {
    window.KRATOS_PUBLIC_URL = window.APPBLOCKS_ACCOUNTS_BASE_URL;
  }
})();
