/**
 * Frontend configuration. Edit these two constants when you deploy.
 *
 * APP_DOMAIN — your platform apex (the bare domain that resolves to nginx).
 *   Examples:
 *     "example.com"        — site at  https://example.com  + https://alpha.example.com
 *     "app.example.com"    — site at  https://app.example.com + https://alpha.app.example.com
 *     ""                   — local dev with manual tenant input on the login form
 *
 *   When set, the frontend reads `window.location.hostname`, strips APP_DOMAIN,
 *   and uses whatever's left as the tenant subdomain (empty = public host).
 *
 * API_PORT  — leave empty to talk to the same origin as the page (the normal
 *   production setup behind nginx — nginx proxies /api/, /admin/, /static/
 *   to Django on a unix socket or upstream port).
 *
 *   In local dev where the frontend is served by `python -m http.server 5500`
 *   and Django runs on :8000, set "8000" so the frontend knows to switch port.
 */

export const APP_DOMAIN = "";
export const API_PORT = "8000";
