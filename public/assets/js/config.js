// Central configuration for AppBlocks API requests.
// Update these URLs to point to the desired servers.
(function configureAppblocksEndpoints() {
  const DEFAULT_BACKEND_URL = "http://127.0.0.1:8080";
  const DEFAULT_ACCOUNTS_URL = "https://5dffq2.logto.app";

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

  const DEFAULT_LOGTO_ENDPOINT = "https://5dffq2.logto.app";
  const DEFAULT_POST_LOGOUT_REDIRECT_URI = window.location.origin;

  window.LOGTO_ENDPOINT = window.LOGTO_ENDPOINT || DEFAULT_LOGTO_ENDPOINT;
  window.LOGTO_APP_ID = "1uqz2f01b42wmoqhtppo8";
  window.LOGTO_DEFAULT_REDIRECT_URI = "http://127.0.0.1:3000/callback";
  window.LOGTO_POST_LOGOUT_REDIRECT_URI =
    window.LOGTO_POST_LOGOUT_REDIRECT_URI || DEFAULT_POST_LOGOUT_REDIRECT_URI;

  if (typeof window.LOGTO_RESOURCE_ID === "undefined") {
    window.LOGTO_RESOURCE_ID = null;
  }

  if (!window.LOGTO_RESOURCES) {
    window.LOGTO_RESOURCES = [];
  }

  if (typeof window.APPBLOCKS_SHOW_TOKENS === "undefined") {
    window.APPBLOCKS_SHOW_TOKENS = true;
  }
})();
