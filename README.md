# Ory Kratos Bootstrap UI

A lightweight, responsive Bootstrap client for [Ory Kratos](https://www.ory.sh/kratos) self-service flows. It provides sign-up, sign-in and logout experiences that consume the Kratos public API and showcases identity traits once the user is authenticated.

## Getting started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the static site on port **3000** (this must match the URLs in your `kratos.yml`).

   ```bash
   npm run dev
   ```

   The site will be available at `http://127.0.0.1:3000`.

3. With Kratos running using the provided configuration, open the following routes:

   - `http://127.0.0.1:4433/self-service/registration/browser` – redirects to the responsive sign-up page.
   - `http://127.0.0.1:4433/self-service/login/browser` – redirects to the sign-in page.
   - `http://127.0.0.1:3000` – shows the welcome dashboard with traits for the authenticated session.

## Features

- **Responsive layout** built with Bootstrap 5 and custom styling.
- **Dynamic form rendering** driven by Kratos UI nodes – CSRF fields, validation messages and submit buttons are handled automatically.
- **Session-aware home page** that greets the authenticated identity, displays key traits and allows logging out.
- **Logout shortcut** that retrieves the Kratos logout URL and redirects the user in one click.

## Customisation

All static assets live in `public/assets`. Update the CSS or extend the helper functions in `public/assets/js/kratos.js` to adjust the look & feel or support additional Kratos flows (settings, recovery, verification, ...).

## License

MIT
