// Embermarch client: Persistent progress (META): defaults, load/save, upgrades, achievements.
// Classic script: shares the global scope with the other js/*.js files; load order is set in index.html.
"use strict";

/* ============================= META (persistent) ============================= */

const META_KEY='embermarch_meta_v1';
const RUN_KEY='embermarch_run_v1';

function defaultMeta(){
  return {embers:0,bestLayer:0,wins:0,ascensionUnlocked:0,ascensionChoice:0,
    upgrades:{packs:0,bones:0,favor:0,whetstone:0,boots:0,aegis:0,wardsigils:0,caravan:0,vitality_rite:0,bulwark:0,warding_rite:0,vanguard:0,legacy_ember:0,keen_edge:0,deadly_precision:0,lethal_calling:0,fortune:0,fortune_rite:0,fortune_capstone:0,field_dressing:0,mending_rite:0,second_wind:0,tutor:0,drill_rite:0,old_masters:0},
    heroesUnlocked:{bram:true,sael:true,yvana:true,kest:true,ashra:false,doran:false,morwen:false,torvin:false},
    customHeroes:[],achievements:{},history:[],theme:'dark',
    seenHeroes:['bram','sael','yvana','kest'],seenAchievements:[],
    settings:{animations:true,textScale:1,sound:true,music:true,musicVolume:0.65,colorblind:false},
    biomeChoice:'ashfall',routeChoice:'random',modifiers:{eliteVanguard:false,earlyStorm:false,brokenWard:false},
    dailyLastDate:null,dailyLastResult:null,dailyWinsCount:0,lastExportNudgeEmbers:0,
    /* Weekly Trial (see WEEKLY_*): last ISO week attempted + its result. */
    weeklyLastWeek:null,weeklyLastResult:null,weeklyWinsCount:0,
    /* Bestiary: dict keyed 'enemy:<key>' / 'boss:<key>' -> true once that foe has been
       met in combat at least once (see recordBestiary(), called from startCombat()). */
    bestiary:{},
    /* Saved company line-ups (hero-select screen) — a named list of up to 3 hero keys
       the player can re-apply in one click instead of picking heroes by hand each time. */
    gearPresets:[],
    /* Best depth reached in the Endless March (post-boss survival mode) — see onDefeat(). */
    bestEndlessDepth:0,endlessRuns:[],
    /* Lifetime march statistics (see recordRunHistory / showStatsModal). Missing
       on older saves: statsOf() fills every field, so nothing else needs migrating. */
    stats:null,
    /* One-time onboarding tips, each shown at most once per account (see
       maybeShowTutorial()). 'welcome' fires right after first login/register;
       the rest fire the first time that screen/situation is reached. */
    tutorial:{welcome:false,heroSelect:false,map:false,combat:false}};
}
let META = defaultMeta(); // populated from the server after login — see onAuthSubmit()
function loadMeta(){
  try{const raw=localStorage.getItem(META_KEY);if(!raw)return defaultMeta();
    const m=JSON.parse(raw);return Object.assign(defaultMeta(),m,{upgrades:Object.assign(defaultMeta().upgrades,m.upgrades),heroesUnlocked:Object.assign(defaultMeta().heroesUnlocked,m.heroesUnlocked),customHeroes:m.customHeroes||[],achievements:m.achievements||{},history:m.history||[],theme:m.theme==='light'?'light':'dark',
      settings:Object.assign(defaultMeta().settings,m.settings),
      biomeChoice:BIOME_DEFS[m.biomeChoice]?m.biomeChoice:'ashfall',
      routeChoice:ROUTE_CHOICES.indexOf(m.routeChoice)>=0?m.routeChoice:'random',
      modifiers:Object.assign(defaultMeta().modifiers,m.modifiers),
      bestiary:m.bestiary||{},gearPresets:m.gearPresets||[],
      tutorial:Object.assign(defaultMeta().tutorial,m.tutorial)});
  }catch(e){return defaultMeta();}
}
function applySettings(){
  document.documentElement.classList.toggle('no-anim', !!(META.settings&&META.settings.animations===false));
  document.documentElement.classList.toggle('cb', !!(META.settings&&META.settings.colorblind));
  document.documentElement.style.setProperty('--text-scale', (META.settings&&META.settings.textScale)||1);
  if(typeof musicApplySettings==='function')musicApplySettings();
}
function applyTheme(){
  document.documentElement.setAttribute('data-theme', META.theme==='light'?'light':'dark');
  const btn=$('btn-theme-toggle');
  if(btn)btn.innerHTML = META.theme==='light'?ICON_MOON:ICON_SUN;
}
function toggleTheme(){
  META.theme = META.theme==='light'?'dark':'light';
  saveMeta();
  applyTheme();
}
const ICON_SUN='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>';
const ICON_MOON='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 119.5 4a6.5 6.5 0 0010.5 10.5z"/></svg>';
function saveMeta(){if(IS_GUEST){saveGuestMeta();return;}scheduleMetaSync();}
/* Arena fights reuse the whole march combat screen (see liveStartCombatScreen below) by
   temporarily pointing the global RUN at a disposable, isArenaTemp-flagged object —
   never at this key, so a crash mid-fight can never clobber or discard a real
   in-progress march. */
function saveRun(){if(RUN&&RUN.isArenaTemp)return;try{localStorage.setItem(RUN_KEY,JSON.stringify(RUN));}catch(e){} }
function clearRun(){try{localStorage.removeItem(RUN_KEY);}catch(e){} }
function loadRun(){try{const raw=localStorage.getItem(RUN_KEY);return raw?JSON.parse(raw):null;}catch(e){return null;} }

const UPGRADE_DEFS = [
  {key:'packs',name:{en:'Sturdy Packs',ru:'Крепкие мешки'},desc:{en:'+15 starting gold per rank',ru:'+15 к стартовому золоту за уровень'},max:3,cost:function(r){return 5+r*4;}},
  {key:'bones',name:{en:'Hardened Bones',ru:'Закалённые кости'},desc:{en:'+5 max HP to every hero per rank',ru:'+5 к макс. здоровью каждого героя за уровень'},max:3,cost:function(r){return 7+r*5;}},
  {key:'favor',name:{en:"Quartermaster's Favor",ru:'Милость интенданта'},desc:{en:'Start each march with a free common item',ru:'Начинать каждый поход с бесплатным обычным предметом'},max:1,cost:function(){return 10;}},
  {key:'whetstone',name:{en:'Whetstone Kit',ru:'Точильный набор'},desc:{en:'+1 to every hero’s primary damage stat (STR/INT) per rank',ru:'+1 к основной характеристике урона (СИЛА/ИНТ) каждого героя за уровень'},max:3,cost:function(r){return 6+r*5;}},
  {key:'boots',name:{en:'Worn Marching Boots',ru:'Разношенные походные сапоги'},desc:{en:'+1 SPD to every hero per rank',ru:'+1 к скорости каждого героя за уровень'},max:3,cost:function(r){return 6+r*5;}},
  {key:'aegis',name:{en:'Aegis Plates',ru:'Пластины эгиды'},desc:{en:'+1 DEF to every hero per rank',ru:'+1 к защите каждого героя за уровень'},max:3,cost:function(r){return 6+r*5;}},
  {key:'wardsigils',name:{en:'Warded Sigils',ru:'Охранные символы'},desc:{en:'+1 MDEF to every hero per rank',ru:'+1 к магической защите каждого героя за уровень'},max:3,cost:function(r){return 6+r*5;}},
  {key:'caravan',name:{en:'Reinforced Caravan',ru:'Усиленный караван'},desc:{en:'+20 starting gold per rank',ru:'+20 к стартовому золоту за уровень'},max:2,cost:function(r){return 18+r*10;},
    requires:{key:'packs',rank:3}},
  {key:'vitality_rite',name:{en:'Rite of Vitality',ru:'Обряд живучести'},desc:{en:'+8 max HP to every hero per rank',ru:'+8 к макс. здоровью каждого героя за уровень'},max:2,cost:function(r){return 20+r*12;},
    requires:{key:'bones',rank:3}},
  {key:'bulwark',name:{en:'Rite of the Bulwark',ru:'Обряд бастиона'},desc:{en:'+4 DEF to every hero per rank',ru:'+4 к защите каждого героя за уровень'},max:2,cost:function(r){return 20+r*12;},
    requires:{key:'aegis',rank:3}},
  {key:'warding_rite',name:{en:'Rite of Warding',ru:'Обряд ограждения'},desc:{en:'+4 MDEF to every hero per rank',ru:'+4 к магической защите каждого героя за уровень'},max:2,cost:function(r){return 20+r*12;},
    requires:{key:'wardsigils',rank:3}},
  {key:'vanguard',name:{en:"Vanguard's Resolve",ru:'Стойкость авангарда'},desc:{en:'Capstone: +2 to every hero’s primary damage stat (STR/INT) and +2 SPD',ru:'Вершина ветки: +2 к основной характеристике урона (СИЛА/ИНТ) и +2 к скорости каждого героя'},max:1,cost:function(){return 45;},
    requires2:[{key:'whetstone',rank:3},{key:'boots',rank:3}]},
  {key:'legacy_ember',name:{en:"Legacy of the Last Ember",ru:'Наследие последнего уголька'},desc:{en:'Grand capstone: +2 to primary damage stat (STR/INT), +2 DEF, +1 MDEF, +2 SPD and +10 max HP to every hero',ru:'Высшая вершина: +2 к основной характеристике урона (СИЛА/ИНТ), +2 к защите, +1 к магической защите, +2 к скорости и +10 к макс. здоровью каждого героя'},max:1,cost:function(){return 80;},
    requires2:[{key:'vanguard',rank:1},{key:'bulwark',rank:2}]},
  {key:'keen_edge',name:{en:'Keen Edge',ru:'Отточенное лезвие'},desc:{en:'+3% critical hit chance to every hero per rank',ru:'+3% к шансу крит. удара каждого героя за уровень'},max:3,cost:function(r){return 6+r*5;}},
  {key:'deadly_precision',name:{en:'Deadly Precision',ru:'Смертельная точность'},desc:{en:'+5% critical hit chance to every hero per rank',ru:'+5% к шансу крит. удара каждого героя за уровень'},max:2,cost:function(r){return 20+r*12;},
    requires:{key:'keen_edge',rank:3}},
  {key:'lethal_calling',name:{en:'Lethal Calling',ru:'Зов смерти'},desc:{en:'Capstone: +8% critical hit chance and +15% critical damage to every hero',ru:'Вершина ветки: +8% к шансу крит. удара и +15% к урону от крита каждого героя'},max:1,cost:function(){return 45;},
    requires:{key:'deadly_precision',rank:2}},
  /* Fifth branch (see relicChanceBonus()): the first branch that isn't a flat
     per-hero stat — it leans on the econ/itemization side of the run instead
     (reliccs, salvage shards), parallel in shape (base -> rite -> capstone)
     to the existing four axes. */
  {key:'fortune',name:{en:"Fortune's Favor",ru:'Благосклонность фортуны'},desc:{en:'+2% chance for a relic in march rewards per rank',ru:'+2% к шансу найти реликвию в наградах похода за уровень'},max:3,cost:function(r){return 6+r*5;}},
  {key:'fortune_rite',name:{en:'Rite of Fortune',ru:'Обряд удачи'},desc:{en:'+3% chance for a relic in march rewards per rank',ru:'+3% к шансу найти реликвию в наградах похода за уровень'},max:2,cost:function(r){return 20+r*12;},
    requires:{key:'fortune',rank:3}},
  {key:'fortune_capstone',name:{en:"Fortune's Blessing",ru:'Благословение фортуны'},desc:{en:'Capstone: +10% chance for a relic in march rewards, and +1 shard whenever you salvage gear',ru:'Вершина ветки: +10% к шансу реликвии в наградах похода и +1 осколок при разборе снаряжения'},max:1,cost:function(){return 45;},
    requires:{key:'fortune_rite',rank:2}},
  /* Sixth and seventh branches: march-only effects (healing between fights,
     faster leveling), never hero stats, so arena champions (server/champion.js)
     are unaffected. Numbers live in UPGRADE_TUNING below. */
  {key:'field_dressing',name:{en:'Field Dressing',ru:'Полевые перевязки'},desc:{en:'After every won battle, living heroes recover 3% of max HP per rank',ru:'После каждой победы живые герои восстанавливают 3% макс. здоровья за уровень'},max:3,cost:function(r){return 6+r*5;}},
  {key:'mending_rite',name:{en:'Rite of Mending',ru:'Обряд исцеления'},desc:{en:'Resting at a camp heals +10% more max HP per rank',ru:'Отдых в лагере лечит ещё на 10% макс. здоровья за уровень'},max:2,cost:function(r){return 20+r*12;},
    requires:{key:'field_dressing',rank:3}},
  {key:'second_wind',name:{en:'Second Wind',ru:'Второе дыхание'},desc:{en:'Capstone: once per march, a fallen hero gets back up with 30% HP after the battle is won',ru:'Вершина ветки: раз за поход павший герой поднимается с 30% здоровья после выигранного боя'},max:1,cost:function(){return 50;},
    requires:{key:'mending_rite',rank:2}},
  {key:'tutor',name:{en:"Tutor's Notes",ru:'Записи наставника'},desc:{en:'+8% experience from battles per rank',ru:'+8% опыта за бои за уровень'},max:3,cost:function(r){return 6+r*5;}},
  {key:'drill_rite',name:{en:'Rite of Drill',ru:'Обряд муштры'},desc:{en:'+12% experience from battles per rank',ru:'+12% опыта за бои за уровень'},max:2,cost:function(r){return 20+r*12;},
    requires:{key:'tutor',rank:3}},
  {key:'old_masters',name:{en:'Old Masters',ru:'Старые мастера'},desc:{en:'Capstone: every hero starts the march at level 2 (with a random perk)',ru:'Вершина ветки: каждый герой начинает поход со 2 уровня (со случайным бонусом)'},max:1,cost:function(){return 50;},
    requires:{key:'drill_rite',rank:2}},
];
const UPGRADE_TUNING={fieldDressingPerRank:0.03,restBase:0.35,mendingPerRank:0.10,secondWindHp:0.30,tutorPerRank:0.08,drillPerRank:0.12};
function postBattleHealFrac(){return (META.upgrades.field_dressing||0)*UPGRADE_TUNING.fieldDressingPerRank;}
function restHealFrac(){return UPGRADE_TUNING.restBase+(META.upgrades.mending_rite||0)*UPGRADE_TUNING.mendingPerRank;}
function xpGainMult(){return 1+(META.upgrades.tutor||0)*UPGRADE_TUNING.tutorPerRank+(META.upgrades.drill_rite||0)*UPGRADE_TUNING.drillPerRank;}
/* Total relic-chance bonus from the Fortune branch above, applied everywhere
   a relic drop/stock chance is rolled (march rewards, shop relic stock —
   see buildRewardCards()/refreshShopStock()) so all three ranks of the
   branch plus the capstone add up consistently in one place. */
function relicChanceBonus(){
  return (META.upgrades.fortune||0)*0.02+(META.upgrades.fortune_rite||0)*0.03+((META.upgrades.fortune_capstone||0)?0.10:0);
}

const ACHIEVEMENTS = [
  {id:'first_win',name:{en:'First Light',ru:'Первый рассвет'},desc:{en:'Win a march.',ru:'Победить в походе.'},reward:20,
    check:function(win){return win;}},
  {id:'flawless',name:{en:'Flawless March',ru:'Безупречный поход'},desc:{en:'Win a march without losing a single hero.',ru:'Победить, не потеряв ни одного героя.'},reward:30,
    check:function(win){return win&&!RUN.heroDied;}},
  {id:'ascendant',name:{en:'Ascendant',ru:'Восхождение'},desc:{en:'Win a march at Ascension 2 or higher.',ru:'Победить в походе со сложностью 2 и выше.'},reward:30,
    check:function(win){return win&&(RUN.ascension||0)>=2;}},
  {id:'collector',name:{en:'Relic Collector',ru:'Коллекционер реликвий'},desc:{en:'Finish a march with a relic equipped.',ru:'Завершить поход с надетой реликвией.'},reward:15,
    check:function(win){return RUN.party.some(function(h){return h.equip&&h.equip.relic;});}},
  {id:'veteran',name:{en:'Veteran',ru:'Ветеран'},desc:{en:'Reach level 5 with any hero.',ru:'Достичь 5 уровня хотя бы одним героем.'},reward:20,
    check:function(win){return RUN.party.some(function(h){return (h.level||1)>=5;});}},
  {id:'wanderer',name:{en:'Wanderer',ru:'Странник'},desc:{en:'Win 3 Daily Challenge marches.',ru:'Победить в 3 испытаниях дня.'},reward:25,
    check:function(win){return win&&(META.dailyWinsCount||0)>=3;}},
  {id:'giant_slayer',name:{en:'Giant Slayer',ru:'Победитель исполина'},desc:{en:'Defeat the Colossus.',ru:'Победить Колосса.'},reward:20,
    check:function(win){return win&&!!(RUN.bossesBeaten&&RUN.bossesBeaten.colossus);}},
  {id:'warden_fallen',name:{en:'The Warden Falls',ru:'Страж повержен'},desc:{en:'Defeat the Warden.',ru:'Победить Стража.'},reward:20,
    check:function(win){return win&&!!(RUN.bossesBeaten&&RUN.bossesBeaten.warden);}},
  {id:'vessel_broken',name:{en:'Vessel Broken',ru:'Сосуд разбит'},desc:{en:'Defeat the Withered Vessel.',ru:'Победить Иссохший сосуд.'},reward:20,
    check:function(win){return win&&!!(RUN.bossesBeaten&&RUN.bossesBeaten.vessel);}},
  {id:'sovereign_broken',name:{en:'The Sovereign Falls',ru:'Государь повержен'},desc:{en:'Defeat the Rime Sovereign in the Frozen Reach.',ru:'Победить Ледяного государя в Морозном рубеже.'},reward:20,
    check:function(win){return win&&!!(RUN.bossesBeaten&&RUN.bossesBeaten.rimesovereign);}},
  {id:'tidemother_broken',name:{en:'Low Tide',ru:'Отлив'},desc:{en:'Defeat the Tide Mother in the Drowned Barrows.',ru:'Победить Мать приливов в Затопленных курганах.'},reward:20,
    check:function(win){return win&&!!(RUN.bossesBeaten&&RUN.bossesBeaten.tidemother);}},
  {id:'thornsovereign_broken',name:{en:'The Thorn Sovereign Falls',ru:'Терновый государь повержен'},desc:{en:"Defeat the Thorn Sovereign in the Thornwild — the march's final chapter.",ru:'Победить Тернового государя в Терновой чаще — финальной главе похода.'},reward:25,
    check:function(win){return win&&!!(RUN.bossesBeaten&&RUN.bossesBeaten.thornsovereign);}},
  {id:'full_roster',name:{en:'Full Company',ru:'Полный отряд'},desc:{en:'Unlock every hero.',ru:'Открыть всех героев.'},reward:40,
    check:function(win){return Object.keys(META.heroesUnlocked).every(function(k){return META.heroesUnlocked[k];});}},
  {id:'hoarder',name:{en:'Ember Hoarder',ru:'Скопидом'},desc:{en:'Accumulate 300 embers over time.',ru:'Накопить 300 угольков за всё время.'},reward:15,
    check:function(win){return (META.embers||0)>=300;}},
  {id:'high_ascension',name:{en:'Into the Deep',ru:'В самую глубь'},desc:{en:'Win a march at Ascension 4 or higher.',ru:'Победить в походе со сложностью 4 и выше.'},reward:35,
    check:function(win){return win&&(RUN.ascension||0)>=4;}},
  {id:'combo_master',name:{en:'Combo Master',ru:'Мастер комбо'},desc:{en:'Land 3 or more hero combos in a single march.',ru:'Провести 3 и более комбо за один поход.'},reward:20,
    check:function(win){return (RUN.comboCount||0)>=3;}},
  {id:'individualist',name:{en:'Individualist',ru:'Индивидуалист'},desc:{en:'Win a march with a custom hero in the company.',ru:'Победить в походе, имея в отряде кастомного героя.'},reward:20,
    check:function(win){return win&&RUN.party.some(function(h){return h.custom;});}},
  {id:'arcane_company',name:{en:'Arcane Company',ru:'Чистая аркана'},desc:{en:'Win a march with a company of only Intellect-based heroes (Pyromancer, Necromancer, Cleric, or a custom hero of that kind).',ru:'Победить в походе, набрав в отряд только магов — бьющих Интеллектом (Пиромант, Некромант, Жрица или свой герой этого типа).'},reward:25,
    check:function(win){return win&&RUN.party.every(function(h){return dmgTypeOf(h)==='int';});}},
  {id:'steel_company',name:{en:'Steel Company',ru:'Стальной отряд'},desc:{en:'Win a march with a company of only Strength-based heroes.',ru:'Победить в походе, набрав в отряд только бойцов, бьющих Силой.'},reward:25,
    check:function(win){return win&&RUN.party.every(function(h){return dmgTypeOf(h)==='str';});}},
  {id:'into_eternity',name:{en:'Into Eternity',ru:'В вечность'},desc:{en:'Reach depth 10 in the Endless March.',ru:'Достичь глубины 10 в Бесконечном походе.'},reward:35,
    check:function(win){return (META.bestEndlessDepth||0)>=10;}},
];
function evaluateAchievements(win){
  META.achievements=META.achievements||{};
  const unlocked=[];
  ACHIEVEMENTS.forEach(function(a){
    if(META.achievements[a.id])return;
    if(a.check(win)){META.achievements[a.id]=true;META.embers+=a.reward;unlocked.push(a);}
  });
  return unlocked;
}
function recordRunHistory(win,embers,endlessDepth){
  META.history=META.history||[];
  META.history.push({win:win,layer:RUN.layersCleared,ascension:RUN.ascension||0,embers:embers,ts:Date.now(),
    endlessDepth:endlessDepth||null,
    heroKeys:RUN.party.map(function(h){return h.key;}),hadCustom:RUN.party.some(function(h){return h.custom;}),
    stats:runStatsSummary(),
    /* Evidence for achievements earned this march: the server only accepts a new
       achievement backed by a fresh history entry (server/progress-guard.js). */
    proof:{heroDied:!!RUN.heroDied,relic:RUN.party.some(function(h){return !!(h.equip&&h.equip.relic);}),
      combos:RUN.comboCount||0,bosses:Object.keys(RUN.bossesBeaten||{}),
      dmgTypes:RUN.party.map(function(h){return dmgTypeOf(h);}),daily:!!RUN.daily&&!RUN.weekly,weekly:!!RUN.weekly}});
  if(META.history.length>15)META.history=META.history.slice(-15);
  addRunToLifetimeStats(win);
}

/* ---- Run statistics ----
   Per-march counters live on RUN.stats (created in startRun; a march saved by an
   older version gets them lazily via runStats()). At march end they are
   summarized into the history entry and added to META.stats. Nothing here
   touches combat math. */
function newRunStats(){return {battles:0,kills:0,elites:0,bosses:0,dmg:0,startedAt:Date.now(),fallen:null};}
function runStats(){if(!RUN.stats)RUN.stats=newRunStats();return RUN.stats;}
function statsOnCombatWin(){
  if(!RUN||RUN.isArenaTemp||!RUN.combat)return;
  const st=runStats();
  const foes=RUN.combat.enemies||[];
  st.battles++;
  st.kills+=foes.length;
  st.dmg+=foes.reduce(function(sum,u){return sum+(u.maxHp||0);},0);
  const type=RUN.combat.node&&RUN.combat.node.type;
  if(type==='elite')st.elites++;
  if(type==='boss')st.bosses++;
}
function statsOnCombatLoss(){
  if(!RUN||RUN.isArenaTemp||!RUN.combat)return;
  const node=RUN.combat.node;
  runStats().fallen={
    biome:node?biomeKeyForLayer(node.layer):null,
    type:node?node.type:null,
    foes:(RUN.combat.enemies||[]).filter(function(u){return u.alive;}).slice(0,4).map(function(u){return u.name;}),
  };
}
function runStatsSummary(){
  const st=runStats();
  return {battles:st.battles,kills:st.kills,elites:st.elites,bosses:st.bosses,dmg:st.dmg,
    durMs:Math.max(0,Date.now()-(st.startedAt||Date.now())),
    maxLvl:RUN.party.reduce(function(m,h){return Math.max(m,h.level||1);},1),
    fallen:st.fallen};
}
function statsOf(){
  const d={runs:0,wins:0,battles:0,kills:0,elites:0,bosses:0,dmg:0,timeMs:0,deathsByBiome:{},deathsByType:{},heroes:{},since:Date.now()};
  const s=Object.assign(d,META.stats||{});
  ['deathsByBiome','deathsByType','heroes'].forEach(function(k){if(!s[k]||typeof s[k]!=='object')s[k]={};});
  return s;
}
function addRunToLifetimeStats(win){
  if(!RUN||RUN.isArenaTemp)return;
  const s=statsOf();
  const r=runStatsSummary();
  s.runs++;if(win)s.wins++;
  s.battles+=r.battles;s.kills+=r.kills;s.elites+=r.elites;s.bosses+=r.bosses;s.dmg+=r.dmg;
  s.timeMs+=Math.min(r.durMs,6*3600*1000); // a march left open overnight shouldn't count as 12h played
  if(!win&&r.fallen){
    if(r.fallen.biome)s.deathsByBiome[r.fallen.biome]=(s.deathsByBiome[r.fallen.biome]||0)+1;
    if(r.fallen.type)s.deathsByType[r.fallen.type]=(s.deathsByType[r.fallen.type]||0)+1;
  }
  RUN.party.forEach(function(h){
    const k=h.custom?'custom':h.key;
    const e=s.heroes[k]||{runs:0,wins:0};
    e.runs++;if(win)e.wins++;
    s.heroes[k]=e;
  });
  META.stats=s;
}
function fmtDuration(ms){
  const m=Math.round((ms||0)/60000);
  if(m<60)return m+M(' min',' мин');
  return Math.floor(m/60)+M(' h ',' ч ')+(m%60)+M(' min',' мин');
}
function statsTile(label,value){
  const t=el('div','stat-tile');
  t.appendChild(el('div','stat-tile-value num',String(value)));
  t.appendChild(el('div','stat-tile-label',label));
  return t;
}
function statsBarRow(label,value,max,cls){
  const row=el('div','stat-bar-row');
  row.appendChild(el('span','stat-bar-label',label));
  const track=el('div','stat-bar-track');
  const fill=el('div','stat-bar-fill'+(cls?' '+cls:''));
  fill.style.width=(max>0?Math.round(value/max*100):0)+'%';
  track.appendChild(fill);
  row.appendChild(track);
  row.appendChild(el('span','stat-bar-value num',String(value)));
  return row;
}
function nodeTypeShort(t){
  return {battle:M('Battle','Бой'),elite:M('Elite','Элита'),boss:M('Boss','Босс')}[t]||t;
}
function showStatsModal(){
  const s=statsOf();
  const wrap=el('div','stack stats-modal');
  wrap.appendChild(el('h3','',M('Statistics','Статистика')));
  wrap.appendChild(el('div','eyebrow',M('Counted since ','Считается с ')+new Date(s.since).toLocaleDateString(LANG==='ru'?'ru-RU':'en-US')));
  const grid=el('div','stat-grid');
  grid.appendChild(statsTile(M('Marches','Походов'),s.runs));
  grid.appendChild(statsTile(M('Victories','Побед'),s.wins+(s.runs?' ('+Math.round(s.wins/s.runs*100)+'%)':'')));
  grid.appendChild(statsTile(M('Battles won','Выиграно боёв'),s.battles));
  grid.appendChild(statsTile(M('Foes slain','Врагов повержено'),s.kills));
  grid.appendChild(statsTile(M('Elites / bosses','Элита / боссы'),s.elites+' / '+s.bosses));
  grid.appendChild(statsTile(M('Foe HP destroyed','Уничтожено HP врагов'),s.dmg));
  grid.appendChild(statsTile(M('Time marching','Время в походах'),fmtDuration(s.timeMs)));
  grid.appendChild(statsTile(M('Best layer / endless','Лучший слой / бесконечный'),META.bestLayer+' / '+(META.bestEndlessDepth||0)));
  wrap.appendChild(grid);

  const heroKeys=Object.keys(s.heroes).sort(function(a,b){return s.heroes[b].runs-s.heroes[a].runs;});
  if(heroKeys.length){
    wrap.appendChild(el('h4','stat-h4',M('Heroes: marches and win rate','Герои: походы и доля побед')));
    const maxRuns=Math.max.apply(null,heroKeys.map(function(k){return s.heroes[k].runs;}));
    heroKeys.forEach(function(k){
      const e=s.heroes[k];
      const name=k==='custom'?M('Custom hero','Свой герой'):(HERO_DEFS[k]?L(HERO_DEFS[k].name):k);
      const row=statsBarRow(name,e.runs,maxRuns);
      row.appendChild(el('span','stat-bar-extra num',Math.round(e.wins/Math.max(1,e.runs)*100)+'%'));
      wrap.appendChild(row);
    });
  }
  const deaths=Object.keys(BIOME_DEFS).filter(function(b){return s.deathsByBiome[b];});
  if(deaths.length){
    wrap.appendChild(el('h4','stat-h4',M('Where companies fall','Где гибнут отряды')));
    const maxD=Math.max.apply(null,Object.keys(BIOME_DEFS).map(function(b){return s.deathsByBiome[b]||0;}));
    Object.keys(BIOME_DEFS).forEach(function(b){wrap.appendChild(statsBarRow(L(getBiome(b).name),s.deathsByBiome[b]||0,maxD,'danger'));});
    const types=Object.keys(s.deathsByType);
    if(types.length)wrap.appendChild(el('div','eyebrow',types.map(function(t){return nodeTypeShort(t)+': '+s.deathsByType[t];}).join(' · ')));
  }
  const recent=(META.history||[]).slice().reverse().filter(function(h){return h.stats;});
  if(recent.length){
    wrap.appendChild(el('h4','stat-h4',M('Recent marches','Последние походы')));
    const list=el('div','stack');
    recent.slice(0,8).forEach(function(h){
      const st=h.stats;
      const head=(h.win?M('Victory','Победа'):M('Fell on layer ','Гибель на слое ')+h.layer)+(h.ascension?(' · '+(h.ascension<0?M('Story','История'):M('Asc ','Слож. ')+h.ascension)):'');
      const parts=[st.battles+M(' battles',' боёв'),st.kills+M(' slain',' убито'),M('Lv ','Ур. ')+st.maxLvl,fmtDuration(st.durMs)];
      const line=el('div','stat-run '+(h.win?'win':'lose'));
      line.appendChild(el('div','stat-run-head',head));
      line.appendChild(el('div','stat-run-meta',parts.join(' · ')));
      if(!h.win&&st.fallen&&st.fallen.foes&&st.fallen.foes.length){
        line.appendChild(el('div','stat-run-meta',M('Fallen to: ','Погибли от: ')+st.fallen.foes.join(', ')));
      }
      list.appendChild(line);
    });
    wrap.appendChild(list);
  }
  if(!s.runs)wrap.appendChild(el('div','',"<span style='color:var(--muted);'>"+M('Finish a march to start filling these numbers in.','Завершите поход, и здесь появятся цифры.')+"</span>"));
  const close=el('button','primary',M('Close','Закрыть'));
  close.addEventListener('click',closeModal);
  wrap.appendChild(close);
  openModal(wrap);
}
/* Separate top-10 leaderboard of Endless March depths, independent of the
   15-entry general march history above (which would otherwise push an old
   deep Endless run out after a few ordinary marches). */
function recordEndlessDepth(depth){
  if(!depth)return;
  META.endlessRuns=META.endlessRuns||[];
  META.endlessRuns.push({depth:depth,ts:Date.now()});
  META.endlessRuns.sort(function(a,b){return b.depth-a.depth;});
  if(META.endlessRuns.length>10)META.endlessRuns=META.endlessRuns.slice(0,10);
}
function computeRunStats(){
  const hist=META.history||[];
  const total=hist.length;
  const wins=hist.filter(function(h){return h.win;}).length;
  const winRate=total?Math.round(wins/total*100):0;
  const lossLayers=hist.filter(function(h){return !h.win;}).map(function(h){return h.layer;});
  const avgLossLayer=lossLayers.length?(lossLayers.reduce(function(a,b){return a+b;},0)/lossLayers.length).toFixed(1):null;
  const heroCounts={};
  let heroRunsCounted=0;
  hist.forEach(function(h){
    if(h.heroKeys&&h.heroKeys.length){
      heroRunsCounted++;
      h.heroKeys.forEach(function(k){heroCounts[k]=(heroCounts[k]||0)+1;});
    }
  });
  let favKey=null,favCount=0;
  Object.keys(heroCounts).forEach(function(k){if(heroCounts[k]>favCount){favCount=heroCounts[k];favKey=k;}});
  const customRuns=hist.filter(function(h){return h.hadCustom;}).length;
  return {total:total,wins:wins,winRate:winRate,avgLossLayer:avgLossLayer,favKey:favKey,favCount:favCount,customRuns:customRuns,heroRunsCounted:heroRunsCounted};
}
