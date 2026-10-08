// Embermarch combat core: the one copy of the combat math, shared by the
// browser client (loaded as a classic <script>, exposes EmberCombatCore) and
// the game server (require()d by server/combat-engine.js for live PvP).
// Damage formula, crits, combo marks, relic hooks, status ticks and turn
// order all live here, so client and server cannot drift apart.
//
// Everything that differs between the two sides comes in through create(env):
//   env.tr(en, ru)   text for logs/labels. Client: M (a string in the current
//                    language). Server: a {en, ru} pair rendered by the viewer.
//   env.sfx(name, dmgType)  sound hook ('hit', 'crit', 'heal', 'buff', 'death';
//                    'hit' also gets the caster's damage type); optional.
//   env.heroDown()   a hero fell (the client marks the run); optional.
//   env.brokenWard() Broken Ward march modifier active (heroes take +15%); optional.
// Combat state is passed per call: { party, enemies, comboCount }.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EmberCombatCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';

const HERO_DMG_TYPE = {bram:'str',sael:'str',kest:'str',doran:'str',torvin:'str',ashra:'int',morwen:'int',yvana:'int'};

/* Relic passive numbers (descriptions live with the relics in js/data.js). */
const RELIC_TUNING={
  executioner:{below:0.3,mult:1.3},
  ember_brand:{chance:0.3,amount:3,duration:2},
  mender:{mult:1.25},
  cinderproof:{mult:0.5},
  reaper:{healPct:0.12},
};

function statOf(c,key){
  let v=c[key]||0;
  c.status.forEach(function(s){if(s.stat===key)v+=s.amount;});
  return Math.max(0,v);
}
/* Which offensive stat a unit's damage comes from: a hero's STR or INT
   (see HERO_DMG_TYPE), or a flat 'atk' for enemies/bosses (no split there —
   see the changelog for why). A 'pow' status effect (company-wide buffs like
   Rally Cry, or enemy buffs like Blood Rite) always applies on top, whichever
   stat it actually is for that unit. */
function dmgTypeOf(unit){
  if(unit&&unit.isHero)return HERO_DMG_TYPE[unit.tplKey||unit.key]||'str';
  return 'atk';
}
function powerOf(unit){
  const dt=dmgTypeOf(unit);
  let v=unit[dt]||0;
  unit.status.forEach(function(s){if(s.stat===dt||s.stat==='pow')v+=s.amount;});
  return Math.max(0,v);
}
/* Mitigation: STR/physical damage is reduced by DEF, INT/magic damage by MDEF.
   Enemies attacking (dt 'atk') mitigate the same way a physical hit always
   did — against the target's DEF — since enemies don't have a magic attack
   split of their own. */
function mitigationKeyFor(attackerDmgType){return attackerDmgType==='int'?'mdef':'def';}
function defenseOf(unit,key){
  let v=unit[key]||0;
  unit.status.forEach(function(s){if(s.stat===key)v+=s.amount;});
  return Math.max(0,v);
}

function create(env){
  env=env||{};
  const tr=env.tr;
  const sfx=env.sfx||function(){};
  const heroDown=env.heroDown||function(){};
  const brokenWard=env.brokenWard||function(){return false;};

  function statAbbr(key){
    return {atk:tr('ATK','АТК'),str:tr('STR','СИЛ'),int:tr('INT','ИНТ'),pow:tr('POW','МОЩЬ'),def:tr('DEF','ЗАЩ'),mdef:tr('MDEF','МЗАЩ'),spd:tr('SPD','СКР'),hp:tr('HP','ЗДР')}[key]||tr(String(key).toUpperCase(),String(key).toUpperCase());
  }

  function hasRelic(unit,passive){
    return !!(unit&&unit.isHero&&unit.equip&&unit.equip.relic&&unit.equip.relic.passive===passive);
  }
  function dmgCalc(actor,target,mult){
    const dt=dmgTypeOf(actor);
    const atk=powerOf(actor);
    let def=defenseOf(target,mitigationKeyFor(dt));
    if(hasRelic(target,'last_stand')&&target.hp/target.maxHp<0.25)def=Math.round(def*1.3);
    let base=Math.max(1,Math.round(atk*mult - def*0.5));
    base=Math.round(base*(0.88+Math.random()*0.24));
    if(hasRelic(actor,'executioner')&&target.hp/target.maxHp<RELIC_TUNING.executioner.below)base=Math.round(base*RELIC_TUNING.executioner.mult);
    /* Broken Ward modifier: heroes take 15% extra damage (paid off by its gold bonus in onCombatWin). */
    if(target.isHero&&brokenWard())base=Math.round(base*1.15);
    let crit=false;
    let critChance=0.12+(hasRelic(actor,'crit_boost')?0.15:0)+(actor.critBonus||0);
    if(Math.random()<critChance){base=Math.round(base*(1.5+(actor.critMultBonus||0)));crit=true;}
    return {amount:Math.max(1,base),crit:crit};
  }
  function frontAlive(list){return list.filter(function(c){return c.alive&&c.row==='front';});}
  function backAlive(list){return list.filter(function(c){return c.alive&&c.row==='back';});}
  function anyAlive(list){return list.filter(function(c){return c.alive;});}
  /* "Nearest row": the front row if anyone's alive there, otherwise the back row acts as the front line. */
  function nearestRowAlive(list){
    const f=frontAlive(list);
    return f.length?f:backAlive(list);
  }

  function getValidTargets(state,ability,caster){
    const enemySide=caster.side==='hero'?state.enemies:state.party;
    const allySide=caster.side==='hero'?state.party:state.enemies;
    if(ability.targets==='single-ally'||ability.targets==='all-ally')return anyAlive(allySide);
    if(ability.targets==='self')return [caster];
    if(ability.reach==='melee'){
      return nearestRowAlive(enemySide);
    }
    return anyAlive(enemySide);
  }
  function targetsForRow(state,ability,caster){
    if(ability.targets!=='row')return null;
    const enemySide=caster.side==='hero'?state.enemies:state.party;
    return nearestRowAlive(enemySide);
  }
  function abilityHasTargets(state,ability,caster){
    if(ability.targets==='row'){
      const enemySide=caster.side==='hero'?state.enemies:state.party;
      return nearestRowAlive(enemySide).length>0;
    }
    if(ability.targets==='single'||ability.targets==='single-ally'){
      return getValidTargets(state,ability,caster).length>0;
    }
    return true;
  }

  function applyAbilityEffect(state,caster,ability,target){
    const logs=[];
    const fx=[];
    if(ability.type==='damage'){
      const targets = ability.targets==='row'?targetsForRow(state,ability,caster):(ability.targets==='all'?anyAlive(caster.side==='hero'?state.enemies:state.party):(target?[target]:[]));
      if(!targets||!targets.length){
        logs.push(tr(caster.name+"'s "+ability.name+' finds no one in range.',caster.name+' использует «'+ability.name+'», но там некого атаковать.'));
        logs.fx=fx;
        return logs;
      }
      let totalDealt=0;
      targets.forEach(function(t){
        if(!t.alive)return;
        let mult=ability.mult;
        if(ability.bonusVsBack&&t.row==='back')mult+=ability.bonusVsBack;
        const burning=t.status.some(function(s){return s.type==='dot';});
        if(burning)mult*=1.25;
        const stunned=t.status.some(function(s){return s.type==='stun';});
        if(stunned)mult*=1.2;
        const dodged = t.status.some(function(s){return s.type==='dodge';});
        if(dodged){
          t.status=t.status.filter(function(s){return s.type!=='dodge';});
          logs.push(tr(t.name+' dodges the attack!',t.name+' уклоняется от удара!'));
          fx.push({uid:t.uid,text:tr('Dodge!','Уклон!'),textCls:'dodge'});
          return;
        }
        /* Combo: Doran's Pack Tackle leaves a foe 'exposed' — Kest's Backstab/Assassinate
           cashes it in for bonus damage. A direct hero-to-hero link, not just a status threshold. */
        const exposedMark=(ability.id==='backstab'||ability.id==='assassinate')?t.status.find(function(s){return s.type==='mark'&&s.tag==='exposed';}):null;
        /* Combo: Yvana's healing blesses the healed ally — their next hit lands harder. */
        const blessedMark=caster.status.find(function(s){return s.type==='mark'&&s.tag==='blessed';});
        /* Combo: Sael's Pin Down leaves a foe 'pinned' — a front-liner's basic strike
           (Bram, Doran or Torvin) cashes it in for bonus damage, rewarding pairing the
           ranger with a melee opener. */
        const pinnedMark=(ability.id==='strike'||ability.id==='claw'||ability.id==='shieldbash')?t.status.find(function(s){return s.type==='mark'&&s.tag==='pinned';}):null;
        /* Combo: Ashra's Ember Flick leaves a foe 'scorched' — Sael's ranged attacks
           (Quick Shot, Pin Down, Deadeye Shot) cash it in for bonus damage, rewarding
           pairing the pyromancer's marker with the ranger's precision follow-up. */
        const scorchedMark=(ability.id==='shot'||ability.id==='pin'||ability.id==='deadeye')?t.status.find(function(s){return s.type==='mark'&&s.tag==='scorched';}):null;
        /* Combo: Bram's Cleave leaves everyone it hits 'staggered' — Doran's Claw Strike
           cashes it in for bonus damage, rewarding opening a fight with the warrior's
           sweep before the beastmaster follows up. */
        const staggeredMark=(ability.id==='claw')?t.status.find(function(s){return s.type==='mark'&&s.tag==='staggered';}):null;
        /* Combo: Kest's Backstab/Assassinate leaves a foe 'bleeding' — Morwen's Withering
           Touch or Soul Siphon cashes it in for bonus damage and extra lifesteal, rewarding
           pairing the rogue's opener with the necromancer's drain. */
        const bleedingMark=(ability.id==='wither'||ability.id==='siphon')?t.status.find(function(s){return s.type==='mark'&&s.tag==='bleeding';}):null;
        if(exposedMark){mult+=0.4;t.status=t.status.filter(function(s){return s!==exposedMark;});state.comboCount=(state.comboCount||0)+1;}
        if(blessedMark){mult+=0.25;caster.status=caster.status.filter(function(s){return s!==blessedMark;});state.comboCount=(state.comboCount||0)+1;}
        if(pinnedMark){mult+=0.3;t.status=t.status.filter(function(s){return s!==pinnedMark;});state.comboCount=(state.comboCount||0)+1;}
        if(scorchedMark){mult+=0.35;t.status=t.status.filter(function(s){return s!==scorchedMark;});state.comboCount=(state.comboCount||0)+1;}
        if(staggeredMark){mult+=0.25;t.status=t.status.filter(function(s){return s!==staggeredMark;});state.comboCount=(state.comboCount||0)+1;}
        if(bleedingMark){mult+=0.25;t.status=t.status.filter(function(s){return s!==bleedingMark;});state.comboCount=(state.comboCount||0)+1;}
        const r=dmgCalc(caster,t,mult);
        t.hp=Math.max(0,t.hp-r.amount);
        totalDealt+=r.amount;
        if(r.crit)sfx('crit');else sfx('hit',dmgTypeOf(caster));
        if(exposedMark||blessedMark||pinnedMark||scorchedMark||staggeredMark||bleedingMark)sfx('buff');
        fx.push({uid:t.uid,shakeCls:r.crit?'fx-crit':'fx-hit',text:'-'+r.amount,textCls:r.crit?'crit':'dmg'});
        if(exposedMark||blessedMark||pinnedMark||scorchedMark||staggeredMark||bleedingMark)fx.push({uid:t.uid,text:tr('Combo!','Комбо!'),textCls:'combo'});
        const tagEn=(r.crit?' (crit!)':'')+(burning?' (burning target, +25%!)':'')+(stunned?' (stunned target, +20%!)':'')+(exposedMark?' (combo: exposed target, +40%!)':'')+(blessedMark?' (combo: blessed strike, +25%!)':'')+(pinnedMark?' (combo: pinned target, +30%!)':'')+(scorchedMark?' (combo: scorched target, +35%!)':'')+(staggeredMark?' (combo: staggered target, +25%!)':'')+(bleedingMark?' (combo: bleeding target, +25%!)':'');
        const tagRu=(r.crit?' (крит!)':'')+(burning?' (горящая цель, +25%!)':'')+(stunned?' (оглушённая цель, +20%!)':'')+(exposedMark?' (комбо: уязвимая цель, +40%!)':'')+(blessedMark?' (комбо: благословенный удар, +25%!)':'')+(pinnedMark?' (комбо: пригвождённая цель, +30%!)':'')+(scorchedMark?' (комбо: обожжённая цель, +35%!)':'')+(staggeredMark?' (комбо: оглушённая ударом цель, +25%!)':'')+(bleedingMark?' (комбо: кровоточащая цель, +25%!)':'');
        logs.push(tr(
          caster.name+"'s "+ability.name+' hits '+t.name+' for '+r.amount+tagEn+'.',
          caster.name+' использует «'+ability.name+'» и наносит '+t.name+' '+r.amount+' урона'+tagRu+'.'
        ));
        /* Combo: Torvin's Oath of Protection marks the protected ally — their next hit
           lands with extra force, rewarding pairing the paladin with an aggressive ally. */
        const rallyMark=caster.status.find(function(s){return s.type==='mark'&&s.tag==='rally';});
        if(rallyMark){
          const bonus=Math.max(2,Math.round(powerOf(caster)*0.3));
          t.hp=Math.max(0,t.hp-bonus);totalDealt+=bonus;
          caster.status=caster.status.filter(function(s){return s!==rallyMark;});
          state.comboCount=(state.comboCount||0)+1;
          logs.push(tr(caster.name+" strikes with the vow's fury, dealing "+bonus+' bonus damage! (combo!)',caster.name+' наносит удар с яростью клятвы — ещё '+bonus+' урона! (комбо!)'));
          sfx('buff');
        }
        /* Combo: Morwen's Withering Touch on an already-burning foe spreads a small burn
           to the rest of the enemy line — rewards pairing her with Ashra. */
        if(ability.id==='wither'&&burning){
          const others=(caster.side==='hero'?state.enemies:state.party).filter(function(o){return o.alive&&o!==t;});
          if(others.length){
            others.forEach(function(o){o.status.push({type:'dot',amount:2,duration:2,label:tr('burn','ожог')});});
            state.comboCount=(state.comboCount||0)+1;
            logs.push(tr(caster.name+' spreads the flame through the rest of the company! (combo!)',caster.name+' распространяет пламя на остальных врагов! (комбо!)'));
            sfx('buff');
          }
        }
        if(ability.lifesteal&&caster.alive){
          let lifestealPct=ability.lifesteal;
          if(bleedingMark)lifestealPct+=0.2;
          const heal=Math.max(1,Math.round(r.amount*lifestealPct));
          caster.hp=Math.min(caster.maxHp,caster.hp+heal);
          logs.push(tr(caster.name+' drains '+heal+' HP from the wound.'+(bleedingMark?' (combo: bleeding wound!)':''),caster.name+' поглощает '+heal+' HP из раны.'+(bleedingMark?' (комбо: кровоточащая рана!)':'')));
        }
        if(hasRelic(caster,'vampiric')&&caster.alive){
          const heal=Math.max(1,Math.round(r.amount*0.15));
          caster.hp=Math.min(caster.maxHp,caster.hp+heal);
          const rn=caster.equip.relic.name;
          logs.push(tr(caster.name+"'s "+rn+' heals them for '+heal+'.',caster.name+' исцеляется на '+heal+' благодаря «'+rn+'».'));
        }
        if(hasRelic(caster,'chill_on_hit')&&t.alive&&Math.random()<0.25){
          t.status.push({type:'stun',duration:1,label:tr('stun','оглушение')});
          const rn=caster.equip.relic.name;
          logs.push(tr(caster.name+"'s "+rn+' freezes '+t.name+' in place!',caster.name+' сковывает '+t.name+' («'+rn+'»)!'));
        }
        if(hasRelic(caster,'ember_brand')&&t.alive&&Math.random()<RELIC_TUNING.ember_brand.chance){
          t.status.push({type:'dot',amount:RELIC_TUNING.ember_brand.amount,duration:RELIC_TUNING.ember_brand.duration,label:tr('burn','ожог')});
          const rn=caster.equip.relic.name;
          logs.push(tr(caster.name+"'s "+rn+' sets '+t.name+' alight!',caster.name+' поджигает '+t.name+' («'+rn+'»)!'));
        }
        if(hasRelic(t,'thorns')&&caster!==t&&caster.alive){
          const reflect=Math.max(1,Math.round(r.amount*0.2));
          caster.hp=Math.max(0,caster.hp-reflect);
          const rn=t.equip.relic.name;
          logs.push(tr(t.name+"'s "+rn+' reflects '+reflect+' damage onto '+caster.name+'.',t.name+' отражает '+reflect+' урона («'+rn+'») обратно '+caster.name+'.'));
          if(caster.hp<=0&&caster.alive){caster.alive=false;if(caster.isHero)heroDown();logs.push(tr(caster.name+' falls.',caster.name+' падает замертво.'));}
        }
        if(ability.dot){t.status.push({type:'dot',amount:ability.dot.amount,duration:ability.dot.duration,label:tr('burn','ожог')});}
        if(ability.debuff){t.status.push({type:'debuff',stat:ability.debuff.stat,amount:ability.debuff.amount,duration:ability.debuff.duration,label:statAbbr(ability.debuff.stat)});}
        if(ability.id==='pin'&&t.alive){t.status.push({type:'mark',tag:'pinned',duration:2,label:tr('pinned','пригвождён')});}
        if(ability.id==='flick'&&t.alive){t.status.push({type:'mark',tag:'scorched',duration:2,label:tr('scorched','обожжён')});}
        if(ability.id==='cleave'&&t.alive){t.status.push({type:'mark',tag:'staggered',duration:1,label:tr('staggered','сбит с ног')});}
        if((ability.id==='backstab'||ability.id==='assassinate')&&t.alive){t.status.push({type:'mark',tag:'bleeding',duration:2,label:tr('bleeding','кровотечение')});}
        if(t.hp<=0&&t.alive){
          if(hasRelic(t,'revive')&&!t.usedPhoenix){
            t.usedPhoenix=true;t.hp=1;
            const rn=t.equip.relic.name;
            logs.push(tr(t.name+"'s "+rn+' flares — they cling to life at 1 HP!',t.name+' спасён («'+rn+'») — остаётся жить с 1 HP!'));
          } else {
            t.alive=false;if(t.isHero)heroDown();logs.push(tr(t.name+' falls.',t.name+' падает замертво.'));sfx('death');
            fx.push({uid:t.uid,dieCls:'fx-die'});
            if(hasRelic(caster,'reaper')&&caster.alive&&caster!==t){
              const heal=Math.max(1,Math.round(caster.maxHp*RELIC_TUNING.reaper.healPct));
              caster.hp=Math.min(caster.maxHp,caster.hp+heal);
              const rn=caster.equip.relic.name;
              logs.push(tr(caster.name+"'s "+rn+' drinks the kill: +'+heal+' HP.',caster.name+' питается добычей («'+rn+'»): +'+heal+' HP.'));
            }
          }
        }
      });
    } else if(ability.type==='heal'){
      const targets=ability.targets==='all-ally'?anyAlive(caster.side==='hero'?state.party:state.enemies):(target?[target]:[]);
      targets.forEach(function(t){
        if(!t.alive)return;
        let amt=Math.round(ability.flat+powerOf(caster)*ability.mult);
        if(hasRelic(caster,'mender'))amt=Math.round(amt*RELIC_TUNING.mender.mult);
        t.hp=Math.min(t.maxHp,t.hp+amt);
        logs.push(tr(caster.name+' mends '+t.name+' for '+amt+'.',caster.name+' лечит '+t.name+' на '+amt+'.'));
        sfx('heal');
        fx.push({uid:t.uid,shakeCls:'fx-heal',text:'+'+amt,textCls:'heal'});
        if((ability.id==='mend'||ability.id==='sanctuary')&&t!==caster){
          t.status.push({type:'mark',tag:'blessed',duration:2,label:tr('blessed','благословение')});
        }
      });
    } else if(ability.type==='buff'){
      const allySide=caster.side==='hero'?state.party:state.enemies;
      const targets=ability.targets==='all-ally'?anyAlive(allySide):(ability.targets==='single-ally'&&target?[target]:[caster]);
      targets.forEach(function(t){
        t.status.push({type:'buff',stat:ability.stat,amount:ability.amount,duration:ability.duration,label:statAbbr(ability.stat)});
        if(ability.id==='oath'&&t!==caster){
          t.status.push({type:'mark',tag:'rally',duration:2,label:tr('vow','клятва')});
          logs.push(tr(t.name+' feels ready to strike back, emboldened by the vow.',t.name+' чувствует готовность ударить в ответ, воодушевлённый клятвой.'));
        }
      });
      logs.push(tr(caster.name+' uses '+ability.name+'.',caster.name+' использует «'+ability.name+'».'));
    } else if(ability.type==='debuff'){
      const targets = ability.targets==='all-ally'?anyAlive(caster.side==='hero'?state.enemies:state.party):(target?[target]:[]);
      targets.forEach(function(t){t.status.push({type:'debuff',stat:ability.stat,amount:ability.amount,duration:ability.duration,label:statAbbr(ability.stat)});});
      logs.push(tr(
        caster.name+' uses '+ability.name+' on '+(target?target.name:'the company')+'.',
        caster.name+' использует «'+ability.name+'» на '+(target?target.name:'весь отряд')+'.'
      ));
    } else if(ability.type==='special'&&ability.effect==='dodge'){
      caster.status.push({type:'dodge',duration:1,label:tr('dodge','уклонение')});
      logs.push(tr(caster.name+' readies to slip the next blow.',caster.name+' готовится уклониться от следующего удара.'));
    } else if(ability.type==='special'&&ability.effect==='stun'){
      if(target&&target.alive){
        target.status.push({type:'stun',duration:1,label:tr('stun','оглушение')});
        logs.push(tr(caster.name+' stuns '+target.name+'!',caster.name+' оглушает '+target.name+'!'));
        if(ability.id==='tackle'){
          target.status.push({type:'mark',tag:'exposed',duration:2,label:tr('exposed','уязвим')});
          logs.push(tr(target.name+" is left wide open — the company can capitalize on it.",target.name+' остаётся без защиты — отряд может этим воспользоваться.'));
        }
      } else {
        logs.push(tr(caster.name+' swings at nothing.',caster.name+' бьёт в пустоту.'));
      }
    } else if(ability.type==='swap_row'){
      if(target&&target.alive){
        target.row = target.row==='front'?'back':'front';
        logs.push(tr(caster.name+' shoves '+target.name+' to the '+(target.row==='front'?'front':'back')+' row!',caster.name+' толкает '+target.name+' в '+(target.row==='front'?'перед':'тыл')+' ряд!'));
      } else {
        logs.push(tr(caster.name+' finds no one to shove.',caster.name+' не находит, кого толкнуть.'));
      }
    }
    logs.fx=fx;
    return logs;
  }

  function tickStatus(unit,state){
    const logs=[];
    const keep=[];
    unit.status.forEach(function(s){
      if(s.type==='dot'){
        const burn=hasRelic(unit,'cinderproof')?Math.max(1,Math.round(s.amount*RELIC_TUNING.cinderproof.mult)):s.amount;
        unit.hp=Math.max(0,unit.hp-burn);
        logs.push(tr(unit.name+' burns for '+burn+'.',unit.name+' горит и получает '+burn+' урона.'));
        if(unit.hp<=0 && unit.alive){
          if(hasRelic(unit,'revive')&&!unit.usedPhoenix){
            unit.usedPhoenix=true;unit.hp=1;
            const rn=unit.equip.relic.name;
            logs.push(tr(unit.name+"'s "+rn+' flares — they cling to life at 1 HP!',unit.name+' спасён («'+rn+'») — остаётся жить с 1 HP!'));
          } else {
            unit.alive=false;
            if(unit.isHero&&state)heroDown();
            logs.push(tr(unit.name+' falls.',unit.name+' падает замертво.'));
          }
        }
      }
      const nd=s.synergy?s.duration:s.duration-1; // synergy buffs last the whole fight
      if(nd>0)keep.push(Object.assign({},s,{duration:nd}));
    });
    unit.status=keep;
    return logs;
  }

  function buildTurnOrder(state){
    const all=state.party.concat(state.enemies).filter(function(c){return c.alive;});
    all.sort(function(a,b){return statOf(b,'spd')-statOf(a,'spd');});
    return all;
  }

  return {
    statAbbr:statAbbr, hasRelic:hasRelic, dmgCalc:dmgCalc,
    frontAlive:frontAlive, backAlive:backAlive, anyAlive:anyAlive, nearestRowAlive:nearestRowAlive,
    getValidTargets:getValidTargets, targetsForRow:targetsForRow, abilityHasTargets:abilityHasTargets,
    applyAbilityEffect:applyAbilityEffect, tickStatus:tickStatus, buildTurnOrder:buildTurnOrder,
  };
}

return {
  HERO_DMG_TYPE:HERO_DMG_TYPE, RELIC_TUNING:RELIC_TUNING,
  statOf:statOf, dmgTypeOf:dmgTypeOf, powerOf:powerOf, mitigationKeyFor:mitigationKeyFor, defenseOf:defenseOf,
  create:create,
};
});
