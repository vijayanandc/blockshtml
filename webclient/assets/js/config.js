// Central configuration for the App Blocks web client.
// Adjust these defaults as needed for your environment.
(function configureAppBlocksWebClient() {
  const DEFAULT_AUTH_SERVER_URL = "http://127.0.0.1:4444";
  const DEFAULT_CLIENT_ID = "ca668a7d-1461-4358-b2fd-6a60f2420ee3";
  const DEFAULT_SCOPES = "openid offline offline_access profile email";
  const DEFAULT_ACCOUNTS_URL = "http://127.0.0.1:4433";
  const DEFAULT_BACKEND_URL = "http://127.0.0.1:8080";

  const origin = window.location.origin;
  const DEFAULT_REDIRECT_URI = `${origin}/callback`;

  window.APPBLOCKS_AUTH_SERVER_URL =
    window.APPBLOCKS_AUTH_SERVER_URL || DEFAULT_AUTH_SERVER_URL;

  window.APPBLOCKS_CLIENT_ID =
    window.APPBLOCKS_CLIENT_ID || DEFAULT_CLIENT_ID;

  window.APPBLOCKS_SCOPES =
    window.APPBLOCKS_SCOPES || DEFAULT_SCOPES;

  window.APPBLOCKS_REDIRECT_URI =
    window.APPBLOCKS_REDIRECT_URI || DEFAULT_REDIRECT_URI;

  window.APPBLOCKS_ACCOUNTS_BASE_URL =
    window.APPBLOCKS_ACCOUNTS_BASE_URL || DEFAULT_ACCOUNTS_URL;

  window.APPBLOCKS_BACKEND_BASE_URL =
    window.APPBLOCKS_BACKEND_BASE_URL || DEFAULT_BACKEND_URL;
})();
