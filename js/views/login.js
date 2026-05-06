import { APP_DOMAIN } from "../../config.js";
import { detectTenant, login } from "../auth.js";
import { el, clear, flash, errorText } from "../ui.js";

export function renderLogin(host, onLogged) {
  clear(host);
  // The "Тенант" field is shown only when APP_DOMAIN isn't configured —
  // in that fallback we don't know how to derive the tenant from the URL,
  // so the operator types it manually. When APP_DOMAIN is set (any prod
  // setup), the tenant is unambiguous from window.location.hostname.
  const askTenantManually = !APP_DOMAIN;
  const detected = detectTenant();

  const wrap = el("div", { class: "login-wrap card" }, el("h2", {}, "Вхід"));

  if (askTenantManually) {
    wrap.append(el("p", { class: "muted" },
      "Залиште поле «Тенант» порожнім для адміністратора платформи. "
      + "Введіть alpha / beta / gamma — для адміна компанії, водія або клієнта."));
  } else {
    wrap.append(el("p", { class: "muted" },
      detected
        ? `Тенант визначено з адреси: ${detected}.`
        : "Ви на основному сайті — увійдіть як адміністратор платформи."));
  }

  const form = el("form", {});

  if (askTenantManually) {
    form.append(formField(
      "Тенант (необов'язково)",
      el("input", { name: "subdomain", placeholder: "alpha", value: detected }),
    ));
  }
  form.append(
    formField("Логін", el("input", { name: "username", required: true, autocomplete: "username" })),
    formField("Пароль", el("input", { name: "password", type: "password", required: true, autocomplete: "current-password" })),
    el("div", { class: "row", style: "margin-top: 0.5rem" },
      el("button", { type: "submit" }, "Увійти"),
    ),
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const subdomain = askTenantManually
      ? (data.get("subdomain") || "").toString().trim().toLowerCase()
      : undefined;  // undefined → auth.js falls back to detectTenant()
    const username = (data.get("username") || "").toString().trim();
    const password = (data.get("password") || "").toString();
    try {
      const session = await login(subdomain, username, password);
      onLogged(session);
    } catch (error) {
      flash(wrap, "error", errorText(error));
    }
  });

  wrap.append(form);
  host.append(wrap);
}

function formField(label, input) {
  return el("div", { style: "margin-bottom: 0.6rem" },
    el("label", {}, label),
    input,
  );
}