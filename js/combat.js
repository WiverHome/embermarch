// Embermarch client: Combat flow on the client: encounters, turns, enemy AI, win/loss. Pure combat math lives in js/combat-core.js.
// Classic script: shares the global scope with the other js/*.js files; load order is set in index.html.
"use strict";

/* ============================= COMBAT ENGINE ============================= */

/* Tier thresholds are proportional to TOTAL_MAP_LAYERS (currently 19): roughly the
   first sixth is tier 1, the next quarter tier 2, the next third tier 3, and the
   rest — including the final layer — tier 4. Every tier's layer range always has
   real battle/elite nodes in LAYER_PLAN (buildLayerPlan never makes a whole layer
   rest-only), so no tier is ever unreachable the way tier 4 once was. */
function tierForLayer(li){
  /* Early Storm modifier: pull the tier thresholds in so harder enemy pools show up
     sooner in the march, without touching TOTAL_MAP_LAYERS or the boss's position. */
  const storm=RUN&&RUN.modifiers&&RUN.modifiers.earlyStorm;
  const mul=storm?0.78:1;
  const t1=Math.round(TOTAL_MAP_LAYERS*0.16*mul),t2=Math.round(TOTAL_MAP_LAYERS*0.42*mul),t3=Math.round(TOTAL_MAP_LAYERS*0.74*mul);
  return li<t1?1:(li<t2?2:(li<t3?3:4));
}

/* Scales with how far through the WHOLE march a layer is (li / TOTAL_MAP_LAYERS),
   not with the raw layer index. The ramp and def-growth constants (0.315 / 0.14)
   are picked so the boss (li = TOTAL_MAP_LAYERS) ends up at the same difficulty
   the original 7-layer march's boss had. Scaling off the raw index instead —
   as an earlier version of this function did — meant every layer added to
   lengthen the march also added flat extra ramp, so extending the march from
   8 to 20 steps made the MID-game spike far past where the boss itself used to
   land, well before the final layers. Playtesting (scripted full auto-battle
   runs) showed parties dying right at the tier 2→3 jump (layer ~8 of 20) under
   the old per-layer formula; this keeps that same relative difficulty curve,
   just stretched to fit the longer march instead of compounding on top of it. */
/* The +frac^3 terms below are new: a convex "late spike" layered on top of the
   original linear ramp. At low/mid fracs it adds almost nothing (frac^3 is
   tiny), so the early-to-mid march plays the same as before; by the final
   stretch — and especially the boss, frac=1 — it adds a real extra jump on
   top of the old flat ramp. That's the steeper difficulty curve toward the
   end the "нет превозмогания" feedback asked for, without also making the
   early layers (now starved of good loot by the rarity gate) any harder. */
/* Per-ascension enemy scaling. ENEMY_TUNING.ascStep is what the Legacy screen
   promises the player (+17% HP and ATK per level), so that text reads it from
   here instead of a second hardcoded number. 2026-10-08: a steep ladder (was
   12%) plus a harder late march (rampCube, elite/boss extras): fully upgraded
   companies were winning nearly every march at 0-2. Ascension 0 stays the
   approachable base; the challenge is in climbing (balance-sim, auto-battle:
   max upgrades win ~100/59/33/9/1% at Ascension 0/2/3/4/5). */
/* All enemy-strength knobs in one table (tools/balance-sim.js --set tweaks them
   for experiments). ramp*: the HP/ATK curve over the march; def*: the DEF curve;
   ascStep/ascDefStep: per Ascension level; elite/boss: extra HP and ATK on top
   of the curve for those nodes. */
const ENEMY_TUNING={rampLin:0.315,rampCube:0.45,defLin:0.14,defCube:0.10,
  ascStep:0.17,ascDefStep:0.07,eliteHp:1.25,eliteAtk:1.1,bossHp:1.3,bossAtk:1.1,storyRampCube:0.25};
/* Story Mode (ascension -1) has its own, bigger discount: at -12% a brand-new
   account (no upgrades) still won ~1% of marches, so it wasn't a real on-ramp;
   at -25% (and without the late spike, see isStoryMode) it wins ~19% with the
   starter heroes (tools/balance-sim.js, 2026-10-08). */
const STORY_STAT_STEP=0.25;
const STORY_DEF_STEP=0.12;
const STORY_HINT_AFTER_LOSSES=2;
function ascStatMult(){const a=RUN.ascension||0;return a<0?1-STORY_STAT_STEP:1+a*ENEMY_TUNING.ascStep;}
function ascDefMult(){const a=RUN.ascension||0;return a<0?1-STORY_DEF_STEP:1+a*ENEMY_TUNING.ascDefStep;}
function scaleAtFrac(frac){
  const T=ENEMY_TUNING;
  const asc=ascStatMult();
  const ramp=1+frac*T.rampLin+Math.pow(frac,3)*(isStoryMode()?T.storyRampCube:T.rampCube);
  return {atk:asc*ramp,hp:asc*ramp,def:ascDefMult()+frac*T.defLin+Math.pow(frac,3)*T.defCube};
}
function enemyScale(li){
  const storm=RUN.modifiers&&RUN.modifiers.earlyStorm;
  return scaleAtFrac(Math.max(0,Math.min(1,(li||0)/TOTAL_MAP_LAYERS*(storm?1.18:1))));
}
/* Same curve as enemyScale(), but without the frac<=1 clamp — used only past the
   final boss, in the Endless March (see buildEndlessEncounter()), where li keeps
   growing past TOTAL_MAP_LAYERS on purpose so the fights keep getting harder
   instead of plateauing at boss-tier forever. */
/* Elite/boss extras grow with the march (quadratically: little mid-march, full
   at the final boss), so they press strong late-game companies without walling new accounts,
   which rarely get past the first chapter. */
function lateBonus(mult,li){const f=Math.max(0,Math.min(1,(li||0)/TOTAL_MAP_LAYERS));return isStoryMode()?1:1+(mult-1)*f*f;}
/* Story Mode is the on-ramp for new accounts: it keeps the old gentle late curve
   (storyRampCube) and skips the elite/boss extras. */
function isStoryMode(){return !!RUN&&(RUN.ascension||0)<0;}
function enemyScaleEndless(li){
  return scaleAtFrac(Math.max(0,(li||0)/TOTAL_MAP_LAYERS));
}
/* Enemies don't get a full STR/INT split (that's a player-class thing per the
   request) — but they do get a magic-defense split, cheaply, by deriving MDEF
   from the same base DEF number rather than hand-tuning every monster:
   res:'magic' (casters/curse-users — shaman, caster, banshee, zealot,
   frostwitch, wailingblizzard, vessel, rimesovereign) are tougher to hit with
   INT-based damage but a little softer to STR; res:'phys' (armored brutes —
   revenant, wraith, hand, knight, ashlord, glacier line, colossus, warden)
   are the opposite: their armor stops blades, not spells. Untagged enemies
   (skirmishers/archers) have MDEF == DEF, no bias either way. */
function enemyDefSplit(d,s){
  const physMult=d.res==='magic'?0.85:1;
  const magicMult=d.res==='magic'?1.35:(d.res==='phys'?0.6:1);
  return {def:Math.round(d.def*s.def*physMult),mdef:Math.round(d.def*s.def*magicMult)};
}
function makeEnemyInstance(defKey,li,uncapped){
  const d=ENEMY_DEFS[defKey];
  const s=uncapped?enemyScaleEndless(li):enemyScale(li);
  const ds=enemyDefSplit(d,s);
  return {
    uid:nextUid(),
    key:defKey,name:L(d.name),icon:d.icon,color:d.color,isHero:false,side:'enemy',res:d.res||null,
    maxHp:Math.round(d.hp*s.hp*(d.elite?lateBonus(ENEMY_TUNING.eliteHp,li):1)),hp:Math.round(d.hp*s.hp*(d.elite?lateBonus(ENEMY_TUNING.eliteHp,li):1)),
    atk:Math.round(d.atk*s.atk*(d.elite?lateBonus(ENEMY_TUNING.eliteAtk,li):1)),def:ds.def,mdef:ds.mdef,spd:d.spd,row:d.row,elite:!!d.elite,
    abilities:d.abilities.map(function(a){return Object.assign({},a,{name:L(a.name),cdLeft:0});}),
    status:[],alive:true,enraged:false,
  };
}
function makeBossInstance(node){
  /* One of three boss fights a march now has — this act's chapter boss (at
     CH1/CH2, mid-march) or the true final boss (layer===TOTAL_MAP_LAYERS).
     Scale and species both key off this specific node's layer/act, not the
     march's overall end, so a chapter boss is a real climax for where it
     sits in the story without being end-game strength this early. */
  const li=node?node.layer:TOTAL_MAP_LAYERS;
  const s=enemyScale(li);
  const act=actForLayer(li);
  const bossKey=(RUN.bossKeys&&RUN.bossKeys[act])||RUN.bossKey||'warden';
  const BOSS_DEF=BOSS_DEFS[bossKey]||BOSS_DEFS.warden;
  const ds=enemyDefSplit(BOSS_DEF,s);
  return {
    uid:nextUid(),
    key:'boss',bossKey:bossKey,name:L(BOSS_DEF.name),icon:BOSS_DEF.icon,color:BOSS_DEF.color,isHero:false,side:'enemy',res:BOSS_DEF.res||null,
    maxHp:Math.round(BOSS_DEF.hp*s.hp*lateBonus(ENEMY_TUNING.bossHp,li)),hp:Math.round(BOSS_DEF.hp*s.hp*lateBonus(ENEMY_TUNING.bossHp,li)),
    atk:Math.round(BOSS_DEF.atk*s.atk*lateBonus(ENEMY_TUNING.bossAtk,li)),def:ds.def,mdef:ds.mdef,spd:BOSS_DEF.spd,row:'front',boss:true,
    abilities:BOSS_DEF.abilities.map(function(a){return Object.assign({},a,{name:L(a.name),cdLeft:0});}),
    status:[],alive:true,enraged:false,
  };
}
function disambiguateNames(list){
  const counts={};
  list.forEach(function(u){counts[u.name]=(counts[u.name]||0)+1;});
  const seen={};
  const roman=['I','II','III','IV','V'];
  list.forEach(function(u){
    if(counts[u.name]>1){
      seen[u.name]=(seen[u.name]||0)+1;
      u.name=u.name+' '+(roman[seen[u.name]-1]||seen[u.name]);
    }
  });
  return list;
}
/* Endless March encounters: always tier-4 pressure, growing steadily past the
   boss via enemyScaleEndless(). Every 4th depth throws an elite (with its usual
   minions) instead of a plain skirmish, so the climb still has rhythm to it. */
function buildEndlessEncounter(depth){
  const li=TOTAL_MAP_LAYERS+depth;
  /* Endless March runs past the true final boss, so it stays in the story's
     last (hardest) act forever rather than cycling back through earlier,
     easier biomes. */
  const route=runRoute();
  const biome=getBiome(route[route.length-1]);
  const pool=biome.pools[4];
  if(depth>0&&depth%4===0){
    const list=[makeEnemyInstance(biome.eliteKeys[4],li,true)];
    const minions=biome.eliteMinions[4];
    if(Math.random()<0.85)list.push(makeEnemyInstance(pick(minions),li,true));
    if(Math.random()<0.4)list.push(makeEnemyInstance(pick(minions),li,true));
    return disambiguateNames(list);
  }
  const count=randInt(2,3)+(Math.random()<0.4?1:0);
  const list=[];
  for(let i=0;i<count;i++)list.push(makeEnemyInstance(pick(pool),li,true));
  return disambiguateNames(list);
}
function buildEncounter(node){
  const li=node.layer;
  if(node.endless)return buildEndlessEncounter(node.endlessDepth||0);
  const tier=tierForLayer(li);
  if(node.type==='boss')return disambiguateNames([makeBossInstance(node)]);
  const biome=getBiome(biomeKeyForLayer(li));
  if(node.type==='elite'){
    const eliteKey=biome.eliteKeys[tier];
    const minions=biome.eliteMinions[tier];
    const list=[makeEnemyInstance(eliteKey,li)];
    const minionChance=tier>=4?0.9:(tier===3?0.8:0.7);
    if(Math.random()<minionChance)list.push(makeEnemyInstance(pick(minions),li));
    if(tier>=4&&Math.random()<0.35)list.push(makeEnemyInstance(pick(minions),li));
    return disambiguateNames(list);
  }
  const pool=biome.pools[tier];
  const count=randInt(2,3)+(tier>=3&&Math.random()<0.35?1:0);
  const list=[];
  for(let i=0;i<count;i++)list.push(makeEnemyInstance(pick(pool),li));
  return disambiguateNames(list);
}

/* The combat math (damage, crits, combos, relic hooks, statuses, turn order)
   lives in js/combat-core.js and is the same file the server runs for live PvP.
   These wrappers bind it to the client: M() texts, SFX, and the RUN state. */
const COMBAT_CORE=EmberCombatCore.create({
  tr:M,
  sfx:function(name,dmgType){SFX[name==='hit'&&dmgType==='int'?'hit_magic':name]();},
  heroDown:function(){RUN.heroDied=true;},
  brokenWard:function(){return !!(RUN&&RUN.modifiers&&RUN.modifiers.brokenWard);},
});
const COMBAT_STATE={
  get party(){return RUN.combat.party;},
  get enemies(){return RUN.combat.enemies;},
  get comboCount(){return RUN.comboCount;},
  set comboCount(v){RUN.comboCount=v;},
};
function hasRelic(unit,passive){return COMBAT_CORE.hasRelic(unit,passive);}
function dmgCalc(actor,target,mult){return COMBAT_CORE.dmgCalc(actor,target,mult);}
function frontAlive(list){return COMBAT_CORE.frontAlive(list);}
function backAlive(list){return COMBAT_CORE.backAlive(list);}
function anyAlive(list){return COMBAT_CORE.anyAlive(list);}
/* "Nearest row": the front row if anyone's alive there, otherwise the back row acts as the front line. */
function nearestRowAlive(list){return COMBAT_CORE.nearestRowAlive(list);}
function getValidTargets(ability,caster){return COMBAT_CORE.getValidTargets(COMBAT_STATE,ability,caster);}
function targetsForRow(ability,caster){return COMBAT_CORE.targetsForRow(COMBAT_STATE,ability,caster);}
function abilityHasTargets(ability,caster){return COMBAT_CORE.abilityHasTargets(COMBAT_STATE,ability,caster);}
function applyAbilityEffect(caster,ability,target){return COMBAT_CORE.applyAbilityEffect(COMBAT_STATE,caster,ability,target);}
function tickStatus(unit){return COMBAT_CORE.tickStatus(unit,RUN&&RUN.combat?COMBAT_STATE:null);}
function buildTurnOrder(){return COMBAT_CORE.buildTurnOrder(COMBAT_STATE);}

function startCombat(node){
  RUN.combat={
    node:node,
    enemies:buildEncounter(node),
    party:RUN.party,
    queue:[],
    qi:0,
    round:1,
    log:[],
    selectedAbility:null,
    targetingUnit:null,
    over:false,
    autoBattle:false,
  };
  recordBestiary(RUN.combat.enemies);
  RUN.party.forEach(function(h){h.abilities.forEach(function(a){a.cdLeft=0;});h.status=[];});
  applyPartySynergies();
  logCombat(M(
    'The company braces as '+RUN.combat.enemies.map(function(e){return e.name;}).join(', ')+' close in.',
    'Отряд готовится к бою: приближаются '+RUN.combat.enemies.map(function(e){return e.name;}).join(', ')+'.'
  ));
  show('screen-combat');
  if(node.type==='boss'||node.type==='elite')SFX.roar();
  renderTopbar();
  newRound();
  maybeShowTutorial('combat',showCombatTutorial);
}
/* Fight-long synergy buffs (see PARTY_SYNERGIES). Duration 99 outlasts any
   fight; startCombat() clears status first, so they never stack. */
function applyPartySynergies(){
  /* Only living heroes form a synergy; tplKey covers custom heroes. */
  const keys=RUN.party.filter(function(h){return h.alive;}).map(function(h){return h.tplKey||h.key;});
  activeSynergies(keys).forEach(function(s){
    RUN.party.forEach(function(h){
      if(!h.alive)return;
      if(s.who==='members'&&s.heroes.indexOf(h.tplKey||h.key)<0)return;
      h.status.push({type:'buff',stat:s.stat,amount:s.amount,duration:99,label:statAbbr(s.stat),synergy:s.id});
    });
    RUN.combat.log.push(M('Synergy — '+L(s.name)+': '+L(s.desc).replace(/^[^:]*:\s*/,''),'Синергия — '+L(s.name)+': '+L(s.desc).replace(/^[^:]*:\s*/,'')));
  });
}
function logCombat(msg){RUN.combat.log.push(msg);renderCombatLog();}
/* Resume a battle that was left mid-fight (page reload / closed browser). Every combat
   checkpoint saves RUN.combat.phase alongside the state it describes, so we just re-enter
   at that exact phase instead of restarting the encounter. */
function resumeCombat(){
  if(!RUN.combat)return;
  renderCombat();
  const phase=RUN.combat.phase;
  const unit=RUN.combat.activeUnit;
  if(phase==='hero_choose'||phase==='hero_target'){
    renderActionPanel();
    if(phase==='hero_choose'&&RUN.combat.autoBattle&&unit)setTimeout(function(){autoActHero(unit);},500);
  } else if(phase==='enemy_turn'&&unit&&unit.alive){
    renderActionPanel();
    setTimeout(function(){enemyAct(unit);},550);
  } else {
    advanceTurn();
  }
}

function newRound(){
  RUN.combat.queue=buildTurnOrder();
  RUN.combat.qi=0;
  advanceTurn();
}
function checkCombatEnd(){
  if(RUN.combat.over)return true;
  const heroesAlive=anyAlive(RUN.combat.party).length>0;
  const enemiesAlive=anyAlive(RUN.combat.enemies).length>0;
  /* Loss is checked first: a mutual wipe (thorns/reflect/DoT finishing both
     sides on one action) used to count as a win, handing rewards to a dead
     company that then lost the next fight on its first tick. */
  if(!heroesAlive){RUN.combat.over=true;onCombatLoss();return true;}
  if(!enemiesAlive){RUN.combat.over=true;onCombatWin();return true;}
  return false;
}
function advanceTurn(){
  if(checkCombatEnd())return;
  if(RUN.combat.qi>=RUN.combat.queue.length){RUN.combat.round++;newRound();return;}
  const unit=RUN.combat.queue[RUN.combat.qi];
  if(!unit.alive){RUN.combat.qi++;RUN.combat.phase='advance';advanceTurn();return;}
  const dl=tickStatus(unit);
  dl.forEach(logCombat);
  if(checkCombatEnd())return;
  if(!unit.alive){RUN.combat.qi++;RUN.combat.phase='advance';advanceTurn();return;}
  unit.abilities.forEach(function(a){if(a.cdLeft>0)a.cdLeft--;});
  if(unit.boss&&!unit.enraged&&unit.hp<=unit.maxHp*0.5){
    unit.enraged=true;unit.atk=Math.round(unit.atk*1.3);
    logCombat(M(unit.name+' enters a hollow rage!',unit.name+' впадает в бездушную ярость!'));
  }
  if(unit.elite&&!unit.enraged&&unit.hp<=unit.maxHp*0.5){
    unit.enraged=true;unit.atk=Math.round(unit.atk*1.25);
    logCombat(M(unit.name+' finds a second wind!',unit.name+' обретает второе дыхание!'));
  }
  if(unit.status.some(function(s){return s.type==='stun';})){
    logCombat(M(unit.name+' is stunned and cannot act.',unit.name+' оглушён и не может действовать.'));
    RUN.combat.qi++;RUN.combat.phase='advance';advanceTurn();return;
  }
  RUN.combat.activeUnit=unit;
  if(unit.side==='hero'){
    RUN.combat.activeHero=unit;
    RUN.combat.phase='hero_choose';
    renderCombat();
    renderActionPanel();
    if(RUN.combat.autoBattle)setTimeout(function(){autoActHero(unit);},500);
  } else {
    RUN.combat.activeHero=null;
    RUN.combat.phase='enemy_turn';
    RUN.combat.enemyIntent=buildEnemyIntent(unit);
    renderCombat();
    renderActionPanel();
    setTimeout(function(){enemyAct(unit);},550);
  }
}
function buildEnemyIntent(unit){
  const usable=unit.abilities.filter(function(a){return a.cdLeft<=0 && (!a.requiresEnrage||unit.enraged) && abilityHasTargets(a,unit);});
  if(!usable.length)return null;
  const healAbility=usable.find(function(a){return a.type==='heal';});
  const allyList=anyAlive(RUN.combat.enemies);
  const hurtAllies=allyList.filter(function(a){return a.hp/a.maxHp<0.55;});
  let ability;
  if(healAbility&&hurtAllies.length&&Math.random()<0.85){
    ability=healAbility;
  } else {
    const dmgAbilities=usable.filter(function(a){return a.type==='damage';});
    const utilAbilities=usable.filter(function(a){return a.type!=='damage'&&a.type!=='heal';});
    if(dmgAbilities.length){
      if(utilAbilities.length&&Math.random()<0.18){
        ability=pick(utilAbilities);
      } else {
        dmgAbilities.sort(function(a,b){return (b.mult||0)-(a.mult||0);});
        ability = Math.random()<0.72 ? dmgAbilities[0] : pick(dmgAbilities);
      }
    } else {
      ability=usable[0];
    }
  }
  let target=null;
  if(ability.type==='heal'){
    target=hurtAllies.slice().sort(function(a,b){return (a.hp/a.maxHp)-(b.hp/b.maxHp);})[0]||allyList[0];
  } else if(ability.targets==='single-ally'){
    const valid=getValidTargets(ability,unit);
    target=valid.length?pick(valid):null;
  } else if(ability.targets==='single'){
    const valid=getValidTargets(ability,unit);
    if(valid.length){
      const execTarget=valid.find(function(t){return t.hp/t.maxHp<0.3;});
      if(execTarget){
        target=execTarget;
      } else {
        const healerTargets=valid.filter(function(t){return t.isHero&&t.abilities&&t.abilities.some(function(a){return a.type==='heal'&&a.cdLeft<=0;});});
        if(healerTargets.length&&Math.random()<0.45){
          target=pick(healerTargets);
        } else {
          target=valid.slice().sort(function(a,b){return (a.hp/a.maxHp)-(b.hp/b.maxHp);})[0];
        }
      }
    }
  }
  const enemyIdx=RUN.combat.enemies.indexOf(unit);
  let targetSide=null,targetIdx=-1;
  if(target){
    const pIdx=RUN.combat.party.indexOf(target);
    if(pIdx>=0){targetSide='party';targetIdx=pIdx;}
    else{targetSide='enemies';targetIdx=RUN.combat.enemies.indexOf(target);}
  }
  return {enemyIdx:enemyIdx,abilityId:ability.id,abilityName:ability.name,abilityType:ability.type,targetSide:targetSide,targetIdx:targetIdx};
}
function enemyAct(unit){
  if(!unit.alive){RUN.combat.qi++;RUN.combat.phase='advance';RUN.combat.enemyIntent=null;renderCombat();setTimeout(advanceTurn,50);return;}
  const intent=RUN.combat.enemyIntent;
  const ability=intent?unit.abilities.find(function(a){return a.id===intent.abilityId;}):null;
  if(!intent||!ability){
    logCombat(M(unit.name+' finds no target and holds.',unit.name+' не находит цель и медлит.'));
    RUN.combat.qi++;
    RUN.combat.activeUnit=null;
    RUN.combat.enemyIntent=null;
    RUN.combat.phase='advance';
    renderCombat();
    setTimeout(advanceTurn,350);
    return;
  }
  const target = intent.targetSide==='party'?RUN.combat.party[intent.targetIdx]:(intent.targetSide==='enemies'?RUN.combat.enemies[intent.targetIdx]:null);
  ability.cdLeft=ability.cd;
  const logs=applyAbilityEffect(unit,ability,target);
  logs.forEach(logCombat);
  RUN.combat.qi++;
  RUN.combat.activeUnit=null;
  RUN.combat.enemyIntent=null;
  RUN.combat.phase='advance';
  renderCombat();
  playCombatFx(logs.fx);
  setTimeout(advanceTurn,450);
}

function autoChooseForHero(unit){
  const usableAbilities=unit.abilities.filter(function(a){return a.cdLeft<=0&&(!a.minLevel||(unit.level||1)>=a.minLevel)&&abilityHasTargets(a,unit);});
  const healAbility=usableAbilities.find(function(a){return a.type==='heal';});
  if(healAbility){
    const allies=anyAlive(RUN.combat.party);
    const hurt=allies.filter(function(a){return a.hp/a.maxHp<0.6;});
    if(hurt.length){
      const target=healAbility.targets==='all-ally'?null:hurt.sort(function(a,b){return (a.hp/a.maxHp)-(b.hp/b.maxHp);})[0];
      return {ability:healAbility,target:target};
    }
  }
  const dmgAbilities=usableAbilities.filter(function(a){return a.type==='damage';});
  if(!dmgAbilities.length)return null;
  dmgAbilities.sort(function(a,b){return (b.mult||0)-(a.mult||0);});
  const ability=dmgAbilities[0];
  let target=null;
  if(ability.targets==='single'){
    const valid=getValidTargets(ability,unit);
    target=valid.sort(function(a,b){return a.hp-b.hp;})[0];
  }
  return {ability:ability,target:target};
}
function autoActHero(unit){
  if(!RUN.combat||!RUN.combat.autoBattle||RUN.combat.activeHero!==unit||!unit.alive)return;
  const decision=autoChooseForHero(unit);
  if(!decision){
    logCombat(M(unit.name+' finds no target and holds.',unit.name+' не находит цель и медлит.'));
    RUN.combat.activeHero=null;
    RUN.combat.activeUnit=null;
    RUN.combat.qi++;
    RUN.combat.phase='advance';
    renderCombat();
    setTimeout(advanceTurn,300);
    return;
  }
  resolveHeroAbility(decision.ability,decision.target);
}
function heroChooseAbility(ability){
  /* Guards against a stray click landing after this hero's turn already
     resolved (see the note in resolveHeroAbility) — without this,
     RUN.combat.activeHero.level below would itself throw on null. */
  if(!RUN.combat||!RUN.combat.activeHero||RUN.combat.phase!=='hero_choose')return;
  if(ability.cdLeft>0)return;
  if(ability.minLevel&&(RUN.combat.activeHero.level||1)<ability.minLevel)return;
  if(!abilityHasTargets(ability,RUN.combat.activeHero))return;
  RUN.combat.selectedAbility=ability;
  const needsTarget = ability.targets==='single'||ability.targets==='single-ally';
  if(!needsTarget){
    resolveHeroAbility(ability,null);
    return;
  }
  RUN.combat.phase='hero_target';
  renderActionPanel();
  renderCombat();
}
function resolveHeroAbility(ability,target){
  if(RUN.combat.isLivePvp){liveResolveHeroAbility(ability,target);return;}
  const unit=RUN.combat.activeHero;
  ability.cdLeft=ability.cd;
  const logs=applyAbilityEffect(unit,ability,target);
  logs.forEach(logCombat);
  RUN.combat.selectedAbility=null;
  RUN.combat.activeHero=null;
  RUN.combat.activeUnit=null;
  RUN.combat.qi++;
  RUN.combat.phase='advance';
  renderCombat();
  /* The old ability-bar buttons stay in the DOM (and clickable) until
     advanceTurn()'s next renderActionPanel() call, 250-450ms later. A fast
     double-click (or an automated bot) landing in that window re-enters
     heroChooseAbility() with RUN.combat.activeHero already null, crashing
     on caster.side inside abilityHasTargets()/getValidTargets(). Clearing
     the panel immediately closes that window. */
  renderActionPanel();
  playCombatFx(logs.fx);
  setTimeout(advanceTurn,250);
}
function heroChooseTarget(target){
  if(!RUN.combat.selectedAbility)return;
  resolveHeroAbility(RUN.combat.selectedAbility,target);
}

function onCombatWin(){
  statsOnCombatWin();
  logCombat(M('The foes are defeated.','Враги повержены.'));
  snapshotCombatLog();
  RUN.layersCleared=Math.max(RUN.layersCleared,RUN.combat.node.layer+1);
  const node=RUN.combat.node;
  if(node.type==='boss'){
    /* Record which boss species just fell (chapter or final) so achievements
       keyed to a specific boss (see evaluateAchievements) can check "did I
       beat this one this run" instead of "was this the run's final boss" —
       with three boss fights now, only the Verdant one is ever the latter. */
    const beaten=RUN.combat.enemies&&RUN.combat.enemies[0]&&RUN.combat.enemies[0].bossKey;
    if(beaten){RUN.bossesBeaten=RUN.bossesBeaten||{};RUN.bossesBeaten[beaten]=true;}
    /* Only the TRUE final boss (the layer after every regular layer, i.e.
       the old-style standalone bossNode) ends the march. A chapter boss at
       CH1/CH2 is a climax, not the end — fall through to the normal
       reward-and-continue flow so the story moves into the next act. */
    if(node.layer===TOTAL_MAP_LAYERS){
      saveRun();
      setTimeout(function(){onVictory();},700);
      return;
    }
    logCombat(M('The chapter is won. The road presses on into harsher land.','Глава пройдена. Путь ведёт дальше, в более суровые земли.'));
  }
  if(afterBattleRecovery())snapshotCombatLog();
  let baseGold=14+node.layer*5+randInt(0,10);
  if(RUN.modifiers&&RUN.modifiers.brokenWard)baseGold=Math.round(baseGold*1.2);
  RUN.gold+=baseGold;
  const cards=buildRewardCards(node.layer);
  RUN.pendingReward={gold:baseGold,cards:cards,node:node};
  awardXp(node);
  saveRun();
  setTimeout(function(){SFX.chest();renderRewardScreen();},700);
}
/* Field Medicine branch (see UPGRADE_DEFS): a little healing after every win,
   and once per march the capstone brings one fallen hero back. */
function afterBattleRecovery(){
  const frac=postBattleHealFrac();
  if(frac>0)RUN.party.forEach(function(h){if(h.alive)h.hp=Math.min(h.maxHp,h.hp+Math.max(1,Math.round(h.maxHp*frac)));});
  if(META.upgrades.second_wind>0&&!RUN.secondWindUsed){
    const fallen=RUN.party.find(function(h){return !h.alive;});
    if(fallen){
      RUN.secondWindUsed=true;
      fallen.alive=true;fallen.status=[];
      fallen.hp=Math.max(1,Math.round(fallen.maxHp*UPGRADE_TUNING.secondWindHp));
      logCombat(M(fallen.name+' gets back up — second wind!',fallen.name+' поднимается на ноги — второе дыхание!'));
      return true;
    }
  }
  return false;
}
function onCombatLoss(){
  statsOnCombatLoss();
  logCombat(M('The company has fallen.','Отряд пал.'));
  snapshotCombatLog();
  saveRun();
  setTimeout(function(){onDefeat();},900);
}
