# Logto Traditional Web UI

A lightweight, responsive Bootstrap client for [Logto](https://logto.io/) based authentication flows. It provides sign-up, sign-in and logout experiences that rely on the Logto hosted pages and showcases AppBlocks data once the user is authenticated.

## Getting started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the static site on port **3000** (this must match the redirect URIs configured in Logto).

   ```bash
   npm run dev
   ```

   The site will be available at `http://127.0.0.1:3000`.

3. Configure Logto:

   - Create a traditional web application.
   - Add `http://127.0.0.1:3000/callback` to the redirect URIs.
   - Add `http://127.0.0.1:3000` to the post sign-out redirect URIs.
   - Make sure the application is allowed to request the `openid profile email offline_access` scopes.

4. Point the UI at your services. By default the following endpoints are used:

   | Purpose               | Default value               | Override via `window` global                         |
   | --------------------- | --------------------------- | --------------------------------------------------- |
   | AppBlocks backend API | `http://127.0.0.1:8080`     | `APPBLOCKS_BACKEND_BASE_URL`                        |
   | Logto endpoint        | `http://127.0.0.1:3001`     | `LOGTO_ENDPOINT`                                    |
   | Logto app ID          | `appblocks-traditional-web` | `LOGTO_APP_ID`                                      |
   | Resource identifier   | backend URL                 | `LOGTO_RESOURCE_ID`, `LOGTO_RESOURCES` (array)      |
   | Redirect URI          | `http://127.0.0.1:3000/callback` | `LOGTO_DEFAULT_REDIRECT_URI`                   |
   | Post logout URI       | `http://127.0.0.1:3000`     | `LOGTO_POST_LOGOUT_REDIRECT_URI`                    |

   You can override these values by injecting a `<script>` before `assets/js/config.js` that sets the corresponding `window` variables.

5. With Logto and your backend running, open the following routes:

   - `http://127.0.0.1:3000/signin` – redirects to the Logto sign-in page.
   - `http://127.0.0.1:3000/signup` – redirects to Logto sign-up.
   - `http://127.0.0.1:3000` – shows the welcome dashboard with AppBlocks data.

## Features

- **Responsive layout** built with Bootstrap 5 and custom styling.
- **Native Logto integration** using the browser SDK for seamless sign-in, sign-up and sign-out.
- **Session-aware home page** that greets the authenticated identity, displays key traits and allows logging out.
- **Bearer token support** when calling the AppBlocks backend so API requests can be authorized via Logto resource scopes.

## Customisation

All static assets live in `public/assets`. Update the CSS or extend the helper functions in `public/assets/js/logto.js` to adjust the look & feel or support additional Logto flows. The helper exposes `signIn`, `signOut`, `getAccessToken` and `handleSignInCallback` so that new pages can initiate authentication.

## License

MIT
