// Central configuration for AppBlocks API requests.
// Update these URLs to point to the desired servers.
(function configureAppblocksEndpoints() {
  const DEFAULT_BACKEND_URL = "https://appblocks.in";
  const DEFAULT_ACCOUNTS_URL = "https://accounts.appblocks.in";
  const DEFAULT_HYDRA_URL = "https://hydra.appblocks.in";

  window.APPBLOCKS_BACKEND_BASE_URL =
    window.APPBLOCKS_BACKEND_BASE_URL || DEFAULT_BACKEND_URL;

  window.APPBLOCKS_ACCOUNTS_BASE_URL =
    window.APPBLOCKS_ACCOUNTS_BASE_URL || DEFAULT_ACCOUNTS_URL;

  window.HYDRA_PUBLIC_URL = window.HYDRA_PUBLIC_URL || DEFAULT_HYDRA_URL;

  // OAuth2 client configuration for Ory Hydra.
  // Redirect defaults to the current origin so the SPA can finish the PKCE flow.
  window.HYDRA_OAUTH_CLIENT_ID =
    window.HYDRA_OAUTH_CLIENT_ID || "appblocks-public-client";

  window.HYDRA_OAUTH_SCOPES =
    window.HYDRA_OAUTH_SCOPES || "openid offline offline_access profile email";

  window.HYDRA_OAUTH_REDIRECT_URI =
    window.HYDRA_OAUTH_REDIRECT_URI || window.location.origin + "/";

  // Maintain legacy globals for compatibility if they are not explicitly set.
  if (!window.APPBLOCKS_BASE_URL) {
    window.APPBLOCKS_BASE_URL = window.APPBLOCKS_BACKEND_BASE_URL;
  }

  if (!window.KRATOS_PUBLIC_URL) {
    window.KRATOS_PUBLIC_URL = window.APPBLOCKS_ACCOUNTS_BASE_URL;
  }
})();
