/**
 * Admin dashboard.
 * - tenant_admin (on the public host) sees ONLY the Tenants tab.
 * - company_admin (on a tenant host) sees Cars, Drivers, Customers, Products,
 *   Orders, Routes.
 *
 * Each tab is a tiny CRUD: list on top, create-form below.
 *
 * All UI strings are looked up via i18n — tab labels and column headers are
 * resolved at render time so toggling UA/EN re-renders correctly.
 */

import { api } from "../api.js";
import { apex, getSession } from "../auth.js";
import { t } from "../i18n.js";
import { el, clear, flash, errorText } from "../ui.js";

export function renderAdmin(host) {
  clear(host);
  const session = getSession();
  const tabs = session.role === "tenant_admin" ? tenantAdminTabs() : companyAdminTabs();

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
// Generic CRUD card builder.
// ---------------------------------------------------------------------------

function crudCard({ title, listEndpoint, createEndpoint, deleteEndpoint, columns, fields, transformCreate }) {
  return (host) => {
    const card = el("div", { class: "card" }, el("h2", {}, title));
    const tableWrap = el("div", {}, el("p", { class: "muted" }, t("common.loading")));
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
        tableWrap.append(el("p", { class: "muted" }, t("common.empty")));
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
                  if (!confirm(t("common.confirmDelete") + row.id + "?")) return;
                  try {
                    await api.delete(deleteEndpoint(row));
                    await refresh();
                  } catch (e) { flash(card, "error", errorText(e)); }
                },
              }, t("common.delete")),
            ) : null,
          );
          tbody.append(tr);
        }
        table.append(thead, tbody);
        tableWrap.append(table);
      }
    }

    if (fields && createEndpoint) {
      formWrap.append(el("h3", {}, t("common.create")));
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
      const submit = el("div", { style: "align-self: flex-end" },
        el("button", { type: "submit" }, t("common.add")));
      form.append(submit);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        const payload = transformCreate ? transformCreate(data) : data;
        try {
          await api.post(createEndpoint, payload);
          form.reset();
          flash(card, "ok", t("common.added"));
          await refresh();
        } catch (e) { flash(card, "error", errorText(e)); }
      });
      formWrap.append(form);
    }

    refresh();
  };
}

// ---------------------------------------------------------------------------
// tenant_admin tabs — built fresh on each render so labels reflect lang.
// ---------------------------------------------------------------------------

function tenantAdminTabs() {
  return [
    {
      id: "tenants",
      label: t("tab.tenants"),
      render: renderTenantsAdmin,
    },
  ];
}

/**
 * Custom render для табу «Тенанти» (замість generic crudCard).
 *
 * Чому окремо: поле `domain` не вводиться вручну, а обчислюється з
 * schema_name + APP_DOMAIN. Так оператор не може фізично ввести apex
 * (наприклад, `test-multitenants.isi-technology.com` сам по собі — він
 * уже належить public-тенанту, і duplicate-domain падав би). Preview
 * під формою показує, який саме hostname отримає новий тенант.
 */
async function renderTenantsAdmin(host) {
  const card = el("div", { class: "card" }, el("h2", {}, t("tab.tenants")));
  const tableWrap = el("div", {}, el("p", { class: "muted" }, t("common.loading")));
  const formWrap = el("div");
  card.append(tableWrap, formWrap);
  host.append(card);

  // apex() — той самий хелпер, що використовується для tenant-детекції в
  // auth.js: повертає APP_DOMAIN як-є, або (dev fallback) обчислює його
  // з window.location.hostname. Гарантує, що формула однакова в обох
  // місцях — щоб новий tenant-домен мав ту саму структуру, що бачить
  // detectTenant() при логіні з нього.

  async function refresh() {
    try {
      const data = await api.get("/api/tenants/");
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
      tableWrap.append(el("p", { class: "muted" }, t("common.empty")));
      return;
    }
    const table = el("table", {},
      el("thead", {}, el("tr", {},
        el("th", {}, t("field.schema")),
        el("th", {}, t("field.name")),
        el("th", {}, t("field.domains")),
        el("th", {}, t("field.created")),
        el("th", {}, ""),
      )),
      el("tbody", {}, ...rows.map((row) => el("tr", {},
        el("td", {}, row.schema_name),
        el("td", {}, row.name),
        el("td", {}, (row.domains || []).map((d) => d.domain).join(", ")),
        el("td", {}, row.created_on),
        el("td", {},
          el("button", {
            class: "danger",
            onclick: async () => {
              if (!confirm(t("common.confirmDelete") + row.id + "?")) return;
              try {
                await api.delete(`/api/tenants/${row.id}/`);
                await refresh();
              } catch (e) { flash(card, "error", errorText(e)); }
            },
          }, t("common.delete")),
        ),
      ))),
    );
    tableWrap.append(table);
  }

  // Форма створення.
  formWrap.append(el("h3", {}, t("common.create")));

  const schemaInput = el("input", { name: "schema_name", required: true, placeholder: "delta" });
  const nameInput = el("input", { name: "name", required: true, placeholder: "Delta LLC" });
  const domainPreview = el("code", { style: "background: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 4px" }, "—");

  function updatePreview() {
    const schema = (schemaInput.value || "").toLowerCase().trim();
    domainPreview.textContent = schema ? `${schema}.${apex()}` : "—";
  }
  schemaInput.addEventListener("input", updatePreview);

  const form = el("form", { class: "row" },
    el("div", { style: "min-width: 160px" },
      el("label", {}, t("tenant.field.schema")),
      schemaInput,
    ),
    el("div", { style: "min-width: 220px" },
      el("label", {}, t("tenant.field.name")),
      nameInput,
    ),
    el("div", { style: "min-width: 240px" },
      el("label", {}, t("tenant.field.domain")),
      el("div", { style: "padding-top: 0.4rem" }, domainPreview),
    ),
    el("div", { style: "align-self: flex-end" }, el("button", { type: "submit" }, t("common.add"))),
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const schema = (schemaInput.value || "").toLowerCase().trim();
    const payload = {
      schema_name: schema,
      name: nameInput.value.trim(),
      domain: `${schema}.${apex()}`,
    };
    try {
      await api.post("/api/tenants/", payload);
      flash(card, "ok", t("common.added"));
      form.reset();
      updatePreview();
      await refresh();
    } catch (e) {
      flash(card, "error", errorText(e));
    }
  });
  formWrap.append(form);

  refresh();
}

// ---------------------------------------------------------------------------
// company_admin tabs
// ---------------------------------------------------------------------------

function companyAdminTabs() {
  return [
    {
      id: "products",
      label: t("tab.products"),
      render: crudCard({
        title: t("tab.products"),
        listEndpoint: "/api/products/",
        createEndpoint: "/api/products/",
        deleteEndpoint: (row) => `/api/products/${row.id}/`,
        columns: [
          { key: "id", label: t("field.id") },
          { key: "name", label: t("field.name") },
          { key: "price", label: t("field.price") },
        ],
        fields: [
          { name: "name", label: t("field.name"), required: true },
          { name: "price", label: t("field.price"), required: true, type: "number", step: "0.01" },
        ],
      }),
    },
    {
      id: "cars",
      label: t("tab.cars"),
      render: crudCard({
        title: t("tab.cars"),
        listEndpoint: "/api/cars/",
        createEndpoint: "/api/cars/",
        deleteEndpoint: (row) => `/api/cars/${row.id}/`,
        columns: [
          { key: "id", label: t("field.id") },
          { key: "brand", label: t("field.brand") },
          { key: "model", label: t("field.model") },
          { key: "year", label: t("field.year") },
          { key: "license_plate", label: t("field.licensePlate") },
        ],
        fields: [
          { name: "brand", label: t("field.brand"), required: true },
          { name: "model", label: t("field.model"), required: true },
          { name: "year", label: t("field.year"), required: true, type: "number" },
          { name: "license_plate", label: t("field.licensePlate"), required: true },
        ],
        transformCreate: (d) => ({ ...d, year: Number(d.year) }),
      }),
    },
    {
      id: "drivers",
      label: t("tab.drivers"),
      render: crudCard({
        title: t("tab.drivers"),
        listEndpoint: "/api/drivers/",
        createEndpoint: "/api/drivers/",
        deleteEndpoint: (row) => `/api/drivers/${row.id}/`,
        columns: [
          { key: "id", label: t("field.id") },
          { key: "username", label: t("field.username") },
          { key: "first_name", label: t("field.firstName") },
          { key: "last_name", label: t("field.lastName") },
          { key: "date_of_birth", label: t("field.dateOfBirth") },
          { key: "license_number", label: t("field.licenseNumber") },
        ],
        fields: [
          { name: "username", label: t("field.username"), required: true },
          { name: "password", label: t("field.password"), required: true, type: "password" },
          { name: "first_name", label: t("field.firstName"), required: true },
          { name: "last_name", label: t("field.lastName"), required: true },
          { name: "date_of_birth", label: t("field.dateOfBirth"), required: true, type: "date" },
          { name: "license_number", label: t("field.licenseNumber"), required: true },
        ],
      }),
    },
    {
      id: "customers",
      label: t("tab.customers"),
      render: crudCard({
        title: t("tab.customers"),
        listEndpoint: "/api/customers/",
        createEndpoint: "/api/customers/",
        deleteEndpoint: (row) => `/api/customers/${row.id}/`,
        columns: [
          { key: "id", label: t("field.id") },
          { key: "username", label: t("field.username") },
          { key: "first_name", label: t("field.firstName") },
          { key: "last_name", label: t("field.lastName") },
          { key: "phone", label: t("field.phone") },
        ],
        fields: [
          { name: "username", label: t("field.username"), required: true },
          { name: "password", label: t("field.password"), required: true, type: "password" },
          { name: "first_name", label: t("field.firstName") },
          { name: "last_name", label: t("field.lastName") },
          { name: "email", label: t("field.email") },
          { name: "phone", label: t("field.phone") },
          { name: "address", label: t("field.address") },
        ],
      }),
    },
    {
      id: "orders",
      label: t("tab.orders"),
      render: renderOrdersAdmin,
    },
    {
      id: "routes",
      label: t("tab.routes"),
      render: renderRoutesAdmin,
    },
  ];
}

// ---------------------------------------------------------------------------
// Orders / Routes need richer UI than the generic helper supports
// ---------------------------------------------------------------------------

async function renderOrdersAdmin(host) {
  const card = el("div", { class: "card" }, el("h2", {}, t("tab.orders")));
  host.append(card);
  try {
    const orders = await api.get("/api/orders/");
    const rows = Array.isArray(orders) ? orders : (orders.results || []);
    if (!rows.length) {
      card.append(el("p", { class: "muted" }, t("orders.empty")));
      return;
    }
    const table = el("table", {},
      el("thead", {}, el("tr", {},
        el("th", {}, t("field.id")),
        el("th", {}, t("field.customer")),
        el("th", {}, t("field.status")),
        el("th", {}, t("field.items")),
        el("th", {}, t("field.created")),
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
  const card = el("div", { class: "card" }, el("h2", {}, t("tab.routes")));
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

  if (routes.length) {
    const tbl = el("table", {},
      el("thead", {}, el("tr", {},
        el("th", {}, t("field.id")),
        el("th", {}, t("field.name")),
        el("th", {}, t("field.driver")),
        el("th", {}, t("field.car")),
        el("th", {}, t("field.orders")),
        el("th", {}, t("field.status")),
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
    card.append(el("p", { class: "muted" }, t("routes.empty")));
  }

  card.append(el("h3", {}, t("routes.new")));
  const form = el("form", { class: "row" });
  const inputName = el("input", { name: "name", required: true });
  const selectDriver = el("select", { name: "driver", required: true },
    el("option", { value: "" }, t("routes.placeholder.driver")),
    ...drivers.map((d) => el("option", { value: d.id }, labelDriver(d))),
  );
  const selectCar = el("select", { name: "car", required: true },
    el("option", { value: "" }, t("routes.placeholder.car")),
    ...cars.map((c) => el("option", { value: c.id }, labelCar(c))),
  );
  const ordersBox = el("select", { name: "orders", multiple: true, size: Math.min(6, Math.max(3, orders.length)) },
    ...orders.map((o) => el("option", { value: o.id }, `#${o.id} — ${o.customer} (${o.status})`)),
  );
  const selectStatus = el("select", { name: "status" },
    ...["planned", "active", "completed", "cancelled"].map((s) => el("option", { value: s }, s)),
  );

  form.append(
    formField(t("field.name"), inputName),
    formField(t("field.driver"), selectDriver),
    formField(t("field.car"), selectCar),
    formField(t("routes.placeholder.orders"), ordersBox),
    formField(t("field.status"), selectStatus),
    el("div", { style: "align-self: flex-end" }, el("button", { type: "submit" }, t("common.create"))),
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
      flash(card, "ok", t("routes.created"));
      renderRoutesAdmin(host);
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
