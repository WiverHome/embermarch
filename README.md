<div align="center">

<img src="icons/icon-192.png" width="96" alt="Embermarch">

# Embermarch

**Отряд последней дороги** · браузерная roguelite-RPG с пошаговыми боями

*Веди отряд наёмников через выжженные земли. Каждый поход не похож на предыдущий. Не каждый отряд возвращается.*


![Vanilla JS](https://img.shields.io/badge/frontend-vanilla%20JS-f0a860?style=flat-square)
![Без сборки](https://img.shields.io/badge/сборка-не%20нужна-3a2a1a?style=flat-square)
![Node.js](https://img.shields.io/badge/backend-Node.js%20%2B%20Express-3a2a1a?style=flat-square)
![SQLite](https://img.shields.io/badge/база-SQLite-3a2a1a?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-устанавливается-3a2a1a?style=flat-square)
![RU / EN](https://img.shields.io/badge/языки-RU%20%2F%20EN-3a2a1a?style=flat-square)
![Android 7.0+](https://img.shields.io/badge/Android-7.0%2B-3DDC84?style=flat-square&logo=android&logoColor=white)

[![Версия](https://img.shields.io/github/v/release/WiverHome/embermarch?style=flat-square&label=%D0%B2%D0%B5%D1%80%D1%81%D0%B8%D1%8F&color=f0a860)](../../releases/latest)
[![Скачиваний](https://img.shields.io/github/downloads/WiverHome/embermarch/total?style=flat-square&label=%D1%81%D0%BA%D0%B0%D1%87%D0%B8%D0%B2%D0%B0%D0%BD%D0%B8%D0%B9&color=FF8A3D)](../../releases)
[![Лицензия MIT](https://img.shields.io/badge/%D0%BB%D0%B8%D1%86%D0%B5%D0%BD%D0%B7%D0%B8%D1%8F-MIT-3a2a1a?style=flat-square)](LICENSE)

**[⬇ Скачать APK](../../releases/latest/download/Embermarch.apk)** &nbsp;·&nbsp; [Как установить](#на-телефоне) &nbsp;·&nbsp; [Все версии](../../releases)

</div>

<p align="center">
  <img src="screenshots/title.png" width="49%" alt="Главный экран">
  <img src="screenshots/map.png" width="49%" alt="Карта похода">
</p>
<p align="center">
  <img src="screenshots/combat.png" width="49%" alt="Пошаговый бой">
  <img src="screenshots/hero-select.png" width="49%" alt="Выбор отряда">
</p>
<p align="center">
  <img src="screenshots/legacy.png" width="70%" alt="Летопись: постоянные улучшения">
</p>

## Содержание

- [Как играть](#как-играть)
- [Возможности](#возможности)
- [На телефоне](#на-телефоне)
- [Архитектура](#архитектура)
- [Структура проекта](#структура-проекта)
- [Локальный запуск](#локальный-запуск)
- [Инструменты разработчика](#инструменты-разработчика)
- [История разработки](#история-разработки)
- [Лицензия](#лицензия)

## Как играть

```mermaid
flowchart LR
    A([Собери отряд<br/>из трёх героев]) --> B[Карта похода<br/>20 уровней, 3 главы]
    B --> C{Узел}
    C -->|Бой / Элита| D[Пошаговый бой]
    C -->|Событие| E[Выбор с последствиями]
    C -->|Лавка| F[Снаряжение и крафт]
    C -->|Привал| G[Лечение или тренировка]
    D --> H[Награда: золото, опыт,<br/>предметы, реликвии]
    E --> B
    F --> B
    G --> B
    H --> B
    B -->|Босс главы| I([Победа или гибель])
    I --> J[Угольки → постоянные<br/>улучшения в Летописи]
    J --> A
```

Поход проходит через три главы: **Пепельный поход**, **Морозный рубеж** и **Терновую чащу**. Каждая глава сложнее предыдущей и заканчивается боссом. За любой исход отряд получает угольки. На них в Летописи покупаются постоянные улучшения, и следующий поход начинается сильнее.

## Возможности

<table>
<tr>
<td width="50%" valign="top">

### ⚔️ Бой
- Пошаговая тактика: передний и задний ряд, порядок ходов по скорости
- Статусы: горение, оглушение, метки, усиления и ослабления; комбо между героями
- Синергии состава отряда
- Ульты с 7-го уровня, автобой, горячие клавиши
- Процедурная музыка для каждого биома и босса

</td>
<td width="50%" valign="top">

### 🛡️ Герои и прогрессия
- 8 героев: воин, лучник, жрица, разбойник, пиромант, зверолов, некромант, паладин
- Свой герой: очки характеристик, пассивка, цвет и иконка
- Уровни и перки внутри похода
- 19 постоянных улучшений с ветками и вершинами
- Новых героев открывают достижения

</td>
</tr>
<tr>
<td valign="top">

### 🗺️ Реиграбельность
- Процедурная карта с ветвящимися путями
- Событийные цепочки, привязанные к биомам
- Снаряжение, реликвии, крафт, рюкзак
- Сложность 0–5, режим истории для новичков, модификаторы
- **Испытание дня** и **испытание недели**: одна карта для всех
- Бесконечный поход после финального босса
- Бестиарий, 19 достижений, подробная статистика

</td>
<td valign="top">

### 🏟️ Арена (PvP)
- Асинхронные бои против чемпионов других игроков
- Живые дуэли через WebSocket: очередь или приглашение по коду
- **Результат считает сервер**: чемпионы собираются из серверных таблиц, клиенту не доверяем
- Сезоны по 28 дней, рейтинг, награды за место
- Повторы боёв

</td>
</tr>
<tr>
<td valign="top">

### 💾 Аккаунты
- Прогресс хранится на сервере, можно играть с любого устройства
- Гостевой режим без регистрации, его прогресс переносится в новый аккаунт
- Сервер проверяет, правдоподобен ли прогресс (угольки не растут быстрее игры)
- Код сохранения для резервной копии

</td>
<td valign="top">

### ✨ Интерфейс
- Каждый экран помещается в окно, страница не прокручивается
- PWA: устанавливается на телефон и рабочий стол
- Тёмная и светлая темы, режим для дальтоников
- Масштаб текста, отключение анимаций
- Обучение для новых игроков, правила игры
- Русский и английский

</td>
</tr>
</table>

## На телефоне

У мобильной версии своя раскладка: крупный список доступных узлов вместо широкой карты и компактное поле боя.

<p align="center">
  <img src="screenshots/mobile-title.png" width="28%" alt="Главный экран на телефоне">
  &nbsp;
  <img src="screenshots/mobile-map.png" width="28%" alt="Выбор следующего шага на телефоне">
  &nbsp;
  <img src="screenshots/mobile-combat.png" width="28%" alt="Бой на телефоне">
</p>

### Приложение для Android

1. Скачайте **[Embermarch.apk](../../releases/latest/download/Embermarch.apk)** на телефон (Android 7.0+).
2. Откройте файл и разрешите установку из этого источника. Если Google Play Защита предупредит о незнакомом приложении: «Подробнее» → «Всё равно установить».

Игра целиком лежит в APK: гостевой режим работает без сети, аккаунт, синхронизация и арена подключаются к серверу игры. Сборка: [android/](android/) (`./gradlew assembleRelease`, адрес сервера - в `android/game.properties` по образцу `game.properties.example`).

## Архитектура

```mermaid
flowchart LR
    subgraph Client["Браузер"]
        UI["index.html, style.css, js/*.js<br/>UI, карта, музыка"]
        CORE["js/combat-core.js<br/>боевая математика"]
        SW["sw.js<br/>офлайн-кэш (PWA)"]
    end
    subgraph Server["Сервер игры · Node.js"]
        API["server.js<br/>REST: аккаунты, прогресс,<br/>арена, сезоны"]
        LIVE["live-pvp.js<br/>WebSocket-дуэли"]
        STATIC["static.js<br/>раздаёт сам клиент"]
        ENG["combat-engine.js<br/>тот же combat-core.js"]
        GUARD["progress-guard.js<br/>проверка прогресса"]
        ADM["/admin<br/>панель администратора"]
        DB[(SQLite)]
    end
    UI --> CORE
    STATIC -. "файлы игры" .-> UI
    UI -- "JWT, JSON" --> API
    UI -- "WebSocket" --> LIVE
    API --> GUARD
    API --> DB
    LIVE --> ENG
    API --> ENG
    ADM --> API
```

| Часть | Стек |
|---|---|
| Игра | vanilla JS без сборки и зависимостей: `index.html`, `style.css`, `js/*.js` |
| Звук | Web Audio API: процедурная музыка + короткие эффекты (`audio/`) |
| Backend | Node.js, Express, `ws` |
| База данных | SQLite (`better-sqlite3`) |
| Безопасность | bcrypt, JWT с отзывом сессий, rate limit, CSP для админки |
| Хостинг | VPS за nginx: один Node-сервер раздаёт и игру, и API |

Боевая математика живёт в одном файле `js/combat-core.js`: его исполняют и браузер, и сервер, который сам считает исход PvP. Сборку чемпионов арены и обёртки сверяет `tools/parity-check.js`.

## Структура проекта

```
embermarch/
├── index.html              # разметка экранов и порядок скриптов
├── style.css               # стили
├── js/                     # логика игры (combat-core.js общий с сервером)
├── sw.js, manifest.webmanifest, icons/   # PWA
├── audio/                  # короткие звуковые эффекты
├── server/
│   ├── server.js           # REST API, аккаунты, прогресс, арена
│   ├── live-pvp.js         # WebSocket-дуэли
│   ├── combat-engine.js    # combat-core.js для live PvP
│   ├── static.js, client-dir.js   # раздача игры
│   ├── champion.js         # сборка чемпионов арены на сервере
│   ├── seasons.js          # сезоны и повторы
│   ├── progress-guard.js   # проверка правдоподобия прогресса
│   ├── admin.js, public/admin.html   # панель администратора (/admin)
│   ├── hero-defs.json      # таблицы, выгруженные из клиента
│   └── DEPLOY.md           # развёртывание на сервере
├── tools/                  # симулятор баланса, паритет, сборка архива деплоя
├── screenshots/            # картинки для README
├── CHANGELOG.md            # история изменений
└── ROADMAP.md              # планы
```

## Локальный запуск

Игре не нужна сборка: можно открыть `index.html` в браузере (аккаунты тогда идут на боевой сервер, гостевой режим работает офлайн).

Для аккаунтов и арены запустите backend:

```bash
cd server
cp .env.example .env    # задайте JWT_SECRET
npm install
npm start               # http://localhost:4000
```

Локальный сервер сам раздаёт игру из корня репозитория: откройте http://localhost:4000, и игра будет работать с ним. Развёртывание на сервере описано в [`server/DEPLOY.md`](server/DEPLOY.md).

## Инструменты разработчика

```bash
# бот играет целые походы на настоящем коде клиента
node tools/balance-sim.js --runs 100 --asc 0,2,4 --meta fresh,mid,max

# кривая прогрессии нового аккаунта
node tools/balance-sim.js --career 30

# клиентский и серверный движки дают одинаковый результат
node tools/parity-check.js --duels 1000 --equip

# выгрузка таблиц героев и улучшений для сервера
node tools/gen-hero-defs.js
```

## История разработки

Подробный список изменений по датам: [CHANGELOG.md](CHANGELOG.md). Планы и известные ограничения: [ROADMAP.md](ROADMAP.md).

## Лицензия

Код игры, сервера и Android-обёртки распространяется по лицензии [MIT](LICENSE).

Музыка и звуки - CC0 (общественное достояние), авторы и источники перечислены в [audio/CREDITS.md](audio/CREDITS.md). Шрифты (Marcellus, Cormorant Garamond, Work Sans, JetBrains Mono) подключаются с Google Fonts и распространяются по SIL Open Font License; в репозитории их нет.
