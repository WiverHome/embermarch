# Развёртывание Embermarch backend на сервере

Инструкция рассчитана на обычный Linux VPS (Ubuntu/Debian-стиль), где уже
установлен Node.js (18+). Используется обычный паттерн для таких сервисов:
systemd + nginx + Let's Encrypt. Это полностью отдельный сервис со своей
собственной SQLite-базой, не зависящий от других сервисов на сервере.

Целевой поддомен в этой инструкции: **`embermarch.lapochka.online`**.
Если вы разворачиваете куда-то ещё — замените домен везде ниже и в
константе `API_BASE` в `index.html` игры.

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

Вставьте результат в `.env`. Убедитесь, что `ALLOWED_ORIGINS` включает
`https://wiverhome.github.io` (GitHub Pages) и `https://embermarch.lapochka.online`
(для случая, если игра когда-нибудь будет открываться с самого этого домена).

## 3. Путь к SQLite-файлу и права

По умолчанию `DB_PATH=./data/embermarch.sqlite` — файл и папка `data/`
создаются автоматически при первом запуске. Убедитесь, что пользователь,
от которого будет работать сервис (см. ниже), имеет право на запись в
`/opt/embermarch-server/data/`:

```bash
sudo mkdir -p /opt/embermarch-server/data
sudo chown -R www-data:www-data /opt/embermarch-server
```

(Замените `www-data` на пользователя, от которого у вас принято запускать
такие сервисы на этом сервере, если он отдельный.)

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
sudo cp embermarch-nginx.conf /etc/nginx/sites-available/embermarch.lapochka.online
sudo ln -s /etc/nginx/sites-available/embermarch.lapochka.online /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Затем выпустите TLS-сертификат через certbot (сам certbot здесь не
запускается — выполните команду вручную на сервере):

```bash
sudo certbot --nginx -d embermarch.lapochka.online
```

## 6. DNS

**Это можете сделать только вы** — у вашего DNS-провайдера (там же, где
настроен `lapochka.online`) добавьте A-запись (и AAAA, если у сервера есть
IPv6) для `embermarch` (то есть `embermarch.lapochka.online`), указывающую
на IP-адрес этого сервера. Без этого шага certbot из пункта 5 не сможет
подтвердить домен.

## 7. Проверка, что всё работает

```bash
# health-check напрямую на localhost (минуя nginx)
curl http://localhost:4000/api/health
# ожидаемый ответ: {"ok":true}

# через публичный домен (после DNS + certbot)
curl https://embermarch.lapochka.online/api/health

# пробная регистрация
curl -X POST https://embermarch.lapochka.online/api/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"testuser","password":"correcthorsebattery"}'
```

Если `register` вернул JSON с `token` — сервис работает и игра сможет к
нему подключиться.

## 8. Резервное копирование

Всё сохранение всех игроков — это один файл SQLite по пути, указанному в
`DB_PATH` (по умолчанию `/opt/embermarch-server/data/embermarch.sqlite`).
Бэкапьте его как обычный файл (например, `cp` в архив по крону, или
добавьте путь в существующую схему бэкапов, если она уже настроена для
других ваших сервисов на этом сервере). Перед копированием «на горячую»
рекомендуется `sqlite3 embermarch.sqlite ".backup backup.sqlite"`, чтобы не
зацепить файл посреди записи (WAL-режим уже включён, что снижает риск, но
консистентный `.backup` надёжнее прямого `cp` под нагрузкой).
