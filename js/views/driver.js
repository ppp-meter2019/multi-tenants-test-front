/**
 * Driver view:
 *   - own profile (read from /api/drivers/?username=<self>),
 *   - routes assigned to them (read from /api/routes/, backend filters by driver).
 */

import { api } from "../api.js";
import { getSession } from "../auth.js";
import { el, clear, errorText } from "../ui.js";

export async function renderDriver(host) {
  clear(host);
  const session = getSession();

  const profileCard = el("div", { class: "card" }, el("h2", {}, "Мій профіль"));
  const routesCard = el("div", { class: "card" }, el("h2", {}, "Мої маршрути"));
  host.append(profileCard, routesCard);

  // Drivers can read /api/routes/ — backend already filters to "where driver
  // is me". For the profile, we don't have a driver-side endpoint; we fall
  // back to showing what we already know from the JWT/session.
  profileCard.append(
    kv("Логін", session.username),
    kv("Тенант (схема)", session.schema),
    kv("Роль", "Водій"),
  );

  try {
    const data = await api.get("/api/routes/");
    const routes = Array.isArray(data) ? data : (data.results || []);
    if (!routes.length) {
      routesCard.append(el("p", { class: "muted" }, "На вас поки що нічого не призначено."));
      return;
    }
    const tbl = el("table", {},
      el("thead", {}, el("tr", {},
        el("th", {}, "ID"),
        el("th", {}, "Назва"),
        el("th", {}, "Машина"),
        el("th", {}, "Замовлення"),
        el("th", {}, "Статус"),
        el("th", {}, "Створено"),
      )),
      el("tbody", {}, ...routes.map((r) => el("tr", {},
        el("td", {}, r.id),
        el("td", {}, r.name),
        el("td", {}, "#" + r.car),
        el("td", {}, (r.orders || []).map((o) => "#" + o).join(", ") || "—"),
        el("td", {}, el("span", { class: "pill" }, r.status)),
        el("td", {}, (r.created_at || "").slice(0, 10)),
      ))),
    );
    routesCard.append(tbl);
  } catch (error) {
    routesCard.append(el("div", { class: "message error" }, errorText(error)));
  }
}

function kv(label, value) {
  return el("div", { style: "margin: 0.3rem 0" },
    el("span", { class: "muted" }, label + ": "),
    el("strong", {}, String(value || "—")),
  );
}