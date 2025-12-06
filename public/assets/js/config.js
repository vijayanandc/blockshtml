// Central configuration for AppBlocks API requests.
// Update these URLs to point to the desired servers.
(function configureAppblocksEndpoints() {
  const DEFAULT_BACKEND_URL = "http://127.0.0.1:8080";
  const DEFAULT_ACCOUNTS_URL = "http://127.0.0.1:4433";
  const DEFAULT_HYDRA_URL = "http://127.0.0.1:4444";

  window.APPBLOCKS_BACKEND_BASE_URL =
    window.APPBLOCKS_BACKEND_BASE_URL || DEFAULT_BACKEND_URL;

  window.APPBLOCKS_ACCOUNTS_BASE_URL =
    window.APPBLOCKS_ACCOUNTS_BASE_URL || DEFAULT_ACCOUNTS_URL;

  window.HYDRA_PUBLIC_URL = window.HYDRA_PUBLIC_URL || DEFAULT_HYDRA_URL;

  // OAuth2 client configuration for Ory Hydra.
  // Redirect defaults to the current origin so the SPA can finish the PKCE flow.
  window.HYDRA_OAUTH_CLIENT_ID =
    window.HYDRA_OAUTH_CLIENT_ID || "b5467abd-109e-4740-a11a-065c6ac79346";

  window.HYDRA_OAUTH_SCOPES =
    window.HYDRA_OAUTH_SCOPES || "openid offline offline_access profile email";

  window.HYDRA_OAUTH_REDIRECT_URI =
    window.HYDRA_OAUTH_REDIRECT_URI || window.location.origin + "/";

  // Admin endpoint for handling Hydra login challenges. Falls back to replacing
  // the typical public port (4444) with the admin port (4445).
  window.HYDRA_ADMIN_URL =
    window.HYDRA_ADMIN_URL || window.HYDRA_PUBLIC_URL?.replace(":4444", ":4445");

  // Maintain legacy globals for compatibility if they are not explicitly set.
  if (!window.APPBLOCKS_BASE_URL) {
    window.APPBLOCKS_BASE_URL = window.APPBLOCKS_BACKEND_BASE_URL;
  }

  if (!window.KRATOS_PUBLIC_URL) {
    window.KRATOS_PUBLIC_URL = window.APPBLOCKS_ACCOUNTS_BASE_URL;
  }
})();
