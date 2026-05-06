/**
 * Entry point. Reads the session from localStorage and routes to the right
 * view by role. Login screen is what the user sees if no valid session.
 */

import { getSession, logout } from "./auth.js";
import { renderLogin } from "./views/login.js";
import { renderAdmin } from "./views/admin.js";
import { renderCustomer } from "./views/customer.js";
import { renderDriver } from "./views/driver.js";

const appEl = document.getElementById("app");
const topbarEl = document.getElementById("topbar");
const whoEl = document.getElementById("who");
const logoutBtn = document.getElementById("logout");

logoutBtn.addEventListener("click", () => {
  logout();
  route();
});

// If any view performs a fetch that comes back 401, the api module clears the
// session. Listen for storage changes so other tabs (or that clear) bring us
// back to the login screen.
window.addEventListener("storage", route);

route();

function route() {
  const session = getSession();
  if (!session) {
    topbarEl.hidden = true;
    renderLogin(appEl, () => route());
    return;
  }

  topbarEl.hidden = false;
  whoEl.textContent = `${session.username} · ${session.role} · ${session.schema}`;

  switch (session.role) {
    case "tenant_admin":
    case "company_admin":
      renderAdmin(appEl);
      break;
    case "customer":
      renderCustomer(appEl);
      break;
    case "driver":
      renderDriver(appEl);
      break;
    default:
      // unknown role → bounce back to login
      logout();
      route();
  }
}