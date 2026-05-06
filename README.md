# tenants_front — vanilla-JS frontend

Простий SPA на чистому JS (ES-модулі, без бандлера, без npm).

## Два режими роботи

Конфіг — `tenants_front/config.js`. Дві константи: `APP_DOMAIN` і `API_PORT`.

| Що ставимо                                        | Поведінка                                                                       |
|---------------------------------------------------|---------------------------------------------------------------------------------|
| `APP_DOMAIN=""`, `API_PORT="8000"` (за замовч.)   | **Дев split-origin.** Фронт на `:5500`, бек на `:8000`. На логіні є поле «Тенант». |
| `APP_DOMAIN="example.com"`, `API_PORT=""`         | **Прод same-origin.** Усе через nginx, тенант береться з URL автоматично.       |
| `APP_DOMAIN="localhost"`, `API_PORT=""`           | Локально через nginx (auto-detect із `alpha.localhost`).                        |

---

## A. Локальний дев (split-origin, як було)

1. Підняти бекенд (`tenants_back`) на `localhost:8000`. У `/etc/hosts`:
   ```
   127.0.0.1   localhost alpha.localhost beta.localhost gamma.localhost
   ```

2. У `tenants_front/`:
   ```bash
   python3 -m http.server 5500
   ```
   (`file://` не підійде — ES-модулі браузер так не вантажить.)

3. Відкрити <http://localhost:5500>.

| Кого логінимо           | Поле «Тенант» | Що показує           |
|-------------------------|---------------|----------------------|
| `root`/`rootpass`       | _порожнє_     | Список тенантів      |
| `admin`/`adminpass`     | `alpha` …     | Усі сутності тенанта |
| Замовник                | `alpha` …     | Каталог + замовлення |
| Водій                   | `alpha` …     | Профіль + маршрути   |

---

## B. Продакшн із nginx + реальним доменом

**Логіка**: користувач набирає в браузері `https://alpha.example.com` —
nginx віддає той самий статичний фронт, фронт бачить hostname,
вираховує тенант = `alpha`, посилає API-запити на `https://alpha.example.com/api/...`.
Bek (django-tenants) дивиться на заголовок `Host` і перемикає схему.

### 1. DNS

Підніми wildcard-A-запис: `*.example.com → IP_сервера` плюс `example.com → IP_сервера`.

### 2. TLS

Випусти wildcard-сертифікат (Let's Encrypt через DNS-01):
```bash
certbot certonly --dns-... -d example.com -d '*.example.com'
```

### 3. Файлова структура на сервері

```
/home/webmaster/tenants_front/                       # сюди викладаємо вміст tenants_front/
/home/webmaster/tenants_back/                        # бекенд (manage.py, settings.py, ...)
/home/webmaster/tenants_back/staticfiles/            # сюди йде collectstatic
/home/webmaster/tenants_back/run/gunicorn.sock       # UNIX-сокет, який створює bin/gunicorn_start.sh
```

### 4. Налаштування фронта

У `tenants_front/config.js`:
```js
export const APP_DOMAIN = "example.com";
export const API_PORT   = "";
```

Більше нічого не правити: усі API-запити стануть relative (`/api/...`).

### 5. Налаштування бекенда

Прод env-змінні (`DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`,
`DJANGO_CSRF_TRUSTED_ORIGINS`, `DJANGO_BEHIND_TLS_PROXY`, `DB_*`) живуть
**у самому bash-скрипті** — `tenants_back/bin/gunicorn_start.sh`, у блоці
`--- Production env vars ---`. Без зовнішніх env-файлів.

Локальні оверрайди для дев — окремий файл `tenants_back/settings_local.py`
(gitignored), його імпортує `settings.py` у самому кінці через
`from .settings_local import *`.

Bootstrap і запуск — повністю у `tenants_back/deploy/README.md` (розділ 3
«supervisor + bin/gunicorn_start.sh» і розділ 7 «Перший bootstrap»).

### 6. nginx

Готовий шаблон — `tenants_back/deploy/nginx.example.conf`. Заміни
`example.com` на свій домен і шляхи до сертифікатів. Ключове:

- `server_name example.com *.example.com;` — один `server { ... }` ловить
  і apex, і всі сабдомени.
- `upstream` дивиться на сокет з `bin/gunicorn_start.sh`:
  `unix:/home/webmaster/tenants_back/run/gunicorn.sock`.
- `location ~ ^/(api|admin)/` → проксі на gunicorn із збереженням `Host`,
  щоб `TenantMainMiddleware` зміг знайти потрібний `Domain`.
- `location /static/` → `alias /home/webmaster/tenants_back/staticfiles/`.
- `location /` → `root /home/webmaster/tenants_front; try_files $uri $uri/ /index.html;`
  (SPA-фолбек).

Поведінка для користувача:
| URL                          | Що показує                                                |
|------------------------------|-----------------------------------------------------------|
| `https://example.com`        | Логін → форма без поля тенанта → роль `tenant_admin`      |
| `https://alpha.example.com`  | Логін → роль `company_admin`/`customer`/`driver` для alpha |
| `https://beta.example.com`   | Те саме для beta                                          |

---

## Структура

```
tenants_front/
├── index.html       # точка входу, темплейти
├── style.css
├── config.js        # APP_DOMAIN + API_PORT (єдине, що оператор редагує)
├── README.md
└── js/
    ├── api.js       # fetch + JWT + decode
    ├── auth.js      # login + session + детект тенанта з hostname
    ├── ui.js        # tiny DOM helpers
    ├── app.js       # router (role → view)
    └── views/
        ├── login.js
        ├── admin.js     # tenant_admin або company_admin
        ├── customer.js
        └── driver.js
```