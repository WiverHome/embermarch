# Развёртывание Embermarch backend на сервере

Инструкция рассчитана на обычный Linux VPS (Ubuntu/Debian-стиль), где уже
установлен Node.js (18+). Схема: systemd + nginx + Let's Encrypt, отдельный
сервис со своей SQLite-базой.

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

## 3. Путь к SQLite-файлу и права

По умолчанию `DB_PATH=./data/embermarch.sqlite` — файл и папка `data/`
создаются автоматически при первом запуске. Убедитесь, что пользователь,
от которого будет работать сервис (см. ниже), имеет право на запись в
`/opt/embermarch-server/data/`:

```bash
sudo mkdir -p /opt/embermarch-server/data
sudo chown -R www-data:www-data /opt/embermarch-server
```

(Замените `www-data` на пользователя, под которым должен работать сервис.)

## 4. systemd-юнит

Файл `embermarch-server.service` уже приложен в этой папке — скопируйте
его и включите сервис:

```bash
sudo cp embermarch-server.service /etc/systemd/system/embermarch-server.service
sudo systemctl daemon-reload
sudo systemctl enable --now embermarch-server
sudo systemctl status embermarch-server
```

Проверьте, что в юните путь `WorkingDirectory` и пользователь (`User=`)
соответствуют тому, куда вы скопировали папку на шаге 1 — при необходимости
отредактируйте перед `daemon-reload`.

## 5. nginx reverse proxy + TLS

Пример конфигурации — в приложенном файле `embermarch-nginx.conf`.
Скопируйте его в конфиг nginx и подключите:

```bash
sudo cp embermarch-nginx.conf /etc/nginx/sites-available/game.example.com
sudo ln -s /etc/nginx/sites-available/game.example.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Затем выпустите TLS-сертификат через certbot (сам certbot здесь не
запускается — выполните команду вручную на сервере):

```bash
sudo certbot --nginx -d game.example.com
```

## 6. DNS

**Это можете сделать только вы** — у вашего DNS-провайдера добавьте A-запись (и AAAA, если у сервера есть
IPv6) для `embermarch` (то есть `game.example.com`), указывающую
на IP-адрес этого сервера. Без этого шага certbot из пункта 5 не сможет
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
Бэкапьте его как обычный файл (например, `cp` в архив по крону, или
добавьте путь в существующую схему бэкапов сервера). Перед копированием «на горячую»
рекомендуется `sqlite3 embermarch.sqlite ".backup backup.sqlite"`, чтобы не
зацепить файл посреди записи (WAL-режим уже включён, что снижает риск, но
консистентный `.backup` надёжнее прямого `cp` под нагрузкой).
