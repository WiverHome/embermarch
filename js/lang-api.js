// Embermarch client: Language helpers (M/L) and the accounts/progress server API.
// Classic script: shares the global scope with the other js/*.js files; load order is set in index.html.
"use strict";

/* ============================= LANGUAGE ============================= */

const LANG_KEY='embermarch_lang_v1';
let LANG = (function(){
  try{const v=localStorage.getItem(LANG_KEY);if(v==='en'||v==='ru')return v;}catch(e){}
  return 'ru';
})();
function saveLang(){try{localStorage.setItem(LANG_KEY,LANG);}catch(e){} }
function L(field){
  if(field==null)return '';
  if(typeof field==='string')return field;
  return field[LANG]!==undefined?field[LANG]:field.en;
}
function M(en,ru){return LANG==='ru'?ru:en;}

/* ============================= ACCOUNTS / SERVER API ============================= */
/* Base URL of the accounts+progress backend (see /server for the Node.js service and DEPLOY.md).
   The game server also serves the game itself, so the API is always same-origin.
   Opened as a file there is no server: only offline guest play works. */
const API_BASE=/^https?:$/.test(location.protocol)?location.origin+'/api':'/api';

let AUTH_TOKEN=null;      // in-memory only — never written to localStorage
let CURRENT_USER=null;    // in-memory username of the logged-in player
let AUTH_MODE='login';    // 'login' | 'register', which form the auth screen shows
let _syncTimer=null;
let _syncInFlight=false;
let _syncDirtyWhileInFlight=false;
let _syncPromise=null; // the in-flight progress PUT, if any

function apiUrl(path){return API_BASE+path;}

function apiRequest(path,opts){
  opts=opts||{};
  const headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});
  if(AUTH_TOKEN)headers['Authorization']='Bearer '+AUTH_TOKEN;
  return fetch(apiUrl(path),Object.assign({},opts,{headers:headers}))
    .then(function(res){
      return res.json().catch(function(){return {};}).then(function(body){
        if(!res.ok){const e=new Error((body&&body.error)||('HTTP '+res.status));e.status=res.status;e.body=body;throw e;}
        return body;
      });
    });
}

function apiRegister(username,password){
  return apiRequest('/register',{method:'POST',body:JSON.stringify({username:username,password:password})});
}
function apiLogin(username,password){
  return apiRequest('/login',{method:'POST',body:JSON.stringify({username:username,password:password})});
}
function apiLogoutRequest(){
  return apiRequest('/logout',{method:'POST'}).catch(function(){});
}
function apiChangeUsername(newUsername,password){
  return apiRequest('/account/username',{method:'PUT',body:JSON.stringify({newUsername:newUsername,password:password})});
}
function apiChangePassword(currentPassword,newPassword){
  return apiRequest('/account/password',{method:'PUT',body:JSON.stringify({currentPassword:currentPassword,newPassword:newPassword})});
}
function apiGetProgress(){
  return apiRequest('/progress',{method:'GET'});
}
function apiPutProgress(data){
  return apiRequest('/progress',{method:'PUT',body:JSON.stringify(data)});
}
/* ---- Arena (asynchronous PvP) ---- */
function apiGetChampion(){return apiRequest('/arena/champion',{method:'GET'});}
/* heroes: [{key}] only; the server rebuilds every stat from its own hero tables + saved progress. */
function apiPutChampion(name,heroes){return apiRequest('/arena/champion',{method:'PUT',body:JSON.stringify({name:name,heroes:heroes,lang:LANG})});}
function apiGetOpponent(){return apiRequest('/arena/opponent',{method:'GET'});}
function apiArenaSeason(){return apiRequest('/arena/season',{method:'GET'});}
function apiArenaSeasonClaim(seasonId){return apiRequest('/arena/season/claim',{method:'POST',body:JSON.stringify({seasonId:seasonId})});}
function apiArenaReplays(){return apiRequest('/arena/replays',{method:'GET'});}
function apiArenaReplay(id){return apiRequest('/arena/replays/'+encodeURIComponent(id),{method:'GET'});}
function apiArenaLeaderboard(limit){return apiRequest('/arena/leaderboard?limit='+(limit||20),{method:'GET'});}

/* Debounced sync of META to the server. Called from saveMeta() everywhere the game
   already persisted progress — coalesced so we don't hit the API on every render. */
function scheduleMetaSync(){
  if(!AUTH_TOKEN)return;
  if(_syncTimer)clearTimeout(_syncTimer);
  _syncTimer=setTimeout(function(){_syncTimer=null;flushMetaSync();},1500);
}
function flushMetaSync(){
  if(!AUTH_TOKEN)return Promise.resolve();
  if(_syncInFlight){_syncDirtyWhileInFlight=true;return Promise.resolve();}
  _syncInFlight=true;
  const snapshot=JSON.stringify(META);
  return _syncPromise=apiPutProgress(META).then(function(r){
    _syncInFlight=false;
    setSyncStatus(true);
    if(r&&r.corrected&&r.progress){_syncDirtyWhileInFlight=false;onProgressCorrected(r.progress,JSON.parse(snapshot));return;}
    if(_syncDirtyWhileInFlight){_syncDirtyWhileInFlight=false;scheduleMetaSync();}
  }).catch(function(e){
    _syncInFlight=false;
    if(e&&e.status===409&&e.body&&e.body.progress){onProgressChangedByAdmin(e.body.progress);return;}
    if(e&&(e.status===401||e.status===403)){onSessionRevoked(e.status);return;}
    setSyncStatus(false);
    console.warn('Embermarch: progress sync failed',e);
  });
}
/* Waits for any in-flight sync, then pushes the current META immediately
   (instead of after the debounce). Never rejects. Use before a request whose
   server side reads the saved progress (champion save, season reward claim). */
function flushMetaSyncNow(){
  return (_syncInFlight&&_syncPromise?_syncPromise:Promise.resolve()).then(function(){
    if(_syncTimer){clearTimeout(_syncTimer);_syncTimer=null;}
    return flushMetaSync();
  });
}
/* The server answers 409 when an administrator edited this account's progress
   (progress._adminRev moved past ours): take the server copy instead of
   overwriting it. Any in-progress march (local RUN) is kept as is. */
function onProgressChangedByAdmin(progress){ /* also used for season rewards claimed in another tab */
  applyProgressToMeta(progress);
  applyTheme();applySettings();
  setSyncStatus(true);
  if(!$('screen-title').hidden)renderTitle();
  const wrap=el('div','stack');
  wrap.appendChild(el('h3','',M('Progress updated','Прогресс обновлён')));
  wrap.appendChild(el('div','',"<span style='color:var(--muted);font-size:13px;'>"+M('Your progress was changed on the server (by an administrator or a season reward claimed in another tab). The new version has been loaded.','Прогресс аккаунта изменился на сервере (администратором или наградой сезона в другой вкладке). Загружена новая версия.')+"</span>"));
  const ok=el('button','primary',M('OK','Понятно'));
  ok.addEventListener('click',closeModal);
  wrap.appendChild(ok);
  openModal(wrap);
}
/* The server found this save implausible (embers or upgrades gained faster than
   play allows, see server/progress-guard.js) and stored a corrected copy. */
function onProgressCorrected(progress,sent){
  /* Only the fields the server changed are taken (relative to what was sent),
     so anything earned while the request was in flight is kept. */
  META.embers=Math.max(0,(META.embers||0)+((progress.embers||0)-(sent.embers||0)));
  ['upgrades','heroesUnlocked'].forEach(function(f){
    const srv=progress[f]||{},was=sent[f]||{};
    Object.keys(srv).forEach(function(k){if(srv[k]!==was[k])META[f][k]=srv[k];});
  });
  /* Achievements without evidence from a played march are removed (their reward
     is already out of the embers above); a wins count raised too fast is cut. */
  const srvAch=progress.achievements||{};
  Object.keys(sent.achievements||{}).forEach(function(k){if(sent.achievements[k]&&!srvAch[k])delete META.achievements[k];});
  if(typeof progress.wins==='number'&&progress.wins<(sent.wins||0))META.wins=Math.max(0,(META.wins||0)-((sent.wins||0)-progress.wins));
  if(progress.ascensionUnlocked!==sent.ascensionUnlocked)META.ascensionUnlocked=Math.min(META.ascensionUnlocked,progress.ascensionUnlocked||0);
  META.ascensionChoice=Math.min(META.ascensionChoice||0,META.ascensionUnlocked||0);
  saveMeta();
  if(!$('screen-title').hidden)renderTitle();
  if(!$('screen-legacy').hidden)renderLegacy();
  /* Never interrupt a fight with the notice: it waits for the next screen. */
  if(!$('screen-combat').hidden){_progressCorrectedPending=true;return;}
  showProgressCorrectedNotice();
}
let _progressCorrectedPending=false;
function showProgressCorrectedNotice(){
  _progressCorrectedPending=false;
  const wrap=el('div','stack');
  wrap.appendChild(el('h3','',M('Progress corrected','Прогресс исправлен')));
  wrap.appendChild(el('div','',"<span style='color:var(--muted);font-size:13px;'>"+M('The server did not accept part of the latest changes (embers, upgrades, wins or Ascension came in faster than play allows, or an achievement had no march behind it) and saved a corrected version.','Сервер не принял часть последних изменений (угольки, улучшения, победы или сложность выросли быстрее, чем это возможно в игре, или достижение не подтверждено походом) и сохранил исправленную версию.')+"</span>"));
  const ok=el('button','primary',M('OK','Понятно'));
  ok.addEventListener('click',closeModal);
  wrap.appendChild(ok);
  openModal(wrap);
}
/* Session revoked server-side (ban, admin password reset, forced logout). */
function onSessionRevoked(status){
  AUTH_TOKEN=null;CURRENT_USER=null;IS_ADMIN=false;
  persistAuthToken(null);
  if(typeof liveClose==='function')liveClose();
  restoreRandom();
  closeModal();
  AUTH_MODE='login';
  renderAuthScreen();
  authSetError(status===403?M('This account is banned.','Этот аккаунт заблокирован.'):M('Your session ended — please log in again.','Сессия завершена — войдите снова.'));
}
/* Admin panel entry: the server alone decides (GET /admin/me answers admin:false for
   everyone but the one ADMIN_USER_ID account); the button opens <server>/admin, which has its own login. */
let IS_ADMIN=false;
function checkAdminAccess(){
  IS_ADMIN=false;
  const btn=$('btn-open-admin');if(btn)btn.hidden=true;
  if(!AUTH_TOKEN)return;
  apiRequest('/admin/me',{method:'GET'}).then(function(r){
    IS_ADMIN=!!(r&&r.admin);
    if(btn)btn.hidden=!IS_ADMIN;
  }).catch(function(){});
}
function setSyncStatus(ok){
  const badge=$('sync-status');
  if(!badge)return;
  if(ok){badge.hidden=true;badge.textContent='';}
  else{badge.hidden=false;badge.textContent=M('⚠ Progress not saved — check your connection','⚠ Прогресс не сохранён — проверьте соединение');}
}

function authSetError(msg){const e=$('auth-error');if(e)e.textContent=msg||'';}

/* ---- session persistence: only the auth TOKEN is remembered across reloads,
   never game progress (that always comes fresh from GET /api/progress). ---- */
const AUTH_STORAGE_KEY='embermarch_auth_token';
function persistAuthToken(token){
  try{
    if(token)localStorage.setItem(AUTH_STORAGE_KEY,token);
    else localStorage.removeItem(AUTH_STORAGE_KEY);
  }catch(e){/* storage unavailable — session just won't survive a reload */}
}
function decodeJwtUsername(token){
  try{
    const parts=token.split('.');
    if(parts.length<2)return null;
    let b64=parts[1].replace(/-/g,'+').replace(/_/g,'/');
    while(b64.length%4)b64+='=';
    const json=JSON.parse(decodeURIComponent(atob(b64).split('').map(function(c){
      return '%'+('00'+c.charCodeAt(0).toString(16)).slice(-2);
    }).join('')));
    return json.username||null;
  }catch(e){return null;}
}
function applyProgressToMeta(progress){
  META=Object.assign(defaultMeta(),progress,{
    upgrades:Object.assign(defaultMeta().upgrades,progress.upgrades),
    heroesUnlocked:Object.assign(defaultMeta().heroesUnlocked,progress.heroesUnlocked),
    customHeroes:progress.customHeroes||[],
    achievements:progress.achievements||{},
    history:progress.history||[],
    theme:progress.theme==='light'?'light':'dark',
    settings:Object.assign(defaultMeta().settings,progress.settings),
    biomeChoice:BIOME_DEFS[progress.biomeChoice]?progress.biomeChoice:'ashfall',
    routeChoice:ROUTE_CHOICES.indexOf(progress.routeChoice)>=0?progress.routeChoice:'random',
    modifiers:Object.assign(defaultMeta().modifiers,progress.modifiers),
    bestiary:progress.bestiary||{},gearPresets:progress.gearPresets||[],
    tutorial:Object.assign(defaultMeta().tutorial,progress.tutorial)
  });
}
/* ---- Guest mode: offline PvE without an account ----
   Progress lives only in this browser (GUEST_META_KEY); nothing is sent to the
   server and the arena is unavailable. Registering a NEW account from guest
   mode uploads the guest progress into it (onAuthSubmit), logging into an
   existing account never overwrites that account. */
const GUEST_META_KEY='embermarch_guest_meta_v1';
const GUEST_FLAG_KEY='embermarch_guest_v1';
let IS_GUEST=false;
function loadGuestProgress(){
  try{const raw=localStorage.getItem(GUEST_META_KEY);return raw?JSON.parse(raw):null;}catch(e){return null;}
}
function saveGuestMeta(){
  try{localStorage.setItem(GUEST_META_KEY,JSON.stringify(META));}catch(e){}
}
function guestHasProgress(p){
  return !!(p&&((p.embers||0)>0||(p.wins||0)>0||(p.bestLayer||0)>0||(p.history&&p.history.length)));
}
function setGuestFlag(on){try{if(on)localStorage.setItem(GUEST_FLAG_KEY,'1');else localStorage.removeItem(GUEST_FLAG_KEY);}catch(e){}}
function startGuest(){
  IS_GUEST=true;AUTH_TOKEN=null;CURRENT_USER=null;IS_ADMIN=false;
  setGuestFlag(true);
  applyProgressToMeta(loadGuestProgress()||{});
  applyTheme();applySettings();
  setSyncStatus(true);
  renderTitle();
  maybeShowTutorial('welcome',showWelcomeTutorial);
}
/* Leave guest mode for the auth screen (register form); guest data is kept. */
function guestToRegister(){
  saveGuestMeta();
  IS_GUEST=false;setGuestFlag(false);
  AUTH_MODE='register';
  renderAuthScreen();
  authSetError('');
  const n=$('auth-guest-note');
  if(n&&guestHasProgress(loadGuestProgress()))n.textContent=M('Your guest progress will be moved into the new account.','Прогресс гостя будет перенесён в новый аккаунт.');
}
function attemptSessionRestore(){
  let stored=null;
  try{stored=localStorage.getItem(AUTH_STORAGE_KEY);}catch(e){}
  let guestFlag=null;
  try{guestFlag=localStorage.getItem(GUEST_FLAG_KEY);}catch(e){}
  if(!stored&&guestFlag){startGuest();return;}
  if(!stored){renderAuthScreen();return;}
  AUTH_TOKEN=stored;
  CURRENT_USER=decodeJwtUsername(stored);
  apiGetProgress().then(function(progress){
    applyProgressToMeta(progress);
    applyTheme();applySettings();
    setSyncStatus(true);
    renderTitle();
    checkAdminAccess();
  }).catch(function(err){
    /* Network failure (offline, server down): keep the stored session for the
       next reload instead of logging the player out; offer guest mode meanwhile. */
    if(!err||err.status===undefined){
      AUTH_TOKEN=null;CURRENT_USER=null;
      renderAuthScreen();
      authSetError(M('The server is unreachable. Reload to retry, or play offline as a guest (separate local progress).','Сервер недоступен. Перезагрузите страницу, чтобы повторить, или играйте офлайн как гость (отдельный локальный прогресс).'));
      return;
    }
    AUTH_TOKEN=null;CURRENT_USER=null;
    persistAuthToken(null);
    renderAuthScreen();
    if(err&&err.status===401){
      authSetError(M('Your session expired — please log in again.','Сессия истекла — войдите снова.'));
    }else if(err&&err.status===403){
      authSetError(M('This account is banned.','Этот аккаунт заблокирован.'));
    }
  });
}

function renderAuthScreen(){
  $('auth-label-username').textContent=L(STATIC_I18N['auth-label-username']);
  $('auth-label-password').textContent=L(STATIC_I18N['auth-label-password']);
  $('btn-auth-submit').textContent=AUTH_MODE==='login'?M('Log In','Войти'):M('Register','Зарегистрироваться');
  $('auth-toggle-text').textContent=AUTH_MODE==='login'?M("Don't have an account yet?",'Ещё нет аккаунта?'):M('Already have an account?','Уже есть аккаунт?');
  $('auth-toggle-link').textContent=AUTH_MODE==='login'?M('Register','Зарегистрироваться'):M('Log In','Войти');
  $('auth-password').autocomplete=AUTH_MODE==='login'?'current-password':'new-password';
  authSetError('');
  renderLangSwitch();
  show('screen-auth');
}

function onAuthToggle(){
  AUTH_MODE=(AUTH_MODE==='login')?'register':'login';
  renderAuthScreen();
}

function onAuthSubmit(e){
  e.preventDefault();
  const username=($('auth-username').value||'').trim();
  const password=$('auth-password').value||'';
  authSetError('');
  if(!username||!password){
    authSetError(M('Please fill in both fields.','Заполните оба поля.'));
    return;
  }
  const submitBtn=$('btn-auth-submit');
  submitBtn.disabled=true;
  const registering=AUTH_MODE!=='login';
  const action=registering?apiRegister(username,password):apiLogin(username,password);
  action.then(function(res){
    AUTH_TOKEN=res.token;
    CURRENT_USER=res.username||username;
    persistAuthToken(AUTH_TOKEN);
    IS_GUEST=false;setGuestFlag(false);
    /* A brand-new account adopts the guest progress played in this browser. */
    const guest=registering?loadGuestProgress():null;
    if(guestHasProgress(guest)){
      return apiPutProgress(guest).then(function(){
        try{localStorage.removeItem(GUEST_META_KEY);}catch(e){}
        return apiGetProgress();
      });
    }
    return apiGetProgress();
  }).then(function(progress){
    applyProgressToMeta(progress);
    submitBtn.disabled=false;
    applyTheme();applySettings();
    setSyncStatus(true);
    renderTitle();
    checkAdminAccess();
    maybeShowTutorial('welcome',showWelcomeTutorial);
  }).catch(function(err){
    submitBtn.disabled=false;
    if(!err||err.status===undefined){
      authSetError(M('Could not reach the server. This game requires a network connection to '+API_BASE+' — that may be blocked in this environment (e.g. a sandboxed preview). Try again later, or play offline as a guest.','Не удалось связаться с сервером. Игре нужен доступ к '+API_BASE+' — возможно, он заблокирован в этом окружении (например, в песочнице предпросмотра). Попробуйте позже или играйте офлайн как гость.'));
    }else if(err&&err.status===401){
      authSetError(M('Incorrect username or password.','Неверное имя пользователя или пароль.'));
    }else if(err&&err.status===403){
      authSetError(M('This account is banned.','Этот аккаунт заблокирован.'));
    }else if(err&&err.status===409){
      authSetError(M('That username is already taken.','Это имя пользователя уже занято.'));
    }else if(err&&err.status===429){
      authSetError(M('Too many attempts. Please wait a moment and try again.','Слишком много попыток. Подождите немного и попробуйте снова.'));
    }else{
      authSetError(M('Network error — could not reach the server. Check your connection and try again.','Ошибка сети — не удалось связаться с сервером. Проверьте соединение и попробуйте снова.'));
    }
  });
}

function doLogout(){
  if(IS_GUEST){saveGuestMeta();IS_GUEST=false;setGuestFlag(false);}
  flushMetaSync().then(function(){
    apiLogoutRequest();
    AUTH_TOKEN=null;CURRENT_USER=null;IS_ADMIN=false;
    persistAuthToken(null);
    META=defaultMeta();
    clearRun();
    /* If a Daily Challenge march was in progress, logging out skips the three
       normal exit points (victory/defeat/abandon) that call restoreRandom() to
       put the real Math.random back — leaving the seeded, fully deterministic
       daily RNG active for the rest of this browser tab. Any run started
       afterwards (by this account or another one logged into on the same tab)
       would then draw shop stock, loot and encounters from that same stuck
       sequence instead of real randomness — exactly the "shop items don't
       refresh" symptom. Always restore here too, whether or not a daily run
       was actually active (restoreRandom() is a safe no-op otherwise). */
    restoreRandom();
    AUTH_MODE='login';
    renderAuthScreen();
  });
}

const STATIC_I18N = {
  'title-eyebrow':{en:'A COMPANY OF THE LAST ROAD',ru:'ОТРЯД ПОСЛЕДНЕЙ ДОРОГИ'},
  'title-tagline':{en:'Lead a mercenary company through the burnt marches.<br>Every crossing is different. Not every company returns.',
                   ru:'Веди отряд наёмников через выжженные земли.<br>Каждый поход не похож на предыдущий. Не каждый отряд возвращается.'},
  'btn-continue':{en:'Continue Expedition',ru:'Продолжить поход'},
  'btn-new-run':{en:'New Expedition',ru:'Новый поход'},
  'btn-open-legacy':{en:'Legacy Ledger',ru:'Летопись'},
  'btn-open-arena':{en:'Arena',ru:'Арена'},
  'arena-h2':{en:'Arena',ru:'Арена'},
  'arena-eyebrow':{en:'Build a champion once, then duel other players’ saved squads — asynchronous: no one needs to be online.',ru:'Соберите чемпиона один раз — и сражайтесь с отрядами других игроков. Это асинхронно: никто не должен быть онлайн одновременно.'},
  'btn-arena-back':{en:'Back',ru:'Назад'},
  'btn-arena-back-top':{en:'← Back',ru:'← Назад'},
  'legacy-h2':{en:'Legacy Ledger',ru:'Летопись'},
  'legacy-eyebrow':{en:'Embers carry forward even when the company falls',ru:'Угольки сохраняются, даже если отряд погибнет'},
  'legacy-embers-label':{en:'Embers banked',ru:'Накоплено угольков'},
  'legacy-tab-upgrades':{en:'Upgrades',ru:'Прокачка'},
  'legacy-tab-stats':{en:'Records',ru:'Статистика'},
  'legacy-tab-settings':{en:'Settings',ru:'Настройки'},
  'legacy-upgrades-h3':{en:'Permanent Upgrades',ru:'Постоянные улучшения'},
  'legacy-recruits-h3':{en:'Recruits',ru:'Наёмники'},
  'legacy-march-h3':{en:'Difficulty',ru:'Сложность'},
  'legacy-ascension-h3':{en:'Ascension',ru:'Сложность'},
  'legacy-stats-h3':{en:'Statistics',ru:'Статистика'},
  'legacy-history-h3':{en:'Recent Marches',ru:'Недавние походы'},
  'legacy-endless-h3':{en:'Endless March — Best Depths',ru:'Бесконечный поход — лучшие глубины'},
  'legacy-endless-eyebrow':{en:'Top runs past the final boss, deepest first.',ru:'Лучшие забеги за финальным боссом, от самого глубокого.'},
  'legacy-achievements-h3':{en:'Achievements',ru:'Достижения'},
  'legacy-settings-h3':{en:'Settings',ru:'Настройки'},
  'legacy-save-h3':{en:'Save Data',ru:'Сохранение'},
  'legacy-account-h3':{en:'Account',ru:'Аккаунт'},
  'btn-logout':{en:'Log Out',ru:'Выйти из аккаунта'},
  'profile-h2':{en:'Profile',ru:'Профиль'},
  'profile-eyebrow':{en:'Manage your account.',ru:'Управление аккаунтом.'},
  'profile-username-h3':{en:'Change Username',ru:'Смена имени пользователя'},
  'profile-label-new-username':{en:'New username',ru:'Новое имя пользователя'},
  'profile-label-username-password':{en:'Current password (to confirm)',ru:'Текущий пароль (для подтверждения)'},
  'btn-profile-save-username':{en:'Save Username',ru:'Сохранить имя'},
  'profile-password-h3':{en:'Change Password',ru:'Смена пароля'},
  'profile-label-current-password':{en:'Current password',ru:'Текущий пароль'},
  'profile-label-new-password':{en:'New password',ru:'Новый пароль'},
  'profile-label-confirm-password':{en:'Confirm new password',ru:'Повторите новый пароль'},
  'btn-profile-save-password':{en:'Save Password',ru:'Сохранить пароль'},
  'btn-profile-logout':{en:'Log Out',ru:'Выйти из аккаунта'},
  'btn-profile-back-top':{en:'Back',ru:'Назад'},
  'btn-profile-back':{en:'Back to Title',ru:'Назад в меню'},
  'auth-eyebrow':{en:'A COMPANY OF THE LAST ROAD',ru:'ОТРЯД ПОСЛЕДНЕЙ ДОРОГИ'},
  'auth-label-username':{en:'Username',ru:'Имя пользователя'},
  'auth-label-password':{en:'Password',ru:'Пароль'},
  'btn-daily':{en:'Daily Challenge',ru:'Испытание дня'},
  'btn-weekly':{en:'Weekly Trial',ru:'Испытание недели'},
  'btn-open-rules':{en:'How to Play',ru:'Правила игры'},
  'btn-open-tutorial':{en:'Tutorial',ru:'Обучение'},
  'btn-open-stats':{en:'Detailed statistics',ru:'Подробная статистика'},
  'btn-open-admin':{en:'Admin panel',ru:'Панель администратора'},
  'btn-play-guest':{en:'Play offline as a guest',ru:'Играть офлайн как гость'},
  'auth-guest-note':{en:'Guest progress stays in this browser only. No arena. Register later to keep it.',ru:'Прогресс гостя хранится только в этом браузере, без арены. Позже можно зарегистрироваться и сохранить его.'},
  'btn-guest-register':{en:'Create an account',ru:'Создать аккаунт'},
  'btn-save-reminder-export':{en:'Export code now',ru:'Экспортировать код'},
  'btn-save-reminder-dismiss':{en:'Remind me later',ru:'Напомнить позже'},
  'settings-animations-label':{en:'Animations',ru:'Анимации'},
  'settings-sound-label':{en:'Sound Effects',ru:'Звуковые эффекты'},
  'settings-colorblind-label':{en:'Colorblind mode',ru:'Режим для дальтоников'},
  'settings-music-label':{en:'Music',ru:'Музыка'},
  'settings-musicvol-label':{en:'Music Volume',ru:'Громкость музыки'},
  'settings-textsize-label':{en:'Text Size',ru:'Размер текста'},
  'btn-export-save':{en:'Export Save Code','ru':'Экспорт кода сохранения'},
  'btn-import-save':{en:'Import Save Code',ru:'Импорт кода сохранения'},
  'legacy-ascension-eyebrow':{en:'Higher ascension hardens every foe, but pays more embers',ru:'Чем выше сложность, тем сильнее враги — но и угольков больше'},
  'legacy-biome-h3':{en:'March',ru:'Поход'},
  'legacy-biome-eyebrow':{en:'Choose which land the company crosses next',ru:'Выберите, через какие земли пройдёт отряд'},
  'legacy-modifiers-h3':{en:'Difficulty Modifiers',ru:'Модификаторы сложности'},
  'legacy-modifiers-eyebrow':{en:'Optional trials to stack on top of Ascension. Toggle any combination.',ru:'Необязательные испытания вдобавок к сложности похода. Включайте в любом сочетании.'},
  'btn-legacy-back':{en:'Back',ru:'Назад'},
  'btn-legacy-back-top':{en:'← Back',ru:'← Назад'},
  'hero-select-h2':{en:'Muster the Company',ru:'Собери отряд'},
  'hero-select-eyebrow':{en:'Choose three. Choose well — there is no reforming mid-march.',ru:'Выбери троих. Выбирай с умом — в середине похода отряд не переформировать.'},
  'hero-select-biome-h3':{en:'Where the march leads',ru:'Куда ведёт поход'},
  'hero-select-biome-eyebrow':{en:'One story, three chapters — each land harsher than the last.',ru:'Один путь, три главы — каждая земля суровее предыдущей.'},
  'btn-confirm-heroes':{en:'Set Out',ru:'В путь'},
  'btn-back-title':{en:'Back',ru:'Назад'},
  'btn-back-title-top':{en:'← Back',ru:'← Назад'},
  'legend-battle':{en:'Battle',ru:'Бой'},
  'legend-elite':{en:'Elite',ru:'Элита'},
  'legend-event':{en:'Event',ru:'Событие'},
  'legend-shop':{en:'Shop',ru:'Лавка'},
  'legend-rest':{en:'Rest',ru:'Привал'},
  'map-hint':{en:'Tap any node to preview it. Glowing nodes are open to enter.',ru:'Нажмите на любую точку карты, чтобы её осмотреть. Светящиеся точки открыты для входа.'},
  'btn-formation':{en:'Formation & Gear',ru:'Строй и снаряжение'},
  'btn-abandon':{en:'Abandon March',ru:'Прервать поход'},
  'zone-foes':{en:'Foes',ru:'Враги'},
  'zone-company':{en:'Your Company',ru:'Ваш отряд'},
  'turn-order-label':{en:'Turn Order',ru:'Порядок ходов'},
  'reward-h2':{en:'Spoils',ru:'Трофеи'},
  'reward-eyebrow':{en:'Take one',ru:'Выберите один'},
  'btn-skip-reward':{en:'Move On',ru:'Идти дальше'},
  'btn-view-combat-log':{en:'Combat Log',ru:'Журнал боя'},
  'shop-h2':{en:"Peddler's Cart",ru:'Тележка торговца'},
  'shop-gold-label':{en:'Gold:',ru:'Золото:'},
  'shop-craft-label':{en:'Forge (spend shards)',ru:'Мастерская (тратит осколки)'},
  'btn-leave-shop':{en:'Leave',ru:'Уйти'},
  'rest-h2':{en:'Ashen Camp',ru:'Пепельный привал'},
  'rest-eyebrow':{en:'One quiet hour before the road resumes',ru:'Один тихий час перед дорогой'},
  'rest-heal-title':{en:'Rest',ru:'Отдых'},
  'rest-heal-desc':{en:'Heal the whole company for 35% of their max health.',ru:'Восстановить всему отряду 35% максимального здоровья.'},
  'rest-train-title':{en:'Train',ru:'Тренировка'},
  'rest-train-desc':{en:'Pick a company member to permanently gain +3 to their primary damage stat (STR/INT) and +1 defense this march.',ru:'Выберите бойца, который навсегда получит +3 к основной характеристике урона (СИЛА/ИНТ) и +1 к защите в этом походе.'},
  'go-layers-label':{en:'Layers reached',ru:'Пройдено уровней'},
  'go-embers-label':{en:'Embers earned',ru:'Получено угольков'},
  'btn-go-continue':{en:'Return to Camp',ru:'Вернуться в лагерь'},
  'legacy-bestiary-h3':{en:'Bestiary',ru:'Бестиарий'},
  'legacy-bestiary-eyebrow':{en:'Foes and bosses you\'ve met on the march, with their weak point.',ru:'Враги и боссы, встреченные в походе, вместе с их слабым местом.'},
  'btn-open-bestiary':{en:'Open Bestiary',ru:'Открыть бестиарий'},
  'btn-save-hero-preset':{en:'Save as Preset',ru:'Сохранить как пресет'},
  'btn-go-endless':{en:'Press on — Endless March',ru:'Идти дальше — Бесконечный поход'},
  'btn-go-view-log':{en:'Combat Log',ru:'Журнал боя'},
};
function applyStaticI18n(){
  Object.keys(STATIC_I18N).forEach(function(id){
    const node=document.getElementById(id);
    if(node)node.innerHTML=L(STATIC_I18N[id]);
  });
}
function renderLangSwitch(){
  document.querySelectorAll('.lang-btn').forEach(function(b){
    b.classList.toggle('active',b.dataset.lang===LANG);
    b.onclick=function(){setLang(b.dataset.lang);};
  });
}
function setLang(l){
  if(l!=='en'&&l!=='ru')return;
  if(l===LANG)return;
  LANG=l;saveLang();
  applyStaticI18n();renderLangSwitch();
  if(!AUTH_TOKEN&&!IS_GUEST)renderAuthScreen();else renderTitle(); // a guest stays on the title screen
}
