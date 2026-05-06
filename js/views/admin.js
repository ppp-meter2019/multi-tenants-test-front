/**
 * Admin dashboard.
 * - tenant_admin (on the public host) sees ONLY the Tenants tab.
 * - company_admin (on a tenant host) sees Cars, Drivers, Customers, Products,
 *   Orders, Routes.
 *
 * Each tab is a tiny CRUD: list on the left, create-form below.
 */

import { api } from "../api.js";
import { getSession } from "../auth.js";
import { el, clear, flash, errorText } from "../ui.js";

export function renderAdmin(host) {
  clear(host);
  const session = getSession();
  const tabs = session.role === "tenant_admin" ? TENANT_ADMIN_TABS : COMPANY_ADMIN_TABS;

  const tabBar = el("div", { class: "tabs" });
  const content = el("div");
  let active = tabs[0];

  function paint() {
    tabBar.querySelectorAll(".tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.id === active.id);
    });
    clear(content);
    active.render(content);
  }

  for (const tab of tabs) {
    const btn = el("button", {
      class: "tab",
      "data-id": tab.id,
      onclick: () => { active = tab; paint(); },
    }, tab.label);
    tabBar.append(btn);
  }

  host.append(tabBar, content);
  paint();
}

// ---------------------------------------------------------------------------
// Generic CRUD card builder. `fields` is a list of {name, label, type?, required?}
// ---------------------------------------------------------------------------

function crudCard({ title, listEndpoint, createEndpoint, deleteEndpoint, columns, fields, transformCreate }) {
  return (host) => {
    const card = el("div", { class: "card" }, el("h2", {}, title));
    const tableWrap = el("div", {}, el("p", { class: "muted" }, "Завантаження..."));
    const formWrap = el("div");
    card.append(tableWrap, formWrap);
    host.append(card);

    async function refresh() {
      try {
        const data = await api.get(listEndpoint);
        const rows = Array.isArray(data) ? data : (data.results || []);
        renderTable(rows);
      } catch (error) {
        clear(tableWrap);
        tableWrap.append(el("div", { class: "message error" }, errorText(error)));
      }
    }

    function renderTable(rows) {
      clear(tableWrap);
      if (!rows.length) {
        tableWrap.append(el("p", { class: "muted" }, "Поки що порожньо."));
      } else {
        const table = el("table");
        const thead = el("thead", {}, el("tr", {},
          ...columns.map((c) => el("th", {}, c.label)),
          deleteEndpoint ? el("th", {}, "") : null,
        ));
        const tbody = el("tbody");
        for (const row of rows) {
          const tr = el("tr", {},
            ...columns.map((c) => el("td", {}, c.render ? c.render(row) : (row[c.key] ?? ""))),
            deleteEndpoint ? el("td", {},
              el("button", {
                class: "danger",
                onclick: async () => {
                  if (!confirm("Видалити запис #" + row.id + "?")) return;
                  try {
                    await api.delete(deleteEndpoint(row));
                    await refresh();
                  } catch (e) { flash(card, "error", errorText(e)); }
                },
              }, "Видалити"),
            ) : null,
          );
          tbody.append(tr);
        }
        table.append(thead, tbody);
        tableWrap.append(table);
      }
    }

    if (fields && createEndpoint) {
      formWrap.append(el("h3", {}, "Створити"));
      const form = el("form", { class: "row" });
      for (const f of fields) {
        const wrap = el("div", { style: "min-width: 160px" });
        wrap.append(el("label", {}, f.label));
        const input = el(f.type === "textarea" ? "textarea" : "input", {
          name: f.name,
          type: f.type === "textarea" ? undefined : (f.type || "text"),
          required: f.required ? true : undefined,
          step: f.step,
        });
        wrap.append(input);
        form.append(wrap);
      }
      const submit = el("div", { style: "align-self: flex-end" }, el("button", { type: "submit" }, "Додати"));
      form.append(submit);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        const payload = transformCreate ? transformCreate(data) : data;
        try {
          await api.post(createEndpoint, payload);
          form.reset();
          flash(card, "ok", "Додано.");
          await refresh();
        } catch (e) { flash(card, "error", errorText(e)); }
      });
      formWrap.append(form);
    }

    refresh();
  };
}

// ---------------------------------------------------------------------------
// tenant_admin tabs
// ---------------------------------------------------------------------------

const TENANT_ADMIN_TABS = [
  {
    id: "tenants",
    label: "Тенанти",
    render: crudCard({
      title: "Тенанти",
      listEndpoint: "/api/tenants/",
      createEndpoint: "/api/tenants/",
      deleteEndpoint: (row) => `/api/tenants/${row.id}/`,
      columns: [
        { key: "schema_name", label: "Schema" },
        { key: "name", label: "Назва" },
        { label: "Домени", render: (r) => (r.domains || []).map((d) => d.domain).join(", ") },
        { key: "created_on", label: "Створено" },
      ],
      fields: [
        { name: "schema_name", label: "Schema (alpha)", required: true },
        { name: "name", label: "Назва (Alpha LLC)", required: true },
        { name: "domain", label: "Домен (alpha.localhost)", required: true },
      ],
    }),
  },
];

// ---------------------------------------------------------------------------
// company_admin tabs
// ---------------------------------------------------------------------------

const COMPANY_ADMIN_TABS = [
  {
    id: "products",
    label: "Товари",
    render: crudCard({
      title: "Товари",
      listEndpoint: "/api/products/",
      createEndpoint: "/api/products/",
      deleteEndpoint: (row) => `/api/products/${row.id}/`,
      columns: [
        { key: "id", label: "ID" },
        { key: "name", label: "Назва" },
        { key: "price", label: "Ціна" },
      ],
      fields: [
        { name: "name", label: "Назва", required: true },
        { name: "price", label: "Ціна", required: true, type: "number", step: "0.01" },
      ],
    }),
  },
  {
    id: "cars",
    label: "Машини",
    render: crudCard({
      title: "Машини",
      listEndpoint: "/api/cars/",
      createEndpoint: "/api/cars/",
      deleteEndpoint: (row) => `/api/cars/${row.id}/`,
      columns: [
        { key: "id", label: "ID" },
        { key: "brand", label: "Бренд" },
        { key: "model", label: "Модель" },
        { key: "year", label: "Рік" },
        { key: "license_plate", label: "Номер" },
      ],
      fields: [
        { name: "brand", label: "Бренд", required: true },
        { name: "model", label: "Модель", required: true },
        { name: "year", label: "Рік", required: true, type: "number" },
        { name: "license_plate", label: "Номер", required: true },
      ],
      transformCreate: (d) => ({ ...d, year: Number(d.year) }),
    }),
  },
  {
    id: "drivers",
    label: "Водії",
    render: crudCard({
      title: "Водії",
      listEndpoint: "/api/drivers/",
      createEndpoint: "/api/drivers/",
      deleteEndpoint: (row) => `/api/drivers/${row.id}/`,
      columns: [
        { key: "id", label: "ID" },
        { key: "username", label: "Логін" },
        { key: "first_name", label: "Ім'я" },
        { key: "last_name", label: "Прізвище" },
        { key: "date_of_birth", label: "Дата народж." },
        { key: "license_number", label: "Ліцензія" },
      ],
      fields: [
        { name: "username", label: "Логін", required: true },
        { name: "password", label: "Пароль", required: true, type: "password" },
        { name: "first_name", label: "Ім'я", required: true },
        { name: "last_name", label: "Прізвище", required: true },
        { name: "date_of_birth", label: "Дата народження", required: true, type: "date" },
        { name: "license_number", label: "Номер ліцензії", required: true },
      ],
    }),
  },
  {
    id: "customers",
    label: "Замовники",
    render: crudCard({
      title: "Замовники",
      listEndpoint: "/api/customers/",
      createEndpoint: "/api/customers/",
      deleteEndpoint: (row) => `/api/customers/${row.id}/`,
      columns: [
        { key: "id", label: "ID" },
        { key: "username", label: "Логін" },
        { key: "first_name", label: "Ім'я" },
        { key: "last_name", label: "Прізвище" },
        { key: "phone", label: "Телефон" },
      ],
      fields: [
        { name: "username", label: "Логін", required: true },
        { name: "password", label: "Пароль", required: true, type: "password" },
        { name: "first_name", label: "Ім'я" },
        { name: "last_name", label: "Прізвище" },
        { name: "email", label: "Email" },
        { name: "phone", label: "Телефон" },
        { name: "address", label: "Адреса" },
      ],
    }),
  },
  {
    id: "orders",
    label: "Замовлення",
    render: renderOrdersAdmin,
  },
  {
    id: "routes",
    label: "Маршрути",
    render: renderRoutesAdmin,
  },
];

// ---------------------------------------------------------------------------
// Orders / Routes need richer UI than the generic helper supports
// ---------------------------------------------------------------------------

async function renderOrdersAdmin(host) {
  const card = el("div", { class: "card" }, el("h2", {}, "Замовлення"));
  host.append(card);
  try {
    const orders = await api.get("/api/orders/");
    const rows = Array.isArray(orders) ? orders : (orders.results || []);
    if (!rows.length) {
      card.append(el("p", { class: "muted" }, "Замовлень немає."));
      return;
    }
    const table = el("table", {},
      el("thead", {}, el("tr", {},
        el("th", {}, "ID"),
        el("th", {}, "Клієнт"),
        el("th", {}, "Статус"),
        el("th", {}, "Позиції"),
        el("th", {}, "Створено"),
      )),
      el("tbody", {}, ...rows.map((o) => el("tr", {},
        el("td", {}, o.id),
        el("td", {}, o.customer),
        el("td", {}, el("span", { class: "pill" }, o.status)),
        el("td", {}, (o.items || []).map((i) => `${i.product_name} ×${i.quantity}`).join(", ")),
        el("td", {}, (o.created_at || "").slice(0, 10)),
      ))),
    );
    card.append(table);
  } catch (e) {
    card.append(el("div", { class: "message error" }, errorText(e)));
  }
}

async function renderRoutesAdmin(host) {
  const card = el("div", { class: "card" }, el("h2", {}, "Маршрути"));
  host.append(card);

  let drivers = [], cars = [], orders = [], routes = [];
  try {
    [drivers, cars, orders, routes] = await Promise.all([
      api.get("/api/drivers/"),
      api.get("/api/cars/"),
      api.get("/api/orders/"),
      api.get("/api/routes/"),
    ]);
  } catch (e) {
    card.append(el("div", { class: "message error" }, errorText(e)));
    return;
  }
  drivers = drivers.results || drivers;
  cars = cars.results || cars;
  orders = orders.results || orders;
  routes = routes.results || routes;

  // existing routes
  if (routes.length) {
    const tbl = el("table", {},
      el("thead", {}, el("tr", {},
        el("th", {}, "ID"),
        el("th", {}, "Назва"),
        el("th", {}, "Водій"),
        el("th", {}, "Машина"),
        el("th", {}, "Замовлення"),
        el("th", {}, "Статус"),
      )),
      el("tbody", {}, ...routes.map((r) => el("tr", {},
        el("td", {}, r.id),
        el("td", {}, r.name),
        el("td", {}, labelDriver(drivers.find((d) => d.id === r.driver))),
        el("td", {}, labelCar(cars.find((c) => c.id === r.car))),
        el("td", {}, (r.orders || []).join(", ") || "—"),
        el("td", {}, el("span", { class: "pill" }, r.status)),
      ))),
    );
    card.append(tbl);
  } else {
    card.append(el("p", { class: "muted" }, "Маршрутів немає."));
  }

  // create form
  card.append(el("h3", {}, "Новий маршрут"));
  const form = el("form", { class: "row" });
  const inputName = el("input", { name: "name", required: true });
  const selectDriver = el("select", { name: "driver", required: true },
    el("option", { value: "" }, "— водій —"),
    ...drivers.map((d) => el("option", { value: d.id }, labelDriver(d))),
  );
  const selectCar = el("select", { name: "car", required: true },
    el("option", { value: "" }, "— машина —"),
    ...cars.map((c) => el("option", { value: c.id }, labelCar(c))),
  );
  const ordersBox = el("select", { name: "orders", multiple: true, size: Math.min(6, Math.max(3, orders.length)) },
    ...orders.map((o) => el("option", { value: o.id }, `#${o.id} — ${o.customer} (${o.status})`)),
  );
  const selectStatus = el("select", { name: "status" },
    ...["planned", "active", "completed", "cancelled"].map((s) => el("option", { value: s }, s)),
  );

  form.append(
    formField("Назва", inputName),
    formField("Водій", selectDriver),
    formField("Машина", selectCar),
    formField("Замовлення (Ctrl+click)", ordersBox),
    formField("Статус", selectStatus),
    el("div", { style: "align-self: flex-end" }, el("button", { type: "submit" }, "Створити")),
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const orderIds = Array.from(ordersBox.selectedOptions).map((o) => Number(o.value));
    const payload = {
      name: inputName.value.trim(),
      driver: Number(selectDriver.value),
      car: Number(selectCar.value),
      orders: orderIds,
      status: selectStatus.value,
    };
    try {
      await api.post("/api/routes/", payload);
      flash(card, "ok", "Маршрут створено.");
      renderRoutesAdmin(host);  // re-fetch
      card.remove();
    } catch (e) { flash(card, "error", errorText(e)); }
  });
  card.append(form);
}

function formField(label, input) {
  return el("div", { style: "min-width: 180px" },
    el("label", {}, label),
    input,
  );
}

function labelDriver(d) {
  if (!d) return "—";
  return `${d.first_name || ""} ${d.last_name || ""} (${d.username})`.trim();
}
function labelCar(c) {
  if (!c) return "—";
  return `${c.brand} ${c.model} [${c.license_plate}]`;
}