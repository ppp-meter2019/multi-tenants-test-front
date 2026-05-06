import { detectTenant, isSplitOriginMode, login } from "../auth.js";
import { el, clear, flash, errorText } from "../ui.js";

export function renderLogin(host, onLogged) {
  clear(host);
  const splitMode = isSplitOriginMode();
  const detected = detectTenant();

  const wrap = el("div", { class: "login-wrap card" }, el("h2", {}, "Вхід"));

  // In production (same-origin) the tenant comes from the URL — show it as
  // read-only context. In dev (split-origin) the operator can type it.
  if (splitMode) {
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

  if (splitMode) {
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
    const subdomain = splitMode
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