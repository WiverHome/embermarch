// Embermarch client: Map generation and run state (RUN), levels and perks.
// Classic script: shares the global scope with the other js/*.js files; load order is set in index.html.
"use strict";

/* ============================= MAP GENERATION ============================= */

function clampIdx(i,n){return clamp(i,0,n-1);}

/* The march is TOTAL_MAP_LAYERS node-layers long, plus a boss layer at the end
   (so the topbar/gameover screens show "N / TOTAL_STEPS"). The plan is built
   programmatically instead of hand-listed so the march length can be tuned by
   changing one number rather than rewriting a long array by hand. Elites start
   appearing once tier 2 begins (see tierForLayer below); shops show up on a
   steady cadence; the last few layers before the boss have a chance at a rest
   node mixed in (not a whole rest-only layer) so players can breathe without
   ever making the toughest content unreachable, the way an all-rest final
   layer once did (see the tierForLayer comment). */
const TOTAL_MAP_LAYERS = 19;
const TOTAL_STEPS = TOTAL_MAP_LAYERS+1; // +1 for the boss layer; used in "N / TOTAL_STEPS" displays
/* The march's three acts (see BIOME_ACT_ORDER) split the regular layers into
   thirds. CH1/CH2 are the layer indices forced to a single mandatory "chapter
   boss" node — the Ashfall and Frost acts' own boss, fought mid-march, same
   as the long-standing final boss layer but earlier in the story. Everything
   up to and including CH1 is act 0 (Ashfall); up to and including CH2 is act 1
   (Frost); the rest, including the true final boss layer at TOTAL_MAP_LAYERS
   itself, is act 2 (Verdant) — the hardest, story-closing chapter. */
const CH1=Math.round(TOTAL_MAP_LAYERS/3);
const CH2=Math.round(TOTAL_MAP_LAYERS*2/3);
function actForLayer(li){return li<=CH1?0:(li<=CH2?1:2);}
function biomeKeyForLayer(li){return runRoute()[actForLayer(li)];}
function buildLayerPlan(){
  const plan=[];
  for(let li=0;li<TOTAL_MAP_LAYERS;li++){
    const hasElite=li>=3;
    /* Shops used to only get a chance to appear every 5th layer, with a
       single low-weight pool entry — that made them rare across a whole
       march. Now every 3rd layer gets a real shot at one, weighted twice
       in the pool so it actually shows up most of the time it's eligible. */
    const hasShop=(li+1)%3===0;
    const nearEnd=li>=TOTAL_MAP_LAYERS-4;
    const pool=['battle','battle','event'];
    if(hasElite)pool.push('elite');
    if(hasShop){pool.push('shop');pool.push('shop');}
    if(nearEnd)pool.push('rest');
    const count=(li%3===2)?4:3;
    plan.push({count:count,pool:pool});
  }
  /* Force the two chapter-boss layers to a single mandatory boss node each —
     the same chokepoint pattern the final boss layer already uses, just
     earlier in the march (see CH1/CH2 above). */
  plan[CH1]={count:1,pool:['boss']};
  plan[CH2]={count:1,pool:['boss']};
  return plan;
}
const LAYER_PLAN = buildLayerPlan();

function generateMap(modifiers){
  const eliteVanguard=!!(modifiers&&modifiers.eliteVanguard);
  const layers=[];
  LAYER_PLAN.forEach(function(def,li){
    const nodes=[];
    for(let i=0;i<def.count;i++){
      const type=pick(def.pool);
      nodes.push({id:'L'+li+'N'+i,layer:li,idx:i,type:type,cleared:false,next:[]});
    }
    /* Elite Vanguard modifier: turn a plain battle into an elite fight on layers that
       already allow elites (li>=3, see buildLayerPlan), for noticeably more elite fights. */
    if(eliteVanguard&&li>=3){
      const battleNodes=nodes.filter(function(n){return n.type==='battle';});
      if(battleNodes.length&&Math.random()<0.6)pick(battleNodes).type='elite';
    }
    layers.push(nodes);
  });
  const hasShop=layers.some(function(l){return l.some(function(n){return n.type==='shop';});});
  if(!hasShop){
    const candidates=[];
    layers.forEach(function(l,li){if(li<layers.length-1)l.forEach(function(n){if(n.type!=='rest')candidates.push(n);});});
    if(candidates.length)pick(candidates).type='shop';
  }
  /* Guaranteed trader right before every boss fight — the final one and each
     chapter-boss chokepoint (CH1/CH2) — so a company can always spend its
     gold and gear up before a climax instead of gambling on the random
     layout putting a shop there. */
  [CH1-1,CH2-1,layers.length-1].forEach(function(li){
    const lyr=layers[li];
    if(!lyr||!lyr.length||lyr.some(function(n){return n.type==='shop';}))return;
    const candidates=lyr.filter(function(n){return n.type!=='rest';});
    (candidates.length?pick(candidates):lyr[0]).type='shop';
  });
  const bossNode={id:'BOSS',layer:layers.length,idx:0,type:'boss',cleared:false,next:[]};

  function connect(curNodes,nextNodes){
    curNodes.forEach(function(node,i){
      const nCur=curNodes.length,nNext=nextNodes.length;
      const base=nCur<=1?Math.floor(nNext/2):Math.round(i*(nNext-1)/(nCur-1));
      const targets={};targets[clampIdx(base,nNext)]=true;
      if(Math.random()<0.5)targets[clampIdx(base+(Math.random()<0.5?1:-1),nNext)]=true;
      node.next=Object.keys(targets).map(function(k){return nextNodes[+k].id;});
    });
    nextNodes.forEach(function(n,j){
      const has=curNodes.some(function(c){return c.next.indexOf(n.id)>=0;});
      if(!has){
        const nCur=curNodes.length,nNext=nextNodes.length;
        const base=nNext<=1?Math.floor(nCur/2):Math.round(j*(nCur-1)/(nNext-1));
        curNodes[clampIdx(base,nCur)].next.push(n.id);
      }
    });
  }
  for(let li=0;li<layers.length-1;li++)connect(layers[li],layers[li+1]);
  connect(layers[layers.length-1],[bossNode]);

  return {layers:layers,bossNode:bossNode};
}
function mapAllNodes(map){
  const all=[];
  map.layers.forEach(function(l){l.forEach(function(n){all.push(n);});});
  all.push(map.bossNode);
  return all;
}
function findNode(map,id){
  if(id==='BOSS')return map.bossNode;
  let found=null;
  map.layers.forEach(function(l){l.forEach(function(n){if(n.id===id)found=n;});});
  return found;
}

/* ============================= RUN STATE ============================= */

let RUN=null;
let UID_COUNTER=0;
/* Snapshot of the last finished combat's full log (normal march, async arena, or live
   PvP) — captured right as that combat ends, since RUN.combat (or RUN itself) is often
   cleared/replaced a moment later by the win/loss/match-end flow. Mobile hides the live
   #combat-log during the fight (see the compact-combat media query), so this is how the
   player reviews it afterward, via openCombatLogModal(). */
let LAST_COMBAT_LOG=[];
function snapshotCombatLog(){LAST_COMBAT_LOG=(RUN&&RUN.combat&&RUN.combat.log)?RUN.combat.log.slice():[];}
function openCombatLogModal(){
  const wrap=el('div','stack');
  wrap.appendChild(el('h3','',M('Combat Log','Журнал боя')));
  const box=el('div','');
  box.style.cssText='max-height:60vh;overflow-y:auto;display:flex;flex-direction:column;gap:5px;font-size:13px;line-height:1.5;color:var(--muted);';
  if(!LAST_COMBAT_LOG.length){
    box.appendChild(el('div','',M('No log to show.','Журнал пуст.')));
  } else {
    LAST_COMBAT_LOG.forEach(function(m){box.appendChild(el('div','',m));});
  }
  wrap.appendChild(box);
  const row=el('div','row');row.style.marginTop='12px';
  const close=el('button','primary',M('Close','Закрыть'));
  close.addEventListener('click',closeModal);
  row.appendChild(close);
  wrap.appendChild(row);
  openModal(wrap);
  box.scrollTop=box.scrollHeight;
}
/* Small "view the fight's log" link dropped at the top of the arena/live-PvP hub right
   after a match — that screen has no dedicated reward/gameover section of its own to
   put a button on, so it's inserted ahead of whatever renderArenaBody() just drew. */
function appendViewLogLink(container){
  if(!container||!LAST_COMBAT_LOG.length)return;
  const link=el('button','',M('View combat log','Посмотреть журнал боя'));
  link.style.cssText='font-size:11px;padding:4px 10px;margin-bottom:10px;';
  link.addEventListener('click',openCombatLogModal);
  container.insertBefore(link,container.firstChild);
}
function nextUid(){UID_COUNTER++;return 'u'+UID_COUNTER;}

function makeHeroInstance(key){
  const def=getHeroDef(key);
  const legacy=(META.upgrades.legacy_ember||0)>0;
  const maxHp=def.baseHp+META.upgrades.bones*5+(META.upgrades.vitality_rite||0)*8+(legacy?10:0);
  const vanguard=(META.upgrades.vanguard||0)>0;
  const lethal=(META.upgrades.lethal_calling||0)>0;
  const critBonus=(META.upgrades.keen_edge||0)*0.03+(META.upgrades.deadly_precision||0)*0.05+(lethal?0.08:0);
  /* Permanent-upgrade power bonuses (whetstone/vanguard/legacy) always used to
     be a flat +ATK. Now they add to whichever stat this hero's class actually
     scales from (STR or heavy melee, INT for casters) instead of a stat that
     would otherwise sit unused. */
  const dmgType=HERO_DMG_TYPE[def.tplKey||key]||'str';
  const powBonus=(META.upgrades.whetstone||0)+(vanguard?2:0)+(legacy?2:0);
  return {
    uid:nextUid(),
    key:key,tplKey:def.tplKey||key,name:L(def.name),cls:L(def.cls),icon:def.icon,color:def.color,isHero:true,side:'hero',custom:!!def.custom,
    maxHp:maxHp,hp:maxHp,
    str:def.baseStr+(dmgType==='str'?powBonus:0),
    int:def.baseInt+(dmgType==='int'?powBonus:0),
    def:def.baseDef+(META.upgrades.aegis||0)+(META.upgrades.bulwark||0)*4+(legacy?2:0),
    mdef:(META.upgrades.wardsigils||0)+(META.upgrades.warding_rite||0)*4+(legacy?1:0),
    spd:def.baseSpd+(META.upgrades.boots||0)+(vanguard?2:0)+(legacy?2:0),
    critBonus:critBonus,critMultBonus:lethal?0.15:0,
    row:def.defaultRow,
    abilities:def.abilities.map(function(a){return Object.assign({},a,{name:L(a.name),desc:L(a.desc),cdLeft:0});}),
    equip:{weapon:null,armor:null,trinket:null,relic:null},
    status:[],alive:true,level:1,xp:0,usedPhoenix:false,
  };
}

/* ---- in-run leveling ---- */
const LEVEL_PERKS=[
  {key:'pow',name:{en:'Might',ru:'Мощь'},desc:{en:'+2 to primary damage stat (STR/INT)',ru:'+2 к основной характеристике урона (СИЛА/ИНТ)'},apply:function(h){const dt=dmgTypeOf(h);h[dt]=(h[dt]||0)+2;}},
  {key:'def',name:{en:'Warding',ru:'Стойкость'},desc:{en:'+2 DEF',ru:'+2 к защите'},apply:function(h){h.def+=2;}},
  {key:'mdef',name:{en:'Arcane Warding',ru:'Магическая стойкость'},desc:{en:'+2 MDEF',ru:'+2 к магической защите'},apply:function(h){h.mdef=(h.mdef||0)+2;}},
  {key:'spd',name:{en:'Swiftness',ru:'Проворство'},desc:{en:'+1 SPD',ru:'+1 к скорости'},apply:function(h){h.spd+=1;}},
  {key:'hp',name:{en:'Vitality',ru:'Живучесть'},desc:{en:'+6 Max HP',ru:'+6 к макс. здоровью'},apply:function(h){h.maxHp+=6;h.hp+=6;}},
];
function xpToNext(level){return 18+(level-1)*14;}
function xpForNode(node){
  const tier=tierForLayer(node.layer);
  let base=10+tier*6;
  if(node.type==='elite')base=Math.round(base*1.6);
  return base;
}
function sampleTwoPerks(){
  const a=LEVEL_PERKS.map(function(p){return p.key;});
  const first=a.splice(Math.floor(Math.random()*a.length),1)[0];
  const second=a.splice(Math.floor(Math.random()*a.length),1)[0];
  return [first,second];
}
function normalizeLeveling(h){
  if(typeof h.level!=='number')h.level=1;
  if(typeof h.xp!=='number')h.xp=0;
}
function grantXpToHero(h,gain){
  normalizeLeveling(h);
  RUN.pendingLevelUps=RUN.pendingLevelUps||[];
  h.xp+=gain;
  while(h.xp>=xpToNext(h.level)){
    h.xp-=xpToNext(h.level);
    h.level++;
    RUN.pendingLevelUps.push({heroKey:h.key,heroName:h.name,level:h.level,options:sampleTwoPerks()});
  }
}
function awardXp(node){
  const gain=Math.round(xpForNode(node)*xpGainMult());
  RUN.pendingLevelUps=RUN.pendingLevelUps||[];
  const before=RUN.pendingLevelUps.length;
  RUN.party.forEach(function(h){
    if(!h.alive)return;
    grantXpToHero(h,gain);
  });
  if(RUN.pendingLevelUps.length>before)SFX.levelup();
}
/* Used outside the reward-screen flow (map events): resolves any resulting level-up
   immediately with a random perk instead of queuing a UI choice. Returns levels gained. */
function grantXpAutoResolve(h,gain){
  normalizeLeveling(h);
  h.xp+=gain;
  let leveled=0;
  while(h.xp>=xpToNext(h.level)){
    h.xp-=xpToNext(h.level);
    h.level++;
    leveled++;
    applyLevelPerkByKey(h,pick(sampleTwoPerks()));
  }
  return leveled;
}
function applyLevelPerkByKey(hero,key){
  const perk=LEVEL_PERKS.find(function(p){return p.key===key;});
  if(perk&&hero)perk.apply(hero);
}
function resolvePendingLevelUps(){
  (RUN.pendingLevelUps||[]).forEach(function(pl){
    const h=RUN.party.find(function(x){return x.key===pl.heroKey;});
    if(h)applyLevelPerkByKey(h,pick(pl.options));
  });
  RUN.pendingLevelUps=[];
}
function finishRewardNode(node){
  resolvePendingLevelUps();
  if(node.endless){
    RUN.endlessDepth=(RUN.endlessDepth||0)+1;
    saveRun();
    maybeEndlessWaypoint();
    return;
  }
  completeCurrentNode(node);
  goToMap();
  maybeShowChapterTransition(node);
}
/* Fires right after a chapter boss (CH1/CH2, never the true final boss — see
   onCombatWin()) is cleared and the party lands back on the map, one act
   harsher than before. Purely narrative: no mechanical effect, closes on its
   own button, never blocks anything if dismissed or skipped. */
function maybeShowChapterTransition(node){
  if(!node||node.type!=='boss'||node.layer===TOTAL_MAP_LAYERS)return;
  const route=runRoute();
  const act=actForLayer(node.layer);
  const nextKey=route[act+1];
  const arrival=nextKey&&(CHAPTER_ARRIVAL[nextKey+'_from_'+route[act]]||CHAPTER_ARRIVAL[nextKey]);
  if(!arrival)return;
  const biome=getBiome(nextKey);
  const wrap=el('div','stack');
  wrap.appendChild(el('div','eyebrow',M('The chapter turns','Глава сменяется')));
  wrap.appendChild(el('h3','',L(biome.name)));
  wrap.appendChild(el('div','',"<span style='color:var(--muted);'>"+L(arrival)+"</span>"));
  const close=el('button','primary',M('Onward','Вперёд'));
  close.addEventListener('click',closeModal);
  wrap.appendChild(close);
  openModal(wrap);
}
/* Leaving a shop/rest stop that was entered from the endless chain (see
   maybeEndlessWaypoint()) needs to resume that chain instead of the normal
   completeCurrentNode()+goToMap(), since there is no real map to return to. */
function afterLeaveNode(node){
  completeCurrentNode(node);
  if(node.endless){nextEndlessEncounter();return;}
  goToMap();
}
/* Every 3rd depth past the boss, the Endless March pauses for a shop or a
   rest (alternating) instead of throwing straight into the next fight —
   otherwise it's an unbroken wall of battles with nowhere to spend the gold
   it hands out or patch the company back up. Doesn't touch endlessDepth —
   only a cleared battle advances the counter used for scaling/scoring. */
function maybeEndlessWaypoint(){
  const depth=RUN.endlessDepth||0;
  if(depth>0&&depth%3===0){
    const kind=(Math.floor(depth/3)%2===0)?'shop':'rest';
    const node={id:'endless-waypoint-'+depth,type:kind,layer:TOTAL_MAP_LAYERS+depth,endless:true,endlessDepth:depth,cleared:false,next:[]};
    // Shop stock is now keyed per node id (see startShop) — this node's id is unique
    // per depth, so it always gets its own fresh, correctly-scaled stock already.
    enterNode(node);
    return;
  }
  nextEndlessEncounter();
}
/* Applies (sign=1) or removes (sign=-1) an item's stat mods to/from a hero.
   str/int/def/mdef/spd are explicit keys (weapon/armor items already roll the
   one that matches their archetype). 'atk' is the generic universal-item key
   (trinkets/relics) — it always lands on whichever stat this hero's class
   actually uses (STR or INT), resolved per-wearer rather than baked into the
   item, since the same trinket can be worn by any class. */
function applyModsDelta(hero,mods,sign){
  if(!mods)return;
  ['str','int','def','mdef','spd'].forEach(function(k){if(mods[k])hero[k]=(hero[k]||0)+sign*mods[k];});
  if(mods.atk){const dt=dmgTypeOf(hero);hero[dt]=(hero[dt]||0)+sign*mods.atk;}
}
function applyItemToHero(hero,item){
  const old=hero.equip[item.slot];
  if(old){
    applyModsDelta(hero,old.mods,-1);
    hero.maxHp-=old.mods.hp||0;hero.hp=Math.min(hero.hp,hero.maxHp);
    if(RUN&&RUN.inventory)RUN.inventory.push(old);
  }
  hero.equip[item.slot]=item;
  applyModsDelta(hero,item.mods,1);
  if(item.mods.hp){hero.maxHp+=item.mods.hp;hero.hp+=item.mods.hp;}
  SFX.equip();
}
function unequipFromHero(hero,slot){
  const old=hero.equip[slot];
  if(!old)return;
  applyModsDelta(hero,old.mods,-1);
  hero.maxHp-=old.mods.hp||0;hero.hp=Math.min(hero.hp,hero.maxHp);
  hero.equip[slot]=null;
  if(RUN&&RUN.inventory)RUN.inventory.push(old);
  SFX.equip();
}

function hydrateParty(run){
  if(!run||!run.party)return;
  if(!run.inventory)run.inventory=[];
  if(typeof run.shards!=='number')run.shards=0;
  if(!run.comboCount)run.comboCount=0;
  if(!BIOME_DEFS[run.biome])run.biome='ashfall';
  if(!run.modifiers)run.modifiers={eliteVanguard:false,earlyStorm:false,brokenWard:false};
  run.party.forEach(function(h){
    normalizeLeveling(h);
    if(typeof h.critBonus!=='number')h.critBonus=0;
    if(typeof h.critMultBonus!=='number')h.critMultBonus=0;
    if(h.equip&&h.equip.relic===undefined)h.equip.relic=null;
    /* Migrate an in-progress march saved before the STR/INT split: a hero used
       to carry one flat 'atk' stat. Route its value into whichever of str/int
       this hero's class actually uses, so a resumed march doesn't come back
       with 0 power, and remap any live 'atk' status buffs/debuffs to the
       generic 'pow' key so they keep applying correctly. */
    if(typeof h.str!=='number'&&typeof h.int!=='number'){
      const dt=HERO_DMG_TYPE[h.tplKey||h.key]||'str';
      h.str=dt==='str'?(h.atk||0):0;
      h.int=dt==='int'?(h.atk||0):0;
    }
    if(typeof h.str!=='number')h.str=0;
    if(typeof h.int!=='number')h.int=0;
    if(typeof h.mdef!=='number')h.mdef=0;
    (h.status||[]).forEach(function(s){if(s.stat==='atk')s.stat='pow';});
    const def=getHeroDef(h.key);
    if(!def)return;
    h.cls=L(def.cls);
    const cdMap={};
    (h.abilities||[]).forEach(function(a){cdMap[a.id]=a.cdLeft||0;});
    h.abilities=def.abilities.map(function(a){
      return Object.assign({},a,{name:L(a.name),desc:L(a.desc),cdLeft:cdMap[a.id]||0});
    });
  });
}

function startNewRun(heroKeys,dailySeed){
  /* Belt-and-suspenders: a regular (non-daily) march must always draw from
     real randomness. applyDailySeed() swaps the global Math.random for a
     deterministic seeded one for the duration of a Daily Challenge run, and
     only the run's own victory/defeat/abandon handlers swap it back — if any
     of those were ever skipped (see doLogout()'s restoreRandom() call and
     its comment), a later regular run could silently inherit the stuck,
     deterministic sequence instead of real randomness (shop stock, drops,
     encounters all look "stuck"/repetitive). Restoring here too guarantees a
     normal march never starts already contaminated, regardless of how. */
  if(dailySeed)applyDailySeed(dailySeed);else restoreRandom();
  const startGold=25+META.upgrades.packs*15+(META.upgrades.caravan||0)*20;
  /* Daily Challenge always runs with no modifiers, so every player on a given
     day faces the exact same seeded encounters. The march itself is no
     longer a single chosen biome — every run (Daily included) is the same
     three-act story, Ashfall -> Frost -> Verdant (see BIOME_ACT_ORDER), each
     act harder than the last. */
  const weekly=isWeeklySeed(dailySeed)?weeklySpec(dailySeed):null;
  const modifiers=weekly?weekly.modifiers:(dailySeed?{eliteVanguard:false,earlyStorm:false,brokenWard:false}:Object.assign({},META.modifiers));
  /* Daily/Weekly: the second chapter's land comes from the seed, like everything else. */
  const route=rollRoute(dailySeed?'random':META.routeChoice);
  const bossKeys=route.map(function(bk){return pick(getBiome(bk).bosses);});
  RUN={
    ascension:weekly?weekly.ascension:(dailySeed?0:META.ascensionChoice),
    modifiers:modifiers,
    map:generateMap(modifiers),
    availableNodeIds:null,
    currentNodeId:null,
    party:heroKeys.map(makeHeroInstance),
    gold:startGold,
    layersCleared:0,
    combat:null,
    pendingReward:null,
    pendingItemPickup:null,
    heroDied:false,
    /* One boss species chosen per act, up front, so the story is consistent
       for the whole run — bossKeys[0] is Ashfall's chapter boss (CH1), [1] is
       Frost's (CH2), [2] is Verdant's, the true final boss. bossKey stays as
       an alias to the final one for any old code/save reading it. */
    bossKeys:bossKeys,
    bossKey:bossKeys[bossKeys.length-1],
    route:route,
    bossesBeaten:{},
    daily:dailySeed||null,
    weekly:!!weekly,
    pendingChainEvent:null,
    inventory:[],
    comboCount:0,
    shards:0,
    endless:false,
    endlessDepth:0,
    stats:newRunStats(),
  };
  RUN.availableNodeIds=RUN.map.layers[0].map(function(n){return n.id;});
  if(META.upgrades.favor>0){
    const item=randomItemForHero(RUN.party[0],1,'common');applyItemToHero(RUN.party[0],item);
  }
  /* Old Masters: level 2 from the start. The perk comes from a hash of the hero,
     not Math.random, so Daily/Weekly fights stay identical with or without it. */
  if(META.upgrades.old_masters>0)RUN.party.forEach(function(h){
    normalizeLeveling(h);h.level++;
    const opts=LEVEL_PERKS.map(function(p){return p.key;});
    applyLevelPerkByKey(h,opts[xmur3('old_masters:'+h.key)()%opts.length]);
  });
  /* Daily Challenge: keep the seeded RNG active for the whole march (combat, loot,
     events, encounters), not just the map layout, so two players on the same day
     face the same fights and drops if they play the same choices. The seed is
     re-applied on resume too (see resumeSavedRun), though a mid-run reload still
     restarts the seeded sequence rather than resuming its exact position. */
  saveRun();
  show('screen-map');
  renderTopbar();
  renderMap();
}
