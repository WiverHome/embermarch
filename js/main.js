// Embermarch client: Wire-up: event listeners and start-up.
// Classic script: shares the global scope with the other js/*.js files; load order is set in index.html.
"use strict";

/* ============================= WIRE UP ============================= */

$('btn-new-run').addEventListener('click',renderHeroSelect);
$('btn-continue').addEventListener('click',function(){
  const saved=loadRun();
  if(!saved)return;
  RUN=saved;
  if(RUN.daily)applyDailySeed(RUN.daily);
  hydrateParty(RUN);
  if(RUN.combat&&!RUN.combat.over){
    saveRun();
    show('screen-combat');
    renderTopbar();
    resumeCombat();
    return;
  }
  if(RUN.combat&&RUN.combat.over){
    if(RUN.pendingReward){renderRewardScreen();return;}
    if(!anyAlive(RUN.combat.party).length){onDefeat();return;}
    onVictory();return;
  }
  if(RUN.pendingReward){renderRewardScreen();return;}
  /* Resuming (page reload, or just coming back later) while still inside a shop
     used to always drop the player back on the map instead of back into the
     shop itself. The shop's own node stayed un-cleared (never marked complete
     — that only happens on the explicit "Leave" button), so it was still shown
     as an open, enterable node on the map; walking back into it reused the
     same cached RUN.shopStockByNode entry (by design, so a reload can't be
     used to reroll a shop) — which, if anything had already been bought, now
     looked like "the trader's goods didn't refresh" instead of what was
     actually happening (the same still-open shop, picked back up where it was
     left). Resuming straight back into it, same as combat/reward resume
     already did, fixes both: the right screen comes back, and the node stops
     dangling as "available" on the map in the meantime. RUN._shopNode survives
     the reload (it's serialized as part of RUN), but it's a deserialized clone
     rather than the live object inside RUN.map — look the real node up by id
     (findNode) so completing it later (Leave) marks the actual map node, not
     a disconnected copy the map never sees. Endless-March waypoint shops
     aren't part of RUN.map (synthesized per depth, never map-clickable), so
     there's nothing to look up for those — just hand the stored node back. */
  if(RUN._shopNode){
    const liveShopNode=RUN._shopNode.endless?RUN._shopNode:(findNode(RUN.map,RUN._shopNode.id)||RUN._shopNode);
    if(!liveShopNode.cleared){
      RUN._shopNode=liveShopNode;
      startShop(liveShopNode);
      return;
    }
  }
  saveRun();show('screen-map');renderTopbar();renderMap();
});
$('btn-open-legacy').addEventListener('click',renderLegacy);
$('btn-open-arena').addEventListener('click',openArena);
$('btn-open-profile').addEventListener('click',renderProfileScreen);
$('btn-profile-back').addEventListener('click',renderTitle);
$('btn-profile-back-top').addEventListener('click',renderTitle);
$('btn-profile-logout').addEventListener('click',doLogout);
$('btn-profile-save-username').addEventListener('click',profileSaveUsername);
$('btn-profile-save-password').addEventListener('click',profileSavePassword);
function leaveArenaScreen(){
  if(LIVE&&LIVE.status==='queued')liveQueueLeave();
  if(LIVE&&LIVE.status==='inviting')liveInviteCancel();
  renderTitle();
}
$('btn-arena-back').addEventListener('click',leaveArenaScreen);
$('btn-arena-back-top').addEventListener('click',leaveArenaScreen);
$('legacy-tabs').addEventListener('click',function(e){
  const btn=e.target.closest('.legacy-tab');
  if(!btn)return;
  legacyActiveTab=btn.dataset.tab;
  applyLegacyTabUI();
});
$('btn-open-rules').addEventListener('click',showRulesModal);
$('btn-open-stats').addEventListener('click',showStatsModal);
$('btn-play-guest').addEventListener('click',startGuest);
$('btn-guest-register').addEventListener('click',guestToRegister);
/* The panel is served by the game server itself (own domain, own login). */
$('btn-open-admin').addEventListener('click',function(){if(IS_ADMIN)window.open(API_BASE.replace(/\/api\/?$/,'')+'/admin','_blank','noopener');});
$('btn-open-tutorial').addEventListener('click',function(){
  META.tutorial={welcome:false,heroSelect:false,map:false,combat:false};
  saveMeta();
  maybeShowTutorial('welcome',showWelcomeTutorial);
});
$('btn-save-reminder-export').addEventListener('click',function(){
  META.lastExportNudgeEmbers=META.embers;saveMeta();
  exportSave();
  renderTitle();
});
$('btn-save-reminder-dismiss').addEventListener('click',function(){
  META.lastExportNudgeEmbers=META.embers;saveMeta();
  renderTitle();
});
$('btn-legacy-back').addEventListener('click',renderTitle);
$('btn-legacy-back-top').addEventListener('click',renderTitle);
$('btn-back-title').addEventListener('click',function(){dailyPendingSeed=null;renderTitle();});
$('btn-back-title-top').addEventListener('click',function(){dailyPendingSeed=null;renderTitle();});
$('btn-confirm-heroes').addEventListener('click',function(){
  if(heroSelectState.length===3){
    const seed=dailyPendingSeed;dailyPendingSeed=null;
    startNewRun(heroSelectState.slice(),seed);
  }
});
$('btn-save-hero-preset').addEventListener('click',openSavePresetModal);
$('btn-formation').addEventListener('click',openFormationModal);
$('btn-auto-battle').addEventListener('click',function(){
  if(!RUN.combat)return;
  RUN.combat.autoBattle=!RUN.combat.autoBattle;
  if(RUN.combat.autoBattle&&RUN.combat.phase==='hero_target'){
    // Cancel any pending manual target selection so auto-battle can't get stuck
    // waiting for a click that will never come.
    RUN.combat.selectedAbility=null;
    RUN.combat.phase='hero_choose';
    renderActionPanel();renderCombat();
  }
  updateAutoBattleButton();
  saveRun();
  if(RUN.combat.autoBattle&&RUN.combat.phase==='hero_choose'&&RUN.combat.activeHero){
    setTimeout(function(){autoActHero(RUN.combat.activeHero);},400);
  }
});
$('btn-abandon').addEventListener('click',function(){
  const wrap=el('div','stack');
  wrap.appendChild(el('h3','',M('Abandon this march?','Прервать этот поход?')));
  wrap.appendChild(el('div','',"<span style='color:var(--muted);font-size:13px;'>"+M('Your embers earned so far will still be banked, but the company disperses.','Заработанные угольки сохранятся, но отряд распустят.')+"</span>"));
  const row=el('div','row');
  const yes=el('button','danger-btn',M('Abandon','Прервать'));
  yes.addEventListener('click',function(){
    const embers=computeEmbers(false);
    META.embers+=embers;META.bestLayer=Math.max(META.bestLayer,RUN.layersCleared);
    recordChallengeResult(false,RUN.layersCleared,true);
    saveMeta();
    clearRun();closeModal();renderTitle();
  });
  const no=el('button','',M('Keep Going','Продолжить поход'));
  no.addEventListener('click',closeModal);
  row.appendChild(yes);row.appendChild(no);
  wrap.appendChild(row);
  openModal(wrap);
});
$('btn-leave-shop').addEventListener('click',function(){afterLeaveNode(RUN._shopNode);});
$('btn-rest-heal').addEventListener('click',function(){
  const frac=restHealFrac();
  RUN.party.forEach(function(h){if(h.alive)h.hp=Math.min(h.maxHp,h.hp+Math.round(h.maxHp*frac));});
  afterLeaveNode(RUN._restNode);
});
$('btn-rest-train').addEventListener('click',function(){
  promptChooseHero(M('Train whom?','Кого тренировать?'),function(h){const dt=dmgTypeOf(h);h[dt]=(h[dt]||0)+3;h.def+=1;afterLeaveNode(RUN._restNode);});
});
$('btn-go-continue').addEventListener('click',renderTitle);
$('btn-go-endless').addEventListener('click',startEndlessMode);
$('btn-go-view-log').addEventListener('click',openCombatLogModal);
$('btn-theme-toggle').addEventListener('click',toggleTheme);
$('btn-toggle-animations').addEventListener('click',function(){
  META.settings.animations = META.settings.animations===false;
  saveMeta();applySettings();renderLegacy();
});
$('btn-toggle-colorblind').addEventListener('click',function(){
  META.settings.colorblind=!META.settings.colorblind;
  saveMeta();applySettings();renderLegacy();
});
$('btn-toggle-sound').addEventListener('click',function(){
  META.settings.sound = META.settings.sound===false;
  saveMeta();renderLegacy();
  if(META.settings.sound!==false)SFX.click();
});
$('btn-toggle-music').addEventListener('click',function(){
  META.settings.music = META.settings.music===false;
  saveMeta();musicApplySettings();renderLegacy();
});
$('btn-export-save').addEventListener('click',exportSave);
$('btn-import-save').addEventListener('click',importSave);
let dailyPendingSeed=null;
$('btn-weekly').addEventListener('click',function(){
  const week=isoWeekStr();
  const spec=weeklySpec(week);
  const wrap=el('div','stack');
  wrap.appendChild(el('h3','',M('Weekly Trial','Испытание недели')+' · '+week.slice(1)));
  const mods=MODIFIER_DEFS.filter(function(m){return spec.modifiers[m.key];});
  wrap.appendChild(el('div','',"<span style='color:var(--muted);font-size:13px;line-height:1.5;'>"+M(
    'The same seeded march for every player this week. Ascension '+spec.ascension+', one attempt. Win: +'+WEEKLY_WIN_EMBERS+' embers, fall: +'+WEEKLY_LOSS_EMBERS+'.',
    'Один и тот же поход для всех игроков на этой неделе. Сложность '+spec.ascension+', одна попытка. Победа: +'+WEEKLY_WIN_EMBERS+' угольков, поражение: +'+WEEKLY_LOSS_EMBERS+'.')+"</span>"));
  const list=el('div','stack');
  mods.forEach(function(m){list.appendChild(el('div','',"<strong>"+L(m.name)+"</strong> <span style='color:var(--muted);font-size:12px;'>"+L(m.desc)+"</span>"));});
  wrap.appendChild(list);
  const row=el('div','row');
  if(META.weeklyLastWeek===week){
    const res=META.weeklyLastResult;
    wrap.appendChild(el('div','eyebrow',res&&res.win?M('Done this week: victory!','На этой неделе пройдено: победа!'):M('Attempted this week: fell on layer ','На этой неделе: гибель на слое ')+((res&&res.layer)||0)+'.'));
  } else {
    const go=el('button','primary',M('Choose company','Выбрать отряд'));
    go.addEventListener('click',function(){closeModal();dailyPendingSeed=week;renderHeroSelect();});
    row.appendChild(go);
  }
  const close=el('button','',M('Close','Закрыть'));
  close.addEventListener('click',closeModal);
  row.appendChild(close);
  wrap.appendChild(row);
  openModal(wrap);
});
$('btn-daily').addEventListener('click',function(){
  const today=todayDateStr();
  if(META.dailyLastDate===today){
    const res=META.dailyLastResult;
    const wrap=el('div','stack');
    wrap.appendChild(el('h3','',M("Today's Challenge",'Испытание дня')));
    wrap.appendChild(el('div','',"<span style='color:var(--muted);font-size:13px;'>"+(res&&res.win?M("You've already completed today's challenge. Come back tomorrow for a new march!","Вы уже прошли сегодняшнее испытание. Возвращайтесь завтра за новым походом!"):M("You've already attempted today's challenge. Come back tomorrow for a new march!","Вы уже пытались пройти сегодняшнее испытание. Возвращайтесь завтра за новым походом!"))+"</span>"));
    const close=el('button','primary',M('Got it','Понятно'));
    close.addEventListener('click',closeModal);
    wrap.appendChild(close);
    openModal(wrap);
    return;
  }
  dailyPendingSeed=today;
  renderHeroSelect();
});
/* ---- Keyboard hotkeys (desktop). Touch devices never see the badges (@media hover:none). ---- */
/* Valid targets for the selected ability, in on-screen order (the 1-9 badges). */
function combatTargetList(){
  const c=RUN&&RUN.combat;
  if(!c||!c.selectedAbility||!c.activeHero||c.phase!=='hero_target')return [];
  const ab=c.selectedAbility;
  if(ab.targets!=='single'&&ab.targets!=='single-ally')return [];
  const valid=getValidTargets(ab,c.activeHero);
  const side=ab.targets==='single'?c.enemies:c.party;
  /* front row first, then back, each in list order: matches how the rows are drawn */
  return side.filter(function(u){return u.row==='front'&&valid.indexOf(u)>=0;})
    .concat(side.filter(function(u){return u.row!=='front'&&valid.indexOf(u)>=0;}));
}
/* Reachable, uncleared map nodes, top to bottom: keys 1-9 on the map. */
function mapHotkeyNodes(){
  if(!RUN||!RUN.map||!RUN.availableNodeIds)return [];
  return mapAllNodes(RUN.map).filter(function(n){return !n.cleared&&RUN.availableNodeIds.indexOf(n.id)>=0;});
}
function showHotkeysModal(){
  const rows=[
    ['1-9',M('Combat: pick an ability; while aiming, pick a target','Бой: выбрать способность; при наведении выбрать цель')],
    [M('Space','Пробел'),M('While aiming: weakest foe / most hurt ally','При наведении: самый слабый враг / самый раненый союзник')],
    ['Esc',M('Cancel aiming, or close a window','Отменить наведение или закрыть окно')],
    ['A',M('Combat: toggle auto-battle','Бой: включить/выключить автобой')],
    ['L',M('Combat: open the full combat log','Бой: открыть полный журнал боя')],
    ['1-9',M('Map: enter a reachable node (numbers next to nodes)','Карта: войти в доступный узел (номера рядом с узлами)')],
    ['H / ?',M('This list','Этот список')],
  ];
  const wrap=el('div','stack');
  wrap.appendChild(el('h3','',M('Hotkeys','Горячие клавиши')));
  const t=el('table','hotkey-table');
  rows.forEach(function(r){const tr=el('tr','');tr.appendChild(el('td','','<kbd>'+r[0]+'</kbd>'));tr.appendChild(el('td','',r[1]));t.appendChild(tr);});
  wrap.appendChild(t);
  const close=el('button','primary',M('Close','Закрыть'));
  close.style.marginTop='12px';
  close.addEventListener('click',closeModal);
  wrap.appendChild(close);
  openModal(wrap);
}
function isTypingTarget(t){return t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable);}
function screenVisible(id){const s=$(id);return !!s&&!s.hidden;}
document.addEventListener('keydown',function(e){
  if(e.ctrlKey||e.metaKey||e.altKey||isTypingTarget(e.target))return;
  const modalOpen=!!$('modal-root').firstChild;
  if(e.key==='Escape'&&modalOpen){closeModal();return;}
  if(modalOpen)return;
  const k=e.key.length===1?e.key.toLowerCase():e.key;
  if(k==='h'||k==='?'){showHotkeysModal();return;}
  const n=parseInt(e.key,10);
  if(screenVisible('screen-map')&&RUN&&!RUN.combat&&n>=1&&n<=9){
    const node=mapHotkeyNodes()[n-1];
    if(node){e.preventDefault();enterNode(node);}
    return;
  }
  if(!RUN||!RUN.combat||RUN.combat.over||!screenVisible('screen-combat'))return;
  const c=RUN.combat;
  if(k==='l'){openCombatLogModal();return;}
  if(k==='a'&&!c.isLivePvp){$('btn-auto-battle').click();return;}
  if(c.phase==='hero_target'){
    if(e.key==='Escape'){c.selectedAbility=null;c.phase='hero_choose';renderActionPanel();renderCombat();return;}
    const list=combatTargetList();
    if(n>=1&&n<=9&&list[n-1]){e.preventDefault();heroChooseTarget(list[n-1]);return;}
    if(e.key===' '&&list.length){
      e.preventDefault();
      heroChooseTarget(list.slice().sort(function(a,b){return (a.hp/a.maxHp)-(b.hp/b.maxHp);})[0]);
    }
    return;
  }
  if(c.autoBattle)return;
  if(c.phase!=='hero_choose'||!c.activeHero)return;
  if(n>=1&&n<=9){
    const a=c.activeHero.abilities[n-1];
    if(a)heroChooseAbility(a);
  }
});
window.addEventListener('beforeunload',function(e){
  if(RUN&&RUN.combat&&!RUN.combat.over){
    e.preventDefault();e.returnValue='';
    return '';
  }
});
function spawnEmberParticles(){
  const host=$('ember-particles');
  if(!host)return;
  host.innerHTML='';
  const n=14;
  for(let i=0;i<n;i++){
    const s=el('div','ember-spark');
    const dur=(10+Math.random()*12).toFixed(1)+'s';
    const delay=(-Math.random()*20).toFixed(1)+'s';
    const drift=Math.round((Math.random()*60-30))+'px';
    s.style.left=(Math.random()*100).toFixed(1)+'%';
    s.style.setProperty('--drift',drift);
    s.style.animationDuration=dur;
    s.style.animationDelay=delay;
    host.appendChild(s);
  }
}

$('auth-form').addEventListener('submit',onAuthSubmit);
$('auth-toggle-link').addEventListener('click',onAuthToggle);
$('btn-logout').addEventListener('click',doLogout);

applyStaticI18n();
applyTheme();
applySettings();
attemptSessionRestore();
spawnEmberParticles();
/* PWA: install to home screen + cached assets (see sw.js). Only over http(s);
   opening index.html straight from disk (file://) skips it. */
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
  window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){});});
}
