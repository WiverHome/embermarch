# Embermarch - правила работы

Браузерная roguelite-RPG, vanilla JS без сборки. Клиент: `index.html` (только разметка экранов, ~420 строк), `style.css`, скрипты `js/*.js` (обычные `<script src>` с общей глобальной областью, порядок задаёт index.html; ~6800 строк всего). Игру целиком раздаёт сервер игры на VPS (backend `server/`: Node, Express, SQLite, ws); прод-адрес и репозиторий - в `CLAUDE.local.md` (не в git). GitHub - только хранилище кода, хостинга там нет.

## Экономия токенов (главное)
- Не читай целиком: `CHANGELOG.md` (120 КБ), `ROADMAP.md` (75 КБ), `server/package-lock.json`, `screenshots/`, `style.css`, `js/data.js` (1200 строк). Остальные `js/*.js` и `server/*.js` - тоже по частям (offset/limit).
- Как найти нужное в клиенте: `Grep` по имени функции/константы в `js/`, либо по маркерам разделов `^/\* =+ `. Затем `Read` с offset/limit, обычно до 80 строк.
- Номера строк ниже приблизительные и дрейфуют: перепроверяй Grep'ом.
- Поиск "где что реализовано" вне карты - субагент `explorer`; длинные логи и ошибки - `summarizer`; мелкие понятные правки - `worker`.
- Правь точечно через Edit, не переписывай файл или большие блоки.
- Запись в CHANGELOG/ROADMAP: прочитай только верх файла (первые ~40 строк), новая запись идёт сверху. Не читай их целиком.
- Ревью - один раз после завершённой фичи через `reviewer` (по умолчанию Sonnet; для правок в `server/` вызывай с model: opus). Передавай ему список изменённых файлов и диапазонов.
- Отвечай кратко: что изменено и где, без пересказа кода. При смене задачи предложи /clear, в длинной сессии - /compact.

## Карта клиента
- `index.html`: head, HTML-экраны (#screen-auth, title, legacy, hero-select, map, combat, reward, event, shop, rest, gameover; #modal-root) и список `<script src>` в порядке загрузки. `style.css` - все стили.
- `js/combat-core.js`: ВСЯ боевая математика (dmgCalc, applyAbilityEffect, комбо, реликвии, статусы, порядок ходов, HERO_DMG_TYPE, RELIC_TUNING). Один файл на клиент и сервер (UMD: в браузере `EmberCombatCore`, на сервере require). Отличия сторон приходят через `create(env)`: тексты (`M` или пары {en,ru}), звуки, гибель героя, модификатор Broken Ward.
- `js/lang-api.js`: LANGUAGE (`M('en','ru')`, `L({en,ru})`); ACCOUNTS / SERVER API: `API_BASE` (~26), `apiRequest`, авторизация, гостевой режим, синхронизация (`scheduleMetaSync`)
- `js/data.js`: HERO_DEFS (~49), PARTY_SYNERGIES (~125), ENEMY_DEFS (~253), BOSS_DEFS, BIOME_DEFS, BESTIARY, MODIFIER_DEFS, ITEM_POOL (~539), RELIC_POOL (~605), EVENTS (~728)
- `js/meta.js`: META (сохраняемый прогресс): defaultMeta, loadMeta/saveMeta, UPGRADE_DEFS, ACHIEVEMENTS
- `js/util.js`: RNG с сидом, SFX (SFX_DEFS, audio/sfx/), музыка (MUSIC_TRACKS, audio/music/, грузится лениво), боевые эффекты, statInfo/rarityLabel. Аудио собирает `tools/build-audio.js` (ffmpeg) из CC0-исходников, авторы в `audio/CREDITS.md`
- `js/run.js`: MAP GENERATION, RUN STATE, makeHeroInstance, уровни (LEVEL_PERKS ~200)
- `js/combat.js`: ход боя на клиенте: ASC_STAT_STEP, враги и энкаунтеры, обёртки над combat-core (COMBAT_CORE, COMBAT_STATE), startCombat, applyPartySynergies, advanceTurn, enemyAct, onCombatWin
- `js/nodes.js`: события, магазин, крафт, отдых
- `js/render.js`: renderMap, renderCombat, unitCard, модалки экипировки и формации; RUN END
- `js/screens.js`: renderTitle, renderLegacy, выбор и создание героя; TUTORIAL, showRulesModal, exportSave/importSave
- `js/arena.js`: ARENA (асинхронный PvP) и LIVE PvP (WebSocket, исход решает сервер)
- `js/main.js`: WIRE UP: обработчики, старт, регистрация sw.js
- Рядом: `sw.js` (service worker, PWA; новый файл клиента - добавь в PRECACHE и подними CACHE), `manifest.webmanifest`, `icons/`, `audio/`; `tools/` (симулятор баланса, паритет, сборка архива деплоя; только для разработки)
- `android/`: APK-обёртка (Java, без зависимостей). Клиент копируется в assets при сборке и отдаётся из APK под происхождением сервера, в сеть идут только `/api` и WebSocket; sw.js не используется. Адрес сервера - `android/game.properties`, подпись - `keystore.properties` + `.jks` (всё в .gitignore, ключ не терять). Сборка: `cd android && ./gradlew assembleRelease -PversionCode=N -PversionName=X.Y` → `app/build/outputs/apk/release/app-release.apk`. Новую версию клиента игроки APK получают только с пересборкой
- `docs/`: рекламный одностраничник на GitHub Pages (не часть игры, в архив деплоя не входит). Править шаблон `tools/landing.template.html`, затем `node tools/build-landing.js` (герои и описания краёв берутся из кода, сборщик предупреждает, если цифры на странице устарели)

## Карта backend (server/)
- `server.js`: REST /api/register, login, logout, account/username, account/password, progress (GET/PUT, лимит 600 КБ), arena/champion, opponent, report, leaderboard; JWT, bcrypt, rate limit, SQLite
- `static.js`: раздача клиента по белому списку (index.html, style.css, sw.js, manifest, js/*.js, audio/{,sfx/,music/}*.mp3, icons/*); `client-dir.js`: где лежит клиент (CLIENT_DIR из .env, иначе `server/client/` на проде, иначе корень репозитория)
- `combat-engine.js`: тонкая обёртка над `js/combat-core.js` для live PvP (+ instantiateCombatant, createDuelState)
- `live-pvp.js`: WebSocket /api/arena/live, очередь и дуэли по коду, исход решает сервер
- `admin.js` (+ public/admin.html): админка на /admin; `champion.js`, `progress-guard.js` используют `hero-defs.json` (генерирует `node tools/gen-hero-defs.js`)
- `DEPLOY.md`: читай только при вопросах о деплое

## Согласованность (частые источники багов)
- Боевая математика живёт в одном файле `js/combat-core.js`, его исполняют и клиент, и сервер (live PvP). Правка формул меняет обе стороны сразу, поэтому после неё нужен деплой на сервер (клиент и сервер едут одним архивом). Данные героев для арены сервер берёт из `server/hero-defs.json`: после правок HERO_DEFS, улучшений или наград запусти `node tools/gen-hero-defs.js`.
- Весь текст для игрока - на двух языках (`M('en','ru')` или `{en,ru}`).
- Новое поле в META: значение по умолчанию в `defaultMeta` и совместимость со старыми сохранениями (`loadMeta`, `applyProgressToMeta`); сервер хранит прогресс целиком.

## Обновление сервера (любая правка клиента или server/)
Игру раздаёт сервер, поэтому любое изменение клиента или `server/` попадает к игрокам только после деплоя. Отдавай мне архив и готовую инструкцию:
1. Архив: `bash tools/pack-deploy.sh [файлы server/, относительно server/ ...]` создаёт `_deploy/server-update-ГГГГММДД-ЧЧММ.tar.gz` (папка `_deploy/` в .gitignore). Внутри всегда весь клиент в `client/` и перечисленные файлы сервера. Никогда не клади в архив `.env`, `data/`, `*.sqlite`, `node_modules/` (скрипт их отвергает).
2. Инструкция для копирования (сервер: `/opt/embermarch-server`, systemd-юнит `embermarch-server`, пользователь `www-data`):
   - загрузка и распаковка: `scp` архива, затем `tar -xzf <архив> -C /opt/embermarch-server` и `sudo chown -R www-data:www-data /opt/embermarch-server`; если из клиента удалялись файлы - перед распаковкой убрать старую `client/` (после резервной копии);
   - резервная копия заменяемых файлов перед распаковкой; если менялась схема БД или миграции - отдельный шаг с копией `data/` (на время копирования сервис остановить);
   - если менялся `package.json`: `cd /opt/embermarch-server && npm install --production`;
   - если нужны новые переменные `.env`: назови имена и смысл, значения секретов не придумывай и не печатай;
   - если менялись юнит или nginx-конфиг: `sudo systemctl daemon-reload` / `sudo systemctl reload nginx`;
   - перезапуск и проверка: `sudo systemctl restart embermarch-server`, `sudo systemctl status embermarch-server`, `curl http://localhost:4000/api/health`;
   - откат: вернуть файлы из резервной копии и перезапустить сервис.
3. Push в GitHub игру не публикует, так что пушить можно сразу после проверок; клиент и сервер обновляются вместе одним архивом.

## Границы и безопасность
- Деплой на сервер я делаю сам вручную: не подключайся к серверу, всё отдавай архивом и инструкцией (раздел ниже).
- Git: изменения проекта всегда уходят в GitHub и остаются в этой локальной папке. После завершённой и проверенной правки основная сессия сама делает commit и push с коротким понятным сообщением. Перед push: проверки синтаксиса из раздела «Как проверять» пройдены, в коммит не попали секреты, `.env` и база. Папки `.claude/` и `_deploy/` в GitHub не пушатся (они в .gitignore): не добавляй их в коммит, не используй `git add -f`, перед коммитом проверяй `git status`. `server/` и `screenshots/` пушатся как обычно (секреты и база закрыты через `server/.gitignore`). Субагенты git не используют.
- Публичные документы обезличены (правила - в `CLAUDE.local.md`).
- Не читай и не печатай `server/.env`, базу `server/data/`, пароли, ключи, токены. Секреты - только в `.env`, которого нет в git.
- Формат сохранений и базу меняй обратно совместимо или сначала опиши план миграции.
- Результат боя PvP считает сервер, клиенту не доверяй.
- Баланс и числа выноси в константы/таблицы.
- `API_BASE` всегда того же происхождения (`location.origin + '/api'`): адрес сервера нигде в коде не записан. Открытый как файл клиент работает только в гостевом режиме.

## Как проверять
- Синтаксис клиента (без браузера): `for f in js/*.js sw.js; do node --check "$f"; done`; полная загрузка всех скриптов в Node: `node -e "require('./tools/load-client').loadClient({quiet:true})"`
- Синтаксис сервера: `for f in server/*.js; do node --check "$f"; done`
- Запуск сервера локально: `cd server && cp .env.example .env && npm install && npm start` (порт 4000): он же раздаёт игру из корня репозитория, открывай http://localhost:4000. В превью - конфигурация `game-server` из `.claude/launch.json` (временная база в scratchpad).
- Паритет клиента и сервера: `node tools/parity-check.js --duels 1000 --equip` (обязательно после правок боя, героев и `champion.js`; должно быть «all identical»). Движок общий, так что проверка ловит в основном расхождения обёрток и сборки чемпионов арены.
- Баланс (бот играет целые походы на настоящем коде клиента): `node tools/balance-sim.js --runs 100 --asc 0,2,4 --meta fresh,mid,max`; кривая прогрессии нового аккаунта: `node tools/balance-sim.js --career 30`. `tools/load-client.js` грузит скрипты из `<script src>` index.html в один Node-контекст с заглушкой DOM.
- Игру открывает локальный сервер (http://localhost:4000) или `index.html` в браузере (тогда API - прод). Автотестов нет: визуальную проверку делаю я, в конце перечисли, что именно посмотреть.
