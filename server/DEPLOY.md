# Развёртывание Embermarch backend на сервере

Инструкция рассчитана на обычный Linux VPS (Ubuntu/Debian-стиль), где уже
установлен Node.js (18+; на Debian — `apt install --no-install-recommends nodejs`). Схема: systemd + Caddy (или nginx + Let's Encrypt), отдельный
сервис со своим пользователем и SQLite-базой.

Домен в этой инструкции условный: **`game.example.com`**. Замените его
везде ниже на свой. В коде игры адрес не записан: клиент обращается к API на том же домене.

Сервер раздаёт и саму игру: файлы клиента лежат в `/opt/embermarch-server/client/`
(index.html, style.css, sw.js, manifest.webmanifest, js/, audio/, icons/), их
отдаёт `static.js` строго по белому списку. Другое место можно задать
переменной `CLIENT_DIR` в `.env`. Без клиента сервер не стартует: live PvP
исполняет тот же `client/js/combat-core.js`, что и браузер. Архив для
обновления собирает `bash tools/pack-deploy.sh [файлы server/]` из корня
репозитория: в нём всегда весь клиент в `client/`.

После обновления `client/` сервис обязательно перезапустить
(`sudo systemctl restart embermarch-server`): `combat-core.js` загружается в
память один раз при старте, и без перезапуска live PvP считал бы бой по старой
версии. Перед первым запуском проверьте, что есть
`/opt/embermarch-server/client/index.html`.

## 1. Скопировать папку на сервер и установить зависимости

```bash
# с локальной машины
scp -r server/ user@your-server:/opt/embermarch-server

# на сервере
cd /opt/embermarch-server
npm install --production
```

`better-sqlite3` тянет нативный биндинг — `npm install` может собрать его
из исходников, если под вашу архитектуру нет прекомпилированного бинарника
(нужны `build-essential`/`python3` — `apt install -y build-essential python3`
на Debian/Ubuntu, если сборка упадёт).

## 2. Создать `.env` из примера

```bash
cp .env.example .env
nano .env   # или любой редактор
```

Сгенерировать случайный секрет для `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Вставьте результат в `.env`. Игра открывается с самого домена сервера, так что
свои запросы разрешены всегда, и `ALLOWED_ORIGINS` обычно можно оставить пустым.

## 3. Пользователь, база и права

Сервис работает от своего системного пользователя `embermarch` без входа в
систему. Код остаётся владельцем `root` и только читается; писать сервис может
лишь в `/var/lib/embermarch/` (её создаёт systemd, `StateDirectory`).

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin embermarch
sudo chown -R root:root /opt/embermarch-server
sudo chown root:embermarch /opt/embermarch-server/.env
sudo chmod 640 /opt/embermarch-server/.env
```

В `.env` укажите `DB_PATH=/var/lib/embermarch/embermarch.sqlite` и
`HOST=127.0.0.1` (наружу порт открывает только обратный прокси).

## 4. systemd-юнит

Файл `embermarch-server.service` уже приложен в этой папке — скопируйте
его и включите сервис:

```bash
sudo cp embermarch-server.service /etc/systemd/system/embermarch-server.service
sudo systemctl daemon-reload
sudo systemctl enable --now embermarch-server
sudo systemctl status embermarch-server
```

Юнит ограничивает сервис: код только для чтения (`ProtectSystem=strict`), без
повышения прав (`NoNewPrivileges`), память до 300 МБ.

## 5. Обратный прокси и HTTPS

**Caddy** (сертификаты получает сам): добавьте блок из `embermarch.Caddyfile`
в `/etc/caddy/Caddyfile`, затем

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

**nginx**: пример — в `embermarch-nginx.conf`.

```bash
sudo cp embermarch-nginx.conf /etc/nginx/sites-available/game.example.com
sudo ln -s /etc/nginx/sites-available/game.example.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d game.example.com
```

## 6. DNS

**Это можете сделать только вы** — у вашего DNS-провайдера добавьте A-запись (и AAAA, если у сервера есть
IPv6) для `embermarch` (то есть `game.example.com`), указывающую
на IP-адрес этого сервера. Без этого шага Caddy или certbot из пункта 5 не смогут
подтвердить домен.

## 7. Проверка, что всё работает

```bash
# health-check напрямую на localhost (минуя nginx)
curl http://localhost:4000/api/health
# ожидаемый ответ: {"ok":true}

# через публичный домен (после DNS + certbot)
curl https://game.example.com/api/health

# пробная регистрация
curl -X POST https://game.example.com/api/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"testuser","password":"correcthorsebattery"}'
```

Если `register` вернул JSON с `token` — сервис работает и игра сможет к
нему подключиться.

## 8. Резервное копирование

Всё сохранение всех игроков — это один файл SQLite по пути, указанному в
`DB_PATH` (по умолчанию `/opt/embermarch-server/data/embermarch.sqlite`).
Путь на сервере по схеме выше — `/var/lib/embermarch/embermarch.sqlite`. Бэкапьте его как обычный файл (например, `cp` в архив по крону, или
добавьте путь в существующую схему бэкапов сервера). Перед копированием «на горячую»
рекомендуется `sqlite3 embermarch.sqlite ".backup backup.sqlite"`, чтобы не
зацепить файл посреди записи (WAL-режим уже включён, что снижает риск, но
консистентный `.backup` надёжнее прямого `cp` под нагрузкой).
