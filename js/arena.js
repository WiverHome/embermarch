// Embermarch client: Arena (async PvP) and live real-time PvP over WebSocket.
// Classic script: shares the global scope with the other js/*.js files; load order is set in index.html.
"use strict";

/* ============================= ARENA (asynchronous PvP) =============================
   One persistent "champion" (1-3 heroes) per account, kept on the server. The client
   only names the heroes; the server rebuilds every stat from its own tables and the
   saved progress (server/champion.js). Fighting fetches an opponent plus a single-use
   battle token (GET arena/opponent), and the fight itself runs on the server over the
   arena WebSocket with a server bot piloting the opponent (see startArenaCombat), so
   the result and rating change are decided server-side. */
let ARENA_BUILDER_STATE=[];
let ARENA_CHAMPION=null;   // {name,heroes,rating,wins,losses} — this account's saved champion, or null
let ARENA_OPPONENT=null;   // last fetched {username,name,heroes,rating,battleToken}, or null
let ARENA_VIEW='hub';      // 'hub' | 'builder' | 'opponent'
let ARENA_BUSY=false;

function arenaHeroPickCard(list,key,def,unlocked){
  const card=el('div','hero-pick'+(unlocked?'':' locked'));
  if(unlocked&&ARENA_BUILDER_STATE.indexOf(key)>=0)card.classList.add('selected');
  const av=el('div','hero-avatar',def.custom?customPortraitSVG(def):(HERO_ICON_SVG[def.tplKey||key]||def.icon));av.style.background=def.color;
  card.appendChild(av);
  const info=el('div','hero-info');
  info.appendChild(el('div','name',L(def.name)+(unlocked?'':M(' (locked)',' (заблокировано)'))));
  info.appendChild(el('div','cls',L(def.cls)));
  const heroDt=HERO_DMG_TYPE[def.tplKey||key]||'str';
  info.appendChild(el('div','hero-stats',statAbbr('hp')+' '+def.baseHp+' &middot; '+statAbbr(heroDt)+' '+(heroDt==='str'?def.baseStr:def.baseInt)+' &middot; '+statAbbr('def')+' '+def.baseDef+' &middot; '+statAbbr('spd')+' '+def.baseSpd));
  card.appendChild(info);
  if(unlocked){
    card.addEventListener('click',function(){
      const idx=ARENA_BUILDER_STATE.indexOf(key);
      if(idx>=0)ARENA_BUILDER_STATE.splice(idx,1);
      else if(ARENA_BUILDER_STATE.length<3)ARENA_BUILDER_STATE.push(key);
      renderArenaBuilder();
    });
  }
  list.appendChild(card);
}
function renderArenaBuilder(){
  const body=$('arena-body');body.innerHTML='';
  body.appendChild(el('h3','',M('Build your champion','Соберите чемпиона')));
  body.appendChild(el('div','eyebrow',M('Pick 1-3 heroes. Their current stats (unlocks, legacy upgrades) are frozen into this squad until you edit it again — gear from your marches is not included.','Выберите 1-3 героев. Их текущие характеристики (открытые герои, постоянные улучшения) замораживаются в этом составе до следующего редактирования — снаряжение из походов в него не входит.')));
  const nameWrap=el('div','',null);
  nameWrap.innerHTML='<label style="font-size:12px;color:var(--muted);">'+M('Champion name','Имя чемпиона')+'</label>';
  const nameInput=document.createElement('input');
  nameInput.type='text';nameInput.maxLength=24;nameInput.style.cssText='width:100%;margin-top:4px;';
  nameInput.value=(ARENA_CHAMPION&&ARENA_CHAMPION.name)||(CURRENT_USER?CURRENT_USER+M("'s Company",' отряд'):M('My Champion','Мой чемпион'));
  nameWrap.appendChild(nameInput);
  body.appendChild(nameWrap);
  const list=el('div','hero-pick-list',null);
  HERO_ORDER.forEach(function(key){arenaHeroPickCard(list,key,HERO_DEFS[key],META.heroesUnlocked[key]);});
  (META.customHeroes||[]).forEach(function(c){arenaHeroPickCard(list,c.id,customHeroToDef(c.id),true);});
  body.appendChild(list);
  const err=el('div','',"");err.style.cssText='color:var(--danger);font-size:12px;min-height:14px;';
  body.appendChild(err);
  const row=el('div','row',null);
  const save=el('button','primary',M('Save Champion','Сохранить чемпиона'));
  save.disabled=ARENA_BUSY;
  save.addEventListener('click',function(){
    const name=nameInput.value.trim();
    if(!name){err.textContent=M('Enter a name.','Введите имя.');return;}
    if(!ARENA_BUILDER_STATE.length){err.textContent=M('Pick at least one hero.','Выберите хотя бы одного героя.');return;}
    ARENA_BUSY=true;save.disabled=true;err.textContent='';
    const heroes=ARENA_BUILDER_STATE.map(function(k){return {key:k};});
    /* The server rebuilds champion stats from the stored progress, so push any
       pending progress sync (fresh upgrades/unlocks) before saving. */
    flushMetaSyncNow().then(function(){return apiPutChampion(name.slice(0,24),heroes);}).then(function(champ){
      ARENA_BUSY=false;
      ARENA_CHAMPION=champ;
      ARENA_VIEW='hub';
      renderArenaBody();
    }).catch(function(e){
      ARENA_BUSY=false;save.disabled=false;
      err.textContent=(e&&e.body&&e.body.error)||M('Could not save — check your connection and try again.','Не удалось сохранить — проверьте соединение и попробуйте снова.');
    });
  });
  row.appendChild(save);
  if(ARENA_CHAMPION){
    const cancel=el('button','',M('Cancel','Отмена'));
    cancel.addEventListener('click',function(){ARENA_VIEW='hub';renderArenaBody();});
    row.appendChild(cancel);
  }
  body.appendChild(row);
}
function arenaMiniSquad(heroes){
  const wrap=el('div','row',null);
  wrap.style.flexWrap='wrap';
  (heroes||[]).forEach(function(h){
    const chip=el('div','',null);
    chip.style.cssText='display:flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:4px 8px 4px 4px;font-size:12px;';
    const av=el('div','hero-avatar',h.custom?customPortraitSVG(h):(HERO_ICON_SVG[h.tplKey||h.key]||h.icon));
    av.style.cssText='width:26px;height:26px;background:'+h.color+';flex-shrink:0;';
    chip.appendChild(av);
    chip.appendChild(el('span','',h.name+' · '+statAbbr('hp')+h.maxHp));
    wrap.appendChild(chip);
  });
  return wrap;
}
function renderArenaHub(){
  const body=$('arena-body');body.innerHTML='';
  if(!ARENA_CHAMPION){
    body.appendChild(el('div','',"<span style='color:var(--muted);'>"+M('No champion saved yet — build one to enter the arena.','Чемпион ещё не создан — соберите его, чтобы выйти на арену.')+"</span>"));
    const build=el('button','primary',M('Build a Champion','Собрать чемпиона'));
    build.addEventListener('click',function(){ARENA_BUILDER_STATE=[];ARENA_VIEW='builder';renderArenaBody();});
    body.appendChild(build);
    return;
  }
  const card=el('div','card stack',null);
  const head=el('div','spread',null);
  head.innerHTML='<strong>'+ARENA_CHAMPION.name+'</strong><span class="gold-badge num">'+M('Rating ','Рейтинг ')+ARENA_CHAMPION.rating+'</span>';
  card.appendChild(head);
  card.appendChild(el('div','eyebrow',M('Wins ','Побед ')+ARENA_CHAMPION.wins+M('  ·  Losses ','  ·  Поражений ')+ARENA_CHAMPION.losses));
  card.appendChild(arenaMiniSquad(ARENA_CHAMPION.heroes));
  const row=el('div','row',null);
  const findBtn=el('button','primary',M('Find an Opponent (Async)','Найти соперника (асинхронно)'));
  findBtn.disabled=ARENA_BUSY;
  findBtn.addEventListener('click',fetchArenaOpponent);
  row.appendChild(findBtn);
  const editBtn=el('button','',M('Edit Squad','Изменить отряд'));
  editBtn.addEventListener('click',function(){ARENA_BUILDER_STATE=ARENA_CHAMPION.heroes.map(function(h){return h.key;});ARENA_VIEW='builder';renderArenaBody();});
  row.appendChild(editBtn);
  const lbBtn=el('button','',M('Leaderboard','Таблица лидеров'));
  lbBtn.addEventListener('click',openArenaLeaderboard);
  row.appendChild(lbBtn);
  card.appendChild(row);
  body.appendChild(card);
  const seasonBox=el('div','card stack',null);seasonBox.id='arena-season-box';seasonBox.hidden=true;
  body.appendChild(seasonBox);
  const replayBox=el('div','card stack',null);replayBox.id='arena-replay-box';replayBox.hidden=true;
  body.appendChild(replayBox);
  renderArenaSeason(seasonBox);
  renderArenaReplayList(replayBox);
  renderLiveDuelPanel();
}
/* ---- Arena seasons (server/seasons.js): end date, last season's result, rank reward ---- */
function renderArenaSeason(box){
  apiArenaSeason().then(function(s){
    if(!box.isConnected)return;
    box.hidden=false;box.innerHTML='';
    const days=Math.max(0,Math.ceil((s.current.endsAt-Date.now())/86400000));
    const head=el('div','spread',null);
    head.appendChild(el('strong','',M('Season ','Сезон ')+s.current.id));
    head.appendChild(el('span','eyebrow',M('ends in '+days+' d','до конца '+days+' дн.')));
    box.appendChild(head);
    box.appendChild(el('div','',"<span style='color:var(--muted);font-size:12px;line-height:1.5;'>"+M(
      'At the end of a season ratings move halfway back to 1000. Top places earn embers (1st '+s.rewards.table[0].embers+', top 10 '+s.rewards.table[s.rewards.table.length-1].embers+'), everyone with '+s.rewards.minGames+'+ fights gets '+s.rewards.participation+'.',
      'В конце сезона рейтинг наполовину возвращается к 1000. За места дают угольки (1-е место '+s.rewards.table[0].embers+', топ-10 '+s.rewards.table[s.rewards.table.length-1].embers+'), всем, у кого '+s.rewards.minGames+'+ боёв, — '+s.rewards.participation+'.')+"</span>"));
    if(s.last&&s.last.mine){
      const m=s.last.mine;
      box.appendChild(el('div','eyebrow',M('Last season: ','Прошлый сезон: ')+(m.rank?M('place #','место №')+m.rank:M('not placed','без места'))+' · '+M('rating ','рейтинг ')+m.rating));
    }
    if(s.pendingReward){
      const pr=s.pendingReward;
      const claim=el('button','primary',M('Claim season reward: +'+pr.reward+' embers','Забрать награду сезона: +'+pr.reward+' угольков'));
      claim.addEventListener('click',function(){
        claim.disabled=true;
        /* Save any pending local progress first: the server credits the embers into the
           saved copy and hands it back, and that copy replaces META here. */
        flushMetaSyncNow().then(function(){return apiArenaSeasonClaim(pr.seasonId);}).then(function(r){
          if(r.progress){applyProgressToMeta(r.progress);setSyncStatus(true);}
          claim.replaceWith(el('div','eyebrow',M('+'+r.reward+' embers added.','+'+r.reward+' угольков получено.')));
        }).catch(function(e){claim.disabled=false;claim.textContent=e.message;});
      });
      box.appendChild(claim);
    }
    if(s.last&&s.last.top&&s.last.top.length){
      const det=el('details','',null);
      det.appendChild(el('summary','',M('Season '+s.last.id+' final standings','Итоги сезона '+s.last.id)));
      s.last.top.forEach(function(t){det.appendChild(el('div','',"<span class='num'>#"+t.rank+'</span> '+escHtml(t.username||'?')+' · '+escHtml(t.name||'')+' · '+t.rating));});
      box.appendChild(det);
    }
  }).catch(function(){});
}
/* ---- Arena replays: the server records every arena fight; participants can watch them. ---- */
function renderArenaReplayList(box){
  apiArenaReplays().then(function(list){
    if(!box.isConnected||!list.length)return;
    box.hidden=false;box.innerHTML='';
    box.appendChild(el('strong','',M('Recent fights','Последние бои')));
    list.slice(0,8).forEach(function(r){
      const line=el('div','spread',null);
      const res=r.result==='win'?M('Win','Победа'):r.result==='loss'?M('Loss','Поражение'):M('Draw','Ничья');
      const kind=r.kind==='live'?M('live','живой'):M('async','асинхр.');
      const when=new Date(r.createdAt).toLocaleDateString(LANG==='ru'?'ru-RU':'en-GB');
      line.appendChild(el('span','',"<span style='color:"+(r.result==='win'?'var(--good)':r.result==='loss'?'var(--danger)':'var(--muted)')+";'>"+res+"</span> · "+escHtml(r.opponent.name||'?')+' ('+escHtml(r.opponent.username||'?')+") <span style='color:var(--muted);font-size:11px;'>"+kind+' · '+when+'</span>'));
      const watch=el('button','',M('Watch','Смотреть'));
      watch.style.cssText='font-size:11px;padding:3px 10px;';
      watch.addEventListener('click',function(){openArenaReplay(r.id);});
      line.appendChild(watch);
      box.appendChild(line);
    });
  }).catch(function(){});
}
let REPLAY=null; // {data, side, idx, playing, speed, timer}
const REPLAY_STEP_MS=900;
function openArenaReplay(id){
  if(loadRun()){$('arena-body').innerHTML="<span style='color:var(--danger);'>"+M('Finish or abandon your current march first.','Сначала заверши или прерви текущий поход.')+"</span>";return;}
  apiArenaReplay(id).then(function(r){
    const loc=liveStateToLocal(r.data.start,r.side);
    RUN={isArenaTemp:true,party:loc.party,gold:0,ascension:0,modifiers:{},biome:'ashfall',inventory:[],combat:null};
    /* over:true keeps every input path (hotkeys, clicks, unload guard) inert. */
    RUN.combat={isReplay:true,enemies:loc.enemies,party:RUN.party,queue:[],qi:0,round:1,log:[],
      selectedAbility:null,targetingUnit:null,over:true,autoBattle:false,activeUnit:null,activeHero:null,phase:'replay'};
    REPLAY={data:r.data,side:r.side,result:r.result,idx:0,playing:true,speed:1,timer:null};
    show('screen-combat');
    renderTopbar();
    $('tb-layer').textContent=M('Replay','Повтор боя');
    const me=r.side==='hero'?r.data.heroUsername:r.data.enemyUsername,them=r.side==='hero'?r.data.enemyUsername:r.data.heroUsername;
    logCombat(M('Replay: '+escHtml(me)+' vs '+escHtml(them)+'.','Повтор: '+escHtml(me)+' против '+escHtml(them)+'.'));
    renderCombat();renderActionPanel();
    replaySchedule();
  }).catch(function(e){
    const body=$('arena-body');if(body)body.insertBefore(el('div','',"<span style='color:var(--danger);'>"+escHtml(e.message)+"</span>"),body.firstChild);
  });
}
function replaySchedule(){
  if(!REPLAY)return;
  clearTimeout(REPLAY.timer);
  if(REPLAY.playing&&REPLAY.idx<REPLAY.data.steps.length)REPLAY.timer=setTimeout(function(){replayStepForward();replaySchedule();},REPLAY_STEP_MS/REPLAY.speed);
}
function replayStepForward(){
  if(!REPLAY)return;
  /* Something else (a live match found while watching) took over the combat screen. */
  if(!RUN||!RUN.combat||!RUN.combat.isReplay){clearTimeout(REPLAY.timer);REPLAY=null;return;}
  const st=REPLAY.data.steps[REPLAY.idx];
  if(!st)return;
  REPLAY.idx++;
  (st.l||[]).forEach(function(l){logCombat(L(l));});
  (st.hp||[]).forEach(function(h){
    const u=liveFindLocalUnit(h[0]);
    if(u){u.hp=h[1];u.alive=!!h[2];if(h[3])u.row=h[3];if(h[4])u.status=h[4].map(function(st){return Object.assign({},st,{label:L(st.label)});});}
  });
  if(REPLAY.idx>=REPLAY.data.steps.length){
    REPLAY.playing=false;
    const mine=REPLAY.result==='draw'?'draw':((REPLAY.result==='hero')===(REPLAY.side==='hero')?'win':'loss');
    logCombat(mine==='win'?M('End of replay: victory.','Конец повтора: победа.'):mine==='loss'?M('End of replay: defeat.','Конец повтора: поражение.'):M('End of replay: draw.','Конец повтора: ничья.'));
  }
  renderCombat();renderActionPanel();
}
function exitReplay(){
  if(REPLAY)clearTimeout(REPLAY.timer);
  REPLAY=null;RUN=null;
  openArena();
}
function renderReplayPanel(panel){
  const total=REPLAY?REPLAY.data.steps.length:0,idx=REPLAY?REPLAY.idx:0;
  panel.appendChild(el('div','eyebrow',M('Replay','Повтор')+' · '+idx+' / '+total));
  const row=el('div','row');
  const play=el('button','primary',REPLAY&&REPLAY.playing?M('Pause','Пауза'):M('Play','Смотреть'));
  play.disabled=idx>=total;
  play.addEventListener('click',function(){REPLAY.playing=!REPLAY.playing;replaySchedule();renderActionPanel();});
  row.appendChild(play);
  const step=el('button','',M('Step','Шаг'));
  step.disabled=idx>=total;
  step.addEventListener('click',function(){REPLAY.playing=false;clearTimeout(REPLAY.timer);replayStepForward();});
  row.appendChild(step);
  [1,2,4].forEach(function(sp){
    const b=el('button',REPLAY&&REPLAY.speed===sp?'primary':'','×'+sp);
    b.addEventListener('click',function(){REPLAY.speed=sp;replaySchedule();renderActionPanel();});
    row.appendChild(b);
  });
  const exit=el('button','',M('Back to arena','Назад на арену'));
  exit.addEventListener('click',exitReplay);
  row.appendChild(exit);
  panel.appendChild(row);
}
function renderArenaOpponentPreview(){
  const body=$('arena-body');body.innerHTML='';
  const card=el('div','card stack',null);
  const head=el('div','spread',null);
  head.innerHTML='<strong>'+ARENA_OPPONENT.name+'</strong><span class="gold-badge num">'+M('Rating ','Рейтинг ')+ARENA_OPPONENT.rating+'</span>';
  card.appendChild(head);
  card.appendChild(el('div','eyebrow',M('Played by ','Игрок ')+ARENA_OPPONENT.username));
  card.appendChild(arenaMiniSquad(ARENA_OPPONENT.heroes));
  const row=el('div','row',null);
  const fight=el('button','primary',M('Fight!','Сразиться!'));
  fight.addEventListener('click',startArenaCombat);
  row.appendChild(fight);
  const again=el('button','',M('Back','Назад'));
  again.addEventListener('click',function(){ARENA_VIEW='hub';renderArenaBody();});
  row.appendChild(again);
  card.appendChild(row);
  card.appendChild(el('div','',"<span style='color:var(--muted);font-size:11px;'>"+M('This matchup stays yours until you fight it (up to 10 minutes): no rerolling for an easier opponent.','Этот соперник закреплён за вами, пока вы с ним не сразитесь (до 10 минут): перебрать более слабого нельзя.')+"</span>"));
  body.appendChild(card);
}
function renderArenaBody(){
  if(ARENA_VIEW==='builder')renderArenaBuilder();
  else if(ARENA_VIEW==='opponent'&&ARENA_OPPONENT)renderArenaOpponentPreview();
  else renderArenaHub();
}
function fetchArenaOpponent(){
  if(loadRun()){
    const body=$('arena-body');
    body.innerHTML='';
    body.appendChild(el('div','',"<span style='color:var(--danger);'>"+M('Finish or abandon your current march first.','Сначала заверши или прерви текущий поход.')+"</span>"));
    return;
  }
  ARENA_BUSY=true;
  const body=$('arena-body');
  body.innerHTML="<div style='color:var(--muted);'>"+M('Searching the arena…','Ищем соперника…')+"</div>";
  apiGetOpponent().then(function(opp){
    ARENA_BUSY=false;
    ARENA_OPPONENT=opp;
    ARENA_VIEW='opponent';
    renderArenaBody();
  }).catch(function(e){
    ARENA_BUSY=false;
    body.innerHTML='';
    body.appendChild(el('div','',"<span style='color:var(--danger);'>"+((e&&e.body&&e.body.error)||M('No opponents available yet — try again later.','Пока нет соперников — попробуйте позже.'))+"</span>"));
    const back=el('button','',M('Back','Назад'));
    back.addEventListener('click',function(){ARENA_VIEW='hub';renderArenaBody();});
    body.appendChild(back);
  });
}
function openArenaLeaderboard(){
  const wrap=el('div','stack');
  wrap.appendChild(el('h3','',M('Arena Leaderboard','Таблица лидеров арены')));
  apiArenaLeaderboard(20).then(function(rows){
    if(!rows.length){wrap.appendChild(el('div','',"<span style='color:var(--muted);'>"+M('No champions yet.','Пока нет чемпионов.')+"</span>"));}
    rows.forEach(function(r,idx){
      const row=el('div','row',null);
      row.style.justifyContent='space-between';
      row.innerHTML='<span>'+(idx+1)+'. <strong>'+r.name+'</strong> ('+r.username+')</span><span>'+r.rating+' &middot; '+r.wins+'W/'+r.losses+'L</span>';
      wrap.appendChild(row);
    });
    const close=el('button','primary',M('Close','Закрыть'));
    close.addEventListener('click',closeModal);
    wrap.appendChild(close);
  }).catch(function(){
    wrap.appendChild(el('div','',M('Could not load the leaderboard.','Не удалось загрузить таблицу лидеров.')));
  });
  openModal(wrap);
}
function openArena(){
  if(IS_GUEST){
    const wrap=el('div','stack');
    wrap.appendChild(el('h3','',M('Arena','Арена')));
    wrap.appendChild(el('div','',"<span style='color:var(--muted);font-size:13px;'>"+M('The arena is played against other players on the server, so it needs an account. Your guest progress moves into a new account when you register.','Арена — это бои с другими игроками через сервер, для неё нужен аккаунт. При регистрации прогресс гостя перейдёт в новый аккаунт.')+"</span>"));
    const row=el('div','row');
    const reg=el('button','primary',M('Create an account','Создать аккаунт'));
    reg.addEventListener('click',function(){closeModal();guestToRegister();});
    const close=el('button','',M('Close','Закрыть'));
    close.addEventListener('click',closeModal);
    row.appendChild(reg);row.appendChild(close);
    wrap.appendChild(row);
    openModal(wrap);
    return;
  }
  if(loadRun()){
    show('screen-arena');
    $('arena-body').innerHTML="<span style='color:var(--danger);'>"+M('Finish or abandon your current march first.','Сначала заверши или прерви текущий поход.')+"</span>";
    return;
  }
  show('screen-arena');
  $('arena-body').innerHTML="<div style='color:var(--muted);'>"+M('Loading…','Загрузка…')+"</div>";
  apiGetChampion().then(function(champ){
    ARENA_CHAMPION=champ;
    ARENA_VIEW='hub';
    renderArenaBody();
  }).catch(function(){
    ARENA_CHAMPION=null;
    ARENA_VIEW='hub';
    renderArenaBody();
  });
}
/* The async duel is resolved on the server like live PvP: the battle token from
   GET /arena/opponent is redeemed over the arena WebSocket ('arena_bot_start') and
   the opponent's snapshot squad is piloted by a server bot. The live-PvP screen code
   below (match_found/turn_prompt/match_end) drives the fight; LIVE.vsBot only
   changes labels. */
function startArenaCombat(){
  if(!ARENA_CHAMPION||!ARENA_OPPONENT||ARENA_BUSY)return;
  if(loadRun()){
    $('arena-body').innerHTML="<span style='color:var(--danger);'>"+M('Finish or abandon your current march first.','Сначала заверши или прерви текущий поход.')+"</span>";
    return;
  }
  const token=ARENA_OPPONENT.battleToken;
  ARENA_OPPONENT=null;
  liveEnsure(function(){liveSend({type:'arena_bot_start',battleToken:token});});
}
/* ============================= LIVE PvP (real-time, server-authoritative) ============================= */
/* Companion to the async arena above: same saved ARENA_CHAMPION squad (the whole 1-3
   hero squad fights, same as the async arena — see live-pvp.js's loadChampion()),
   but resolved live over a WebSocket against a human opponent instead of a
   snapshot. The SERVER computes every damage/heal/turn outcome (see live-pvp.js +
   combat-engine.js on the backend) — this client only displays what it's told and
   submits {abilityId,targetUid} on its own turn. It reuses the entire existing combat
   screen/engine machinery (unitCard, renderCombat, playCombatFx, heroChooseAbility/Target)
   via the RUN.combat.isLivePvp flag (the async arena duel uses the same path) — see resolveHeroAbility()'s branch near the bottom of the
   combat engine section, and liveStateToLocal() below for how server state becomes a
   normal-looking RUN.combat.party/enemies pair. */
let LIVE=null; // {ws,status,matchId,mySide,you,opponent,inviteCode,pendingPrompt}
function liveWsUrl(){return API_BASE.replace(/^http/,'ws')+'/arena/live?token='+encodeURIComponent(AUTH_TOKEN);}
function liveEnsure(onReady){
  if(LIVE&&LIVE.ws&&(LIVE.ws.readyState===WebSocket.OPEN||LIVE.ws.readyState===WebSocket.CONNECTING)){
    if(LIVE.status==='connected'||LIVE.status==='queued'||LIVE.status==='inviting'||LIVE.status==='in_match'){onReady&&onReady();return;}
    const prev=LIVE._onReady;LIVE._onReady=function(){prev&&prev();onReady&&onReady();};
    return;
  }
  LIVE={ws:null,status:'connecting',matchId:null,mySide:null,you:null,opponent:null,inviteCode:null,pendingPrompt:null,_onReady:onReady};
  let ws;
  try{ws=new WebSocket(liveWsUrl());}catch(e){LIVE.status='error';renderLiveDuelPanel();return;}
  LIVE.ws=ws;
  ws.addEventListener('open',function(){});
  ws.addEventListener('close',function(){
    const wasInMatch=LIVE&&LIVE.status==='in_match';
    if(LIVE)LIVE.status='disconnected';
    if(wasInMatch&&RUN&&RUN.combat&&RUN.combat.isLivePvp&&!RUN.combat.over){
      logCombat(M('Connection to the arena lost.','Соединение с ареной потеряно.'));
    }
    if($('arena-body')&&!$('screen-arena').hidden)renderLiveDuelPanel();
  });
  ws.addEventListener('error',function(){});
  ws.addEventListener('message',function(ev){
    let msg;try{msg=JSON.parse(ev.data);}catch(e){return;}
    liveHandleMessage(msg);
  });
  ws.addEventListener('message',function onFirst(ev){
    let msg;try{msg=JSON.parse(ev.data);}catch(e){return;}
    if(msg.type==='auth_ok'){
      ws.removeEventListener('message',onFirst);
      LIVE.status='connected';
      const cb=LIVE._onReady;LIVE._onReady=null;
      cb&&cb();
    }
  });
}
function liveClose(){
  if(LIVE&&LIVE.ws){try{LIVE.ws.close();}catch(e){}}
  LIVE=null;
}
function liveSend(obj){
  if(!LIVE||!LIVE.ws||LIVE.ws.readyState!==WebSocket.OPEN)return;
  LIVE.ws.send(JSON.stringify(obj));
}
/* Converts the server's side-neutral {party,enemies} (labelled 'hero'/'enemy' once at
   match creation, fixed for the whole match) into the local convention the rest of the
   combat engine expects: RUN.combat.party is always *my* unit(s), RUN.combat.enemies is
   always the *opponent's*, so unitCard/getValidTargets/abilityHasTargets/heroChooseAbility all
   just work unmodified. */
function liveStateToLocal(state,mySide){
  const mine=(mySide==='hero'?state.party:state.enemies).map(function(u){return Object.assign({},u,{side:'hero'});});
  const theirs=(mySide==='hero'?state.enemies:state.party).map(function(u){return Object.assign({},u,{side:'enemy'});});
  return {party:mine,enemies:theirs};
}
function liveFindLocalUnit(uid){
  if(!RUN||!RUN.combat)return null;
  return RUN.combat.party.concat(RUN.combat.enemies).find(function(u){return u.uid===uid;});
}
function liveHandleMessage(msg){
  if(!LIVE)return;
  if(msg.type==='auth_ok'){LIVE.status='connected';return;}
  if(msg.type==='queue_joined'){LIVE.status='queued';renderLiveDuelPanel();return;}
  if(msg.type==='queue_left'){LIVE.status='connected';renderLiveDuelPanel();return;}
  if(msg.type==='invite_created'){LIVE.status='inviting';LIVE.inviteCode=msg.code;renderLiveDuelPanel();return;}
  if(msg.type==='error'){
    if(RUN&&RUN.combat&&RUN.combat.isLivePvp){logCombat(M('Server: ','Сервер: ')+escHtml(msg.message));RUN.combat.phase='hero_choose';renderActionPanel();}
    else{const body=$('arena-body');if(body){const n=el('div','',"<span style='color:var(--danger);'>"+escHtml(msg.message)+"</span>");body.insertBefore(n,body.firstChild);}}
    return;
  }
  if(msg.type==='match_found'){
    LIVE.status='in_match';LIVE.matchId=msg.matchId;LIVE.mySide=msg.side;LIVE.you=msg.you;LIVE.opponent=msg.opponent;LIVE.vsBot=!!msg.vsBot;
    liveStartCombatScreen(msg.state);
    return;
  }
  if(msg.type==='turn_prompt'){
    liveApplyTurnPrompt(msg);
    return;
  }
  if(msg.type==='combat_log'){
    (msg.logs||[]).forEach(function(l){logCombat(L(l));});
    if(RUN&&RUN.combat&&RUN.combat.isLivePvp){
      const loc=liveStateToLocal(msg.state,LIVE.mySide);
      RUN.combat.party=loc.party;RUN.combat.enemies=loc.enemies;
      renderCombat();
      playCombatFx((msg.fx||[]).map(function(f){return Object.assign({},f,{text:f.text?L(f.text):undefined});}));
    }
    return;
  }
  if(msg.type==='opponent_disconnected'){
    if(RUN&&RUN.combat&&RUN.combat.isLivePvp)logCombat(M('Your opponent disconnected — waiting for them to return…','Соперник отключился — ждём возвращения…'));
    return;
  }
  if(msg.type==='opponent_disconnected_final'){
    if(RUN&&RUN.combat&&RUN.combat.isLivePvp)logCombat(M('Your opponent never reconnected.','Соперник так и не вернулся.'));
    return;
  }
  if(msg.type==='match_end'){
    liveOnMatchEnd(msg);
    return;
  }
}
function liveStartCombatScreen(state){
  if(REPLAY){clearTimeout(REPLAY.timer);REPLAY=null;}
  if(loadRun()){
    liveSend({type:'forfeit'});
    return;
  }
  const loc=liveStateToLocal(state,LIVE.mySide);
  RUN={isArenaTemp:true,party:loc.party,gold:0,ascension:0,modifiers:{},biome:'ashfall',inventory:[],combat:null};
  RUN.combat={
    isLivePvp:true,
    enemies:loc.enemies,
    party:RUN.party,
    queue:[],qi:0,round:1,log:[],
    selectedAbility:null,targetingUnit:null,over:false,autoBattle:false,
    activeUnit:null,activeHero:null,phase:'waiting',
  };
  show('screen-combat');
  renderTopbar();
  const opp=LIVE.opponent||{};
  const oppName=escHtml(opp.name),oppUser=escHtml(opp.username);
  if(LIVE.vsBot){
    $('tb-layer').textContent=M('Arena Duel','Арена — дуэль');
    logCombat(M('The arena gates open — '+oppName+' ('+oppUser+') steps forward.','Ворота арены открываются — '+oppName+' ('+oppUser+') выходит навстречу.'));
  } else {
    $('tb-layer').textContent=M('Live Duel','Живая дуэль');
    logCombat(M(
      'The live arena connects you to '+oppUser+' — the fight begins!',
      'Арена соединяет вас с '+oppUser+' — бой начинается!'
    ));
  }
  renderCombat();
  renderActionPanel();
}
function liveApplyTurnPrompt(msg){
  if(!RUN||!RUN.combat||!RUN.combat.isLivePvp)return;
  const loc=liveStateToLocal(msg.state,LIVE.mySide);
  RUN.combat.party=loc.party;RUN.combat.enemies=loc.enemies;
  const unit=liveFindLocalUnit(msg.activeUid);
  RUN.combat.activeUnit=unit;
  RUN.combat.round=(RUN.combat.round||1);
  if(msg.yourTurn&&unit){
    RUN.combat.activeHero=unit;
    RUN.combat.phase='hero_choose';
    RUN.combat.selectedAbility=null;
    LIVE.pendingPrompt=msg;
  } else {
    RUN.combat.activeHero=null;
    RUN.combat.phase='enemy_turn';
    LIVE.pendingPrompt=null;
  }
  renderCombat();
  renderActionPanel();
}
/* Called from resolveHeroAbility() instead of the normal local-resolve path when
   RUN.combat.isLivePvp — see that function's branch. Sends the choice to the server and
   waits (phase 'hero_wait') for its authoritative combat_log + next turn_prompt instead
   of resolving anything locally. */
function liveResolveHeroAbility(ability,target){
  RUN.combat.selectedAbility=null;
  RUN.combat.phase='hero_wait';
  renderCombat();
  renderActionPanel();
  liveSend({type:'action',abilityId:ability.id,targetUid:target?target.uid:null});
}
function liveOnMatchEnd(msg){
  if(RUN&&RUN.combat)RUN.combat.over=true;
  const resultText=msg.result==='win'?M('Victory! The crowd roars.','Победа! Толпа ревёт.')
    :msg.result==='loss'?M('Defeat. You withdraw from the arena.','Поражение. Вы покидаете арену.')
    :M('A draw — the match is called.','Ничья — поединок остановлен.');
  logCombat(resultText);
  snapshotCombatLog();
  const ratingText=(typeof msg.ratingDelta==='number'&&msg.ratingDelta!==0)
    ? (msg.ratingDelta>=0?'+':'')+msg.ratingDelta+M(' rating (now ',' рейтинга (теперь ')+msg.newRating+')'
    : null;
  setTimeout(function(){
    RUN=null;
    if(LIVE){LIVE.status='connected';LIVE.matchId=null;LIVE.mySide=null;LIVE.opponent=null;LIVE.vsBot=false;}
    ARENA_VIEW='hub';
    show('screen-arena');
    apiGetChampion().then(function(champ){
      ARENA_CHAMPION=champ;renderArenaBody();renderLiveDuelPanel();
      if(ratingText){const note=el('div','eyebrow',ratingText);$('arena-body').insertBefore(note,$('arena-body').firstChild);}
      appendViewLogLink($('arena-body'));
    }).catch(function(){renderArenaBody();renderLiveDuelPanel();appendViewLogLink($('arena-body'));});
  },900);
}
function liveQueueJoin(){
  if(loadRun()){$('arena-body').innerHTML="<span style='color:var(--danger);'>"+M('Finish or abandon your current march first.','Сначала заверши или прерви текущий поход.')+"</span>";return;}
  if(!ARENA_CHAMPION){return;}
  liveEnsure(function(){liveSend({type:'queue_join'});});
}
function liveQueueLeave(){liveSend({type:'queue_leave'});if(LIVE)LIVE.status='connected';renderLiveDuelPanel();}
function liveInviteCreate(){
  if(loadRun()){$('arena-body').innerHTML="<span style='color:var(--danger);'>"+M('Finish or abandon your current march first.','Сначала заверши или прерви текущий поход.')+"</span>";return;}
  if(!ARENA_CHAMPION){return;}
  liveEnsure(function(){liveSend({type:'invite_create'});});
  renderLiveDuelPanel();
}
function liveInviteCancel(){liveSend({type:'invite_cancel'});if(LIVE){LIVE.status='connected';LIVE.inviteCode=null;}renderLiveDuelPanel();}
function liveInviteJoin(code){
  if(loadRun()){$('arena-body').innerHTML="<span style='color:var(--danger);'>"+M('Finish or abandon your current march first.','Сначала заверши или прерви текущий поход.')+"</span>";return;}
  if(!ARENA_CHAMPION||!code)return;
  liveEnsure(function(){liveSend({type:'invite_join',code:code.toUpperCase().trim()});});
}
function renderLiveDuelPanel(){
  const body=$('arena-body');
  if(!body||!ARENA_CHAMPION)return;
  const old=$('live-duel-card');if(old)old.remove();
  const card=el('div','card stack',null);card.id='live-duel-card';
  card.appendChild(el('h3','',M('⚔ Live Duel','⚔ Живая дуэль')));
  const status=(LIVE&&LIVE.status)||'disconnected';
  if(status==='queued'){
    card.appendChild(el('div','eyebrow',M('Searching for an opponent…','Ищем соперника…')));
    const cancel=el('button','',M('Cancel','Отмена'));cancel.addEventListener('click',liveQueueLeave);
    card.appendChild(cancel);
  } else if(status==='inviting'&&LIVE.inviteCode){
    card.appendChild(el('div','eyebrow',M('Share this code — it expires in 10 minutes:','Поделитесь этим кодом — он истекает через 10 минут:')));
    card.appendChild(el('div','',"<strong style='font-size:22px;letter-spacing:3px;'>"+LIVE.inviteCode+"</strong>"));
    const cancel=el('button','',M('Cancel Invite','Отменить приглашение'));cancel.addEventListener('click',liveInviteCancel);
    card.appendChild(cancel);
  } else {
    card.appendChild(el('div','eyebrow',M('Fight a real opponent live — the server referees every hit, no snapshots.','Сразитесь с живым соперником — сервер судит каждый удар, никаких снимков.')));
    const row=el('div','row',null);
    const quick=el('button','primary',M('Quick Match','Быстрый бой'));
    quick.addEventListener('click',liveQueueJoin);
    row.appendChild(quick);
    const invite=el('button','',M('Create Invite','Создать приглашение'));
    invite.addEventListener('click',liveInviteCreate);
    row.appendChild(invite);
    card.appendChild(row);
    const joinRow=el('div','row',null);
    const codeInput=document.createElement('input');
    codeInput.type='text';codeInput.maxLength=6;codeInput.placeholder=M('Enter code','Введите код');
    codeInput.style.cssText='width:120px;text-transform:uppercase;';
    joinRow.appendChild(codeInput);
    const joinBtn=el('button','',M('Join Duel','Войти в дуэль'));
    joinBtn.addEventListener('click',function(){liveInviteJoin(codeInput.value);});
    joinRow.appendChild(joinBtn);
    card.appendChild(joinRow);
  }
  body.appendChild(card);
}

function renderHeroSelect(){
  heroSelectState=[];
  renderHeroSelectBiomePicker();
  renderMarchSettings();
  renderHeroPickList();
  renderHeroPresetsBar();
  show('screen-hero-select');
  maybeShowTutorial('heroSelect',showHeroSelectTutorial);
}

function openCreateHeroModal(){
  const wrap=el('div','stack');
  wrap.appendChild(el('h3','',M('Create a Hero','Создать героя')));

  wrap.appendChild(el('div','eyebrow',M('Name','Имя')));
  const nameInput=document.createElement('input');
  nameInput.type='text';nameInput.maxLength=18;nameInput.placeholder=M('Hero name','Имя героя');
  nameInput.style.cssText='width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:inherit;box-sizing:border-box;';
  wrap.appendChild(nameInput);

  wrap.appendChild(el('div','eyebrow',M('Class','Класс')));
  const tplWrap=el('div','stack');
  let selectedTpl=HERO_ORDER[0];
  const tplCards={};
  HERO_ORDER.forEach(function(key){
    const def=HERO_DEFS[key];
    const c=el('div','hero-pick');
    const av=el('div','hero-avatar',HERO_ICON_SVG[key]||def.icon);av.style.background=def.color;
    c.appendChild(av);
    const info=el('div','hero-info');
    info.appendChild(el('div','name',L(def.cls)));
    info.appendChild(el('div','cls',def.abilities.map(function(a){return L(a.name);}).join(' · ')));
    c.appendChild(info);
    c.addEventListener('click',function(){
      selectedTpl=key;
      Object.keys(tplCards).forEach(function(k){tplCards[k].classList.toggle('selected',k===key);});
      const labelStatKey=HERO_DMG_TYPE[selectedTpl]||'str';
      powLabelEls.forEach(function(lbl){lbl.innerHTML="<strong>"+statAbbr(labelStatKey)+"</strong> (+1/"+M('pt','очко')+")";});
    });
    tplCards[key]=c;
    tplWrap.appendChild(c);
  });
  tplCards[selectedTpl].classList.add('selected');
  wrap.appendChild(tplWrap);

  wrap.appendChild(el('div','eyebrow',M('Color','Цвет')));
  wrap.appendChild(el('div','',"<span style='color:var(--muted);font-size:11px;'>"+M('Locked colors are visual rewards — earn the matching achievement to unlock them.','Заблокированные цвета — визуальные награды, откройте соответствующий трофей.')+"</span>"));
  const colorWrap=el('div','row');
  colorWrap.style.cssText='gap:8px;flex-wrap:wrap;margin-top:6px;';
  let selectedColor=null;
  const swatchEls={};
  CUSTOM_COLOR_SWATCHES.forEach(function(sw){
    const unlocked=colorSwatchUnlocked(sw);
    const el2=el('div','',unlocked?null:'&#128274;');
    el2.style.cssText='width:26px;height:26px;border-radius:50%;cursor:'+(unlocked?'pointer':'not-allowed')+';background:'+sw.c+';border:2px solid transparent;display:flex;align-items:center;justify-content:center;font-size:11px;'+(unlocked?'':'opacity:0.35;');
    if(!unlocked){
      const ach=ACHIEVEMENTS.find(function(a){return a.id===sw.unlock;});
      el2.title=(sw.name?L(sw.name)+' — ':'')+M('unlocks with achievement: ','открывается трофеем: ')+(ach?L(ach.name):sw.unlock);
    } else if(sw.name){
      el2.title=L(sw.name);
    }
    el2.addEventListener('click',function(){
      if(!unlocked)return;
      selectedColor=sw.c;
      Object.keys(swatchEls).forEach(function(k){swatchEls[k].style.borderColor=(k===sw.c)?'var(--text)':'transparent';});
    });
    swatchEls[sw.c]=el2;
    colorWrap.appendChild(el2);
  });
  wrap.appendChild(colorWrap);

  wrap.appendChild(el('div','eyebrow',M('Emblem','Эмблема')));
  wrap.appendChild(el('div','',"<span style='color:var(--muted);font-size:11px;'>"+M('Custom heroes show their emblem instead of the class icon. Locked ones are visual rewards too.','Кастомные герои показывают эмблему вместо иконки класса. Заблокированные — тоже визуальная награда.')+"</span>"));
  const iconWrap=el('div','row');
  iconWrap.style.cssText='gap:8px;flex-wrap:wrap;margin-top:6px;';
  let selectedIcon=CUSTOM_ICON_SWATCHES[0].icon;
  const iconEls={};
  CUSTOM_ICON_SWATCHES.forEach(function(sw){
    const unlocked=iconSwatchUnlocked(sw);
    const el3=el('div','',unlocked?sw.icon:'&#128274;');
    el3.style.cssText='width:26px;height:26px;border-radius:50%;cursor:'+(unlocked?'pointer':'not-allowed')+';background:var(--surface2);border:2px solid '+(sw.icon===selectedIcon?'var(--text)':'transparent')+';display:flex;align-items:center;justify-content:center;font-size:13px;'+(unlocked?'':'opacity:0.35;');
    if(!unlocked){
      const ach=ACHIEVEMENTS.find(function(a){return a.id===sw.unlock;});
      el3.title=(sw.name?L(sw.name)+' — ':'')+M('unlocks with achievement: ','открывается трофеем: ')+(ach?L(ach.name):sw.unlock);
    } else if(sw.name){
      el3.title=L(sw.name);
    }
    el3.addEventListener('click',function(){
      if(!unlocked)return;
      selectedIcon=sw.icon;
      Object.keys(iconEls).forEach(function(k){iconEls[k].style.borderColor=(k===sw.icon)?'var(--text)':'transparent';});
    });
    iconEls[sw.icon]=el3;
    iconWrap.appendChild(el3);
  });
  wrap.appendChild(iconWrap);

  wrap.appendChild(el('div','eyebrow',M('Distribute '+CUSTOM_HERO_POINTS+' stat points','Распределите '+CUSTOM_HERO_POINTS+' очков характеристик')));
  const alloc={pow:0,def:0,spd:0,hp:0};
  const remainEl=el('div','','');
  function pointsUsed(){return alloc.pow+alloc.def+alloc.spd+alloc.hp;}
  function renderRemain(){remainEl.innerHTML=M('Points left: ','Осталось очков: ')+'<strong>'+(CUSTOM_HERO_POINTS-pointsUsed())+'</strong>';}
  const statsWrap=el('div','stack');
  const powLabelEls=[];
  ['pow','def','spd','hp'].forEach(function(stat){
    const block=el('div','',null);
    const row=el('div','row');
    row.style.cssText='align-items:center;gap:8px;';
    const labelStatKey=stat==='pow'?(HERO_DMG_TYPE[selectedTpl]||'str'):stat;
    const label=el('div','',"<strong>"+statAbbr(labelStatKey)+"</strong>"+(stat==='hp'?(' (+'+CUSTOM_HP_PER_POINT+'/'+M('pt','очко')+')'):' (+1/'+M('pt','очко')+')'));
    label.style.flex='1';
    if(stat==='pow')powLabelEls.push(label);
    const minus=el('button','','−');
    const val=el('span','',String(alloc[stat]));val.style.cssText='min-width:22px;text-align:center;display:inline-block;font-family:JetBrains Mono,monospace;';
    const plus=el('button','','+');
    minus.addEventListener('click',function(){if(alloc[stat]>0){alloc[stat]--;val.textContent=alloc[stat];renderRemain();}});
    plus.addEventListener('click',function(){if(pointsUsed()<CUSTOM_HERO_POINTS){alloc[stat]++;val.textContent=alloc[stat];renderRemain();}});
    row.appendChild(label);row.appendChild(minus);row.appendChild(val);row.appendChild(plus);
    block.appendChild(row);
    block.appendChild(el('div','',"<span style='color:var(--muted);font-size:11px;'>"+(stat==='pow'?M('Becomes this hero’s Strength or Intellect, depending on their class.','Становится Силой или Интеллектом этого героя — в зависимости от класса.'):statInfo(stat))+"</span>"));
    statsWrap.appendChild(block);
  });
  wrap.appendChild(statsWrap);
  renderRemain();
  wrap.appendChild(remainEl);

  wrap.appendChild(el('div','eyebrow',M('Passive','Пассивный навык')));
  const passiveWrap=el('div','stack');
  let selectedPassive=CUSTOM_PASSIVES[0].id;
  const passiveCards={};
  CUSTOM_PASSIVES.forEach(function(p){
    const c=el('div','hero-pick');
    const info=el('div','hero-info');
    info.appendChild(el('div','name',L(p.name)));
    info.appendChild(el('div','cls',L(p.desc)));
    c.appendChild(info);
    c.addEventListener('click',function(){
      selectedPassive=p.id;
      Object.keys(passiveCards).forEach(function(k){passiveCards[k].classList.toggle('selected',k===p.id);});
    });
    passiveCards[p.id]=c;
    passiveWrap.appendChild(c);
  });
  passiveCards[selectedPassive].classList.add('selected');
  wrap.appendChild(passiveWrap);

  const err=el('div','','');err.style.cssText='color:var(--danger);font-size:12px;min-height:16px;';
  wrap.appendChild(err);

  const save=el('button','primary',M('Create','Создать'));
  save.addEventListener('click',function(){
    const name=nameInput.value.trim();
    if(!name){err.textContent=M('Enter a name.','Введите имя.');return;}
    if((META.customHeroes||[]).length>=CUSTOM_HERO_MAX){err.textContent=M('Hero roster is full.','Список героев переполнен.');return;}
    const id='custom'+Date.now()+Math.floor(Math.random()*1000);
    META.customHeroes=META.customHeroes||[];
    META.customHeroes.push({id:id,name:name.slice(0,18),tplKey:selectedTpl,color:selectedColor,icon:selectedIcon,pow:alloc.pow,def:alloc.def,spd:alloc.spd,hp:alloc.hp,passive:selectedPassive});
    saveMeta();
    closeModal();
    renderHeroSelect();
  });
  wrap.appendChild(save);
  const cancel=el('button','',M('Cancel','Отмена'));
  cancel.addEventListener('click',closeModal);
  wrap.appendChild(cancel);
  openModal(wrap);
}
