// Embermarch client: Rendering: map, combat, unit cards, equipment/formation modals; run end.
// Classic script: shares the global scope with the other js/*.js files; load order is set in index.html.
"use strict";

/* ============================= RENDER ============================= */

function renderTopbar(){
  if(!RUN)return;
  if(RUN.endless){
    $('tb-layer').textContent=M('Endless — depth ','Бесконечный — глубина ')+(RUN.endlessDepth||0)+(RUN.ascension?('  ·  '+M('Asc ','Слож. ')+RUN.ascension):'');
  } else {
    const cur = RUN.currentNodeId?findNode(RUN.map,RUN.currentNodeId):null;
    const layerNum = cur? (cur.layer+2) : 1;
    $('tb-layer').textContent=M('Layer ','Уровень ')+Math.min(layerNum,TOTAL_STEPS)+' / '+TOTAL_STEPS+(RUN.ascension?('  ·  '+M('Asc ','Слож. ')+RUN.ascension):'');
  }
  $('tb-gold').textContent=RUN.gold+M('g',M(' зол.',' зол.'));
  const wrap=$('tb-party');wrap.innerHTML='';
  RUN.party.forEach(function(h){
    const b=el('div','pb-hp');
    const dot=el('div','pb-dot',avatarContent(h));
    dot.style.background=h.alive?h.color:'#4a4a4a';
    if(!h.alive)dot.style.opacity='0.4';
    dot.title=h.name+' · '+h.cls+' · '+M('Lv','Ур.')+' '+(h.level||1);
    b.appendChild(dot);
    b.appendChild(el('div','',M('Lv','Ур.')+(h.level||1)));
    b.appendChild(el('div',h.alive?'':'pb-fallen',h.alive?h.hp+'/'+h.maxHp:M('down','пал')));
    wrap.appendChild(b);
  });
}

function nodeColor(type){
  return {battle:'var(--accent)',elite:'var(--danger)',event:'var(--accent2)',shop:'var(--gold)',rest:'var(--good)',boss:'var(--danger)'}[type];
}
function nodeLabel(type){
  return {battle:M('BTL','БОЙ'),elite:M('ELT','ЭЛТ'),event:M('EVT','СОБ'),shop:M('SHP','МАГ'),rest:M('RST','ПРВ'),boss:'☠'}[type];
}
function nodeIcon(type){
  // Plain ASCII/Latin-1 glyphs instead of emoji-presentation dingbats (⚔ ☠ ⚖ ♨ ♛):
  // those render as blank/"×" boxes on systems without a color-emoji font installed,
  // while these are guaranteed to be covered by any basic sans-serif font.
  return {battle:'†',elite:'‡',event:'❓',shop:'$',rest:'+',boss:'!'}[type];
}
/* Accepts either a bare type string or a full node object. For 'boss' nodes
   the wording now has to tell a chapter climax (CH1/CH2 — more land to cross
   after this) apart from the true final boss (TOTAL_MAP_LAYERS — this fight
   ends the march), since a march has three boss fights now instead of one.
   Deliberately doesn't name the specific boss species here, same as the
   (now-removed) placeholder name this replaces — which one of a biome's
   boss options you'll actually face stays a surprise until the fight. */
function nodeTypeName(node){
  const type=(node&&typeof node==='object')?node.type:node;
  if(type==='boss'){
    const li=(node&&typeof node==='object'&&typeof node.layer==='number')?node.layer:TOTAL_MAP_LAYERS;
    return li===TOTAL_MAP_LAYERS?M('The Final Boss','Финальный босс'):M('Chapter Boss','Босс главы');
  }
  return {
    battle:M('Battle','Бой'),elite:M('Elite Battle','Элитный бой'),event:M('Event','Событие'),
    shop:M('Wandering Cart','Бродячая тележка'),rest:M('Rest Site','Привал')
  }[type];
}
function nodeDescription(node){
  const type=(node&&typeof node==='object')?node.type:node;
  if(type==='boss'){
    const li=(node&&typeof node==='object'&&typeof node.layer==='number')?node.layer:TOTAL_MAP_LAYERS;
    return li===TOTAL_MAP_LAYERS
      ? M('The march’s end: a powerful foe blocking the way out of the ash. Defeat it to win the march.','Конец похода: могучий враг преграждает путь из пепла. Победите его, чтобы завершить поход.')
      : M('A chapter’s climax: a powerful foe standing between the company and the next, harsher land. Defeat it to press on.','Кульминация главы: могучий враг стоит между отрядом и следующей, более суровой землёй. Победите его, чтобы идти дальше.');
  }
  return {
    battle:M('A skirmish against a band of ash-touched foes. Win to earn gold and a choice of rewards.','Стычка с отрядом врагов, тронутых пеплом. Победа приносит золото и выбор награды.'),
    elite:M('A tougher fight against a dangerous foe with a second wind at low health. Higher risk, better rewards.','Более тяжёлый бой с опасным противником, у которого при низком HP открывается «второе дыхание». Выше риск — лучше награда.'),
    event:M('An encounter with a choice to make — search, barter, help, or walk away. Some choices echo later in the march.','Встреча с выбором — обыскать, поторговаться, помочь или пройти мимо. Некоторые решения аукнутся позже в походе.'),
    shop:M('A cart of goods for sale. Spend gold on gear, an elixir, or a vial of vigor before moving on.','Тележка с товарами на продажу. Потратьте золото на снаряжение, эликсир или флакон бодрости перед тем, как идти дальше.'),
    rest:M('A safe place to catch your breath. Heal the company or reforge gear before the road continues.','Безопасное место перевести дух. Подлечите отряд или перекуйте снаряжение перед тем, как идти дальше.')
  }[type];
}
const MAP_FLAVOR_BY_TIER={
  1:{en:'The road is quiet, for now.',ru:'Пока дорога спокойна.'},
  2:{en:'The ash grows thicker; the going gets harder.',ru:'Пепел сгущается — идти становится тяжелее.'},
  3:{en:'Something shifts at the edge of sight, just past the firelight.',ru:'Что-то шевелится на краю зрения, у самой границы света костра.'},
  4:{en:"The air itself hums — you're close to whatever rules this place.",ru:'Сам воздух гудит — вы близко к тому, что правит этим краем.'},
};
function renderMapFlavor(){
  const cur=RUN.currentNodeId?findNode(RUN.map,RUN.currentNodeId):null;
  const li=cur?Math.min(cur.layer+1,TOTAL_MAP_LAYERS-1):0;
  const tier=tierForLayer(li);
  const el2=$('map-flavor');
  if(el2)el2.textContent=L(MAP_FLAVOR_BY_TIER[tier]||MAP_FLAVOR_BY_TIER[1]);
}
function renderMap(){
  if(_progressCorrectedPending)setTimeout(showProgressCorrectedNotice,0);
  renderMapFlavor();
  const map=RUN.map;
  const layers=map.layers;
  const totalLayers=layers.length+1;
  const maxPerLayer=layers.reduce(function(m,l){return Math.max(m,l.length);},1);
  const w=70+totalLayers*112;
  const h=Math.max(300,110+(maxPerLayer-1)*116);
  const svg=$('map-svg');
  svg.setAttribute('viewBox','0 0 '+w+' '+h);
  svg.setAttribute('width',w);
  svg.setAttribute('height',h);
  svg.innerHTML='';
  const NS='http://www.w3.org/2000/svg';
  function coordsFor(node){
    const arr = node.type==='boss'?[node]:layers[node.layer];
    const n=arr.length;
    const y = n<=1?h/2:55+node.idx*((h-110)/(n-1));
    const x = 55+node.layer*112;
    return {x:x,y:y};
  }
  const allNodes=mapAllNodes(map);
  const posMap={};
  allNodes.forEach(function(n){posMap[n.id]=coordsFor(n);});

  /* Decorative tier bands behind the path, so the march's four difficulty
     stretches read visually instead of only through node color. Purely
     cosmetic — never affects which nodes are reachable. */
  let bandStart=0,bandTier=tierForLayer(0);
  for(let li=1;li<=layers.length;li++){
    const t=li<layers.length?tierForLayer(li):-1;
    if(t!==bandTier){
      const x1=55+bandStart*112-56, x2=55+(li-1)*112+56;
      const band=document.createElementNS(NS,'rect');
      band.setAttribute('x',x1);band.setAttribute('y',0);
      band.setAttribute('width',Math.max(0,x2-x1));band.setAttribute('height',h);
      band.setAttribute('fill',bandTier%2===0?'var(--map-band-a)':'var(--map-band-b)');
      svg.insertBefore(band,svg.firstChild);
      const label=document.createElementNS(NS,'text');
      label.setAttribute('class','map-tier-label');
      label.setAttribute('x',(x1+x2)/2);label.setAttribute('y',18);
      label.setAttribute('text-anchor','middle');
      label.textContent=M('Tier ','Ярус ')+bandTier;
      svg.appendChild(label);
      bandStart=li;bandTier=t;
    }
  }

  allNodes.forEach(function(n){
    n.next.forEach(function(nid){
      const p1=posMap[n.id],p2=posMap[nid];
      const line=document.createElementNS(NS,'line');
      line.setAttribute('x1',p1.x);line.setAttribute('y1',p1.y);
      line.setAttribute('x2',p2.x);line.setAttribute('y2',p2.y);
      line.setAttribute('stroke', n.cleared?'var(--map-line-cleared)':'var(--map-line)');
      line.setAttribute('stroke-width','2.5');
      svg.appendChild(line);
    });
  });
  allNodes.forEach(function(n){
    const p=posMap[n.id];
    const g=document.createElementNS(NS,'g');
    const available=RUN.availableNodeIds&&RUN.availableNodeIds.indexOf(n.id)>=0;
    g.setAttribute('class','map-node'+(available?'':' locked'));
    const r = n.type==='boss'?24:(n.type==='elite'?19:16);
    const circle=document.createElementNS(NS,'circle');
    circle.setAttribute('cx',p.x);circle.setAttribute('cy',p.y);circle.setAttribute('r',r);
    let fill=nodeColor(n.type);
    if(n.cleared)fill='var(--map-line-cleared)';
    else if(!available)fill='var(--map-locked)';
    circle.setAttribute('fill',fill);
    circle.setAttribute('stroke', n.id===RUN.currentNodeId?'var(--text)':'var(--border)');
    circle.setAttribute('stroke-width', n.id===RUN.currentNodeId?'2.5':'1');
    g.appendChild(circle);
    const hk=mapHotkeyNodes().indexOf(n);
    if(hk>=0&&hk<9){
      const t=document.createElementNS(NS,'text');
      t.setAttribute('class','map-hotkey');t.setAttribute('x',p.x+r+3);t.setAttribute('y',p.y-r+4);
      t.textContent=String(hk+1);
      svg.appendChild(t);
    }
    if(available&&!n.cleared){
      const glow=document.createElementNS(NS,'circle');
      glow.setAttribute('cx',p.x);glow.setAttribute('cy',p.y);glow.setAttribute('r',r+6);
      glow.setAttribute('fill','none');glow.setAttribute('stroke',fill);
      glow.setAttribute('stroke-width','1.5');glow.setAttribute('opacity','.45');
      svg.appendChild(glow);
    }
    const text=document.createElementNS(NS,'text');
    text.setAttribute('class', n.cleared?'':'map-node-icon');
    text.setAttribute('x',p.x);text.setAttribute('y',p.y+(n.cleared?4:5));text.setAttribute('text-anchor','middle');
    /* Locked nodes keep a dark, low-contrast fill circle, so their icon needs
       a light fill to stay legible; available/cleared nodes have a bright
       fill circle, so the icon stays dark. Inline style so it beats the
       ".map-node text{fill:...}" stylesheet rule. */
    text.style.fill = (available||n.cleared) ? 'var(--bg)' : 'var(--muted)';
    text.textContent = n.cleared? '✓' : nodeIcon(n.type);
    g.appendChild(text);
    g.addEventListener('click',function(){showNodePreviewModal(n,available);});
    svg.appendChild(g);
  });
  renderMapMobileList(allNodes);
  maybeShowTutorial('map',showMapTutorial);
}

/* Mobile node-choice list (see .map-mobile in the CSS): instead of the full
   branching SVG map, show only the nodes the player can actually walk into
   right now as big tappable cards, plus a compact strip of the path already
   cleared for context. The card already shows the node's name and
   description, so tapping it enters the node straight away (no preview
   modal, unlike a desktop SVG node). */
function renderMapMobileList(allNodes){
  const flavorSrc=$('map-flavor');
  const flavorDst=$('map-flavor-mobile');
  if(flavorDst)flavorDst.textContent=flavorSrc?flavorSrc.textContent:'';

  const history=$('map-mobile-history');
  if(history){
    history.innerHTML='';
    allNodes.filter(function(n){return n.cleared;}).forEach(function(n){
      const dot=el('div','mh-dot','✓');
      dot.style.background='var(--map-line-cleared)';
      dot.title=nodeTypeName(n);
      history.appendChild(dot);
    });
  }

  const list=$('map-mobile-list');
  const eyebrow=$('map-mobile-eyebrow');
  if(!list)return;
  list.innerHTML='';
  delete list.dataset.entering;
  const choices=allNodes.filter(function(n){
    return !n.cleared && RUN.availableNodeIds && RUN.availableNodeIds.indexOf(n.id)>=0;
  });
  if(eyebrow)eyebrow.textContent=choices.length>1
    ? M('Choose your next step','Выберите следующий шаг')
    : M('Next step','Следующий шаг');
  if(!choices.length){
    list.appendChild(el('div','map-mobile-empty',M('No reachable nodes right now.','Сейчас нет доступных узлов.')));
    return;
  }
  choices.forEach(function(n){
    const card=document.createElement('button');
    card.type='button';
    card.className='map-mobile-card';
    const icon=el('div','mc-icon',nodeIcon(n.type));
    icon.style.background=nodeColor(n.type);
    card.appendChild(icon);
    const body=el('div','mc-body');
    body.appendChild(el('div','mc-title',nodeTypeName(n)));
    body.appendChild(el('div','mc-desc',nodeDescription(n)));
    card.appendChild(body);
    card.addEventListener('click',function(){
      if(list.dataset.entering)return; // a double tap must not enter twice
      list.dataset.entering='1';
      enterNode(n);
    });
    list.appendChild(card);
  });
}

function showNodePreviewModal(node,available){
  const wrap=el('div','stack');
  const badge=el('div','node-preview-badge',nodeLabel(node.type));
  badge.style.background=nodeColor(node.type);
  wrap.appendChild(badge);
  wrap.appendChild(el('div','node-preview-type',nodeTypeName(node)));
  wrap.appendChild(el('div','',"<span style='color:var(--muted);font-size:13px;line-height:1.5;'>"+nodeDescription(node)+"</span>"));
  const status=el('div','','');
  status.style.marginTop='12px';
  status.style.fontSize='12px';
  status.style.color='var(--muted)';
  if(node.cleared)status.textContent=M('Already cleared.','Уже пройдено.');
  else if(!available)status.textContent=M('Not yet reachable — clear a connected node first.','Пока недостижимо — сначала пройдите соединённый узел.');
  wrap.appendChild(status);
  const row=el('div','row');
  row.style.marginTop='14px';
  if(available&&!node.cleared){
    const go=el('button','primary',M('Enter','Войти'));
    go.addEventListener('click',function(){closeModal();enterNode(node);});
    row.appendChild(go);
  }
  const close=el('button','',M('Close','Закрыть'));
  close.addEventListener('click',closeModal);
  row.appendChild(close);
  wrap.appendChild(row);
  openModal(wrap);
}

function renderCombatLog(){
  const box=$('combat-log');box.innerHTML='';
  const msgs=RUN.combat.log.slice(-60).slice().reverse();
  msgs.forEach(function(m,i){box.appendChild(el('div',i===0?'l-new':'',m));});
}
const ROMAN_SUFFIX_RE=/ (I{1,3}|IV|V)$/;
function renderTurnOrder(){
  const strip=$('turn-order');
  if(!strip||!RUN.combat.queue)return;
  strip.innerHTML='';
  RUN.combat.queue.forEach(function(u,i){
    const it=el('div','to-item'+(i===RUN.combat.qi&&u.alive?' current':'')+(!u.alive?' dead':''),avatarContent(u));
    it.style.background=u.color;
    it.title=u.name;
    const m=u.name.match(ROMAN_SUFFIX_RE);
    if(m){
      const badge=el('span','to-badge',m[1]);
      it.appendChild(badge);
    }
    strip.appendChild(it);
  });
}

function statusTooltip(s){
  if(s.synergy){
    const syn=PARTY_SYNERGIES.find(function(x){return x.id===s.synergy;});
    return M('Synergy','Синергия')+(syn?' — '+L(syn.name)+': '+L(syn.desc):'')+M(' (whole fight)',' (весь бой)');
  }
  if(s.type==='dot')return M('Burning: loses '+s.amount+' HP at the start of each turn.','Горит: теряет '+s.amount+' HP в начале каждого хода.');
  if(s.type==='stun')return M('Stunned: skips their next turn.','Оглушён: пропускает следующий ход.');
  if(s.type==='dodge')return M('Will dodge the next attack against them.','Уклонится от следующей атаки по себе.');
  if(s.type==='buff')return M(statAbbr(s.stat)+' '+(s.amount>0?'+':'')+s.amount+' for '+s.duration+' more turn(s).',statAbbr(s.stat)+' '+(s.amount>0?'+':'')+s.amount+' ещё '+s.duration+' ход(а/ов).');
  if(s.type==='debuff')return M(statAbbr(s.stat)+' '+s.amount+' for '+s.duration+' more turn(s).',statAbbr(s.stat)+' '+s.amount+' ещё '+s.duration+' ход(а/ов).');
  if(s.type==='mark'&&s.tag==='exposed')return M('Exposed: the next Backstab or Assassinate against them deals +40% bonus damage (combo).','Уязвим: следующий Удар в спину или Убийство по нему наносит +40% урона (комбо).');
  if(s.type==='mark'&&s.tag==='rally')return M("Vow of protection: this hero's next attack deals bonus damage (combo).","Клятва защиты: следующая атака этого героя наносит бонусный урон (комбо).");
  if(s.type==='mark'&&s.tag==='blessed')return M("Blessed: this hero's next attack deals +25% bonus damage (combo).","Благословение: следующая атака этого героя наносит +25% урона (комбо).");
  if(s.type==='mark'&&s.tag==='pinned')return M('Pinned: the next basic strike from Bram, Doran or Torvin against them deals +30% bonus damage (combo).','Пригвождён: следующий базовый удар Брама, Дорана или Торвина по нему наносит +30% урона (комбо).');
  if(s.type==='mark'&&s.tag==='scorched')return M("Scorched: Sael's next ranged attack against them deals +35% bonus damage (combo).",'Обожжён: следующая дальняя атака Саэль по нему наносит +35% урона (комбо).');
  if(s.type==='mark'&&s.tag==='staggered')return M("Staggered: Doran's next Claw Strike against them deals +25% bonus damage (combo).",'Сбит с ног: следующий Удар когтем Дорана по нему наносит +25% урона (комбо).');
  if(s.type==='mark'&&s.tag==='bleeding')return M("Bleeding: Morwen's next Withering Touch or Soul Siphon against them deals +25% bonus damage and extra lifesteal (combo).",'Кровотечение: следующее Иссушающее касание или Похищение душ Морвены по нему наносит +25% урона и лечит её сильнее (комбо).');
  return '';
}
function intentIcon(type){
  return {damage:'⚔',heal:'✚',buff:'▲',debuff:'▼',special:'✦'}[type]||'?';
}
function unitCard(unit,isTargetable,isAllyTargetable,intentBadge,isIntentTarget){
  const card=el('div','unit-card'+(unit.alive?'':' dead'));
  if(unit.uid)card.dataset.uid=unit.uid;
  if(RUN.combat.activeUnit===unit)card.classList.add('active-turn');
  if(isTargetable)card.classList.add('targetable');
  if(isAllyTargetable)card.classList.add('ally-targetable');
  if(isTargetable||isAllyTargetable){
    const hk=combatTargetList().indexOf(unit);
    if(hk>=0&&hk<9){card.style.position='relative';card.appendChild(el('span','hotkey-badge',String(hk+1)));}
  }
  if(isIntentTarget)card.classList.add('intent-target');
  const av=el('div','unit-avatar',avatarContent(unit));
  av.style.background=unit.color;
  if(intentBadge){
    const ib=el('span','intent-badge',intentIcon(intentBadge.type));
    ib.title=intentBadge.name;
    av.appendChild(ib);
  }
  if(!unit.isHero&&unit.res){
    /* res:'magic' units were built with high MDEF / low DEF (magic-resistant, armor-light) —
       so they're vulnerable to physical attacks. res:'phys' units are the reverse: hardy
       physical armor, thin magic wards, vulnerable to magic. Shown as a small corner badge
       so players can make an informed call without reading the bestiary. */
    const weak=unit.res==='magic'?'phys':'magic';
    const rb=el('span','res-badge weak-'+weak,weak==='phys'?'⚔':'✦');
    rb.title=weak==='phys'?M('Vulnerable to physical (STR) attacks','Уязвим к физическим атакам (СИЛА)'):M('Vulnerable to magic (INT) attacks','Уязвим к магическим атакам (ИНТ)');
    av.appendChild(rb);
  }
  card.appendChild(av);
  card.title=unit.isHero?(unit.name+' · '+unit.cls+' · '+M('Lv','Ур.')+' '+(unit.level||1)):unit.name;
  card.appendChild(el('div','unit-name',unit.name));
  if(unit.isHero)card.appendChild(el('div','unit-class',unit.cls+' · '+M('Lv','Ур.')+(unit.level||1)));
  card.appendChild(el('div','unit-row-tag',rowLabel(unit.row)+(unit.elite?(' · '+M('elite','элита')):'')+(unit.boss?(' · '+M('boss','босс')):'')));
  const pct=Math.max(0,unit.hp/unit.maxHp*100);
  const bar=el('div','hpbar');
  const fill=el('div','hpbar-fill'+(pct<30?' low':''));fill.style.width=pct+'%';
  bar.appendChild(fill);card.appendChild(bar);
  card.appendChild(el('div','hp-num',unit.hp+'/'+unit.maxHp));
  const icons=el('div','status-icons');
  unit.status.forEach(function(s){
    const cls=s.type==='dot'?'debuff':(s.type==='debuff'?'debuff':'buff');
    const sign=(typeof s.amount==='number')?(s.amount>0?'+':'')+s.amount+' ':'';
    const icon=el('span','status-icon '+cls, sign+(L(s.label)||s.type)+' '+(s.synergy?'∞':s.duration));
    icon.title=statusTooltip(s);
    icons.appendChild(icon);
  });
  card.appendChild(icons);
  if(isTargetable){card.addEventListener('click',function(){heroChooseTarget(unit);});}
  if(isAllyTargetable){card.addEventListener('click',function(){heroChooseTarget(unit);});}
  return card;
}

function renderCombat(){
  if(!RUN.combat)return;
  const ability=RUN.combat.selectedAbility;
  const active=RUN.combat.activeHero;
  let targetableEnemies=[],targetableAllies=[];
  if(ability&&active){
    if(ability.targets==='single')targetableEnemies=getValidTargets(ability,active);
    if(ability.targets==='single-ally')targetableAllies=getValidTargets(ability,active);
  }
  const intent=RUN.combat.enemyIntent;
  const intentUnit=intent?RUN.combat.enemies[intent.enemyIdx]:null;
  const intentTarget=intent&&intent.targetSide?((intent.targetSide==='party'?RUN.combat.party:RUN.combat.enemies)[intent.targetIdx]):null;
  const eb=$('enemy-row-back'),ef=$('enemy-row-front');
  eb.innerHTML='';ef.innerHTML='';
  RUN.combat.enemies.forEach(function(en){
    const tgt=targetableEnemies.indexOf(en)>=0;
    const badge=(intentUnit===en)?{type:intent.abilityType,name:intent.abilityName}:null;
    (en.row==='back'?eb:ef).appendChild(unitCard(en,tgt,false,badge,intentTarget===en));
  });
  const hf=$('hero-row-front'),hb=$('hero-row-back');
  hf.innerHTML='';hb.innerHTML='';
  RUN.combat.party.forEach(function(h){
    const tgt=targetableAllies.indexOf(h)>=0;
    (h.row==='back'?hb:hf).appendChild(unitCard(h,false,tgt,null,intentTarget===h));
  });
  renderTurnOrder();
  renderCombatLog();
  updateAutoBattleButton();
  fitBattlefield();
  saveRun();
}
/* Desktop: scale the battlefield column down just enough that the whole fight
   fits the window (the screen never scrolls the page; see .screen-head CSS).
   Phones use their own stacked layout and are left alone. */
const BATTLEFIELD_MIN_ZOOM=0.55;
function fitBattlefield(){
  const sec=$('screen-combat'),col=document.querySelector('#screen-combat .combat-right');
  if(!sec||!col||sec.hidden)return;
  col.style.zoom='';
  if(window.innerWidth<=680)return;
  const over=sec.scrollHeight-sec.clientHeight;
  if(over<=0)return;
  const h=col.offsetHeight;
  col.style.zoom=Math.max(BATTLEFIELD_MIN_ZOOM,(h-over)/h).toFixed(3);
}
window.addEventListener('resize',function(){if(RUN&&RUN.combat)fitBattlefield();});
function updateAutoBattleButton(){
  const btn=$('btn-auto-battle');
  if(!btn||!RUN.combat)return;
  btn.hidden=!!RUN.combat.isReplay;
  const on=!!RUN.combat.autoBattle;
  btn.textContent=on?M('Auto: ON','Авто: ВКЛ'):M('Auto: OFF','Авто: ВЫКЛ');
  btn.className=on?'primary':'';
}

function renderActionPanel(){
  const panel=$('action-panel');panel.innerHTML='';
  if(RUN.combat.isReplay){renderReplayPanel(panel);return;}
  const unit=RUN.combat.activeHero;
  if(RUN.combat.isLivePvp&&RUN.combat.phase==='hero_wait'){panel.innerHTML='<div style="color:var(--muted);font-size:13px;">'+M('Resolving…','Разрешение хода…')+'</div>';return;}
  if(!unit){
    const waitMsg=RUN.combat.isLivePvp?M("Opponent's turn…",'Ход соперника…'):M('The foe stirs…','Враг готовится…');
    panel.innerHTML='<div style="color:var(--muted);font-size:13px;">'+waitMsg+'</div>';return;
  }
  panel.appendChild(el('div','eyebrow',M(unit.name+"'s turn",'Ход: '+unit.name)));
  const bar=el('div','ability-bar');
  unit.abilities.forEach(function(a,idx){
    const btn=el('button','ability-btn');
    if(RUN.combat.selectedAbility===a)btn.classList.add('selected');
    btn.title=(a.desc||'')+(a.cd?' · '+M('Cooldown','Откат')+' '+a.cd:'')+' · ['+(idx+1)+']';
    btn.innerHTML='<span class="a-name">'+(idx+1)+'. '+escHtml(a.name)+(a.minLevel?' <span class="ult-tag">'+M('ULT','УЛЬТ')+'</span>':'')+'</span><span class="a-meta">'+escHtml(a.desc||'')+'</span>';
    if(a.minLevel&&(unit.level||1)<a.minLevel){
      btn.disabled=true;
      btn.classList.add('no-target');
      const badge=el('span','cd-badge',M('Lv','Ур.')+a.minLevel);
      btn.appendChild(badge);
    } else if(a.cdLeft>0){
      btn.disabled=true;
      const badge=el('span','cd-badge',a.cdLeft);
      btn.appendChild(badge);
    } else if(!abilityHasTargets(a,unit)){
      btn.disabled=true;
      btn.classList.add('no-target');
      const badge=el('span','cd-badge',M('N/A','нет цели'));
      btn.appendChild(badge);
    }
    btn.addEventListener('click',function(){
      if(RUN.combat.selectedAbility===a){RUN.combat.selectedAbility=null;RUN.combat.phase='hero_choose';renderActionPanel();renderCombat();return;}
      heroChooseAbility(a);
    });
    bar.appendChild(btn);
  });
  panel.appendChild(bar);
  if(RUN.combat.selectedAbility){
    const hint = {'single':M('Choose a foe to strike (1-9, Space = weakest). Esc to cancel.','Выберите врага для удара (1-9, пробел — самый слабый). Esc — отмена.'),'single-ally':M('Choose an ally (1-9, Space = most hurt). Esc to cancel.','Выберите союзника (1-9, пробел — самый раненый). Esc — отмена.')}[RUN.combat.selectedAbility.targets]||'';
    panel.appendChild(el('div','eyebrow',hint));
  } else {
    panel.appendChild(el('div','hotkey-hint',"<span style='color:var(--muted);font-size:11px;'>"+M('Keys: 1-9 ability, then 1-9 or Space for a target · A auto · H all hotkeys','Клавиши: 1-9 способность, затем 1-9 или пробел для цели · A авто · H все клавиши')+"</span>"));
  }
}

/* ---- reward screen ---- */
function renderRewardScreen(){
  const box=$('reward-cards');box.innerHTML='';
  const pr=RUN.pendingReward;
  (RUN.pendingLevelUps||[]).forEach(function(pl){
    const card=el('div','card level-up-card');
    card.appendChild(el('div','',M(
      '<strong>'+pl.heroName+'</strong> reaches level '+pl.level+'! Choose a bonus:',
      '<strong>'+pl.heroName+'</strong> достигает '+pl.level+' уровня! Выберите бонус:'
    )));
    const opts=el('div','row');
    pl.options.forEach(function(key){
      const perk=LEVEL_PERKS.find(function(p){return p.key===key;});
      const b=el('button','card-choice');
      b.innerHTML='<strong>'+L(perk.name)+'</strong><br><span style="color:var(--muted);font-size:12px;">'+L(perk.desc)+'</span>';
      b.addEventListener('click',function(){
        const h=RUN.party.find(function(x){return x.key===pl.heroKey;});
        applyLevelPerkByKey(h,key);
        const idx=RUN.pendingLevelUps.indexOf(pl);
        if(idx>=0)RUN.pendingLevelUps.splice(idx,1);
        saveRun();
        renderRewardScreen();
      });
      opts.appendChild(b);
    });
    card.appendChild(opts);
    box.appendChild(card);
  });
  box.appendChild(el('div','card',M(
    "You claim <strong style='color:var(--gold)'>"+pr.gold+' gold</strong> from the fallen.',
    "Вы забираете у павших <strong style='color:var(--gold)'>"+pr.gold+' золота</strong>.'
  )));
  pr.cards.forEach(function(card){
    const b=el('button','card-choice');
    if(card.type==='item'){
      b.innerHTML='<strong>'+escHtml(card.item.name)+'</strong> <span class="item-tag rarity-'+card.item.rarity+'">'+rarityLabel(card.item.rarity)+'</span><br><span style="color:var(--muted);font-size:12px;">'+slotName(card.item.slot)+' · '+itemDescText(card.item)+'</span>';
      b.addEventListener('click',function(){promptEquip(card.item,function(){finishRewardNode(pr.node);});});
    } else if(card.type==='gold'){
      b.innerHTML='<strong>'+M('Extra Gold','Дополнительное золото')+'</strong><br><span style="color:var(--muted);font-size:12px;">+'+card.amount+goldSuffix()+'</span>';
      b.addEventListener('click',function(){RUN.gold+=card.amount;finishRewardNode(pr.node);});
    } else if(card.type==='elixir'){
      b.innerHTML='<strong>'+M('Elixir','Эликсир')+'</strong><br><span style="color:var(--muted);font-size:12px;">'+M('Restores 60% of one member\'s HP.','Восстанавливает 60% здоровья одному бойцу.')+'</span>';
      b.addEventListener('click',function(){promptChooseHero(M('Heal whom?','Кого исцелить?'),function(h){h.hp=Math.min(h.maxHp,h.hp+Math.round(h.maxHp*0.6));finishRewardNode(pr.node);});});
    }
    box.appendChild(b);
  });
  show('screen-reward');
  renderTopbar();
  $('btn-skip-reward').onclick=function(){finishRewardNode(pr.node);};
  $('btn-view-combat-log').hidden=!LAST_COMBAT_LOG.length;
  $('btn-view-combat-log').onclick=openCombatLogModal;
}

/* ---- modals ---- */
function itemClassHint(item){
  if(!item||!item.classes)return '';
  const names=item.classes.map(function(k){const d=HERO_DEFS[k];return d?L(d.cls):k;});
  return M('Class: ','Класс: ')+names.join(', ');
}
function promptEquip(item,after){
  const wrap=el('div','stack');
  wrap.appendChild(el('h3','',M('Equip '+item.name+'?','Экипировать «'+item.name+'»?')));
  const hint=itemClassHint(item);
  wrap.appendChild(el('div','',"<span style='color:var(--muted);font-size:13px;'>"+slotName(item.slot)+' · '+itemDescText(item)+(hint?' · <span style="color:var(--accent);">'+hint+'</span>':'')+"</span>"));
  RUN.party.forEach(function(h){
    const cur=h.equip[item.slot];
    const usable=heroCanUseItem(h,item);
    const b=el('button','card-choice');
    b.innerHTML='<strong>'+escHtml(h.name)+'</strong> <span class="item-tag" style="color:var(--accent2);">'+escHtml(h.cls)+'</span><br><span style="color:var(--muted);font-size:12px;">'+(usable?(M('current '+slotName(item.slot)+': ','сейчас: ')+(cur?escHtml(cur.name):M('none','нет'))):M("Wrong class for this item","Не подходит этому классу"))+'</span>';
    if(!usable){b.disabled=true;b.style.opacity='0.45';}
    else b.addEventListener('click',function(){applyItemToHero(h,item);closeModal();saveRun();after();});
    wrap.appendChild(b);
  });
  const skip=el('button','',M('Put in backpack','Убрать в рюкзак'));
  skip.addEventListener('click',function(){if(RUN&&RUN.inventory)RUN.inventory.push(item);closeModal();saveRun();after();});
  wrap.appendChild(skip);
  openModal(wrap,{required:true});
}
function promptChooseHero(title,cb){
  const wrap=el('div','stack');
  wrap.appendChild(el('h3','',title));
  RUN.party.forEach(function(h){
    if(!h.alive)return;
    const b=el('button','card-choice');
    b.innerHTML='<strong>'+escHtml(h.name)+'</strong> <span class="item-tag" style="color:var(--accent2);">'+escHtml(h.cls)+'</span> <span style="color:var(--muted);font-size:12px;">'+h.hp+'/'+h.maxHp+' '+statAbbr('hp')+'</span>';
    b.addEventListener('click',function(){closeModal();cb(h);});
    wrap.appendChild(b);
  });
  openModal(wrap,{required:true});
}
function promptEquipFromInventory(item,idx){
  const wrap=el('div','stack');
  wrap.appendChild(el('h3','',M('Equip '+item.name+'?','Экипировать «'+item.name+'»?')));
  const hint=itemClassHint(item);
  wrap.appendChild(el('div','',"<span style='color:var(--muted);font-size:13px;'>"+slotName(item.slot)+' · '+itemDescText(item)+(hint?' · <span style="color:var(--accent);">'+hint+'</span>':'')+"</span>"));
  RUN.party.forEach(function(h){
    const cur=h.equip[item.slot];
    const usable=heroCanUseItem(h,item);
    const b=el('button','card-choice');
    b.innerHTML='<strong>'+escHtml(h.name)+'</strong> <span class="item-tag" style="color:var(--accent2);">'+escHtml(h.cls)+'</span><br><span style="color:var(--muted);font-size:12px;">'+(usable?(M('current '+slotName(item.slot)+': ','сейчас: ')+(cur?escHtml(cur.name):M('none','нет'))):M("Wrong class for this item","Не подходит этому классу"))+'</span>';
    if(!usable){b.disabled=true;b.style.opacity='0.45';}
    else b.addEventListener('click',function(){
      RUN.inventory.splice(idx,1);
      applyItemToHero(h,item);
      saveRun();
      closeModal();
      openFormationModal();
    });
    wrap.appendChild(b);
  });
  const cancel=el('button','',M('Cancel','Отмена'));
  cancel.addEventListener('click',function(){closeModal();openFormationModal();});
  wrap.appendChild(cancel);
  openModal(wrap);
}
function openFormationModal(){
  const wrap=el('div','stack');
  wrap.appendChild(el('h3','',M('Formation & Gear','Строй и снаряжение')));
  wrap.appendChild(el('div','',"<span style='color:var(--muted);font-size:12px;'>"+M('Melee attacks hit the nearest row — the front row if anyone stands there, otherwise the back row. Ranged attacks reach anyone.','Атаки ближнего боя бьют по ближайшему ряду — переднему, если там кто-то есть, иначе по заднему. Дальние атаки достают любого.')+"</span>"));
  /* Party defense summary: everything a player needs to judge the company's overall
     durability at a glance, without opening each hero's card individually. */
  const sumHp=RUN.party.reduce(function(s,h){return s+(h.hp||0);},0);
  const sumMaxHp=RUN.party.reduce(function(s,h){return s+(h.maxHp||0);},0);
  const sumDef=RUN.party.reduce(function(s,h){return s+(h.def||0);},0);
  const sumMdef=RUN.party.reduce(function(s,h){return s+(h.mdef||0);},0);
  const summary=el('div','card',
    "<span style='color:var(--muted);font-size:11px;'>"+M('Company totals','Суммарно по отряду')+"</span><br>"+
    statAbbr('hp')+' '+sumHp+'/'+sumMaxHp+' &middot; '+statAbbr('def')+' '+sumDef+' &middot; '+statAbbr('mdef')+' '+sumMdef);
  summary.style.cssText='padding:8px 10px;margin:6px 0 10px;';
  wrap.appendChild(summary);
  RUN.party.forEach(function(h){
    const row=el('div','row',null);
    const dt=dmgTypeOf(h);
    const info=el('div','',"<strong>"+h.name+"</strong> <span class='item-tag' style='color:var(--accent2);'>"+h.cls+' · '+M('Lv','Ур.')+(h.level||1)+"</span><br><span style='color:var(--muted);font-size:11px;'>"+statAbbr(dt)+' '+(h[dt]||0)+' &middot; '+statAbbr('def')+' '+h.def+' &middot; '+statAbbr('mdef')+' '+(h.mdef||0)+' &middot; '+statAbbr('spd')+' '+h.spd+' &middot; XP '+(h.xp||0)+'/'+xpToNext(h.level||1)+"</span>");
    info.style.flex='1';
    row.appendChild(info);
    const toggle=el('button','',h.row==='front'?M('Front','Перед'):M('Back','Тыл'));
    toggle.addEventListener('click',function(){h.row=h.row==='front'?'back':'front';toggle.textContent=h.row==='front'?M('Front','Перед'):M('Back','Тыл');saveRun();});
    row.appendChild(toggle);
    wrap.appendChild(row);
    const gearRow=el('div','',null);
    gearRow.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 8px;';
    ['weapon','armor','trinket','relic'].forEach(function(slot){
      const item=h.equip[slot];
      const chip=el('div','',null);
      chip.style.cssText='border:1px solid var(--border);border-radius:8px;padding:4px 8px;font-size:11px;display:flex;align-items:center;gap:6px;background:var(--surface2);';
      chip.innerHTML='<span style="color:var(--muted);">'+slotName(slot)+':</span> '+(item?('<strong>'+escHtml(item.name)+'</strong>'):('<span style="color:var(--muted);">'+M('empty','пусто')+'</span>'));
      if(item){
        const un=document.createElement('button');un.textContent='×';un.title=M('Unequip to backpack','Снять в рюкзак');
        un.style.cssText='padding:1px 6px;font-size:11px;margin-left:2px;';
        un.addEventListener('click',function(){unequipFromHero(h,slot);saveRun();closeModal();openFormationModal();});
        chip.appendChild(un);
      }
      gearRow.appendChild(chip);
    });
    wrap.appendChild(gearRow);
  });
  wrap.appendChild(el('div','eyebrow',M('Backpack','Рюкзак')+' · '+M('Shards: ','Осколки: ')+(RUN.shards||0)));
  wrap.appendChild(el('div','',"<span style='color:var(--muted);font-size:11px;'>"+M('Salvage gear you can\'t use for shards — spend them crafting at a shop.','Разбирайте ненужное снаряжение на осколки — тратьте их на крафт в лавке.')+"</span>"));
  const inv=RUN.inventory||[];
  if(!inv.length){
    wrap.appendChild(el('div','',"<span style='color:var(--muted);font-size:12px;'>"+M('Empty. Unequipped and unused items collected during the march end up here.','Пусто. Снятые и неиспользованные вещи, найденные за поход, попадают сюда.')+"</span>"));
  } else {
    inv.forEach(function(item,idx){
      const row=el('div','row',null);
      const hint=itemClassHint(item);
      const info=el('div','',"<strong>"+item.name+"</strong> <span class='item-tag rarity-"+item.rarity+"'>"+rarityLabel(item.rarity)+"</span><br><span style='color:var(--muted);font-size:11px;'>"+slotName(item.slot)+' · '+itemDescText(item)+(hint?' · '+hint:'')+"</span>");
      info.style.flex='1';
      row.appendChild(info);
      const eq=el('button','',M('Equip','Экипировать'));
      eq.addEventListener('click',function(){closeModal();promptEquipFromInventory(item,idx);});
      row.appendChild(eq);
      const y=salvageYield(item);
      const del=el('button','',M('Salvage (+'+y.shards+')','Разобрать (+'+y.shards+')'));
      del.title=M('Breaks the item down for '+y.shards+' shards and '+y.gold+' gold.','Даёт '+y.shards+' осколков и '+y.gold+' золота.');
      del.addEventListener('click',function(){RUN.inventory.splice(idx,1);salvageItem(item);saveRun();closeModal();openFormationModal();});
      row.appendChild(del);
      wrap.appendChild(row);
    });
  }
  const close=el('button','primary',M('Done','Готово'));
  close.addEventListener('click',closeModal);
  wrap.appendChild(close);
  openModal(wrap);
}

/* ============================= RUN END ============================= */

function computeEmbers(win){
  const allNodes = mapAllNodes(RUN.map);
  const cleared = allNodes.filter(function(n){return n.cleared;}).length;
  let embers;
  if(win){
    /* Story Mode (ascension -1) promises "no embers penalty": the ascension
       bonus never goes negative. */
    embers = cleared*2 + Math.max(0,RUN.ascension)*3 + 15;
  }else{
    /* Consolation reward on defeat/retreat: deliberately capped well below
       what a full win pays, so clearing a handful of cheap non-combat nodes
       and bailing out is never a better payout rate than finishing the run. */
    embers = Math.min(cleared,6) + Math.floor(Math.max(0,RUN.ascension)*1.5);
  }
  return Math.max(1,Math.round(embers));
}
function renderAchievementUnlocks(unlocked){
  const box=$('go-achievements');box.innerHTML='';
  if(!unlocked.length)return;
  box.appendChild(el('div','eyebrow',M('Achievements unlocked','Открытые достижения')));
  unlocked.forEach(function(a){
    box.appendChild(el('div','card',
      "<strong>"+L(a.name)+"</strong> <span class='gold-badge'>+"+a.reward+M(' embers',' угольков')+"</span><br><span style='color:var(--muted);font-size:12px;'>"+L(a.desc)+"</span>"
    ));
  });
}
function onVictory(){
  const embers=computeEmbers(true);
  META.embers+=embers;
  META.wins++;
  META.bestLayer=Math.max(META.bestLayer,TOTAL_STEPS);
  META.ascensionUnlocked=Math.max(META.ascensionUnlocked,Math.min(5,RUN.ascension+1));
  recordChallengeResult(true,TOTAL_STEPS);
  const unlocked=evaluateAchievements(true);
  checkHeroUnlocks();
  recordRunHistory(true,embers);
  saveMeta();
  clearRun();
  $('go-banner').textContent=M('The March is Won','Поход завершён победой');
  $('go-banner').className='gameover-banner win';
  $('go-text').textContent=M(
    'The company breaks through the last of the ash and finds open sky. The road behind them is finally quiet.',
    'Отряд пробивается сквозь последний пепел и находит открытое небо. Дорога позади них наконец затихает.'
  );
  $('go-layers').textContent=TOTAL_STEPS+' / '+TOTAL_STEPS;
  $('go-embers').textContent=embers;
  renderAchievementUnlocks(unlocked);
  /* Endless March: offered only right after beating the final boss — the run's party,
     gold and gear are still in memory (clearRun() above only drops the localStorage
     checkpoint), so pressing on just keeps using them for one more scaled fight at a
     time instead of ending the session here. */
  $('btn-go-endless').hidden=false;
  $('btn-go-view-log').hidden=!LAST_COMBAT_LOG.length;
  const fanfare=playMusicCue('victory'); // before show(): the gameover screen keeps the fanfare
  show('screen-gameover');
  if(!fanfare)SFX.victory();
}
/* Starts (or resumes, after a reload) the Endless March: an unbroken chain of
   scaled battle encounters past the final boss, ending only when the company
   falls. See buildEndlessEncounter()/nextEndlessEncounter()/finishRewardNode(). */
function startEndlessMode(){
  if(!RUN||!RUN.party||!RUN.party.length)return;
  RUN.endless=true;
  RUN.endlessDepth=0;
  RUN.combat=null;
  RUN.pendingReward=null;
  saveRun();
  nextEndlessEncounter();
}
function nextEndlessEncounter(){
  const depth=RUN.endlessDepth||0;
  const node={id:'endless-'+depth,type:'battle',layer:TOTAL_MAP_LAYERS+depth,endless:true,endlessDepth:depth,cleared:false,next:[]};
  startCombat(node);
}
function onDefeat(){
  $('btn-go-endless').hidden=true;
  const endlessRun=!!(RUN&&RUN.endless);
  const depth=(RUN&&RUN.endlessDepth)||0;
  const embers=computeEmbers(false)+(endlessRun?depth*3:0);
  META.embers+=embers;
  META.bestLayer=Math.max(META.bestLayer,RUN.layersCleared);
  if(endlessRun){
    META.bestEndlessDepth=Math.max(META.bestEndlessDepth||0,depth);
    recordEndlessDepth(depth);
  }
  recordChallengeResult(false,RUN.layersCleared);
  const unlocked=evaluateAchievements(false);
  checkHeroUnlocks();
  recordRunHistory(false,embers,endlessRun?depth:null);
  saveMeta();
  clearRun();
  if(endlessRun){
    $('go-banner').textContent=M('The Endless March Ends','Бесконечный поход завершён');
    $('go-banner').className='gameover-banner lose';
    $('go-text').textContent=M(
      'The company falls '+depth+' fight'+(depth===1?'':'s')+' beyond the March. Best depth so far: '+(META.bestEndlessDepth||0)+'.',
      'Отряд пал, пройдя '+depth+' боёв сверх похода. Лучшая глубина: '+(META.bestEndlessDepth||0)+'.'
    );
    $('go-layers').textContent=(TOTAL_STEPS+depth)+' / ∞';
  } else {
    $('go-banner').textContent=M('The Company Falls','Отряд погиб');
    $('go-banner').className='gameover-banner lose';
    $('go-text').textContent=M(
      'The ash takes what remains. Somewhere behind, the next company is already being mustered.',
      'Пепел забирает всё, что осталось. Где-то позади уже собирают следующий отряд.'
    );
    /* New-player on-ramp: after a couple of early losses without a single win,
       point at Story Mode (much gentler, same embers) instead of letting them grind asc 0. */
    const losses=(META.history||[]).filter(function(h){return !h.win;}).length;
    if(!META.wins&&losses>=STORY_HINT_AFTER_LOSSES&&(RUN.ascension||0)>=0&&!RUN.daily){
      $('go-text').textContent+=' '+M(
        'Tip: Story Mode (company screen → Ascension “S”) makes enemies '+Math.round(STORY_STAT_STEP*100)+'% weaker and still pays full embers.',
        'Совет: режим истории (экран отряда → Сложность «И») ослабляет врагов на '+Math.round(STORY_STAT_STEP*100)+'% и даёт угольки без штрафа.'
      );
    }
    $('go-layers').textContent=(RUN.layersCleared)+' / '+TOTAL_STEPS;
  }
  $('go-embers').textContent=embers;
  renderAchievementUnlocks(unlocked);
  $('btn-go-view-log').hidden=!LAST_COMBAT_LOG.length;
  show('screen-gameover');
  SFX.defeat();
}
