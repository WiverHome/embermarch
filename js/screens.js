// Embermarch client: Screens: title, legacy, hero select/creation; tutorial and onboarding.
// Classic script: shares the global scope with the other js/*.js files; load order is set in index.html.
"use strict";

/* ============================= SCREENS: TITLE / LEGACY / HERO SELECT ============================= */

function renderTitle(){
  if(_progressCorrectedPending)setTimeout(showProgressCorrectedNotice,0);
  $('btn-continue').hidden = !loadRun();
  const el2=$('title-stats');
  el2.innerHTML = M(
    'Wins <b>'+META.wins+'</b> &middot; Embers <b>'+META.embers+'</b> &middot; Best reach <b>'+META.bestLayer+' / '+TOTAL_STEPS+'</b>',
    'Побед <b>'+META.wins+'</b> &middot; Угольков <b>'+META.embers+'</b> &middot; Рекорд <b>'+META.bestLayer+' / '+TOTAL_STEPS+'</b>'
  );
  const today=todayDateStr();
  const dailyDone=META.dailyLastDate===today;
  const dailyBtn=$('btn-daily');
  /* The challenge rules live on the buttons themselves (a short line plus a
     tooltip) instead of a separate block of grey text under the menu. */
  if(dailyBtn){
    dailyBtn.innerHTML=(dailyDone?M('Daily Challenge ✓','Испытание дня ✓'):M('Daily Challenge','Испытание дня'))
      +'<span class="btn-sub">'+M('shared map · +10','общая карта · +10')+'</span>';
    dailyBtn.title=M('A fixed map, the same for everyone today. Ascension 0, +10 embers on a win.','Одинаковая карта для всех сегодня. Сложность 0, +10 угольков за победу.');
  }
  const dailyInfo=$('title-daily-info');
  if(dailyInfo)dailyInfo.hidden=true;
  const weeklyBtn=$('btn-weekly');
  if(weeklyBtn){
    weeklyBtn.innerHTML=(META.weeklyLastWeek===isoWeekStr()?M('Weekly Trial ✓','Испытание недели ✓'):M('Weekly Trial','Испытание недели'))
      +'<span class="btn-sub">'+M('Asc. '+WEEKLY_ASCENSION+' + 2 mods · +'+WEEKLY_WIN_EMBERS,'сложн. '+WEEKLY_ASCENSION+' + 2 модиф. · +'+WEEKLY_WIN_EMBERS)+'</span>';
    weeklyBtn.title=M('A harder seeded march: Ascension '+WEEKLY_ASCENSION+' + 2 modifiers, +'+WEEKLY_WIN_EMBERS+' embers on a win.','Сложнее обычного: сложность '+WEEKLY_ASCENSION+' + 2 модификатора, +'+WEEKLY_WIN_EMBERS+' угольков за победу.');
  }
  const reminder=$('title-save-reminder');
  if(reminder)reminder.hidden=true; // progress now lives on the server, not the browser
  const profileBtn=$('btn-open-profile');
  if(profileBtn){
    profileBtn.hidden=!CURRENT_USER;
    if(CURRENT_USER)profileBtn.textContent='👤 '+CURRENT_USER;
  }
  const guestBtn=$('btn-guest-register');
  if(guestBtn)guestBtn.hidden=!IS_GUEST;
  renderLangSwitch();
  show('screen-title');
}

function renderProfileScreen(){
  $('profile-username-h3').textContent=CURRENT_USER?M('Change Username (current: ','Смена имени пользователя (сейчас: ')+CURRENT_USER+')':L(STATIC_I18N['profile-username-h3']);
  $('profile-new-username').value='';
  $('profile-username-password').value='';
  $('profile-username-error').textContent='';
  $('profile-current-password').value='';
  $('profile-new-password').value='';
  $('profile-confirm-password').value='';
  $('profile-password-error').textContent='';
  show('screen-profile');
}
function profileSaveUsername(){
  const newUsername=($('profile-new-username').value||'').trim();
  const password=$('profile-username-password').value||'';
  const errEl=$('profile-username-error');
  errEl.textContent='';
  if(!newUsername||!password){errEl.textContent=M('Fill in both fields.','Заполните оба поля.');return;}
  const btn=$('btn-profile-save-username');
  btn.disabled=true;
  apiChangeUsername(newUsername,password).then(function(res){
    AUTH_TOKEN=res.token;
    CURRENT_USER=res.username;
    persistAuthToken(AUTH_TOKEN);
    btn.disabled=false;
    $('profile-new-username').value='';
    $('profile-username-password').value='';
    errEl.style.color='var(--good)';
    errEl.textContent=M('Username updated.','Имя пользователя обновлено.');
    $('profile-username-h3').textContent=M('Change Username (current: ','Смена имени пользователя (сейчас: ')+CURRENT_USER+')';
  }).catch(function(e){
    btn.disabled=false;
    errEl.style.color='var(--danger)';
    errEl.textContent=(e&&e.body&&e.body.error)||M('Could not update username.','Не удалось обновить имя пользователя.');
  });
}
function profileSavePassword(){
  const currentPassword=$('profile-current-password').value||'';
  const newPassword=$('profile-new-password').value||'';
  const confirmPassword=$('profile-confirm-password').value||'';
  const errEl=$('profile-password-error');
  errEl.style.color='var(--danger)';
  errEl.textContent='';
  if(!currentPassword||!newPassword||!confirmPassword){errEl.textContent=M('Fill in all three fields.','Заполните все три поля.');return;}
  if(newPassword!==confirmPassword){errEl.textContent=M('New passwords do not match.','Новые пароли не совпадают.');return;}
  if(newPassword.length<8){errEl.textContent=M('New password must be at least 8 characters.','Новый пароль должен быть не короче 8 символов.');return;}
  const btn=$('btn-profile-save-password');
  btn.disabled=true;
  apiChangePassword(currentPassword,newPassword).then(function(res){
    /* The server ended every other session; keep this one with the fresh token. */
    if(res&&res.token){AUTH_TOKEN=res.token;persistAuthToken(AUTH_TOKEN);}
    btn.disabled=false;
    $('profile-current-password').value='';
    $('profile-new-password').value='';
    $('profile-confirm-password').value='';
    errEl.style.color='var(--good)';
    errEl.textContent=M('Password updated.','Пароль обновлён.');
  }).catch(function(e){
    btn.disabled=false;
    errEl.style.color='var(--danger)';
    errEl.textContent=(e&&e.body&&e.body.error)||M('Could not update password.','Не удалось обновить пароль.');
  });
}

/* Achievements list can get long once most are unlocked; collapsed by default
   to just the unlocked ones + a summary count, with a button to reveal the
   locked ones too. Not persisted — resets to collapsed each visit, which is
   fine since it's a display preference, not progress. */
let achievementsExpanded=false;
let legacyActiveTab='upgrades';
function applyLegacyTabUI(){
  document.querySelectorAll('#legacy-tabs .legacy-tab').forEach(function(btn){
    btn.classList.toggle('active', btn.dataset.tab===legacyActiveTab);
  });
  document.querySelectorAll('.legacy-tab-panel').forEach(function(panel){
    panel.hidden = panel.dataset.tab!==legacyActiveTab;
  });
}
/* Feedback for a Legacy purchase: the bought row glows, the embers counter
   pulses and a "−N" floats off it. */
function flashPurchase(key,cost){
  const row=document.querySelector('#leg-upgrades .upgrade-row[data-key="'+key+'"]');
  if(row){row.classList.remove('just-bought');void row.offsetWidth;row.classList.add('just-bought');}
  const counter=$('leg-embers');
  if(counter){
    counter.classList.remove('spent');void counter.offsetWidth;counter.classList.add('spent');
    const fly=el('span','embers-fly','−'+cost);
    counter.parentNode.style.position='relative';
    counter.parentNode.appendChild(fly);
    setTimeout(function(){fly.remove();},900);
  }
}
function renderLegacy(){
  $('leg-embers').textContent=META.embers;
  const acctEl=$('legacy-account-user');
  if(acctEl)acctEl.textContent=CURRENT_USER?M('Logged in as ','Вы вошли как ')+CURRENT_USER:(IS_GUEST?M('Guest mode: progress is kept only in this browser.','Гостевой режим: прогресс хранится только в этом браузере.'):'');
  const logoutBtn=$('btn-logout');
  if(logoutBtn)logoutBtn.textContent=IS_GUEST?M('Leave guest mode','Выйти из гостевого режима'):L(STATIC_I18N['btn-logout']);
  const up=$('leg-upgrades');up.innerHTML='';
  function reqMet(def){
    if(def.requires)return (META.upgrades[def.requires.key]||0)>=def.requires.rank;
    if(def.requires2)return def.requires2.every(function(r){return (META.upgrades[r.key]||0)>=r.rank;});
    return true;
  }
  function reqLabel(def){
    const reqs=def.requires?[def.requires]:(def.requires2||[]);
    return reqs.map(function(r){const rd=UPGRADE_DEFS.find(function(d){return d.key===r.key;});return L(rd.name)+' '+M('rank ','ур. ')+r.rank;}).join(' + ');
  }
  UPGRADE_DEFS.forEach(function(def){
    const rank=META.upgrades[def.key]||0;
    const maxed=rank>=def.max;
    const cost=def.cost(rank);
    const locked=!reqMet(def);
    const row=el('div','upgrade-row'+(locked?' locked':''));
    row.dataset.key=def.key;
    const dots=el('div','stack-dots');
    for(let i=0;i<def.max;i++)dots.appendChild(el('span','stack-dot'+(i<rank?' filled':'')));
    const branchTag=(def.requires||def.requires2)?("<span style='color:var(--accent,var(--good));font-size:11px;'>&#9492;&#9472; "+M('Branch','Ветка')+"</span> "):'';
    const reqText=locked?("<br><span style='color:var(--danger);font-size:11px;'>"+M('Requires: ','Требуется: ')+reqLabel(def)+"</span>"):'';
    const left=el('div','',branchTag+"<strong>"+L(def.name)+"</strong><br><span style='color:var(--muted);font-size:12px;'>"+L(def.desc)+"</span>"+reqText);
    left.style.flex='1';
    row.appendChild(left);
    row.appendChild(dots);
    const btn=el('button',maxed||locked?'':'primary',locked?M('Locked','Заблокировано'):(maxed?M('Maxed','Максимум'):(M('Buy','Купить')+' · '+cost)));
    btn.disabled = maxed || locked || META.embers<cost;
    btn.addEventListener('click',function(){
      if(META.embers<cost||maxed||locked)return;
      META.embers-=cost;META.upgrades[def.key]=(META.upgrades[def.key]||0)+1;SFX.coin();saveMeta();renderLegacy();
      flashPurchase(def.key,cost);
    });
    row.appendChild(btn);
    up.appendChild(row);
  });
  const rec=$('leg-recruits');rec.innerHTML='';
  ['ashra','doran','morwen','torvin'].forEach(function(key){
    const def=HERO_DEFS[key];
    const owned=META.heroesUnlocked[key];
    const isNew=owned&&!(META.seenHeroes||[]).includes(key);
    const achId=HERO_UNLOCK_ACHIEVEMENT[key];
    const ach=ACHIEVEMENTS.find(function(a){return a.id===achId;});
    const row=el('div','upgrade-row'+(owned?'':' locked'));
    const reqText=owned?'':("<br><span style='color:var(--danger);font-size:11px;'>"+M('Requires achievement: ','Требуется трофей: ')+(ach?L(ach.name):achId)+"</span>");
    const left=el('div','',(isNew?"<span class='gold-badge' style='margin-right:6px;'>"+M('NEW','НОВОЕ')+"</span>":'')+"<strong>"+L(def.name)+"</strong> <span style='color:var(--muted);font-size:12px;'>"+L(def.cls)+"</span>"+reqText);
    left.style.flex='1';
    row.appendChild(left);
    const btn=el('button','',owned?M('Recruited','Нанят'):M('Locked','Заблокировано'));
    btn.disabled=true;
    row.appendChild(btn);
    rec.appendChild(row);
  });
  const statsBox=$('leg-stats');
  if(statsBox){
    const st=computeRunStats();
    if(!st.total){
      statsBox.innerHTML="<span style='color:var(--muted);font-size:12px;'>"+M('No completed marches yet — stats appear after your first one.','Пока нет завершённых походов — статистика появится после первого.')+"</span>";
    } else {
      const favDef=st.favKey?getHeroDef(st.favKey):null;
      const favName=favDef?L(favDef.name):st.favKey;
      const lines=[
        M('Marches completed: <strong>'+st.total+'</strong> ('+st.wins+' won, '+st.winRate+'%)','Завершено походов: <strong>'+st.total+'</strong> (побед: '+st.wins+', '+st.winRate+'%)'),
        st.avgLossLayer?M('Average layer on defeat: <strong>'+st.avgLossLayer+' / '+TOTAL_STEPS+'</strong>','Средний слой при поражении: <strong>'+st.avgLossLayer+' / '+TOTAL_STEPS+'</strong>'):null,
        favDef?M('Most-used hero: <strong>'+favName+'</strong> ('+st.favCount+' of '+st.heroRunsCounted+' tracked marches)','Чаще всего в отряде: <strong>'+favName+'</strong> ('+st.favCount+' из '+st.heroRunsCounted+' походов с данными)'):null,
        st.customRuns?M('Marches with a custom hero: <strong>'+st.customRuns+'</strong>','Походов с кастомным героем: <strong>'+st.customRuns+'</strong>'):null,
      ].filter(Boolean);
      statsBox.innerHTML=lines.map(function(l){return "<div style='font-size:12px;margin-bottom:4px;'>"+l+"</div>";}).join('');
    }
  }
  const histBox=$('leg-history');
  if(histBox){
    histBox.innerHTML='';
    const hist=(META.history||[]).slice().reverse();
    if(!hist.length){
      histBox.appendChild(el('div','',"<span style='color:var(--muted);font-size:12px;'>"+M('No completed marches yet.','Пока нет завершённых походов.')+"</span>"));
    } else {
      hist.forEach(function(h){
        const row=el('div','upgrade-row');
        const outcome=h.win?M('Victory','Победа'):M('Defeat','Поражение');
        const color=h.win?'var(--good)':'var(--danger)';
        row.innerHTML="<div style='flex:1;'><strong style='color:"+color+"'>"+outcome+"</strong> · "+M('layer','уровень')+' '+h.layer+'/'+TOTAL_STEPS+(h.ascension?(' · '+M('Asc ','Слож. ')+h.ascension):'')+"<br><span style='color:var(--muted);font-size:11px;'>+"+h.embers+M(' embers',' угольков')+"</span></div>";
        histBox.appendChild(row);
      });
    }
  }
  const endlessBoard=$('leg-endless-board');
  if(endlessBoard){
    endlessBoard.innerHTML='';
    const runs=META.endlessRuns||[];
    if(!runs.length){
      endlessBoard.appendChild(el('div','',"<span style='color:var(--muted);font-size:12px;'>"+M('No Endless March runs yet — press on after beating a boss to start one.','Пока нет забегов Бесконечного похода — нажмите «Идти дальше» после победы над боссом.')+"</span>"));
    } else {
      runs.forEach(function(r,i){
        const row=el('div','upgrade-row');
        const date=new Date(r.ts).toLocaleDateString();
        row.innerHTML="<div style='flex:1;'><strong>#"+(i+1)+"</strong> &middot; "+M('Depth ','Глубина ')+"<strong>"+r.depth+"</strong><br><span style='color:var(--muted);font-size:11px;'>"+date+"</span></div>";
        endlessBoard.appendChild(row);
      });
    }
  }
  const achBox=$('leg-achievements');
  if(achBox){
    achBox.innerHTML='';
    const unlockedCount=ACHIEVEMENTS.filter(function(a){return META.achievements&&META.achievements[a.id];}).length;
    const summary=$('leg-achievements-summary');
    if(summary)summary.textContent=unlockedCount+' / '+ACHIEVEMENTS.length;
    const visible=achievementsExpanded?ACHIEVEMENTS:ACHIEVEMENTS.filter(function(a){return !!(META.achievements&&META.achievements[a.id]);});
    if(!visible.length){
      achBox.appendChild(el('div','',"<span style='color:var(--muted);font-size:12px;'>"+M('No achievements unlocked yet.','Пока нет открытых достижений.')+"</span>"));
    }
    visible.forEach(function(a){
      const unlocked=!!(META.achievements&&META.achievements[a.id]);
      const isNew=unlocked&&!(META.seenAchievements||[]).includes(a.id);
      const row=el('div','ach-row'+(unlocked?'':' locked'));
      row.appendChild(el('div','ach-icon',unlocked?'&#9733;':'&#128274;'));
      const info=el('div','',(isNew?"<span class='gold-badge' style='margin-right:6px;'>"+M('NEW','НОВОЕ')+"</span>":'')+"<strong>"+L(a.name)+"</strong><br><span style='color:var(--muted);font-size:12px;'>"+L(a.desc)+" &middot; +"+a.reward+M(' embers',' угольков')+"</span>");
      info.style.flex='1';
      row.appendChild(info);
      achBox.appendChild(row);
    });
    const toggleBtn=$('btn-toggle-achievements');
    if(toggleBtn){
      const lockedCount=ACHIEVEMENTS.length-unlockedCount;
      if(lockedCount<=0){
        toggleBtn.hidden=true;
      }else{
        toggleBtn.hidden=false;
        toggleBtn.textContent=achievementsExpanded?M('Show unlocked only','Показать только открытые'):M('Show '+lockedCount+' locked','Показать заблокированные ('+lockedCount+')');
        toggleBtn.onclick=function(){achievementsExpanded=!achievementsExpanded;renderLegacy();};
      }
    }
    const newHeroes=Object.keys(META.heroesUnlocked).filter(function(k){return META.heroesUnlocked[k];});
    const newAch=ACHIEVEMENTS.filter(function(a){return META.achievements&&META.achievements[a.id];}).map(function(a){return a.id;});
    let sawSomethingNew=newHeroes.some(function(k){return !(META.seenHeroes||[]).includes(k);})||newAch.some(function(k){return !(META.seenAchievements||[]).includes(k);});
    if(sawSomethingNew){
      META.seenHeroes=newHeroes;META.seenAchievements=newAch;saveMeta();
    }
  }
  const bestiarySummary=$('leg-bestiary-summary');
  if(bestiarySummary){
    const total=Object.keys(ENEMY_DEFS).length+Object.keys(BOSS_DEFS).length;
    const known=Object.keys(META.bestiary||{}).length;
    bestiarySummary.textContent=known+' / '+total;
  }
  const bestiaryBtn=$('btn-open-bestiary');
  if(bestiaryBtn)bestiaryBtn.onclick=openBestiaryModal;
  const animBtn=$('btn-toggle-animations');
  if(animBtn){
    const on=META.settings.animations!==false;
    animBtn.classList.toggle('on',on);
  }
  const cbBtn=$('btn-toggle-colorblind');
  if(cbBtn)cbBtn.classList.toggle('on',!!META.settings.colorblind);
  const soundBtn=$('btn-toggle-sound');
  if(soundBtn){
    const on=META.settings.sound!==false;
    soundBtn.classList.toggle('on',on);
  }
  const musicBtn=$('btn-toggle-music');
  if(musicBtn)musicBtn.classList.toggle('on',META.settings.music!==false);
  const volBtns=$('music-volume-btns');
  if(volBtns){
    volBtns.innerHTML='';
    MUSIC_VOLUMES.forEach(function(opt){
      const b=el('button','seg-btn'+(musicVolume()===opt.k?' selected':''),L(opt));
      b.type='button';
      b.addEventListener('click',function(){META.settings.musicVolume=opt.k;saveMeta();musicApplySettings();renderLegacy();});
      volBtns.appendChild(b);
    });
  }
  const sizeBtns=$('text-size-btns');
  if(sizeBtns){
    sizeBtns.innerHTML='';
    [{k:0.9,l:'S'},{k:1,l:'M'},{k:1.15,l:'L'}].forEach(function(opt){
      const b=el('button','seg-btn'+(META.settings.textScale===opt.k?' selected':''),opt.l);
      b.type='button';
      b.addEventListener('click',function(){META.settings.textScale=opt.k;saveMeta();applySettings();renderLegacy();});
      sizeBtns.appendChild(b);
    });
  }
  renderLangSwitch();
  applyLegacyTabUI();
  show('screen-legacy');
}

/* ============================= TUTORIAL / ONBOARDING =============================
   A handful of short, one-time modal tips shown the first time a new account hits
   a given situation (first login, first hero pick, first map, first fight). Each
   fires at most once per account (flags live in META.tutorial, synced to the
   server like the rest of progress), and the whole sequence can be replayed any
   time from the title screen's "Tutorial" button. Text-only modal cards were
   chosen over coordinate-based UI highlighting so the exact same code works
   unchanged on both the desktop and mobile layouts (the modal itself is already
   fully responsive — see .modal/.modal-card in the stylesheet). */
function maybeShowTutorial(key,builder){
  if(!META.tutorial)META.tutorial={welcome:false,heroSelect:false,map:false,combat:false};
  if(META.tutorial[key])return;
  META.tutorial[key]=true;
  saveMeta();
  builder();
}
function openTutorialSteps(steps,doneLabel){
  let idx=0;
  function renderStep(){
    const s=steps[idx];
    const wrap=el('div','stack');
    wrap.appendChild(el('div','eyebrow',M('Tutorial','Обучение')+' · '+(idx+1)+'/'+steps.length));
    wrap.appendChild(el('h3','',s.title));
    wrap.appendChild(el('div','',"<span style='color:var(--muted);font-size:13px;line-height:1.5;'>"+s.body+"</span>"));
    const row=el('div','row');
    if(idx>0){
      const back=el('button','',M('Back','Назад'));
      back.type='button';
      back.addEventListener('click',function(){idx--;renderStep();});
      row.appendChild(back);
    }
    const next=el('button','primary',idx<steps.length-1?M('Next','Далее'):(doneLabel||M('Got it','Понятно')));
    next.type='button';
    next.addEventListener('click',function(){
      if(idx<steps.length-1){idx++;renderStep();}else{closeModal();}
    });
    row.appendChild(next);
    wrap.appendChild(row);
    openModal(wrap);
  }
  renderStep();
}
function showWelcomeTutorial(){
  openTutorialSteps([
    {title:M('Welcome, Commander','Добро пожаловать, командир'),body:M(
      "Embermarch is a roguelite: you lead a small mercenary company on foot through a burnt land, fighting, looting and choosing a path node by node. Every march is freshly generated, and death isn't always the end — some of what you earn carries forward. This short tour covers the basics; skip it anytime with Back, and revisit it later from the \"Tutorial\" button on this screen.",
      'Embermarch — рогалик: вы ведёте небольшой отряд наёмников пешком через выжженные земли, сражаясь, собирая добычу и выбирая путь от узла к узлу. Каждый поход генерируется заново, и гибель отряда — не всегда конец: часть добытого сохраняется между походами. Этот короткий тур расскажет основы; его можно пропустить кнопкой «Назад», а позже открыть снова кнопкой «Обучение» на этом экране.'
    )},
    {title:M('Build a company','Соберите отряд'),body:M(
      'Before a march you pick exactly three heroes and arrange them into a front and back row. Each hero has a class, a damage stat (Strength or Intellect) and a handful of abilities with cooldowns. Melee abilities usually only reach the front row, so put fragile heroes in back.',
      'Перед походом вы выбираете ровно трёх героев и расставляете их по переднему и заднему ряду. У каждого героя есть класс, характеристика урона (Сила или Интеллект) и несколько способностей с откатом. Ближние способности обычно достают только до переднего ряда — хрупких героев лучше ставить в тыл.'
    )},
    {title:M('The march','Поход'),body:M(
      'The map screen shows the road ahead as a branching set of nodes: battles, events, shops and rest sites, leading up to a chapter boss. Tap or click a node to see what it offers before committing. "Formation & Gear" on the map lets you re-equip and reorder your rows at any time between fights.',
      'Экран карты показывает путь вперёд как разветвлённую цепочку узлов: бои, события, лавки и привалы, ведущие к боссу главы. Нажмите на узел, чтобы увидеть, что он предлагает, прежде чем выбрать его. «Строй и снаряжение» на карте позволяет в любой момент между боями переэкипироваться и поменять ряды.'
    )},
    {title:M('Permanent progress','Постоянный прогресс'),body:M(
      "Embers earned on a march stay with your account even if the company falls — spend them in the Legacy Ledger on permanent upgrades and new recruits for future marches. For the full rules on rows, statuses, cooldowns and damage types, open \"How to Play\" from this screen any time.",
      'Угольки, заработанные в походе, остаются у аккаунта даже если отряд погибнет — тратьте их в Летописи на постоянные улучшения и новых наёмников для будущих походов. Полные правила по рядам, статусам, откатам и типам урона всегда доступны в «Правилах игры» на этом экране.'
    )},
  ],M("Let's go",'Вперёд'));
}
function showHeroSelectTutorial(){
  openTutorialSteps([
    {title:M('Choosing your company','Выбор отряда'),body:M(
      'Pick exactly three heroes, then set each as front or back row — click a selected hero\'s row badge to swap it. Unlock more heroes by playing, or build a custom one of your own (one custom hero per account). You can save a line-up as a preset to reuse it in one click next time.',
      'Выберите ровно трёх героев, затем задайте каждому передний или задний ряд — переключается кликом по значку ряда у выбранного героя. Новые герои открываются по мере игры, либо можно создать собственного героя (один на аккаунт). Состав можно сохранить как пресет и применить одним кликом в следующий раз.'
    )},
  ]);
}
function showMapTutorial(){
  openTutorialSteps([
    {title:M('Reading the map','Чтение карты'),body:M(
      'Each icon is a node: crossed swords for a battle, a skull for an elite, a question mark for an event, a bag for a shop, a campfire to rest, and a crown for the chapter boss. Only the nodes connected to where you are now are open — tap one to preview it, then confirm to enter. "Formation & Gear" above the map is always free to use between nodes.',
      'Каждый значок — это узел: скрещённые мечи — бой, череп — элитный враг, знак вопроса — событие, мешок — лавка, костёр — привал, корона — босс главы. Доступны только узлы, соединённые с текущим; нажмите на узел для предпросмотра, затем подтвердите вход. «Строй и снаряжение» над картой можно использовать бесплатно между узлами в любой момент.'
    )},
  ]);
}
function showCombatTutorial(){
  openTutorialSteps([
    {title:M('Your first battle','Первый бой'),body:M(
      'Turn order is set by Speed — the queue at the top shows who acts next. On your turn, pick an ability then a target; stronger abilities go on cooldown (shown on the button) after use, so lean on basic attacks while they recharge. Watch for status icons (burning, stunned, exposed and more) — hover or tap one for details, and see "How to Play" for the full list and hero combos.',
      'Порядок ходов определяется Скоростью — очередь сверху показывает, кто ходит следующим. В свой ход выберите способность, затем цель; сильные способности после использования уходят в откат (показан на кнопке), так что пока они перезаряжаются — используйте базовые удары. Следите за значками статусов (горение, оглушение, уязвимость и другие) — наведите или нажмите на значок для подробностей, а полный список и комбо героев — в «Правилах игры».'
    )},
  ]);
}

function showRulesModal(){
  const wrap=el('div','stack');
  wrap.appendChild(el('h3','',M('How to Play','Правила игры')));
  const sections=[
    {h:M('Rows','Ряды'),t:M(
      'Each side has a front and back row. Melee abilities can only reach the front row (or the back row once the front is empty). Ranged and "any" abilities can strike anyone. Put your fragile heroes in the back.',
      'У каждой стороны есть передний и задний ряд. Ближние способности достают только до переднего ряда (или до заднего, если передний пуст). Дальние способности и способности «в любого» достают до всех. Держите хрупких героев в тылу.'
    )},
    {h:M('Statuses','Статусы'),t:M(
      'Burning deals damage each turn. Stunned skips the whole turn. Buffs/debuffs change a stat for a few turns. Dodge avoids the next hit. Hover any icon in battle for details.',
      'Горение наносит урон каждый ход. Оглушение полностью пропускает ход. Баффы/дебаффы меняют характеристику на несколько ходов. Уклонение спасает от следующего удара. Наведите на значок в бою, чтобы увидеть подробности.'
    )},
    {h:M('Cooldowns','Откаты'),t:M(
      'Using a strong ability locks it for a number of turns (shown on the button). Basic attacks usually have no cooldown — lean on them while your big abilities recharge.',
      'Сильная способность после использования уходит в откат на несколько ходов (показано на кнопке). У базовых ударов обычно нет отката — используйте их, пока перезаряжаются мощные способности.'
    )},
    {h:M('Combos','Комбо'),t:M(
      'Some abilities set up others. The first hero leaves a mark on the target, the second hits it harder. Watch for the combo status icons.',
      'Некоторые способности подготавливают другие: первый герой оставляет на цели метку, второй бьёт по ней сильнее. Следите за значками комбо-статусов.'
    ),items:[
      M('<b>Doran</b> · Pack Tackle → foe <i>exposed</i> → <b>Kest</b> · Backstab or Assassinate deal bonus damage','<b>Доран</b> · Стая набрасывается → враг <i>уязвим</i> → <b>Кест</b> · Удар в спину или Убийство бьют сильнее'),
      M('<b>Sael</b> · Pin Down → foe <i>pinned</i> → basic strike of <b>Bram</b>, <b>Doran</b> or <b>Torvin</b>','<b>Саэль</b> · Пригвоздить → враг <i>пригвождён</i> → базовый удар <b>Брама</b>, <b>Дорана</b> или <b>Торвина</b>'),
      M('<b>Ashra</b> · Ember Flick → foe <i>scorched</i> → ranged attacks of <b>Sael</b>','<b>Ашра</b> · Всплеск огня → враг <i>обожжён</i> → дальние атаки <b>Саэль</b>'),
      M('<b>Bram</b> · Cleave → every foe hit <i>staggered</i> → <b>Doran</b> · Claw Strike','<b>Брам</b> · Рассечение → все задетые враги <i>сбиты с ног</i> → <b>Доран</b> · Удар когтем'),
      M('<b>Kest</b> · Backstab or Assassinate → foe <i>bleeding</i> → <b>Morwen</b> · Withering Touch or Soul Siphon, and she heals more','<b>Кест</b> · Удар в спину или Убийство → враг <i>кровоточит</i> → <b>Морвена</b> · Иссушающее касание или Похищение душ, и она лечится сильнее'),
      M('<b>Torvin</b> · Oath of Protection or <b>Yvana</b>’s healing → the ally they helped hits harder next time','<b>Торвин</b> · Клятва защиты или лечение <b>Иваны</b> → союзник, которому помогли, следующим ударом бьёт сильнее'),
    ]},
    {h:M('Damage Types','Типы урона'),t:M(
      'Physical classes (Warrior, Beastmaster, Ranger, Rogue, Paladin) deal damage from Strength (STR); magic classes (Pyromancer, Necromancer, Cleric) deal damage from Intellect (INT) — each hero only grows the one they use. Magic Defense (MDEF) protects against magic attacks, separate from ordinary Defense (DEF) which protects against physical ones — casters usually run light on DEF and build up MDEF instead, mainly through their own gear. A small badge on an enemy\'s portrait in battle (⚔ or ✦) shows which type of damage they\'re weaker against.',
      'Физические классы (Воин, Зверолов, Лучник, Разбойник, Паладин) наносят урон Силой (СИЛ); магические (Пиромант, Некромант, Жрица) — Интеллектом (ИНТ), и каждый герой качает только свою характеристику. Магическая защита (МЗАЩ) защищает от магических атак отдельно от обычной Защиты (ЗАЩ), которая защищает от физических — у магов обычно мало ЗАЩ, а МЗАЩ они набирают в основном за счёт своего снаряжения. Маленький значок на портрете врага в бою (⚔ или ✦) показывает, к какому типу урона он слабее.'
    )},
    {h:M('Gear & Relics','Снаряжение и реликвии'),t:M(
      'Each hero has a weapon, armor and trinket slot, plus one shared relic per hero with a passive effect. Better gear drops from harder fights. Check "Formation & Gear" on the map screen to re-equip or reorder your rows anytime.',
      'У каждого героя есть слоты оружия, брони и аксессуара, а также реликвия с пассивным эффектом. Более редкое снаряжение выпадает за сложные бои. «Строй и снаряжение» на экране карты позволяет переэкипироваться и менять ряды в любой момент.'
    )},
    {h:M('Ascension','Сложность похода'),t:M(
      'Set the difficulty on the company screen right before setting out. Higher Ascension makes enemies tougher but pays more embers; Story Mode (S) is gentler with no penalty.',
      'Сложность выбирается на экране отряда прямо перед походом. Чем выше — тем сильнее враги, но и больше угольков. Режим истории (И) мягче и без штрафа.'
    )},
    {h:M('Permanent progress','Постоянный прогресс'),t:M(
      'Embers persist even after a defeat — spend them in the Legacy Ledger on permanent upgrades. New heroes are unlocked by achievements. Your progress is saved to your account on the server (a guest keeps it in this browser); "Export Save Code" in Legacy makes an extra backup.',
      'Угольки сохраняются даже после поражения — тратьте их в Летописи на постоянные улучшения. Новых героев открывают достижения. Прогресс хранится в аккаунте на сервере (у гостя — в этом браузере); «Экспорт кода сохранения» в Летописи делает дополнительную копию.'
    )},
  ];
  /* Collapsible sections instead of one long wall of text; the first is open. */
  wrap.classList.add('rules-wrap');
  sections.forEach(function(s,i){
    const sec=document.createElement('details');
    sec.className='rules-sec';
    if(i===0)sec.open=true;
    sec.innerHTML='<summary>'+s.h+'</summary><div class="rules-body">'+s.t+
      (s.items?'<ul class="rules-list">'+s.items.map(function(x){return '<li>'+x+'</li>';}).join('')+'</ul>':'')+'</div>';
    wrap.appendChild(sec);
  });
  const close=el('button','primary',M('Got it','Понятно'));
  close.addEventListener('click',closeModal);
  wrap.appendChild(close);
  openModal(wrap);
}
function exportSave(){
  let code='';
  try{code='EMBERMARCH1:'+btoa(unescape(encodeURIComponent(JSON.stringify(META))));}catch(e){code='';}
  const wrap=el('div','stack');
  wrap.appendChild(el('h3','',M('Export Save Code','Экспорт кода сохранения')));
  wrap.appendChild(el('div','',"<span style='color:var(--muted);font-size:12px;'>"+M('Copy this code and keep it somewhere safe. Paste it back in on another device to restore your progress.','Скопируйте этот код и сохраните его. Вставьте его на другом устройстве, чтобы восстановить прогресс.')+"</span>"));
  const ta=document.createElement('textarea');
  ta.className='save-code';ta.readOnly=true;ta.value=code;
  wrap.appendChild(ta);
  const row=el('div','row');
  const copyBtn=el('button','primary',M('Copy','Копировать'));
  copyBtn.addEventListener('click',function(){
    ta.select();
    try{navigator.clipboard&&navigator.clipboard.writeText(code);}catch(e){}
    try{document.execCommand('copy');}catch(e){}
    copyBtn.textContent=M('Copied!','Скопировано!');
  });
  const close=el('button','',M('Close','Закрыть'));
  close.addEventListener('click',closeModal);
  row.appendChild(copyBtn);row.appendChild(close);
  wrap.appendChild(row);
  openModal(wrap);
}
function importSave(){
  const wrap=el('div','stack');
  wrap.appendChild(el('h3','',M('Import Save Code','Импорт кода сохранения')));
  wrap.appendChild(el('div','',"<span style='color:var(--muted);font-size:12px;'>"+M('Pasting a code will overwrite your current progress on this device.','Вставка кода перезапишет текущий прогресс на этом устройстве.')+"</span>"));
  const ta=document.createElement('textarea');
  ta.className='save-code';ta.placeholder=M('Paste save code here…','Вставьте код сохранения сюда…');
  wrap.appendChild(ta);
  const err=el('div','',"");err.style.cssText='color:var(--danger);font-size:12px;min-height:14px;';
  wrap.appendChild(err);
  const row=el('div','row');
  const load=el('button','primary',M('Load','Загрузить'));
  load.addEventListener('click',function(){
    let raw=ta.value.trim();
    if(raw.indexOf('EMBERMARCH1:')===0)raw=raw.slice('EMBERMARCH1:'.length);
    try{
      const parsed=JSON.parse(decodeURIComponent(escape(atob(raw))));
      const keepRev=META._adminRev; // server-owned revision: an old export must not trigger the admin-edit 409
      META=Object.assign(defaultMeta(),parsed,{upgrades:Object.assign(defaultMeta().upgrades,parsed.upgrades),heroesUnlocked:Object.assign(defaultMeta().heroesUnlocked,parsed.heroesUnlocked),customHeroes:parsed.customHeroes||[],achievements:parsed.achievements||{},history:parsed.history||[],theme:parsed.theme==='light'?'light':'dark',settings:Object.assign(defaultMeta().settings,parsed.settings),biomeChoice:BIOME_DEFS[parsed.biomeChoice]?parsed.biomeChoice:'ashfall',routeChoice:ROUTE_CHOICES.indexOf(parsed.routeChoice)>=0?parsed.routeChoice:'random',modifiers:Object.assign(defaultMeta().modifiers,parsed.modifiers),bestiary:parsed.bestiary||{},gearPresets:parsed.gearPresets||[],tutorial:Object.assign(defaultMeta().tutorial,parsed.tutorial)});
      if(keepRev!==undefined)META._adminRev=keepRev;else delete META._adminRev;
      saveMeta();applyTheme();applySettings();closeModal();renderLegacy();
    }catch(e){
      err.textContent=M('That code could not be read. Check for typos and try again.','Не удалось прочитать код. Проверьте на опечатки и попробуйте снова.');
    }
  });
  const cancel=el('button','',M('Cancel','Отмена'));
  cancel.addEventListener('click',closeModal);
  row.appendChild(load);row.appendChild(cancel);
  wrap.appendChild(row);
  openModal(wrap);
}

let heroSelectState=[];
function heroUnlockedForSelect(key){
  if(META.heroesUnlocked&&Object.prototype.hasOwnProperty.call(META.heroesUnlocked,key))return !!META.heroesUnlocked[key];
  return (META.customHeroes||[]).some(function(c){return c.id===key;});
}
function updateHeroSelectButtons(){
  $('btn-confirm-heroes').disabled=heroSelectState.length!==3;
  const saveBtn=$('btn-save-hero-preset');
  if(saveBtn)saveBtn.disabled=heroSelectState.length!==3;
  renderSynergyBox();
}
/* Lists every synergy, highlighting the ones the current pick activates, so
   players can discover combinations without reading the rules. */
function renderSynergyBox(){
  const box=$('hero-synergy-box');if(!box)return;
  box.innerHTML='';
  const active=activeSynergies(heroSelectState).map(function(s){return s.id;});
  box.appendChild(el('div','eyebrow',M('Synergies','Синергии')+(active.length?' · '+M('active: ','активно: ')+active.length:'')));
  PARTY_SYNERGIES.forEach(function(s){
    const on=active.indexOf(s.id)>=0;
    const row=el('div','',(on?'✔ ':'○ ')+'<strong>'+L(s.name)+'</strong> <span style="color:var(--muted);font-size:12px;">'+L(s.desc)+'</span>');
    row.style.cssText='font-size:13px;'+(on?'color:var(--good);':'opacity:0.6;');
    box.appendChild(row);
  });
}
function renderHeroPickCard(list,key,def,unlocked,isCustom){
  const card=el('div','hero-pick'+(unlocked?'':' locked'));
  if(unlocked&&heroSelectState.indexOf(key)>=0)card.classList.add('selected');
  const av=el('div','hero-avatar',def.custom?customPortraitSVG(def):(HERO_ICON_SVG[def.tplKey||key]||def.icon));av.style.background=def.color;
  card.appendChild(av);
  const info=el('div','hero-info');
  info.appendChild(el('div','name',L(def.name)+(unlocked?'':M(' (locked)',' (заблокировано)'))));
  info.appendChild(el('div','cls',L(def.cls)));
  const heroDt=HERO_DMG_TYPE[def.tplKey||key]||'str';
  const stats=el('div','hero-stats',statAbbr('hp')+' '+def.baseHp+' &middot; '+statAbbr(heroDt)+' '+(heroDt==='str'?def.baseStr:def.baseInt)+' &middot; '+statAbbr('def')+' '+def.baseDef+' &middot; '+statAbbr('spd')+' '+def.baseSpd);
  info.appendChild(stats);
  if(def.passive){
    const pd=customPassiveDef(def.passive);
    info.appendChild(el('div','cls',"<span style='color:var(--accent,var(--good));'>"+L(pd.name)+'</span> — '+L(pd.desc)));
  }
  card.appendChild(info);
  if(isCustom){
    const del=el('button','',M('Delete','Удалить'));
    del.style.cssText='flex-shrink:0;align-self:center;font-size:11px;padding:5px 8px;';
    del.addEventListener('click',function(e){
      e.stopPropagation();
      META.customHeroes=META.customHeroes.filter(function(c){return c.id!==key;});
      saveMeta();renderHeroSelect();
    });
    card.appendChild(del);
  }
  if(unlocked){
    card.addEventListener('click',function(){
      const idx=heroSelectState.indexOf(key);
      if(idx>=0)heroSelectState.splice(idx,1);
      else if(heroSelectState.length<3)heroSelectState.push(key);
      card.classList.toggle('selected',heroSelectState.indexOf(key)>=0);
      updateHeroSelectButtons();
    });
  }
  list.appendChild(card);
}
/* Builds the card grid from the current heroSelectState (marking already-selected
   cards), without resetting the selection — so a saved preset can repopulate it. */
function renderHeroPickList(){
  const list=$('hero-pick-list');list.innerHTML='';
  HERO_ORDER.forEach(function(key){
    renderHeroPickCard(list,key,HERO_DEFS[key],META.heroesUnlocked[key],false);
  });
  (META.customHeroes||[]).forEach(function(c){
    renderHeroPickCard(list,c.id,customHeroToDef(c.id),true,true);
  });
  if((META.customHeroes||[]).length<CUSTOM_HERO_MAX){
    const addCard=el('div','hero-pick hero-pick-add');
    addCard.innerHTML='<div class="hero-info" style="text-align:center;width:100%;">+ '+M('Create a Hero','Создать героя')+'</div>';
    addCard.addEventListener('click',openCreateHeroModal);
    list.appendChild(addCard);
  }
  updateHeroSelectButtons();
}
/* Saved company line-ups (META.gearPresets) shown as clickable chips above the
   hero grid — re-applies a saved 3-hero selection in one click instead of picking
   heroes by hand every march. */
function renderHeroPresetsBar(){
  const bar=$('hero-presets-bar');if(!bar)return;
  bar.innerHTML='';
  bar.style.flexWrap='wrap';
  const presets=META.gearPresets||[];
  if(!presets.length){
    bar.appendChild(el('div','',"<span style='color:var(--muted);font-size:11px;'>"+M('No saved companies yet — pick three heroes below, then “Save as Preset”.','Сохранённых составов пока нет — выберите троих героев ниже и нажмите «Сохранить как пресет».')+"</span>"));
    return;
  }
  presets.forEach(function(p,idx){
    const applicable=p.heroKeys.length===3&&p.heroKeys.every(heroUnlockedForSelect);
    const chip=el('div','',null);
    chip.style.cssText='border:1px solid var(--border);border-radius:8px;padding:5px 8px;font-size:12px;display:flex;align-items:center;gap:6px;background:var(--surface2);cursor:'+(applicable?'pointer':'default')+';'+(applicable?'':'opacity:0.5;');
    const names=p.heroKeys.map(function(k){const d=HERO_DEFS[k]||customHeroToDef(k);return d?L(d.name):k;}).join(', ');
    const label=el('div','',"<strong>"+p.name+"</strong><br><span style='color:var(--muted);'>"+names+"</span>");
    chip.title=applicable?M('Click to select this company','Нажмите, чтобы выбрать этот состав'):M('Missing an unlocked hero','Не хватает открытого героя');
    chip.appendChild(label);
    if(applicable)chip.addEventListener('click',function(){applyHeroPreset(p);});
    const del=document.createElement('button');del.textContent='×';del.title=M('Delete preset','Удалить пресет');
    del.style.cssText='padding:1px 6px;font-size:11px;flex-shrink:0;';
    del.addEventListener('click',function(e){
      e.stopPropagation();
      META.gearPresets.splice(idx,1);
      saveMeta();
      renderHeroPresetsBar();
    });
    chip.appendChild(del);
    bar.appendChild(chip);
  });
}
function applyHeroPreset(p){
  heroSelectState=p.heroKeys.filter(heroUnlockedForSelect).slice(0,3);
  renderHeroPickList();
}
function openSavePresetModal(){
  if(heroSelectState.length!==3)return;
  const wrap=el('div','stack');
  wrap.appendChild(el('h3','',M('Save Company Preset','Сохранить состав отряда')));
  const names=heroSelectState.map(function(k){const d=HERO_DEFS[k]||customHeroToDef(k);return d?L(d.name):k;}).join(', ');
  wrap.appendChild(el('div','',"<span style='color:var(--muted);font-size:12px;'>"+names+"</span>"));
  const nameInput=document.createElement('input');
  nameInput.type='text';nameInput.maxLength=20;nameInput.placeholder=M('Preset name','Название пресета');
  nameInput.style.cssText='width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:inherit;box-sizing:border-box;';
  wrap.appendChild(nameInput);
  const err=el('div','',"");err.style.cssText='color:var(--danger);font-size:12px;min-height:14px;';
  wrap.appendChild(err);
  const save=el('button','primary',M('Save','Сохранить'));
  save.addEventListener('click',function(){
    const name=nameInput.value.trim();
    if(!name){err.textContent=M('Enter a name.','Введите название.');return;}
    META.gearPresets=META.gearPresets||[];
    if(META.gearPresets.length>=8){err.textContent=M('Preset limit reached (8). Delete one first.','Достигнут лимит пресетов (8). Сначала удалите один.');return;}
    META.gearPresets.push({id:'preset_'+Date.now(),name:name.slice(0,20),heroKeys:heroSelectState.slice()});
    saveMeta();
    closeModal();
    renderHeroPresetsBar();
  });
  wrap.appendChild(save);
  const cancel=el('button','',M('Cancel','Отмена'));
  cancel.addEventListener('click',closeModal);
  wrap.appendChild(cancel);
  openModal(wrap);
}
/* Difficulty of the next march: Ascension and modifiers, shown on the
   hero-select screen right before setting out (it used to be a Legacy tab).
   Daily/Weekly fix their own difficulty, so the card is replaced by a note. */
function renderMarchSettings(){
  const card=$('march-settings'),note=$('march-settings-challenge');
  if(!card)return;
  const challenge=typeof dailyPendingSeed!=='undefined'&&!!dailyPendingSeed;
  card.hidden=challenge;
  if(note){
    note.hidden=!challenge;
    note.textContent=challenge?M('This challenge sets its own difficulty and modifiers.','Испытание само задаёт сложность и модификаторы.'):'';
  }
  if(challenge)return;
  const ascWrap=$('leg-ascension');ascWrap.innerHTML='';
  for(let i=-1;i<=5;i++){
    const locked=i>META.ascensionUnlocked;
    const label=i===-1?M('S','И'):i;
    const pip=el('div','asc-pip'+(locked?' locked':'')+(META.ascensionChoice===i?' selected':''),label);
    if(!locked)pip.addEventListener('click',function(){META.ascensionChoice=i;saveMeta();renderMarchSettings();});
    ascWrap.appendChild(pip);
  }
  const ascInfo=$('leg-ascension-info');
  if(ascInfo){
    const step=Math.round(ENEMY_TUNING.ascStep*100);
    const pct=META.ascensionChoice*step;
    ascInfo.textContent=META.ascensionChoice===-1
      ? M('Story Mode: enemies have '+Math.round(STORY_STAT_STEP*100)+'% less HP and ATK. A gentler march, no embers penalty.','Режим истории: у врагов на '+Math.round(STORY_STAT_STEP*100)+'% меньше HP и атаки. Более спокойный поход, без штрафа к уголькам.')
      : META.ascensionChoice===0
      ? M('Ascension 0: no modifiers.','Сложность 0: без модификаторов.')
      : M('Ascension '+META.ascensionChoice+': enemies have +'+pct+'% HP and ATK, and you gain +'+(META.ascensionChoice*3)+' bonus embers per march.',
          'Сложность '+META.ascensionChoice+': у врагов +'+pct+'% к HP и атаке, а вы получаете +'+(META.ascensionChoice*3)+' угольков за поход.');
  }
  const modWrap=$('leg-modifiers');
  if(modWrap){
    modWrap.innerHTML='';
    MODIFIER_DEFS.forEach(function(md){
      const on=!!(META.modifiers&&META.modifiers[md.key]);
      const pip=el('div','mod-pip'+(on?' selected':''),"<strong>"+L(md.name)+"</strong><br><span style='font-size:11px;color:var(--muted);'>"+L(md.desc)+"</span>");
      pip.addEventListener('click',function(){
        META.modifiers=META.modifiers||{};
        META.modifiers[md.key]=!META.modifiers[md.key];
        saveMeta();renderMarchSettings();
      });
      modWrap.appendChild(pip);
    });
  }
}
/* Previews the march's three chapters (BIOME_ACT_CHOICES). The second chapter
   forks: the player picks the Frozen Reach, the Drowned Barrows or a random one
   (META.routeChoice); the first and last are fixed. */
function renderHeroSelectBiomePicker(){
  const wrap=$('hero-select-biome-row');
  if(!wrap)return;
  wrap.innerHTML='';
  BIOME_ACT_CHOICES.forEach(function(opts,i){
    if(opts.length===1){
      const pip=el('div','biome-pip biome-pip-story',(i+1)+'. '+L(BIOME_DEFS[opts[0]].name));
      pip.title=L(BIOME_FLAVOR[opts[0]]||BIOME_FLAVOR.ashfall);
      wrap.appendChild(pip);
    } else {
      const fork=el('div','biome-fork');
      ROUTE_CHOICES.forEach(function(rc){
        const label=rc==='random'?M('Either land','Любой край'):L(BIOME_DEFS[rc].name);
        const pip=el('div','biome-pip'+((META.routeChoice||'random')===rc?' selected':''),(i+1)+'. '+label);
        pip.title=rc==='random'?M('The second chapter is drawn at random when the march starts.','Край второй главы выбирается случайно в начале похода.'):L(BIOME_FLAVOR[rc]);
        pip.addEventListener('click',function(){META.routeChoice=rc;saveMeta();renderHeroSelectBiomePicker();});
        fork.appendChild(pip);
      });
      wrap.appendChild(fork);
    }
    if(i<BIOME_ACT_CHOICES.length-1)wrap.appendChild(el('div','biome-pip-arrow','→'));
  });
  const info=$('hero-select-biome-info');
  if(info)info.textContent=M(
    'Each chapter picks up where the last leaves off and gets harder. Choose the land of the second chapter; Daily and Weekly challenges pick it from their seed.',
    'Каждая глава продолжает предыдущую и становится сложнее. Выберите край второй главы; в испытаниях дня и недели он определяется сидом.'
  );
}
