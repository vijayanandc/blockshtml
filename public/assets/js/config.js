// Central configuration for AppBlocks API requests.
// Update these URLs to point to the desired servers.
(function configureAppblocksEndpoints() {
  const DEFAULT_BACKEND_URL = "https://appblocks.in";
  const DEFAULT_ACCOUNTS_URL = "https://accounts.appblocks.in";

  window.APPBLOCKS_BACKEND_BASE_URL =
    window.APPBLOCKS_BACKEND_BASE_URL || DEFAULT_BACKEND_URL;

  window.APPBLOCKS_ACCOUNTS_BASE_URL =
    window.APPBLOCKS_ACCOUNTS_BASE_URL || DEFAULT_ACCOUNTS_URL;

  // Maintain legacy globals for compatibility if they are not explicitly set.
  if (!window.APPBLOCKS_BASE_URL) {
    window.APPBLOCKS_BASE_URL = window.APPBLOCKS_BACKEND_BASE_URL;
  }

  if (!window.KRATOS_PUBLIC_URL) {
    window.KRATOS_PUBLIC_URL = window.APPBLOCKS_ACCOUNTS_BASE_URL;
  }
})();
