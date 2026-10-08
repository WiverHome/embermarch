// Embermarch client: Game data tables: heroes, enemies, bosses, biomes, items, relics, events, bestiary.
// Classic script: shares the global scope with the other js/*.js files; load order is set in index.html.
"use strict";

/* ============================= DATA ============================= */

const HERO_ICON_SVG = {
  bram:'<svg viewBox="0 0 24 24"><path d="M12 3.4a4.1 4.1 0 0 1 4.1 4.1c0 1.6-.6 2.6-1.2 3.4 3.3 1 5.6 3.5 6.1 7.4H7c.5-3.9 2.8-6.4 6.1-7.4-.6-.8-1.2-1.8-1.2-3.4A4.1 4.1 0 0 1 12 3.4Z" fill="#12141a"/><path d="M9.5 5.1 10.6 2.5 11.4 5.4Z" fill="#12141a"/><path d="M14.5 5.1 13.4 2.5 12.6 5.4Z" fill="#12141a"/><path d="M12 14.6v5M10 16.5h4" stroke="#c98a3b" stroke-width="1.4" stroke-linecap="round"/></svg>',
  sael:'<svg viewBox="0 0 24 24"><path d="M12 3.4a4.1 4.1 0 0 1 4.1 4.1c0 1.6-.6 2.6-1.2 3.4 3.3 1 5.6 3.5 6.1 7.4H7c.5-3.9 2.8-6.4 6.1-7.4-.6-.8-1.2-1.8-1.2-3.4A4.1 4.1 0 0 1 12 3.4Z" fill="#12141a"/><path d="M12 2.6c-2.6 1.4-4.2 3.6-4.2 6.1 0 1.1.3 1.9.7 2.6a7.3 7.3 0 0 1 3.5-.9 7.3 7.3 0 0 1 3.5.9c.4-.7.7-1.5.7-2.6 0-2.5-1.6-4.7-4.2-6.1Z" fill="#12141a"/><g transform="translate(16.2,8.2) scale(0.3)"><path d="M4 4c8 0 14 4 16 8-2 4-8 8-16 8 4-3.2 6.4-6 7-8-.6-2-3-4.8-7-8z" fill="none" stroke="#12141a" stroke-width="3.4"/><path d="M11 12h9M18 9l2 3-2 3" fill="none" stroke="#12141a" stroke-width="3.6" stroke-linecap="round"/></g></svg>',
  yvana:'<svg viewBox="0 0 24 24"><path d="M12 3.4a4.1 4.1 0 0 1 4.1 4.1c0 1.6-.6 2.6-1.2 3.4 3.3 1 5.6 3.5 6.1 7.4H7c.5-3.9 2.8-6.4 6.1-7.4-.6-.8-1.2-1.8-1.2-3.4A4.1 4.1 0 0 1 12 3.4Z" fill="#12141a"/><circle cx="12" cy="7.3" r="5.9" fill="none" stroke="#12141a" stroke-width="0.8" opacity="0.5"/><path d="M12 14.8v5.6M9.3 17.6h5.4" stroke="#8fb08a" stroke-width="1.4" stroke-linecap="round"/></svg>',
  kest:'<svg viewBox="0 0 24 24"><path d="M12 3.4a4.1 4.1 0 0 1 4.1 4.1c0 1.6-.6 2.6-1.2 3.4 3.3 1 5.6 3.5 6.1 7.4H7c.5-3.9 2.8-6.4 6.1-7.4-.6-.8-1.2-1.8-1.2-3.4A4.1 4.1 0 0 1 12 3.4Z" fill="#12141a"/><path d="M7.2 9.4c1.5.9 3.1 1.3 4.8 1.3s3.3-.4 4.8-1.3" stroke="#a56bc9" stroke-width="1" fill="none" stroke-linecap="round"/><g transform="translate(5.3,9.6) rotate(25)"><path d="M-1 0h2.6l-.3 6.4-1 2-1-2Z" fill="#12141a"/><rect x="-1.3" y="-1.6" width="3.2" height="1.5" rx="0.3" fill="#12141a"/></g><g transform="translate(18.7,9.6) rotate(-25) scale(-1,1)"><path d="M-1 0h2.6l-.3 6.4-1 2-1-2Z" fill="#12141a"/><rect x="-1.3" y="-1.6" width="3.2" height="1.5" rx="0.3" fill="#12141a"/></g></svg>',
  ashra:'<svg viewBox="0 0 24 24"><path d="M12 3.4a4.1 4.1 0 0 1 4.1 4.1c0 1.6-.6 2.6-1.2 3.4 3.3 1 5.6 3.5 6.1 7.4H7c.5-3.9 2.8-6.4 6.1-7.4-.6-.8-1.2-1.8-1.2-3.4A4.1 4.1 0 0 1 12 3.4Z" fill="#12141a"/><g transform="translate(9.4,1.2) scale(1.6)"><path d="M1.5 0c.5 1.1 1.5 1.8 1.5 3a1.5 1.5 0 0 1-3 0c0-.5.2-.9.5-1.2 0 .4.2.6.4.7-.2-.8.1-1.5.6-2.5z" fill="#12141a"/></g><g transform="translate(6.6,3) scale(1.05)"><path d="M1.5 0c.5 1.1 1.5 1.8 1.5 3a1.5 1.5 0 0 1-3 0c0-.5.2-.9.5-1.2 0 .4.2.6.4.7-.2-.8.1-1.5.6-2.5z" fill="#12141a" opacity="0.92"/></g><g transform="translate(13,3) scale(1.05)"><path d="M1.5 0c.5 1.1 1.5 1.8 1.5 3a1.5 1.5 0 0 1-3 0c0-.5.2-.9.5-1.2 0 .4.2.6.4.7-.2-.8.1-1.5.6-2.5z" fill="#12141a" opacity="0.92"/></g><circle cx="12" cy="18.1" r="1.3" fill="#d9683f"/></svg>',
  doran:'<svg viewBox="0 0 24 24"><path d="M12 3.4a4.1 4.1 0 0 1 4.1 4.1c0 1.6-.6 2.6-1.2 3.4 3.3 1 5.6 3.5 6.1 7.4H7c.5-3.9 2.8-6.4 6.1-7.4-.6-.8-1.2-1.8-1.2-3.4A4.1 4.1 0 0 1 12 3.4Z" fill="#12141a"/><path d="M7.1 7.6c-.6-2-.4-3.6.5-4.9 1 .7 1.6 1.8 2.2 3.6z" fill="#12141a"/><path d="M16.9 7.6c.6-2 .4-3.6-.5-4.9-1 .7-1.6 1.8-2.2 3.6z" fill="#12141a"/><path d="M6.8 16.6c1-.7 2.2-.7 3.1.1M17.2 16.6c-1-.7-2.2-.7-3.1.1" stroke="#b0995a" stroke-width="0.9" fill="none" stroke-linecap="round"/></svg>',
  morwen:'<svg viewBox="0 0 24 24"><path d="M12 2.6a4.6 4.6 0 0 1 4.6 4.6c0 1.9-.8 3-1.6 4 3.5 1 5.9 3.6 6.4 7.6H6.6c.5-4 2.9-6.6 6.4-7.6-.8-1-1.6-2.1-1.6-4A4.6 4.6 0 0 1 12 2.6Z" fill="#12141a"/><circle cx="9.9" cy="7.7" r="0.85" fill="#7a5aa0"/><circle cx="14.1" cy="7.7" r="0.85" fill="#7a5aa0"/><circle cx="9.9" cy="7.7" r="1.6" fill="#7a5aa0" opacity="0.25"/><circle cx="14.1" cy="7.7" r="1.6" fill="#7a5aa0" opacity="0.25"/></svg>',
  torvin:'<svg viewBox="0 0 24 24"><path d="M12 3.4a4.1 4.1 0 0 1 4.1 4.1c0 1.6-.6 2.6-1.2 3.4 3.3 1 5.6 3.5 6.1 7.4H7c.5-3.9 2.8-6.4 6.1-7.4-.6-.8-1.2-1.8-1.2-3.4A4.1 4.1 0 0 1 12 3.4Z" fill="#12141a"/><path d="M12 2a5.6 5.6 0 0 0-3.4 9c.9-.7 2-1.2 3.4-1.2s2.5.5 3.4 1.2A5.6 5.6 0 0 0 12 2Z" fill="#12141a"/><path d="M8.4 6.1c-2.6-1.2-5-1.1-6.9.4 1.1 1.3 2.7 2 4.4 1.9-.3-1 .1-2 2.5-2.3z" fill="#12141a"/><path d="M15.6 6.1c2.6-1.2 5-1.1 6.9.4-1.1 1.3-2.7 2-4.4 1.9.3-1-.1-2-2.5-2.3z" fill="#12141a"/><path d="M12 14.3v6.2M9.1 17.4h5.8" stroke="#c9a227" stroke-width="1.4" stroke-linecap="round"/></svg>',
};
function heroIconInner(key){
  const full=HERO_ICON_SVG[key];
  if(!full)return '';
  const m=full.match(/^<svg[^>]*>([\s\S]*)<\/svg>$/);
  return m?m[1]:'';
}
/* Custom heroes get a composite portrait instead of a bare letter/emblem: the base
   class's silhouette (shrunk and shifted), with the player's chosen emblem shown as
   a small badge in the corner — a real portrait instead of a flat icon-in-circle. */
function customPortraitSVG(unit){
  const inner=heroIconInner(unit.tplKey);
  const badge=(unit.icon||'★');
  if(!inner)return badge;
  return '<svg viewBox="0 0 24 24">'
    +'<g transform="translate(-1.2,-1.2) scale(0.86)">'+inner+'</g>'
    +'<circle cx="18.3" cy="18.3" r="5.4" fill="#12141a" opacity="0.9"/>'
    +'<circle cx="18.3" cy="18.3" r="5.4" fill="none" stroke="#e9e4d6" stroke-width="0.6" opacity="0.5"/>'
    +'<text x="18.3" y="20.6" font-size="6.4" text-anchor="middle" fill="#e9e4d6" font-family="Marcellus,serif">'+badge+'</text>'
    +'</svg>';
}
function avatarContent(unit){
  if(unit&&unit.isHero&&unit.custom&&unit.tplKey&&HERO_ICON_SVG[unit.tplKey])return customPortraitSVG(unit);
  if(unit&&unit.isHero&&!unit.custom&&HERO_ICON_SVG[unit.tplKey||unit.key])return HERO_ICON_SVG[unit.tplKey||unit.key];
  if(unit&&!unit.isHero&&unit.key==='boss'&&typeof BOSS_ICON_SVG!=='undefined'&&BOSS_ICON_SVG[unit.bossKey])return BOSS_ICON_SVG[unit.bossKey];
  if(unit&&!unit.isHero&&typeof ENEMY_ICON_SVG!=='undefined'&&ENEMY_ICON_SVG[unit.key])return ENEMY_ICON_SVG[unit.key];
  return unit&&unit.icon?unit.icon:'';
}

/* Which offensive stat each hero's damage scales from. Physical classes (heavy/finesse
   gear archetypes) deal damage from STR; magic classes (arcane/holy) deal it from INT.
   Enemies/bosses keep a single flat 'atk' stat (no split) — see dmgTypeOf(). */
const HERO_DMG_TYPE = EmberCombatCore.HERO_DMG_TYPE; // defined in js/combat-core.js
const HERO_DEFS = {
  bram:{key:'bram',name:{en:'Bram',ru:'Брам'},cls:{en:'Warrior',ru:'Воин'},icon:'B',color:'#c98a3b',baseHp:36,baseStr:8,baseInt:0,baseDef:6,baseSpd:5,defaultRow:'front',cost:0,
    abilities:[
      {id:'strike',name:{en:'Strike',ru:'Удар'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.0,desc:{en:'Nearest-row foe',ru:'По врагу ближайшего ряда'}},
      {id:'shieldwall',name:{en:'Shield Wall',ru:'Стена щитов'},cd:3,reach:'any',targets:'self',type:'buff',stat:'def',amount:6,duration:2,desc:{en:'+6 DEF, 2 turns',ru:'+6 к защите, 2 хода'}},
      {id:'cleave',name:{en:'Cleave',ru:'Рассечение'},cd:2,reach:'melee',targets:'row',type:'damage',mult:0.65,desc:{en:'All foes in nearest row',ru:'По всем врагам ближайшего ряда'}},
      {id:'reckoning',name:{en:'Reckoning',ru:'Расплата'},cd:5,minLevel:7,reach:'melee',targets:'single',type:'damage',mult:2.1,desc:{en:'Ultimate: massive hit on nearest-row foe (Lv7)',ru:'Ульта: мощнейший удар по врагу ближайшего ряда (Ур.7)'}},
    ]},
  sael:{key:'sael',name:{en:'Sael',ru:'Саэль'},cls:{en:'Ranger',ru:'Лучник'},icon:'S',color:'#5f93ae',baseHp:25,baseStr:9,baseInt:0,baseDef:3,baseSpd:8,defaultRow:'back',cost:0,
    abilities:[
      {id:'shot',name:{en:'Quick Shot',ru:'Быстрый выстрел'},cd:0,reach:'ranged',targets:'single',type:'damage',mult:0.9,desc:{en:'Any foe',ru:'По любому врагу'}},
      {id:'pin',name:{en:'Pin Down',ru:'Пригвоздить'},cd:2,reach:'ranged',targets:'single',type:'damage',mult:1.3,debuff:{stat:'spd',amount:-3,duration:2},desc:{en:'Dmg + slows',ru:'Урон + замедление'}},
      {id:'volley',name:{en:'Volley',ru:'Залп'},cd:3,reach:'ranged',targets:'all',type:'damage',mult:0.5,desc:{en:'All foes',ru:'По всем врагам'}},
      {id:'deadeye',name:{en:'Deadeye Shot',ru:'Смертельный выстрел'},cd:5,minLevel:7,reach:'ranged',targets:'single',type:'damage',mult:2.0,desc:{en:'Ultimate: precise, devastating shot (Lv7)',ru:'Ульта: точный смертельный выстрел (Ур.7)'}},
    ]},
  yvana:{key:'yvana',name:{en:'Yvana',ru:'Ивана'},cls:{en:'Cleric',ru:'Жрица'},icon:'Y',color:'#8fb08a',baseHp:27,baseStr:0,baseInt:5,baseDef:4,baseSpd:6,defaultRow:'back',cost:0,
    abilities:[
      {id:'smite',name:{en:'Smite',ru:'Кара'},cd:0,reach:'ranged',targets:'single',type:'damage',mult:0.85,desc:{en:'Any foe',ru:'По любому врагу'}},
      {id:'mend',name:{en:'Mend',ru:'Исцеление'},cd:0,reach:'any',targets:'single-ally',type:'heal',mult:0.8,flat:5,desc:{en:'Heal one ally',ru:'Лечит союзника'}},
      {id:'wave',name:{en:'Radiant Wave',ru:'Волна света'},cd:3,reach:'any',targets:'all-ally',type:'heal',mult:0.35,flat:4,desc:{en:'Heal company',ru:'Лечит весь отряд'}},
      {id:'sanctuary',name:{en:'Sanctuary',ru:'Святилище'},cd:5,minLevel:7,reach:'any',targets:'single-ally',type:'heal',mult:1.4,flat:14,desc:{en:'Ultimate: near-full heal on one ally (Lv7)',ru:'Ульта: почти полное исцеление союзника (Ур.7)'}},
    ]},
  kest:{key:'kest',name:{en:'Kest',ru:'Кест'},cls:{en:'Rogue',ru:'Разбойник'},icon:'K',color:'#a56bc9',baseHp:26,baseStr:10,baseInt:0,baseDef:3,baseSpd:9,defaultRow:'back',cost:0,
    abilities:[
      {id:'quickstab',name:{en:'Quickstab',ru:'Быстрый укол'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.0,desc:{en:'Nearest-row foe',ru:'По врагу ближайшего ряда'}},
      {id:'backstab',name:{en:'Backstab',ru:'Удар в спину'},cd:2,reach:'ranged',targets:'single',type:'damage',mult:1.5,bonusVsBack:0.5,desc:{en:'+50% vs back row',ru:'+50% урона по заднему ряду'}},
      {id:'shadowstep',name:{en:'Shadowstep',ru:'Шаг тени'},cd:3,reach:'any',targets:'self',type:'special',effect:'dodge',desc:{en:'Dodge next hit',ru:'Уклонение от следующего удара'}},
      {id:'assassinate',name:{en:'Assassinate',ru:'Убийство'},cd:5,minLevel:7,reach:'ranged',targets:'single',type:'damage',mult:1.8,bonusVsBack:0.7,desc:{en:'Ultimate: brutal strike, +70% vs back row (Lv7)',ru:'Ульта: смертельный удар, +70% по заднему ряду (Ур.7)'}},
      {id:'trip',name:{en:'Trip',ru:'Подножка'},cd:2,reach:'melee',targets:'single',type:'swap_row',desc:{en:'Melee foe; forces them to the opposite row',ru:'Ближний враг перемещается в противоположный ряд'}},
    ]},
  ashra:{key:'ashra',name:{en:'Ashra',ru:'Ашра'},cls:{en:'Pyromancer',ru:'Пиромант'},icon:'A',color:'#d9683f',baseHp:23,baseStr:0,baseInt:9,baseDef:2,baseSpd:7,defaultRow:'back',cost:15,
    abilities:[
      {id:'flick',name:{en:'Ember Flick',ru:'Всплеск огня'},cd:0,reach:'ranged',targets:'single',type:'damage',mult:0.8,dot:{amount:3,duration:2},desc:{en:'Dmg + burn',ru:'Урон + поджог'}},
      {id:'burst',name:{en:'Cinder Burst',ru:'Взрыв углей'},cd:3,reach:'ranged',targets:'all',type:'damage',mult:0.5,dot:{amount:2,duration:2},desc:{en:'All foes + burn',ru:'По всем врагам + поджог'}},
      {id:'flare',name:{en:'Flare Guard',ru:'Огненная защита'},cd:2,reach:'any',targets:'self',type:'buff',stat:'spd',amount:3,duration:2,desc:{en:'+3 SPD, 2 turns',ru:'+3 к скорости, 2 хода'}},
      {id:'inferno',name:{en:'Inferno',ru:'Огненный шторм'},cd:5,minLevel:7,reach:'ranged',targets:'all',type:'damage',mult:0.9,dot:{amount:4,duration:3},desc:{en:'Ultimate: all foes take heavy damage + burn (Lv7)',ru:'Ульта: тяжёлый урон и поджог по всем врагам (Ур.7)'}},
    ]},
  doran:{key:'doran',name:{en:'Doran',ru:'Доран'},cls:{en:'Beastmaster',ru:'Зверолов'},icon:'D',color:'#b0995a',baseHp:33,baseStr:8,baseInt:0,baseDef:5,baseSpd:6,defaultRow:'front',cost:25,
    abilities:[
      {id:'claw',name:{en:'Claw Strike',ru:'Удар когтем'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.05,desc:{en:'Nearest-row foe',ru:'По врагу ближайшего ряда'}},
      {id:'rally',name:{en:'Rally Cry',ru:'Боевой клич'},cd:3,reach:'any',targets:'all-ally',type:'buff',stat:'pow',amount:2,duration:2,desc:{en:'+2 to the primary damage stat (STR/INT) of the whole company',ru:'+2 к основной характеристике урона (СИЛА/ИНТ) всему отряду'}},
      {id:'guard',name:{en:'Guard Stance',ru:'Оборонительная стойка'},cd:2,reach:'any',targets:'self',type:'buff',stat:'def',amount:5,duration:2,desc:{en:'+5 DEF, 2 turns',ru:'+5 к защите, 2 хода'}},
      {id:'ferocity',name:{en:'Feral Ferocity',ru:'Дикая ярость'},cd:5,minLevel:7,reach:'any',targets:'all-ally',type:'buff',stat:'pow',amount:5,duration:3,desc:{en:'Ultimate: +5 to the primary damage stat (STR/INT) of the whole company, 3 turns (Lv7)',ru:'Ульта: +5 к основной характеристике урона (СИЛА/ИНТ) всему отряду на 3 хода (Ур.7)'}},
      {id:'tackle',name:{en:'Pack Tackle',ru:'Стая набрасывается'},cd:3,reach:'melee',targets:'single',type:'special',effect:'stun',desc:{en:'Melee foe; stuns them for 1 turn',ru:'Ближний враг оглушается на 1 ход'}},
    ]},
  morwen:{key:'morwen',name:{en:'Morwen',ru:'Морвена'},cls:{en:'Necromancer',ru:'Некромант'},icon:'M',color:'#7a5aa0',baseHp:24,baseStr:0,baseInt:9,baseDef:2,baseSpd:6,defaultRow:'back',cost:30,
    abilities:[
      {id:'wither',name:{en:'Withering Touch',ru:'Иссушающее касание'},cd:0,reach:'ranged',targets:'single',type:'damage',mult:0.85,lifesteal:0.3,desc:{en:'Dmg; heals self for 30% of damage dealt',ru:'Урон; лечит себя на 30% от нанесённого урона'}},
      {id:'frailty',name:{en:'Curse of Frailty',ru:'Проклятие немощи'},cd:2,reach:'ranged',targets:'single',type:'debuff',stat:'def',amount:-4,duration:2,desc:{en:'-4 DEF, 2 turns',ru:'-4 к защите, 2 хода'}},
      {id:'siphon',name:{en:'Soul Siphon',ru:'Похищение душ'},cd:3,reach:'ranged',targets:'all',type:'damage',mult:0.45,lifesteal:0.5,desc:{en:'All foes; heals self for 50% of total damage dealt',ru:'По всем врагам; лечит себя на 50% суммарного урона'}},
      {id:'embrace',name:{en:"Death's Embrace",ru:'Объятия смерти'},cd:5,minLevel:7,reach:'ranged',targets:'single',type:'damage',mult:1.6,dot:{amount:5,duration:3},desc:{en:'Ultimate: heavy damage + strong curse (Lv7)',ru:'Ульта: тяжёлый урон и мощное проклятие со временем (Ур.7)'}},
    ]},
  torvin:{key:'torvin',name:{en:'Torvin',ru:'Торвин'},cls:{en:'Paladin',ru:'Паладин'},icon:'T',color:'#c9a227',baseHp:38,baseStr:6,baseInt:0,baseDef:9,baseSpd:4,defaultRow:'front',cost:35,
    abilities:[
      {id:'shieldbash',name:{en:'Shield Bash',ru:'Удар щитом'},cd:0,reach:'melee',targets:'single',type:'damage',mult:0.9,desc:{en:'Nearest-row foe',ru:'По врагу ближайшего ряда'}},
      {id:'oath',name:{en:'Oath of Protection',ru:'Клятва защиты'},cd:2,reach:'any',targets:'single-ally',type:'buff',stat:'def',amount:5,duration:2,desc:{en:'+5 DEF to an ally, 2 turns',ru:'+5 к защите союзнику на 2 хода'}},
      {id:'light',name:{en:'Righteous Light',ru:'Праведный свет'},cd:3,reach:'any',targets:'single-ally',type:'heal',mult:0.4,flat:6,desc:{en:'Heal one ally',ru:'Лечит союзника'}},
      {id:'battlecry',name:{en:'Battle Cry',ru:'Боевой клич'},cd:5,minLevel:7,reach:'any',targets:'all-ally',type:'buff',stat:'pow',amount:3,duration:2,desc:{en:'Ultimate: +3 to the primary damage stat (STR/INT) of the whole company, 2 turns (Lv7)',ru:'Ульта: +3 к основной характеристике урона (СИЛА/ИНТ) всему отряду на 2 хода (Ур.7)'}},
    ]},
};
const HERO_ORDER = ['bram','sael','yvana','kest','ashra','doran','morwen','torvin'];
/* Locked heroes are earned, not bought — each one requires a specific achievement (trophy)
   instead of a win-count threshold or an embers purchase. */
const HERO_UNLOCK_ACHIEVEMENT = {ashra:'first_win',doran:'collector',morwen:'veteran',torvin:'flawless'};
function checkHeroUnlocks(){
  Object.keys(HERO_UNLOCK_ACHIEVEMENT).forEach(function(key){
    const achId=HERO_UNLOCK_ACHIEVEMENT[key];
    if(!META.heroesUnlocked[key]&&META.achievements&&META.achievements[achId])META.heroesUnlocked[key]=true;
  });
}
/* Party synergies: composition bonuses applied as fight-long buffs at the
   start of every PvE battle (startCombat -> applyPartySynergies). Never in
   arena/live PvP: those are resolved by the server engine, which has no
   synergy concept. A custom hero counts as its class template (tplKey).
   'need' = how many of 'heroes' must be in the party; 'who' = which
   party members get the buff ('all' or 'members'). */
const PARTY_SYNERGIES = [
  {id:'iron_line',name:{en:'Iron Line',ru:'Железный строй'},heroes:['bram','torvin','doran'],need:2,who:'all',stat:'def',amount:2,
    desc:{en:'2 of Warrior/Paladin/Beastmaster: whole company +2 DEF',ru:'2 из Воин/Паладин/Зверолов: весь отряд +2 к защите'}},
  {id:'arcane_circle',name:{en:'Arcane Circle',ru:'Тайный круг'},heroes:['ashra','morwen','yvana'],need:2,who:'all',stat:'mdef',amount:2,
    desc:{en:'2 of Pyromancer/Necromancer/Cleric: whole company +2 MDEF',ru:'2 из Пиромант/Некромант/Жрица: весь отряд +2 к магзащите'}},
  {id:'hunting_pack',name:{en:'Hunting Pack',ru:'Охотничья стая'},heroes:['sael','kest','doran'],need:2,who:'all',stat:'spd',amount:1,
    desc:{en:'2 of Ranger/Rogue/Beastmaster: whole company +1 SPD',ru:'2 из Лучник/Разбойник/Зверолов: весь отряд +1 к скорости'}},
  {id:'ash_and_bone',name:{en:'Ash and Bone',ru:'Пепел и кость'},heroes:['ashra','morwen'],need:2,who:'members',stat:'pow',amount:2,
    desc:{en:'Pyromancer + Necromancer: both +2 to their damage stat',ru:'Пиромант + Некромант: оба +2 к основной характеристике урона'}},
  {id:'steel_and_shadow',name:{en:'Steel and Shadow',ru:'Сталь и тень'},heroes:['bram','kest'],need:2,who:'members',stat:'pow',amount:2,
    desc:{en:'Warrior + Rogue: both +2 to their damage stat',ru:'Воин + Разбойник: оба +2 к основной характеристике урона'}},
];
function synergyBaseKey(key){
  if(HERO_DEFS[key])return key;
  const c=(META.customHeroes||[]).find(function(x){return x.id===key;});
  return c?c.tplKey:key;
}
/* keys: hero keys as picked (custom ids allowed). Returns active synergy defs. */
function activeSynergies(keys){
  const base=keys.map(synergyBaseKey);
  return PARTY_SYNERGIES.filter(function(s){
    return s.heroes.filter(function(h){return base.indexOf(h)>=0;}).length>=s.need;
  });
}
const CUSTOM_HERO_POINTS = 6;
/* Capped at 1 by design: the custom hero is meant to read as the account's
   own personal character (an identity, not a roster slot), not an
   interchangeable 4th-5th option alongside the 8 fixed heroes. Both places
   this gates — the "+ Create a Hero" add-card and the save handler's
   roster-full check — already read this constant, so changing it is the
   only change needed; nothing else hardcodes the old limit of 4. */
const CUSTOM_HERO_MAX = 1;
const CUSTOM_HP_PER_POINT = 3;
const CUSTOM_PASSIVES = [
  {id:'vitality',name:{en:'Vitality',ru:'Живучесть'},desc:{en:'+15% max HP',ru:'+15% к макс. HP'}},
  {id:'ironskin',name:{en:'Iron Skin',ru:'Стальная кожа'},desc:{en:'+3 DEF',ru:'+3 к защите'}},
  {id:'swift',name:{en:'Swift',ru:'Быстрота'},desc:{en:'+3 SPD',ru:'+3 к скорости'}},
  {id:'ferocity',name:{en:'Ferocity',ru:'Ярость'},desc:{en:'+2 to primary damage stat (STR/INT)',ru:'+2 к основной характеристике урона (СИЛА/ИНТ)'}},
];
function customPassiveDef(id){return CUSTOM_PASSIVES.find(function(p){return p.id===id;})||CUSTOM_PASSIVES[0];}
const CUSTOM_COLOR_SWATCHES=[
  {c:'#c98a3b'},{c:'#5f93ae'},{c:'#8fb08a'},{c:'#a56bc9'},{c:'#d9683f'},
  {c:'#b0995a'},{c:'#d94f6a'},{c:'#4fb0d9'},{c:'#e0c341'},{c:'#6a6aa0'},
  {c:'#ff3b3b',unlock:'first_win',name:{en:'Ember Red',ru:'Тлеющий алый'}},
  {c:'#f4d35e',unlock:'flawless',name:{en:'Sunlit Gold',ru:'Солнечное золото'}},
  {c:'#7b2cbf',unlock:'ascendant',name:{en:'Void Violet',ru:'Фиолетовая пустота'}},
  {c:'#e8e8e8',unlock:'giant_slayer',name:{en:'Bone White',ru:'Костяной белый'}},
];
function colorSwatchUnlocked(sw){return !sw.unlock||!!(META.achievements&&META.achievements[sw.unlock]);}
const CUSTOM_ICON_SWATCHES=[
  {icon:'★'},{icon:'♦'},{icon:'☾'},{icon:'✦'},{icon:'●'},{icon:'▲'},
  {icon:'⚔',unlock:'veteran',name:{en:'Blade',ru:'Клинок'}},
  {icon:'♛',unlock:'ascendant',name:{en:'Crown',ru:'Корона'}},
  {icon:'☠',unlock:'giant_slayer',name:{en:'Skull',ru:'Череп'}},
  {icon:'❖',unlock:'flawless',name:{en:'Gem',ru:'Самоцвет'}},
];
function iconSwatchUnlocked(sw){return !sw.unlock||!!(META.achievements&&META.achievements[sw.unlock]);}
function customHeroToDef(customId){
  const c=(META.customHeroes||[]).find(function(x){return x.id===customId;});
  if(!c)return null;
  const tpl=HERO_DEFS[c.tplKey];
  if(!tpl)return null;
  const dmgType=HERO_DMG_TYPE[c.tplKey]||'str';
  /* pow is the new generic allocation field; atk is kept only as a fallback so
     custom heroes created before this pass (saved with an 'atk' point count)
     still come out with the right power stat. */
  const powPts=(typeof c.pow==='number')?c.pow:(c.atk||0);
  let hp=tpl.baseHp+(c.hp||0)*CUSTOM_HP_PER_POINT;
  let str=tpl.baseStr+(dmgType==='str'?powPts:0);
  let intg=tpl.baseInt+(dmgType==='int'?powPts:0);
  let def=tpl.baseDef+(c.def||0), spd=tpl.baseSpd+(c.spd||0);
  const passive=c.passive||'vitality';
  if(passive==='vitality')hp=Math.round(hp*1.15);
  else if(passive==='ironskin')def+=3;
  else if(passive==='swift')spd+=3;
  else if(passive==='ferocity'){if(dmgType==='str')str+=2;else intg+=2;}
  return {
    key:c.id,name:{en:c.name,ru:c.name},cls:tpl.cls,icon:c.icon||tpl.icon,color:c.color||tpl.color,
    baseHp:hp,baseStr:str,baseInt:intg,baseDef:def,baseSpd:spd,
    defaultRow:tpl.defaultRow,cost:0,abilities:tpl.abilities,custom:true,tplKey:c.tplKey,passive:passive,
  };
}
function getHeroDef(key){
  return HERO_DEFS[key]||customHeroToDef(key);
}

/* Enemy and boss portraits, same minimalist style as HERO_ICON_SVG (dark silhouette
   on the unit's own color circle) — replaces the old single-letter icons. */
const ENEMY_ICON_SVG = {
  grunt:'<svg viewBox="0 0 24 24"><path d="M5 19L17 3c1 3-1 6-3 8l-7 9-2-1z" fill="#12141a"/></svg>',
  archer:'<svg viewBox="0 0 24 24"><path d="M6 3c6 3 6 15 0 18" fill="none" stroke="#12141a" stroke-width="1.6"/><path d="M6 12h13M16 8l3 4-3 4" fill="none" stroke="#12141a" stroke-width="1.6" stroke-linecap="round"/></svg>',
  hound:'<svg viewBox="0 0 24 24"><path d="M12 4l3 3 4-1-2 4 2 4-4 3-3 4-3-4-4-3 2-4-2-4 4 1 3-3z" fill="#12141a"/><circle cx="9.5" cy="11" r="1" fill="#e9e4d6"/><circle cx="14.5" cy="11" r="1" fill="#e9e4d6"/></svg>',
  shaman:'<svg viewBox="0 0 24 24"><path d="M12 21V9" stroke="#12141a" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="6" r="3.4" fill="#12141a"/><circle cx="10.7" cy="5.6" r="0.7" fill="#e9e4d6"/><circle cx="13.3" cy="5.6" r="0.7" fill="#e9e4d6"/></svg>',
  revenant:'<svg viewBox="0 0 24 24"><ellipse cx="12" cy="13" rx="7.5" ry="8" fill="#12141a"/><circle cx="9" cy="11" r="1.1" fill="#e9e4d6"/><circle cx="15" cy="11" r="1.1" fill="#e9e4d6"/></svg>',
  wraith:'<svg viewBox="0 0 24 24"><path d="M12 2a6 6 0 016 6v7l-2-2-2 2-2-2-2 2-2-2-2 2V8a6 6 0 016-6z" fill="#12141a"/></svg>',
  caster:'<svg viewBox="0 0 24 24"><path d="M12 3l7 17H5L12 3z" fill="#12141a"/><circle cx="12" cy="13" r="2" fill="#e9e4d6"/></svg>',
  hand:'<svg viewBox="0 0 24 24"><path d="M6 21V11a2 2 0 014 0v-3a2 2 0 014 0v2a2 2 0 014 0v2a2 2 0 014 0v9H6z" fill="#12141a"/></svg>',
  knight:'<svg viewBox="0 0 24 24"><path d="M12 3a7 7 0 017 7v5l-2 6H7l-2-6V10a7 7 0 017-7z" fill="none" stroke="#12141a" stroke-width="1.6"/><path d="M12 10v8M8.5 14h7" stroke="#12141a" stroke-width="1.6" stroke-linecap="round"/></svg>',
  banshee:'<svg viewBox="0 0 24 24"><ellipse cx="12" cy="11" rx="6" ry="7.5" fill="#12141a"/><ellipse cx="12" cy="14.5" rx="2.2" ry="3" fill="#e9e4d6"/></svg>',
  ashlord:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="#12141a"/><circle cx="9.3" cy="11" r="1.3" fill="#e9e4d6"/><circle cx="14.7" cy="11" r="1.3" fill="#e9e4d6"/><path d="M6 6l2 3M18 6l-2 3M9 4l1 3M15 4l-1 3M12 3v3" stroke="#12141a" stroke-width="1.4" stroke-linecap="round"/></svg>',
  stalker:'<svg viewBox="0 0 24 24"><path d="M4 18c2-6 5-9 8-9s5 2 6 5c1-3 3-1 2 1-1 1-3 1-4 0-1 3-4 5-7 5-2 0-4-1-5-2z" fill="#12141a"/><circle cx="9" cy="10" r="0.9" fill="#e9e4d6"/></svg>',
  zealot:'<svg viewBox="0 0 24 24"><path d="M12 3a5 5 0 015 5v3l3 9H4l3-9V8a5 5 0 015-5z" fill="#12141a"/><path d="M9 21l3-5 3 5" stroke="#e9e4d6" stroke-width="1" fill="none"/></svg>',
  /* Frozen Reach biome roster, same minimalist dark-silhouette style. */
  frostling:'<svg viewBox="0 0 24 24"><path d="M12 2l3 6-1 4 3 5-2 5H9l-2-5 3-5-1-4z" fill="#12141a"/></svg>',
  icearcher:'<svg viewBox="0 0 24 24"><path d="M7 3c5 3 5 15 0 18" fill="none" stroke="#12141a" stroke-width="1.6"/><path d="M7 12h12M15 8l4 4-4 4" fill="none" stroke="#12141a" stroke-width="1.6" stroke-linecap="round"/><circle cx="18" cy="6" r="1.2" fill="#12141a"/></svg>',
  rimewolf:'<svg viewBox="0 0 24 24"><path d="M12 4l2 3 4-1-1 4 3 3-4 2-2 4-2-4-4-2 3-3-1-4 4 1z" fill="#12141a"/><circle cx="9.5" cy="11" r="1" fill="#e9e4d6"/><circle cx="14.5" cy="11" r="1" fill="#e9e4d6"/></svg>',
  frostwitch:'<svg viewBox="0 0 24 24"><path d="M12 21V9" stroke="#12141a" stroke-width="1.6" stroke-linecap="round"/><path d="M12 9l-2-3M12 9l2-3" stroke="#12141a" stroke-width="1.4" stroke-linecap="round"/><circle cx="12" cy="6" r="3.2" fill="#12141a"/></svg>',
  glacierknight:'<svg viewBox="0 0 24 24"><path d="M12 3l7 4v5c0 5-3 8-7 9-4-1-7-4-7-9V7l7-4z" fill="none" stroke="#12141a" stroke-width="1.6"/><path d="M12 3v18M8 9l4 3 4-3" stroke="#12141a" stroke-width="1.2" fill="none"/></svg>',
  wailingblizzard:'<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 017 7c0 3-2 4-2 7l-1 4H8l-1-4c0-3-2-4-2-7a7 7 0 017-7z" fill="#12141a"/><path d="M9 8l1 3-1 2M15 8l-1 3 1 2" stroke="#e9e4d6" stroke-width="0.8" fill="none"/></svg>',
  permafrostwarden:'<svg viewBox="0 0 24 24"><path d="M12 2l4 4-1 5 3 4-2 7H8l-2-7 3-4-1-5z" fill="#12141a"/><path d="M9 12l3 2 3-2" stroke="#e9e4d6" stroke-width="1" fill="none"/></svg>',
  /* Thornwild biome roster, same minimalist dark-silhouette style. */
  thornling:'<svg viewBox="0 0 24 24"><path d="M12 3c5 2 7 8 4 13-2 3-6 4-8 2-3-3-2-8 1-11 1-1 2-3 3-4z" fill="#12141a"/><path d="M9 10l2 2M9 14l2-1" stroke="#e9e4d6" stroke-width="0.8" fill="none"/></svg>',
  spinearcher:'<svg viewBox="0 0 24 24"><path d="M7 3c5 3 5 15 0 18" fill="none" stroke="#12141a" stroke-width="1.6"/><path d="M7 12h12M15 8l4 4-4 4" fill="none" stroke="#12141a" stroke-width="1.6" stroke-linecap="round"/><circle cx="18" cy="6" r="1.2" fill="#12141a"/></svg>',
  bramblehound:'<svg viewBox="0 0 24 24"><path d="M12 4l3 3 4-1-2 4 2 4-4 3-3 4-3-4-4-3 2-4-2-4 4 1 3-3z" fill="#12141a"/><path d="M8 7l1 2M16 7l-1 2M8 17l1-2M16 17l-1-2" stroke="#12141a" stroke-width="1" stroke-linecap="round"/><circle cx="9.5" cy="11" r="1" fill="#e9e4d6"/><circle cx="14.5" cy="11" r="1" fill="#e9e4d6"/></svg>',
  rootwitch:'<svg viewBox="0 0 24 24"><path d="M12 21V9" stroke="#12141a" stroke-width="1.6" stroke-linecap="round"/><path d="M12 15l-3 2M12 18l3 2" stroke="#12141a" stroke-width="1.2" stroke-linecap="round" fill="none"/><circle cx="12" cy="6" r="3.4" fill="#12141a"/></svg>',
  mosswarden:'<svg viewBox="0 0 24 24"><path d="M12 3a7 7 0 017 7v5l-2 6H7l-2-6V10a7 7 0 017-7z" fill="none" stroke="#12141a" stroke-width="1.6"/><path d="M9 9l1 3-1 3M15 9l-1 3 1 3" stroke="#12141a" stroke-width="1.2" fill="none"/></svg>',
  thornknight:'<svg viewBox="0 0 24 24"><path d="M12 3l7 4v5c0 5-3 8-7 9-4-1-7-4-7-9V7l7-4z" fill="none" stroke="#12141a" stroke-width="1.6"/><path d="M8 9l2 2-2 2M16 9l-2 2 2 2" stroke="#12141a" stroke-width="1.1" fill="none"/></svg>',
  wailingvine:'<svg viewBox="0 0 24 24"><ellipse cx="12" cy="11" rx="6" ry="7.5" fill="#12141a"/><path d="M9 16l-1 4M15 16l1 4M12 17v4" stroke="#12141a" stroke-width="1" stroke-linecap="round"/><ellipse cx="12" cy="10" rx="2" ry="2.6" fill="#e9e4d6"/></svg>',
  brambletyrant:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="#12141a"/><circle cx="9.3" cy="11" r="1.3" fill="#e9e4d6"/><circle cx="14.7" cy="11" r="1.3" fill="#e9e4d6"/><path d="M6 6l2 3M18 6l-2 3M9 4l1 3M15 4l-1 3M12 3v3" stroke="#12141a" stroke-width="1.4" stroke-linecap="round"/></svg>',
  /* Drowned Barrows biome roster: waterlogged dead and things of the deep. */
  drownedthrall:'<svg viewBox="0 0 24 24"><path d="M12 3a4 4 0 014 4c0 2-1 3-1 4l3 4-2 1-1 6H9l-1-6-2-1 3-4c0-1-1-2-1-4a4 4 0 014-4z" fill="#12141a"/><circle cx="10.5" cy="7" r="0.9" fill="#e9e4d6"/><circle cx="13.5" cy="7" r="0.9" fill="#e9e4d6"/></svg>',
  tidearcher:'<svg viewBox="0 0 24 24"><path d="M4 20L18 6" stroke="#12141a" stroke-width="1.8" stroke-linecap="round"/><path d="M18 6l-1 4M18 6l-4 1M15 9l-2-2" stroke="#12141a" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>',
  eelhound:'<svg viewBox="0 0 24 24"><path d="M3 14c3-5 6-6 9-4s5 3 9 0c-1 4-4 6-8 5s-6-2-10-1z" fill="#12141a"/><circle cx="18" cy="12" r="0.9" fill="#e9e4d6"/><path d="M8 8l1-3M12 8l1-3" stroke="#e9e4d6" stroke-width="0.8"/></svg>',
  saltwitch:'<svg viewBox="0 0 24 24"><path d="M12 21V9" stroke="#12141a" stroke-width="1.6" stroke-linecap="round"/><path d="M8 15c1.5-1 2.5-1 4 0s2.5 1 4 0" stroke="#12141a" stroke-width="1.2" fill="none"/><circle cx="12" cy="6" r="3.4" fill="#12141a"/></svg>',
  barrowknight:'<svg viewBox="0 0 24 24"><path d="M12 3l7 4v5c0 5-3 8-7 9-4-1-7-4-7-9V7l7-4z" fill="#12141a"/><path d="M8 11h8M12 7v8" stroke="#e9e4d6" stroke-width="1"/></svg>',
  bellwraith:'<svg viewBox="0 0 24 24"><path d="M12 3a6 6 0 016 6v6l2 3H4l2-3V9a6 6 0 016-6z" fill="#12141a"/><circle cx="12" cy="20" r="1.6" fill="#12141a"/></svg>',
  mirewarden:'<svg viewBox="0 0 24 24"><path d="M12 3a7 7 0 017 7v5l-2 6H7l-2-6V10a7 7 0 017-7z" fill="none" stroke="#12141a" stroke-width="1.6"/><path d="M7 13c1.7-1 3.3-1 5 0s3.3 1 5 0" stroke="#12141a" stroke-width="1.2" fill="none"/></svg>',
  deeptyrant:'<svg viewBox="0 0 24 24"><circle cx="12" cy="11" r="7" fill="#12141a"/><circle cx="9.3" cy="10" r="1.3" fill="#e9e4d6"/><circle cx="14.7" cy="10" r="1.3" fill="#e9e4d6"/><path d="M7 17l-1 4M10 18v4M14 18v4M17 17l1 4" stroke="#12141a" stroke-width="1.3" stroke-linecap="round"/></svg>',
};
const BOSS_ICON_SVG = {
  tidemother:'<svg viewBox="0 0 24 24"><path d="M12 2c3 2 5 5 5 9 0 3-1 5-1 7h-8c0-2-1-4-1-7 0-4 2-7 5-9z" fill="#12141a"/><circle cx="9.8" cy="10" r="1.1" fill="#e9e4d6"/><circle cx="14.2" cy="10" r="1.1" fill="#e9e4d6"/><path d="M3 20c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" stroke="#12141a" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>',
  warden:'<svg viewBox="0 0 24 24"><path d="M12 2c-2 2-4 2.5-4 6 0 2 1 3 1 5-2 .5-3 2-3 4a6 6 0 0012 0c0-2-1-3.5-3-4 0-2 1-3 1-5 0-3.5-2-4-4-6z" fill="#12141a"/><circle cx="9.5" cy="14" r="1.1" fill="#e9e4d6"/><circle cx="14.5" cy="14" r="1.1" fill="#e9e4d6"/></svg>',
  colossus:'<svg viewBox="0 0 24 24"><path d="M2 20L9 6l3 4 3-6 7 16H2z" fill="#12141a"/><path d="M9 6l2 5-3 2M12 10l1 4-2 1" stroke="#e9e4d6" stroke-width="0.8" fill="none"/></svg>',
  vessel:'<svg viewBox="0 0 24 24"><path d="M9 3h6l1 3-1 2c2 2 3 5 3 8a6 6 0 01-12 0c0-3 1-6 3-8l-1-2 1-3z" fill="#12141a"/><path d="M9 12l2 2-1 3 2 2" stroke="#e9e4d6" stroke-width="0.9" fill="none"/></svg>',
  rimesovereign:'<svg viewBox="0 0 24 24"><path d="M12 2l3 5-1 4 4 3-2 8H10l-2-8 4-3-1-4z" fill="#12141a"/><circle cx="9.5" cy="15" r="1.1" fill="#e9e4d6"/><circle cx="14.5" cy="15" r="1.1" fill="#e9e4d6"/><path d="M6 6l2 2M18 6l-2 2M12 2v3" stroke="#12141a" stroke-width="1.2" stroke-linecap="round"/></svg>',
  thornsovereign:'<svg viewBox="0 0 24 24"><path d="M12 2c-2 2-4 2.5-4 6 0 2 1 3 1 5-2 .5-3 2-3 4a6 6 0 0012 0c0-2-1-3.5-3-4 0-2 1-3 1-5 0-3.5-2-4-4-6z" fill="#12141a"/><circle cx="9.5" cy="14" r="1.1" fill="#e9e4d6"/><circle cx="14.5" cy="14" r="1.1" fill="#e9e4d6"/><path d="M6 10l2 2M18 10l-2 2M8 7l1 2M16 7l-1 2" stroke="#12141a" stroke-width="1" stroke-linecap="round"/></svg>',
};

const ENEMY_DEFS = {
  grunt:{name:{en:'Ashling Grunt',ru:'Пепельный головорез'},icon:'G',color:'#8a6a55',hp:19,atk:6,def:3,spd:4,row:'front',
    abilities:[{id:'gash',name:{en:'Gash',ru:'Рубящий удар'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.0}]},
  archer:{name:{en:'Bone Archer',ru:'Костяной лучник'},icon:'R',color:'#9a9578',hp:15,atk:7,def:1,spd:6,row:'back',
    abilities:[{id:'shot',name:{en:'Shot',ru:'Выстрел'},cd:0,reach:'ranged',targets:'single',type:'damage',mult:0.9},
               {id:'aimed',name:{en:'Aimed Shot',ru:'Прицельный выстрел'},cd:2,reach:'ranged',targets:'single',type:'damage',mult:1.4}]},
  hound:{name:{en:'Cursed Hound',ru:'Проклятый пёс'},icon:'H',color:'#7a4a4a',hp:17,atk:8,def:2,spd:9,row:'front',
    abilities:[{id:'bite',name:{en:'Bite',ru:'Укус'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.0},
               {id:'rend',name:{en:'Rend',ru:'Разрыв'},cd:2,reach:'melee',targets:'single',type:'damage',mult:1.2,dot:{amount:2,duration:2}}]},
  shaman:{name:{en:'Wretch Shaman',ru:'Шаман-изгой'},icon:'W',color:'#6a7a5a',hp:17,atk:5,def:2,spd:5,row:'back',res:'magic',
    abilities:[{id:'hex',name:{en:'Hex Bolt',ru:'Проклятый заряд'},cd:0,reach:'ranged',targets:'single',type:'damage',mult:0.8},
               {id:'curse',name:{en:'Curse',ru:'Порча'},cd:3,reach:'ranged',targets:'single',type:'debuff',stat:'def',amount:-3,duration:2},
               {id:'darkmend',name:{en:'Dark Mend',ru:'Тёмное исцеление'},cd:3,reach:'any',targets:'single-ally',type:'heal',mult:0,flat:9}]},
  revenant:{name:{en:'Bloated Revenant',ru:'Раздутый ревенант'},icon:'V',color:'#5a3a4a',hp:42,atk:9,def:6,spd:3,row:'front',elite:true,res:'phys',
    abilities:[{id:'slam',name:{en:'Slam',ru:'Удар оземь'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.1},
               {id:'quake',name:{en:'Quake',ru:'Сотрясение'},cd:2,reach:'melee',targets:'row',type:'damage',mult:1.0}]},
  wraith:{name:{en:'Iron Wraith',ru:'Железный призрак'},icon:'I',color:'#5a6a7a',hp:31,atk:10,def:7,spd:5,row:'front',res:'phys',
    abilities:[{id:'chop',name:{en:'Chop',ru:'Рубящий удар'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.0},
               {id:'sunder',name:{en:'Sunder',ru:'Раскол брони'},cd:2,reach:'melee',targets:'single',type:'debuff',stat:'def',amount:-4,duration:2}]},
  caster:{name:{en:'Ashfall Caster',ru:'Пепельный заклинатель'},icon:'C',color:'#8a5a7a',hp:21,atk:11,def:3,spd:7,row:'back',res:'magic',
    abilities:[{id:'bolt',name:{en:'Ash Bolt',ru:'Пепельный заряд'},cd:0,reach:'ranged',targets:'single',type:'damage',mult:1.0},
               {id:'ashfall',name:{en:'Ashfall',ru:'Пепельный дождь'},cd:3,reach:'ranged',targets:'all',type:'damage',mult:0.6}]},
  hand:{name:{en:"Warden's Hand",ru:'Длань стража'},icon:'X',color:'#4a3a3a',hp:58,atk:13,def:8,spd:6,row:'front',elite:true,res:'phys',
    abilities:[{id:'crush',name:{en:'Crush',ru:'Сокрушение'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.1},
               {id:'break',name:{en:'Break Guard',ru:'Пролом защиты'},cd:2,reach:'melee',targets:'single',type:'damage',mult:1.5}]},
  knight:{name:{en:'Ashen Knight',ru:'Пепельный рыцарь'},icon:'K',color:'#3a3540',hp:34,atk:14,def:9,spd:7,row:'front',res:'phys',
    abilities:[{id:'kslash',name:{en:'Ashblade Slash',ru:'Удар пепельным клинком'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.15},
               {id:'kbreak',name:{en:'Armor Break',ru:'Пролом брони'},cd:2,reach:'melee',targets:'single',type:'debuff',stat:'def',amount:-5,duration:2}]},
  banshee:{name:{en:'Wailing Banshee',ru:'Воющая банши'},icon:'Y',color:'#7a5a8a',hp:26,atk:13,def:4,spd:9,row:'back',res:'magic',
    abilities:[{id:'wail',name:{en:'Piercing Wail',ru:'Пронзительный вой'},cd:0,reach:'ranged',targets:'single',type:'damage',mult:1.1},
               {id:'dirge',name:{en:'Death Dirge',ru:'Похоронный плач'},cd:3,reach:'ranged',targets:'all',type:'damage',mult:0.7,dot:{amount:3,duration:2}}]},
  ashlord:{name:{en:'Ashlord',ru:'Владыка пепла'},icon:'Ω',color:'#2a1f28',hp:80,atk:16,def:10,spd:6,row:'front',elite:true,res:'phys',
    abilities:[{id:'ashslam',name:{en:'Ashlord Slam',ru:'Удар владыки'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.2},
               {id:'ashwave',name:{en:'Ash Wave',ru:'Пепельная волна'},cd:2,reach:'melee',targets:'row',type:'damage',mult:0.9,dot:{amount:3,duration:2}},
               {id:'ashroar',name:{en:'Doom Roar',ru:'Рёв погибели'},cd:3,reach:'any',targets:'all-ally',type:'debuff',stat:'def',amount:-3,duration:2}]},
  stalker:{name:{en:'Cinder Stalker',ru:'Тлеющий крадец'},icon:'S',color:'#a3572e',hp:22,atk:11,def:2,spd:11,row:'front',
    abilities:[{id:'quickslash',name:{en:'Quick Slash',ru:'Быстрый разрез'},cd:0,reach:'melee',targets:'single',type:'damage',mult:0.95},
               {id:'pounce',name:{en:'Pounce',ru:'Прыжок'},cd:2,reach:'melee',targets:'single',type:'damage',mult:1.3,dot:{amount:3,duration:2}}]},
  zealot:{name:{en:'Ash Zealot',ru:'Пепельный фанатик'},icon:'Z',color:'#7a3a2a',hp:25,atk:9,def:4,spd:6,row:'back',res:'magic',
    abilities:[{id:'zealbolt',name:{en:'Zeal Bolt',ru:'Заряд рвения'},cd:0,reach:'ranged',targets:'single',type:'damage',mult:0.85},
               {id:'fanaticmend',name:{en:'Fanatic Mending',ru:'Фанатичное исцеление'},cd:3,reach:'any',targets:'single-ally',type:'heal',mult:0,flat:14},
               {id:'bloodrite',name:{en:'Blood Rite',ru:'Кровавый ритуал'},cd:3,reach:'any',targets:'single-ally',type:'buff',stat:'pow',amount:4,duration:2}]},
  /* Frozen Reach biome roster — the frost counterpart to the Ashfall March roster above.
     Uses the same generic ability engine (dot/buff/debuff), just reflavored as chill/frostbite
     instead of ash/burning, so no new combat mechanics are needed. */
  frostling:{name:{en:'Rime Ghoul',ru:'Инистый упырь'},icon:'F',color:'#4f7488',hp:20,atk:6,def:3,spd:4,row:'front',
    abilities:[{id:'frostgash',name:{en:'Frost Claw',ru:'Ледяной коготь'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.0},
               {id:'chillstrike',name:{en:'Chilling Strike',ru:'Морозящий удар'},cd:2,reach:'melee',targets:'single',type:'damage',mult:1.15,dot:{amount:2,duration:2}}]},
  icearcher:{name:{en:'Icicle Archer',ru:'Ледяной лучник'},icon:'R',color:'#7fa8bd',hp:15,atk:7,def:1,spd:6,row:'back',
    abilities:[{id:'icebolt',name:{en:'Icicle Shot',ru:'Выстрел сосулькой'},cd:0,reach:'ranged',targets:'single',type:'damage',mult:0.9},
               {id:'frostshot',name:{en:'Frostbound Shot',ru:'Морозный выстрел'},cd:2,reach:'ranged',targets:'single',type:'debuff',stat:'spd',amount:-3,duration:2}]},
  rimewolf:{name:{en:'Rime Wolf',ru:'Иневый волк'},icon:'H',color:'#3d5a6b',hp:18,atk:8,def:2,spd:10,row:'front',
    abilities:[{id:'nip',name:{en:'Frost Bite',ru:'Морозный укус'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.0},
               {id:'rend2',name:{en:'Rime Rend',ru:'Ледяной разрыв'},cd:2,reach:'melee',targets:'single',type:'damage',mult:1.2,dot:{amount:2,duration:2}}]},
  frostwitch:{name:{en:'Frost Witch',ru:'Морозная ведьма'},icon:'W',color:'#5a7a8a',hp:18,atk:5,def:2,spd:5,row:'back',res:'magic',
    abilities:[{id:'rimebolt',name:{en:'Rime Bolt',ru:'Ледяной заряд'},cd:0,reach:'ranged',targets:'single',type:'damage',mult:0.8},
               {id:'winterscurse',name:{en:"Winter's Curse",ru:'Проклятие зимы'},cd:3,reach:'ranged',targets:'single',type:'debuff',stat:'pow',amount:-3,duration:2},
               {id:'frostmend',name:{en:'Frost Mend',ru:'Ледяное исцеление'},cd:3,reach:'any',targets:'single-ally',type:'heal',mult:0,flat:9}]},
  glacierknight:{name:{en:'Glacier Knight',ru:'Ледниковый рыцарь'},icon:'K',color:'#37454f',hp:36,atk:13,def:11,spd:6,row:'front',res:'phys',
    abilities:[{id:'iceslash',name:{en:'Glacial Slash',ru:'Ледниковый удар'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.15},
               {id:'shatterguard',name:{en:'Shatter Guard',ru:'Раскол щита'},cd:2,reach:'melee',targets:'single',type:'debuff',stat:'def',amount:-5,duration:2}]},
  wailingblizzard:{name:{en:'Blizzard Wraith',ru:'Дух метели'},icon:'Y',color:'#6a86a8',hp:27,atk:12,def:4,spd:9,row:'back',res:'magic',
    abilities:[{id:'howlingwind',name:{en:'Howling Wind',ru:'Воющий ветер'},cd:0,reach:'ranged',targets:'single',type:'damage',mult:1.1},
               {id:'blizzardsong',name:{en:'Blizzard Song',ru:'Песнь метели'},cd:3,reach:'ranged',targets:'all',type:'damage',mult:0.6,dot:{amount:2,duration:2}}]},
  permafrostwarden:{name:{en:'Permafrost Warden',ru:'Страж вечной мерзлоты'},icon:'X',color:'#2f4552',hp:44,atk:9,def:6,spd:4,row:'front',elite:true,res:'phys',
    abilities:[{id:'iceslam',name:{en:'Ice Slam',ru:'Ледяной удар'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.1},
               {id:'frostquake',name:{en:'Frostquake',ru:'Ледяное сотрясение'},cd:2,reach:'melee',targets:'row',type:'damage',mult:1.0}]},
  glaciertyrant:{name:{en:'Glacier Tyrant',ru:'Ледниковый тиран'},icon:'Ω',color:'#22323c',hp:64,atk:15,def:9,spd:5,row:'front',elite:true,res:'phys',
    abilities:[{id:'tyrantslam',name:{en:'Tyrant Slam',ru:'Удар тирана'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.2},
               {id:'icewave',name:{en:'Ice Wave',ru:'Ледяная волна'},cd:2,reach:'melee',targets:'row',type:'damage',mult:0.9,dot:{amount:3,duration:2}},
               {id:'frostroar',name:{en:'Frost Roar',ru:'Морозный рёв'},cd:3,reach:'any',targets:'all-ally',type:'debuff',stat:'spd',amount:-3,duration:2}]},
  /* Thornwild biome roster — the poison/thorn counterpart to the Ashfall and Frozen
     Reach rosters above. Same generic ability engine (dot/buff/debuff), reflavored
     as thorns/poison instead of ash/chill, so no new combat mechanics are needed. */
  thornling:{name:{en:'Thornling',ru:'Терновый прихвостень'},icon:'T',color:'#4a6b3a',hp:21,atk:6,def:3,spd:5,row:'front',
    abilities:[{id:'thornclaw',name:{en:'Thorn Claw',ru:'Терновый коготь'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.0},
               {id:'poisonbite',name:{en:'Poison Bite',ru:'Ядовитый укус'},cd:2,reach:'melee',targets:'single',type:'damage',mult:1.1,dot:{amount:2,duration:3}}]},
  spinearcher:{name:{en:'Spine Archer',ru:'Шипострел'},icon:'R',color:'#7a9a5a',hp:15,atk:7,def:1,spd:6,row:'back',
    abilities:[{id:'spineshot',name:{en:'Spine Shot',ru:'Шиповой выстрел'},cd:0,reach:'ranged',targets:'single',type:'damage',mult:0.9},
               {id:'barbedshot',name:{en:'Barbed Shot',ru:'Зазубренный выстрел'},cd:2,reach:'ranged',targets:'single',type:'damage',mult:1.0,dot:{amount:2,duration:3}}]},
  bramblehound:{name:{en:'Bramble Stalker',ru:'Терновый крадец'},icon:'H',color:'#5a7a3a',hp:18,atk:8,def:2,spd:10,row:'front',
    abilities:[{id:'brambite',name:{en:'Bramble Bite',ru:'Терновый укус'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.0},
               {id:'tangle',name:{en:'Tangle',ru:'Опутывание'},cd:2,reach:'melee',targets:'single',type:'debuff',stat:'spd',amount:-3,duration:2}]},
  rootwitch:{name:{en:'Root Witch',ru:'Корневая ведьма'},icon:'W',color:'#5a6a3a',hp:18,atk:5,def:2,spd:5,row:'back',res:'magic',
    abilities:[{id:'rootbolt',name:{en:'Root Bolt',ru:'Корневой заряд'},cd:0,reach:'ranged',targets:'single',type:'damage',mult:0.8},
               {id:'withercurse',name:{en:"Withering Curse",ru:'Увядающее проклятие'},cd:3,reach:'ranged',targets:'single',type:'debuff',stat:'pow',amount:-3,duration:2},
               {id:'sapmend',name:{en:'Sap Mend',ru:'Исцеление соком'},cd:3,reach:'any',targets:'single-ally',type:'heal',mult:0,flat:9}]},
  thornknight:{name:{en:'Thorn Knight',ru:'Терновый рыцарь'},icon:'K',color:'#3a4a2a',hp:37,atk:13,def:11,spd:6,row:'front',res:'phys',
    abilities:[{id:'thornslash',name:{en:'Thorn Slash',ru:'Терновый удар'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.15},
               {id:'barkguard',name:{en:'Shatter Bark',ru:'Раскол коры'},cd:2,reach:'melee',targets:'single',type:'debuff',stat:'def',amount:-5,duration:2}]},
  wailingvine:{name:{en:'Wailing Vine',ru:'Воющая лоза'},icon:'Y',color:'#6a8a4a',hp:27,atk:12,def:4,spd:9,row:'back',res:'magic',
    abilities:[{id:'lashingvine',name:{en:'Lashing Vine',ru:'Хлёсткая лоза'},cd:0,reach:'ranged',targets:'single',type:'damage',mult:1.1},
               {id:'vinesong',name:{en:'Vine Song',ru:'Песнь лозы'},cd:3,reach:'ranged',targets:'all',type:'damage',mult:0.6,dot:{amount:2,duration:3}}]},
  mosswarden:{name:{en:'Moss Warden',ru:'Страж мха'},icon:'X',color:'#2f4522',hp:45,atk:9,def:6,spd:4,row:'front',elite:true,res:'phys',
    abilities:[{id:'mossslam',name:{en:'Moss Slam',ru:'Удар мха'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.1},
               {id:'rootquake',name:{en:'Rootquake',ru:'Корневое сотрясение'},cd:2,reach:'melee',targets:'row',type:'damage',mult:1.0}]},
  brambletyrant:{name:{en:'Bramble Tyrant',ru:'Терновый тиран'},icon:'Ω',color:'#22321c',hp:65,atk:15,def:9,spd:5,row:'front',elite:true,res:'phys',
    abilities:[{id:'tyrantthorn',name:{en:'Tyrant Thorn',ru:'Шип тирана'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.2},
               {id:'thornwave',name:{en:'Thorn Wave',ru:'Терновая волна'},cd:2,reach:'melee',targets:'row',type:'damage',mult:0.9,dot:{amount:3,duration:3}},
               {id:'wildroar',name:{en:'Wild Roar',ru:'Дикий рёв'},cd:3,reach:'any',targets:'all-ally',type:'debuff',stat:'def',amount:-3,duration:2}]},
  /* Drowned Barrows roster: the alternative second chapter (see BIOME_ACT_CHOICES).
     Same generic ability engine; its own twist is the Mire Eel's stunning shock
     and life-draining barrow knights, so it plays differently from the Frozen Reach. */
  drownedthrall:{name:{en:'Drowned Thrall',ru:'Утопленник'},icon:'T',color:'#3f5a5e',hp:22,atk:6,def:3,spd:4,row:'front',
    abilities:[{id:'sodden',name:{en:'Sodden Fist',ru:'Мокрый кулак'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.0},
               {id:'chokegrip',name:{en:'Choking Grip',ru:'Удушающая хватка'},cd:2,reach:'melee',targets:'single',type:'damage',mult:1.2}]},
  tidearcher:{name:{en:'Barrow Harpooner',ru:'Курганный гарпунщик'},icon:'R',color:'#6a8a88',hp:15,atk:7,def:1,spd:6,row:'back',
    abilities:[{id:'harpoon',name:{en:'Harpoon',ru:'Гарпун'},cd:0,reach:'ranged',targets:'single',type:'damage',mult:0.9},
               {id:'barbharpoon',name:{en:'Barbed Harpoon',ru:'Зазубренный гарпун'},cd:2,reach:'ranged',targets:'single',type:'damage',mult:1.0,dot:{amount:2,duration:2}}]},
  eelhound:{name:{en:'Mire Eel',ru:'Болотный угорь'},icon:'H',color:'#2f4a4f',hp:17,atk:8,def:2,spd:11,row:'front',
    abilities:[{id:'eelbite',name:{en:'Eel Bite',ru:'Укус угря'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.0},
               {id:'eelshock',name:{en:'Numbing Shock',ru:'Парализующий разряд'},cd:4,reach:'melee',targets:'single',type:'special',effect:'stun',desc:{en:'Stuns a hero for 1 turn',ru:'Оглушает героя на 1 ход'}}]},
  saltwitch:{name:{en:'Brine Witch',ru:'Солевая ведьма'},icon:'W',color:'#4f6a6e',hp:18,atk:5,def:2,spd:5,row:'back',res:'magic',
    abilities:[{id:'brinebolt',name:{en:'Brine Bolt',ru:'Солёный заряд'},cd:0,reach:'ranged',targets:'single',type:'damage',mult:0.8},
               {id:'drownhex',name:{en:'Drowning Hex',ru:'Порча утопления'},cd:3,reach:'ranged',targets:'single',type:'debuff',stat:'def',amount:-3,duration:2},
               {id:'tidemend',name:{en:'Tide Mend',ru:'Исцеление прилива'},cd:3,reach:'any',targets:'single-ally',type:'heal',mult:0,flat:9}]},
  barrowknight:{name:{en:'Barrow Knight',ru:'Курганный рыцарь'},icon:'K',color:'#2c3a3c',hp:36,atk:13,def:11,spd:6,row:'front',res:'phys',
    abilities:[{id:'graveslash',name:{en:'Grave Slash',ru:'Могильный удар'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.15},
               {id:'gravedrain',name:{en:'Grave Drain',ru:'Могильное иссушение'},cd:2,reach:'melee',targets:'single',type:'damage',mult:1.0,lifesteal:0.5}]},
  bellwraith:{name:{en:'Bell Wraith',ru:'Колокольный призрак'},icon:'Y',color:'#5a7a80',hp:27,atk:12,def:4,spd:9,row:'back',res:'magic',
    abilities:[{id:'toll',name:{en:'Toll',ru:'Звон'},cd:0,reach:'ranged',targets:'single',type:'damage',mult:1.1},
               {id:'drownedbell',name:{en:'Drowned Bell',ru:'Утонувший колокол'},cd:3,reach:'ranged',targets:'all',type:'damage',mult:0.55,dot:{amount:2,duration:3}}]},
  mirewarden:{name:{en:'Mire Warden',ru:'Страж трясины'},icon:'X',color:'#22383c',hp:46,atk:9,def:6,spd:4,row:'front',elite:true,res:'phys',
    abilities:[{id:'mireslam',name:{en:'Mire Slam',ru:'Удар трясины'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.1},
               {id:'undertow',name:{en:'Undertow',ru:'Подводное течение'},cd:2,reach:'melee',targets:'row',type:'damage',mult:1.0}]},
  deeptyrant:{name:{en:'Tyrant of the Deep',ru:'Тиран глубин'},icon:'Ω',color:'#18282c',hp:64,atk:15,def:9,spd:5,row:'front',elite:true,res:'phys',
    abilities:[{id:'deepslam',name:{en:'Crushing Depth',ru:'Давление глубин'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.2},
               {id:'riptide',name:{en:'Riptide',ru:'Обратное течение'},cd:2,reach:'melee',targets:'row',type:'damage',mult:0.9,dot:{amount:3,duration:2}},
               {id:'abyssdrain',name:{en:'Abyssal Drain',ru:'Иссушение бездны'},cd:3,reach:'any',targets:'single',type:'damage',mult:1.1,lifesteal:0.6}]},
};

const BOSS_DEFS = {
  warden:{key:'warden',name:{en:'The Hollow Warden',ru:'Полый Страж'},icon:'☠',color:'#2a2020',hp:95,atk:12,def:8,spd:6,row:'front',boss:true,res:'phys',
    abilities:[{id:'smash',name:{en:'Smash',ru:'Крушащий удар'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.0},
               {id:'wslam',name:{en:'Warden Slam',ru:'Удар стража'},cd:2,reach:'melee',targets:'row',type:'damage',mult:1.4},
               {id:'roar',name:{en:'Hollow Roar',ru:'Полый рёв'},cd:3,reach:'any',targets:'all-ally',type:'debuff',stat:'pow',amount:-2,duration:2},
               {id:'overwhelm',name:{en:'Overwhelm',ru:'Подавление'},cd:3,reach:'melee',targets:'row',type:'damage',mult:1.7,requiresEnrage:true,desc:{en:'Enrage only: devastating blow on the nearest row',ru:'Только в ярости: сокрушительный удар по ближайшему ряду'}}]},
  colossus:{key:'colossus',name:{en:'The Ashwoken Colossus',ru:'Пепельно-пробуждённый колосс'},icon:'⛰',color:'#3a2a1f',hp:110,atk:11,def:11,spd:4,row:'front',boss:true,res:'phys',
    abilities:[{id:'stomp',name:{en:'Stomp',ru:'Топот'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.0},
               {id:'quake2',name:{en:'Ground Shatter',ru:'Раскол земли'},cd:2,reach:'melee',targets:'all',type:'damage',mult:0.55,desc:{en:'Hits every foe',ru:'Бьёт по всем врагам'}},
               {id:'harden',name:{en:'Harden Hide',ru:'Затвердение шкуры'},cd:3,reach:'any',targets:'self',type:'buff',stat:'def',amount:8,duration:2},
               {id:'avalanche',name:{en:'Avalanche',ru:'Лавина'},cd:3,reach:'melee',targets:'all',type:'damage',mult:0.9,requiresEnrage:true,desc:{en:'Enrage only: crushes every foe',ru:'Только в ярости: сокрушает всех врагов'}}]},
  vessel:{key:'vessel',name:{en:'The Withered Vessel',ru:'Иссохший сосуд'},icon:'♱',color:'#3a1f3a',hp:88,atk:13,def:6,spd:8,row:'front',boss:true,res:'magic',
    abilities:[{id:'grasp',name:{en:'Withering Grasp',ru:'Иссушающая хватка'},cd:0,reach:'any',targets:'single',type:'damage',mult:0.95,dot:{amount:3,duration:2}},
               {id:'drain',name:{en:'Drain Essence',ru:'Высасывание сути'},cd:2,reach:'any',targets:'single',type:'damage',mult:1.1,lifesteal:0.6},
               {id:'wither',name:{en:'Wither',ru:'Увядание'},cd:3,reach:'any',targets:'all-ally',type:'debuff',stat:'def',amount:-3,duration:2},
               {id:'collapse',name:{en:'Hollow Collapse',ru:'Пустотный обвал'},cd:3,reach:'any',targets:'all',type:'damage',mult:0.8,dot:{amount:4,duration:2},requiresEnrage:true,desc:{en:'Enrage only: withering blast on the whole company',ru:'Только в ярости: увядающий взрыв по всему отряду'}}]},
  rimesovereign:{key:'rimesovereign',name:{en:'The Rime Sovereign',ru:'Ледяной государь'},icon:'❄',color:'#1e2f38',hp:100,atk:13,def:9,spd:7,row:'front',boss:true,res:'magic',
    abilities:[{id:'frostclaw',name:{en:'Frost Claw',ru:'Ледяной коготь'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.0},
               {id:'glacialsmash',name:{en:'Glacial Smash',ru:'Ледниковый удар'},cd:2,reach:'melee',targets:'row',type:'damage',mult:1.4},
               {id:'wintersgrasp',name:{en:"Winter's Grasp",ru:'Хватка зимы'},cd:3,reach:'any',targets:'all-ally',type:'debuff',stat:'spd',amount:-3,duration:2},
               {id:'blizzard',name:{en:'Eternal Blizzard',ru:'Вечная метель'},cd:3,reach:'any',targets:'all',type:'damage',mult:1.6,requiresEnrage:true,desc:{en:'Enrage only: a howling blizzard engulfs the whole company',ru:'Только в ярости: воющая метель накрывает весь отряд'}}]},
  thornsovereign:{key:'thornsovereign',name:{en:'The Thorn Sovereign',ru:'Терновый государь'},icon:'❀',color:'#20301a',hp:102,atk:13,def:9,spd:6,row:'front',boss:true,res:'phys',
    abilities:[{id:'thornrake',name:{en:'Thorn Rake',ru:'Терновые грабли'},cd:0,reach:'melee',targets:'single',type:'damage',mult:1.0,dot:{amount:3,duration:2}},
               {id:'brambleslash',name:{en:'Bramble Slash',ru:'Терновый удар'},cd:2,reach:'melee',targets:'row',type:'damage',mult:1.4},
               {id:'wildgrowth',name:{en:'Wild Growth',ru:'Дикий рост'},cd:3,reach:'any',targets:'self',type:'buff',stat:'def',amount:6,duration:2},
               {id:'thornstorm',name:{en:'Thornstorm',ru:'Терновая буря'},cd:3,reach:'any',targets:'all',type:'damage',mult:1.5,dot:{amount:3,duration:2},requiresEnrage:true,desc:{en:'Enrage only: a storm of thorns tears through the whole company',ru:'Только в ярости: буря шипов обрушивается на весь отряд'}}]},
  tidemother:{key:'tidemother',name:{en:'The Tide Mother',ru:'Мать приливов'},icon:'≈',color:'#173036',hp:98,atk:13,def:8,spd:7,row:'front',boss:true,res:'magic',
    abilities:[{id:'brinelash',name:{en:'Brine Lash',ru:'Солёный хлыст'},cd:0,reach:'any',targets:'single',type:'damage',mult:1.0},
               {id:'tidecrash',name:{en:'Tide Crash',ru:'Удар прилива'},cd:2,reach:'melee',targets:'row',type:'damage',mult:1.35},
               {id:'embrace',name:{en:'Drowning Embrace',ru:'Объятия пучины'},cd:3,reach:'any',targets:'single',type:'special',effect:'stun',desc:{en:'Stuns a hero for 1 turn',ru:'Оглушает героя на 1 ход'}},
               {id:'deluge',name:{en:'Deluge',ru:'Потоп'},cd:3,reach:'any',targets:'all',type:'damage',mult:1.4,lifesteal:0.25,requiresEnrage:true,desc:{en:'Enrage only: a flood crashes over the whole company and feeds her',ru:'Только в ярости: потоп накрывает весь отряд и питает её'}}]},
};

/* Biomes parametrize which enemy/elite pools and which bosses a march can draw from.
   The march is no longer a single biome picked at hero-select: it's always the same
   three-act story, Ashfall -> Frost -> Verdant, each act harder than the last (see
   BIOME_ACT_ORDER / biomeKeyForLayer below), with that act's own boss as a mid-march
   "chapter climax" fight before the story moves on to the next, harsher land. */
const BIOME_DEFS = {
  ashfall:{key:'ashfall',name:{en:'Ashfall March',ru:'Пепельный поход'},tint:null,
    pools:{1:['grunt','archer'],2:['grunt','archer','hound','shaman'],3:['wraith','caster','hound','shaman','stalker'],4:['knight','banshee','wraith','caster','zealot']},
    eliteKeys:{1:'revenant',2:'revenant',3:'hand',4:'ashlord'},
    eliteMinions:{1:['grunt'],2:['grunt','archer','hound'],3:['wraith','caster','stalker'],4:['knight','banshee','zealot']},
    bosses:['warden','colossus','vessel']},
  frost:{key:'frost',name:{en:'Frozen Reach',ru:'Морозный рубеж'},tint:'frost',
    pools:{1:['frostling','icearcher'],2:['frostling','icearcher','rimewolf','frostwitch'],3:['rimewolf','frostwitch','glacierknight','wailingblizzard'],4:['glacierknight','wailingblizzard','frostwitch','rimewolf']},
    eliteKeys:{1:'permafrostwarden',2:'permafrostwarden',3:'glaciertyrant',4:'glaciertyrant'},
    eliteMinions:{1:['frostling'],2:['frostling','icearcher','rimewolf'],3:['rimewolf','frostwitch','glacierknight'],4:['glacierknight','wailingblizzard','frostwitch']},
    bosses:['rimesovereign']},
  drowned:{key:'drowned',name:{en:'The Drowned Barrows',ru:'Затопленные курганы'},tint:'drowned',
    pools:{1:['drownedthrall','tidearcher'],2:['drownedthrall','tidearcher','eelhound','saltwitch'],3:['eelhound','saltwitch','barrowknight','bellwraith'],4:['barrowknight','bellwraith','saltwitch','eelhound']},
    eliteKeys:{1:'mirewarden',2:'mirewarden',3:'deeptyrant',4:'deeptyrant'},
    eliteMinions:{1:['drownedthrall'],2:['drownedthrall','tidearcher','eelhound'],3:['eelhound','saltwitch','barrowknight'],4:['barrowknight','bellwraith','saltwitch']},
    bosses:['tidemother']},
  verdant:{key:'verdant',name:{en:'The Thornwild',ru:'Терновая чаща'},tint:'verdant',
    pools:{1:['thornling','spinearcher'],2:['thornling','spinearcher','bramblehound','rootwitch'],3:['bramblehound','rootwitch','thornknight','wailingvine'],4:['thornknight','wailingvine','rootwitch','bramblehound']},
    eliteKeys:{1:'mosswarden',2:'mosswarden',3:'brambletyrant',4:'brambletyrant'},
    eliteMinions:{1:['thornling'],2:['thornling','spinearcher','bramblehound'],3:['bramblehound','rootwitch','thornknight'],4:['thornknight','wailingvine','rootwitch']},
    bosses:['thornsovereign']},
};
function getBiome(key){return BIOME_DEFS[key]||BIOME_DEFS.ashfall;}
/* The fixed story order every march now follows, easiest to hardest. See
   biomeKeyForLayer()/CH1/CH2 near TOTAL_MAP_LAYERS for how a layer index maps
   to one of these three acts. */
const BIOME_ACT_ORDER = ['ashfall','frost','verdant'];
/* Each act's possible lands. The second chapter forks: the Frozen Reach or the
   Drowned Barrows, picked on the hero-select screen (META.routeChoice) or at
   random; Daily/Weekly draw it from their seed. BIOME_ACT_ORDER stays the
   default route (and the one old saved marches without RUN.route follow). */
const BIOME_ACT_CHOICES = [['ashfall'],['frost','drowned'],['verdant']];
const ROUTE_CHOICES = ['random','frost','drowned'];
function rollRoute(choice){
  return BIOME_ACT_CHOICES.map(function(opts){
    if(opts.length===1)return opts[0];
    return opts.indexOf(choice)>=0?choice:pick(opts);
  });
}
function runRoute(){return (typeof RUN!=='undefined'&&RUN&&Array.isArray(RUN.route)&&RUN.route.length===BIOME_ACT_CHOICES.length)?RUN.route:BIOME_ACT_ORDER;}
const BIOME_FLAVOR = {
  ashfall:{en:'Smouldering ashlands — the original march, warm-toned foes and a fire-touched final boss.',ru:'Тлеющие пепельные земли — изначальный маршрут, враги в тёплых тонах и финальный босс, тронутый огнём.'},
  frost:{en:'A frozen wasteland with its own roster of ice-bound foes and a different final boss.',ru:'Замёрзшая пустошь со своим набором ледяных врагов и другим финальным боссом.'},
  drowned:{en:'Flooded grave-mounds: drowned dead, eels whose shock stuns, knights that drink the life they spill.',
    ru:'Залитые водой курганы: утопленники, угри, чей разряд оглушает, и рыцари, пьющие пролитую жизнь.'},
  verdant:{en:'An overgrown, poison-choked wild — thorned beasts and witches, ruled by a sovereign wreathed in brambles.',ru:'Заросшая, пропитанная ядом чащоба — терновые звери и ведьмы под властью государя, увитого шипами.'},
};
/* Shown once as a short full-screen-modal interlude the moment the party steps
   onto the map of a new act, right after a chapter boss falls (see
   maybeShowChapterTransition() / onCombatWin()). Two short lines per arriving
   biome: what's left behind, and what the road now looks like — enough to sell
   "one continuous story" without turning into a real cutscene. Keyed by the
   biome key being ENTERED (BIOME_ACT_ORDER[1] and [2] only — there's no
   transition into the first act, the march just begins there). */
const CHAPTER_ARRIVAL = {
  frost:{en:'The ashlands fall away behind the company, their embers fading to grey. Ahead, the air sharpens — the road climbs into a wind-scoured, frozen reach.',
    ru:'Пепельные земли остаются позади, их угли подёргиваются сединой. Впереди воздух становится резче — дорога поднимается в продуваемый ветром, промёрзший край.'},
  drowned:{en:'The ashlands sink behind the company into black, standing water. Ahead, half-flooded barrows rise from the mire, and something below rings a bell that should have rusted silent long ago.',
    ru:'Пепельные земли остаются позади и тонут в чёрной стоячей воде. Впереди из трясины поднимаются полузатопленные курганы, и что-то на дне звонит в колокол, который давно должен был заржаветь.'},
  /* Arrival in the Thornwild after the Drowned Barrows (key: '<to>_from_<from>'). */
  verdant_from_drowned:{en:'The water drains away into roots and rot. Thorned vines drink the last of the mire — the march climbs out into a wild that grows faster than it can be cut back.',
    ru:'Вода уходит в корни и гниль. Терновые плети допивают остатки трясины — поход выбирается в чащу, что разрастается быстрее, чем её успевают вырубать.'},
  verdant:{en:'The last frost cracks underfoot and gives way to damp, living ground. Thorned vines creep across the path ahead — the march enters a wild that grows faster than it can be cut back.',
    ru:'Последний лёд трескается под ногами, уступая влажной, живой земле. Терновые плети стелются поперёк тропы — поход входит в чащу, что разрастается быстрее, чем её успевают вырубать.'},
};

/* ============================= BESTIARY ============================= */
/* Records which foes the player has actually met in combat (win or lose — meeting
   them is what teaches the player their stats/weakness, not beating them), so the
   Legacy screen can show a compendium instead of forcing a re-fight to check a
   forgotten weakness. Keyed 'enemy:<ENEMY_DEFS key>' / 'boss:<BOSS_DEFS key>'. */
function recordBestiary(list){
  META.bestiary=META.bestiary||{};
  let changed=false;
  (list||[]).forEach(function(u){
    const dkey=u.boss?('boss:'+u.bossKey):('enemy:'+u.key);
    if(!META.bestiary[dkey]){META.bestiary[dkey]=true;changed=true;}
  });
  if(changed)saveMeta();
}
/* Same vulnerability rule as the in-combat corner badge (see renderCombat) — kept as
   a shared helper so the bestiary and the battle badge can never drift apart. */
function bestiaryWeaknessInfo(def){
  if(!def||!def.res)return null;
  const weak=def.res==='magic'?'phys':'magic';
  return {icon:weak==='phys'?'⚔':'✦',
    label:weak==='phys'?M('Weak to physical (STR) attacks','Слаб к физическим атакам (СИЛА)'):M('Weak to magic (INT) attacks','Слаб к магическим атакам (ИНТ)')};
}
/* All enemy keys a biome can throw at the party, across every tier and elites/minions,
   deduped — used to group the bestiary by march instead of dumping one flat list. */
function biomeEnemyKeys(biome){
  const set={};
  [1,2,3,4].forEach(function(t){
    (biome.pools[t]||[]).forEach(function(k){set[k]=true;});
    (biome.eliteMinions[t]||[]).forEach(function(k){set[k]=true;});
    if(biome.eliteKeys[t])set[biome.eliteKeys[t]]=true;
  });
  return Object.keys(set);
}
function bestiaryRow(wrap,key,def,isBoss){
  const dkey=(isBoss?'boss:':'enemy:')+key;
  const known=!!(META.bestiary&&META.bestiary[dkey]);
  const row=el('div','row',null);
  row.style.cssText='align-items:center;';
  const av=el('div','hero-avatar',known?def.icon:'?');
  av.style.cssText='background:'+(known?def.color:'var(--surface2)')+';flex-shrink:0;';
  row.appendChild(av);
  const info=el('div','',null);
  info.style.flex='1';
  if(known){
    const weak=bestiaryWeaknessInfo(def);
    const tag=isBoss?" <span class='item-tag' style='color:var(--danger);'>"+M('Boss','Босс')+"</span>":(def.elite?" <span class='item-tag' style='color:var(--accent2);'>"+M('Elite','Элита')+"</span>":'');
    info.innerHTML='<strong>'+L(def.name)+'</strong>'+tag+
      "<br><span style='color:var(--muted);font-size:11px;'>"+statAbbr('hp')+' '+def.hp+' &middot; '+statAbbr('atk')+' '+def.atk+' &middot; '+statAbbr('def')+' '+def.def+' &middot; '+statAbbr('spd')+' '+def.spd+"</span>"+
      (weak?"<br><span style='font-size:11px;color:var(--accent);'>"+weak.icon+' '+weak.label+"</span>":'');
  } else {
    // Keep this short: the full explanation is shown once at the top of the modal
    // instead of being repeated on every single undiscovered row, which used to
    // read as a wall of identical sentences.
    info.innerHTML="<strong style='color:var(--muted);'>"+M('Undiscovered','Не изучен')+"</strong>";
  }
  row.appendChild(info);
  wrap.appendChild(row);
}
function openBestiaryModal(){
  const wrap=el('div','stack');
  wrap.appendChild(el('h3','',M('Bestiary','Бестиарий')));
  const total=Object.keys(ENEMY_DEFS).length+Object.keys(BOSS_DEFS).length;
  const known=Object.keys(META.bestiary||{}).length;
  wrap.appendChild(el('div','eyebrow',known+' / '+total+' '+M('discovered','изучено')));
  if(known<total){
    const hint=el('div','',null);
    hint.style.cssText='font-size:12px;color:var(--muted);margin-bottom:4px;';
    hint.textContent=M('Undiscovered foes are revealed once you meet them in combat.','Неизученные враги открываются после первой встречи с ними в бою.');
    wrap.appendChild(hint);
  }
  Object.keys(BIOME_DEFS).forEach(function(bk,i){
    const biome=BIOME_DEFS[bk];
    wrap.appendChild(el('div','eyebrow',(i+1)+'. '+L(biome.name)));
    biomeEnemyKeys(biome).forEach(function(k){bestiaryRow(wrap,k,ENEMY_DEFS[k],false);});
    (biome.bosses||[]).forEach(function(bossKey){bestiaryRow(wrap,bossKey,BOSS_DEFS[bossKey],true);});
  });
  const close=el('button','primary',M('Close','Закрыть'));
  close.addEventListener('click',closeModal);
  wrap.appendChild(close);
  openModal(wrap);
}

/* Roguelike-trial-style difficulty modifiers, toggled independently of and stacking on
   top of Ascension. Persisted per-player in META.modifiers, copied onto RUN.modifiers
   in startNewRun() (see there for the Daily Challenge exception). */
const MODIFIER_DEFS = [
  {key:'eliteVanguard',name:{en:'Elite Vanguard',ru:'Авангард элиты'},
    desc:{en:'Noticeably more elite fights along the march.',ru:'Заметно больше боёв с элитными противниками за поход.'}},
  {key:'earlyStorm',name:{en:'Early Storm',ru:'Ранняя буря'},
    desc:{en:'Tougher enemy tiers and stat scaling arrive sooner in the march.',ru:'Более сильные враги и их характеристики нарастают раньше по ходу похода.'}},
  {key:'brokenWard',name:{en:'Broken Ward',ru:'Разбитый оберег'},
    desc:{en:'Your company takes 15% more damage, but earns 20% more gold from battles.',ru:'Отряд получает на 15% больше урона, но зарабатывает на 20% больше золота за бои.'}},
];

/* Weapon/armor archetypes group the 8 heroes (and any custom hero, via tplKey)
   by fighting style so gear can be restricted to the classes it makes sense
   for — a healer doesn't wield a warhammer, a pyromancer doesn't carry a bow.
   Trinkets and relics stay universal (no classes field = any class). */
const GEAR_ARCHETYPES = {
  heavy:['bram','doran','torvin'],     // Warrior, Beastmaster, Paladin — melee front line (STR)
  finesse:['sael','kest'],             // Ranger, Rogue — bows/blades (STR)
  arcane:['ashra','morwen'],           // Pyromancer, Necromancer — staves/tomes (INT)
  holy:['yvana'],                      // Cleric — holy symbols/wands (INT)
};
const ARMOR_ARCHETYPES = {
  heavy:['bram','doran','torvin'],       // physical armor — rolls DEF
  light:['sael','kest'],                 // physical light armor — rolls DEF
  arcaneLight:['ashra','morwen','yvana'],// robes/wards for the casters — rolls MDEF instead of DEF
};

const ITEM_POOL = [
  /* ---- heavy weapons (Warrior / Beastmaster / Paladin) — roll STR ---- */
  {id:'w1',slot:'weapon',classes:GEAR_ARCHETYPES.heavy,name:{en:'Rusted Shortsword',ru:'Ржавый короткий меч'},rarity:'common',mods:{str:2}},
  {id:'w1b',slot:'weapon',classes:GEAR_ARCHETYPES.heavy,name:{en:'Notched Hatchet',ru:'Щербатый топор'},rarity:'common',mods:{str:3,spd:-1}},
  {id:'w2',slot:'weapon',classes:GEAR_ARCHETYPES.heavy,name:{en:'Ember-forged Blade',ru:'Клинок, кованный в углях'},rarity:'rare',mods:{str:4,spd:1}},
  {id:'w2b',slot:'weapon',classes:GEAR_ARCHETYPES.heavy,name:{en:"Ashsmith's Hammer",ru:'Молот пепельного кузнеца'},rarity:'rare',mods:{str:5,def:1,spd:-2}},
  {id:'w3',slot:'weapon',classes:GEAR_ARCHETYPES.heavy,name:{en:"Warden's Cleaver",ru:'Тесак стража'},rarity:'epic',mods:{str:7,spd:-1}},
  /* ---- finesse weapons (Ranger / Rogue) — roll STR ---- */
  {id:'w4',slot:'weapon',classes:GEAR_ARCHETYPES.finesse,name:{en:'Hunting Bow',ru:'Охотничий лук'},rarity:'common',mods:{str:2}},
  {id:'w4b',slot:'weapon',classes:GEAR_ARCHETYPES.finesse,name:{en:'Notched Daggers',ru:'Зазубренные кинжалы'},rarity:'common',mods:{str:1,spd:2}},
  {id:'w5',slot:'weapon',classes:GEAR_ARCHETYPES.finesse,name:{en:"Tracker's Recurve",ru:'Составной лук следопыта'},rarity:'rare',mods:{str:3,spd:2}},
  {id:'w5b',slot:'weapon',classes:GEAR_ARCHETYPES.finesse,name:{en:'Half-shade Blades',ru:'Клинки полутени'},rarity:'rare',mods:{str:4,spd:1}},
  {id:'w6',slot:'weapon',classes:GEAR_ARCHETYPES.finesse,name:{en:'Last Breath Longbow',ru:'Лук последнего вздоха'},rarity:'epic',mods:{str:6,spd:2}},
  /* ---- arcane weapons (Pyromancer / Necromancer) — roll INT ---- */
  {id:'w7',slot:'weapon',classes:GEAR_ARCHETYPES.arcane,name:{en:'Cracked Focus',ru:'Треснувший фокус'},rarity:'common',mods:{int:2,hp:2}},
  {id:'w7b',slot:'weapon',classes:GEAR_ARCHETYPES.arcane,name:{en:'Ashwood Staff',ru:'Пепельный посох'},rarity:'common',mods:{int:3}},
  {id:'w8',slot:'weapon',classes:GEAR_ARCHETYPES.arcane,name:{en:'Smoldering Grimoire',ru:'Тлеющий гримуар'},rarity:'rare',mods:{int:4,hp:3}},
  {id:'w8b',slot:'weapon',classes:GEAR_ARCHETYPES.arcane,name:{en:'Withered Bark Staff',ru:'Посох иссохшей коры'},rarity:'rare',mods:{int:4,mdef:1}},
  {id:'w9',slot:'weapon',classes:GEAR_ARCHETYPES.arcane,name:{en:'Scepter of the Dying Star',ru:'Скипетр угасшей звезды'},rarity:'epic',mods:{int:7,hp:4}},
  /* ---- holy weapons (Cleric) — roll INT ---- */
  {id:'w10',slot:'weapon',classes:GEAR_ARCHETYPES.holy,name:{en:'Plain Holy Symbol',ru:'Простой символ веры'},rarity:'common',mods:{int:1,hp:4}},
  {id:'w10b',slot:'weapon',classes:GEAR_ARCHETYPES.holy,name:{en:'Blessed Wand',ru:'Освящённый жезл'},rarity:'common',mods:{int:2,hp:2}},
  {id:'w11',slot:'weapon',classes:GEAR_ARCHETYPES.holy,name:{en:'Dawnlight Emblem',ru:'Символ рассветной зари'},rarity:'rare',mods:{int:3,hp:5}},
  {id:'w11b',slot:'weapon',classes:GEAR_ARCHETYPES.holy,name:{en:'Ashen Brotherhood Beads',ru:'Чётки пепельного братства'},rarity:'rare',mods:{int:3,mdef:1}},
  {id:'w12',slot:'weapon',classes:GEAR_ARCHETYPES.holy,name:{en:'Scepter of Unshaken Faith',ru:'Скипетр незыблемой веры'},rarity:'epic',mods:{int:5,hp:8}},
  /* ---- heavy armor (Warrior / Beastmaster / Paladin) — rolls DEF ---- */
  {id:'a1',slot:'armor',classes:ARMOR_ARCHETYPES.heavy,name:{en:'Boiled Leather',ru:'Варёная кожа'},rarity:'common',mods:{def:2,hp:4}},
  {id:'a1b',slot:'armor',classes:ARMOR_ARCHETYPES.heavy,name:{en:'Studded Jerkin',ru:'Клёпаная куртка'},rarity:'common',mods:{def:3}},
  {id:'a2',slot:'armor',classes:ARMOR_ARCHETYPES.heavy,name:{en:'Chain Hauberk',ru:'Кольчужный хауберк'},rarity:'rare',mods:{def:4}},
  {id:'a2b',slot:'armor',classes:ARMOR_ARCHETYPES.heavy,name:{en:"Militia Plate",ru:'Латы ополченца'},rarity:'rare',mods:{def:3,hp:6}},
  {id:'a3',slot:'armor',classes:ARMOR_ARCHETYPES.heavy,name:{en:'Bulwark Plate',ru:'Латы бастиона'},rarity:'epic',mods:{def:7,spd:-2}},
  /* ---- light armor (Ranger / Rogue) — rolls DEF, same as before this pass but restricted to just these two now that the casters have their own robes below ---- */
  {id:'a4',slot:'armor',classes:ARMOR_ARCHETYPES.light,name:{en:"Traveler's Cloak",ru:'Дорожный плащ'},rarity:'common',mods:{def:1,spd:1}},
  {id:'a4b',slot:'armor',classes:ARMOR_ARCHETYPES.light,name:{en:'Simple Wrap',ru:'Простая накидка'},rarity:'common',mods:{def:1,hp:3}},
  {id:'a5',slot:'armor',classes:ARMOR_ARCHETYPES.light,name:{en:'Ashwalker Cloak',ru:'Плащ пепельного странника'},rarity:'rare',mods:{def:2,spd:2}},
  {id:'a5b',slot:'armor',classes:ARMOR_ARCHETYPES.light,name:{en:'Light Cuirass',ru:'Лёгкая кираса'},rarity:'rare',mods:{def:3,hp:3}},
  {id:'a6',slot:'armor',classes:ARMOR_ARCHETYPES.light,name:{en:'Ashveil Mantle',ru:'Мантия пепельной вуали'},rarity:'epic',mods:{def:4,spd:2,hp:4}},
  /* ---- arcane-light armor (Pyromancer / Necromancer / Cleric) — new: rolls MDEF
     instead of DEF, so a caster's robe protects against magic the way a
     warrior's plate protects against blades. Casters end up with little
     physical DEF unless a trinket/relic gives them some — intentional, it's
     what the back row and their reach-based kit is for. ---- */
  {id:'a7',slot:'armor',classes:ARMOR_ARCHETYPES.arcaneLight,name:{en:'Ashwoven Robe',ru:'Одеяние из пепельной ткани'},rarity:'common',mods:{mdef:2,spd:1}},
  {id:'a7b',slot:'armor',classes:ARMOR_ARCHETYPES.arcaneLight,name:{en:'Warding Sash',ru:'Оберегающий пояс'},rarity:'common',mods:{mdef:1,hp:3}},
  {id:'a8',slot:'armor',classes:ARMOR_ARCHETYPES.arcaneLight,name:{en:'Glyph-stitched Mantle',ru:'Мантия с вышитыми рунами'},rarity:'rare',mods:{mdef:3,spd:1}},
  {id:'a8b',slot:'armor',classes:ARMOR_ARCHETYPES.arcaneLight,name:{en:'Cindercloth Vestments',ru:'Одеяние из тлеющей ткани'},rarity:'rare',mods:{mdef:2,def:1,hp:4}},
  {id:'a9',slot:'armor',classes:ARMOR_ARCHETYPES.arcaneLight,name:{en:'Veil of the Last Ember',ru:'Вуаль последнего уголька'},rarity:'epic',mods:{mdef:5,spd:2,hp:4}},
  /* ---- trinkets: universal, no class restriction. 'atk' here means generic
     power — applied to whichever stat (STR or INT) the wearer actually uses,
     resolved dynamically at equip time (see applyModsDelta). ---- */
  {id:'t1',slot:'trinket',name:{en:'Lucky Coin',ru:'Счастливая монета'},rarity:'common',mods:{spd:2}},
  {id:'t1b',slot:'trinket',name:{en:'Tin Band',ru:'Оловянное кольцо'},rarity:'common',mods:{hp:3}},
  {id:'t1c',slot:'trinket',name:{en:'Worn Compass',ru:'Потёртый компас'},rarity:'common',mods:{atk:1}},
  {id:'t2',slot:'trinket',name:{en:'Vial of Vigor',ru:'Флакон бодрости'},rarity:'rare',mods:{hp:8}},
  {id:'t2b',slot:'trinket',name:{en:"Hunter's Charm",ru:'Амулет охотника'},rarity:'rare',mods:{atk:2,spd:1}},
  {id:'t2c',slot:'trinket',name:{en:'Signet of Resolve',ru:'Перстень стойкости'},rarity:'rare',mods:{def:2,hp:2}},
  {id:'t2d',slot:'trinket',name:{en:'Warded Locket',ru:'Медальон с оберегом'},rarity:'rare',mods:{mdef:2,hp:2}},
  {id:'t3',slot:'trinket',name:{en:'Ember-kissed Locket',ru:'Овеянный угольями медальон'},rarity:'epic',mods:{atk:3,spd:2}},
  {id:'t3b',slot:'trinket',name:{en:"Titan's Knuckle",ru:'Кулак титана'},rarity:'epic',mods:{atk:3,def:2,hp:4}},
  {id:'t3c',slot:'trinket',name:{en:'Aegis of Both Worlds',ru:'Эгида обоих миров'},rarity:'epic',mods:{def:2,mdef:2,hp:3}},
  /* ---- biome trinkets: drop only in their own land (see itemInCurrentBiome),
     a little stronger than the generic ones of the same rarity. ---- */
  {id:'b_ash1',slot:'trinket',biome:'ashfall',name:{en:'Cinder Bead',ru:'Шлаковая бусина'},rarity:'common',mods:{atk:1,hp:3}},
  {id:'b_ash2',slot:'trinket',biome:'ashfall',name:{en:'Smoulder Ring',ru:'Тлеющее кольцо'},rarity:'rare',mods:{atk:2,spd:1,hp:3}},
  {id:'b_ash3',slot:'trinket',biome:'ashfall',name:{en:'Colossus Ember',ru:'Уголь колосса'},rarity:'epic',mods:{atk:4,def:1,hp:4}},
  {id:'b_frost1',slot:'trinket',biome:'frost',name:{en:'Rime Shard',ru:'Осколок инея'},rarity:'common',mods:{mdef:1,spd:1,hp:2}},
  {id:'b_frost2',slot:'trinket',biome:'frost',name:{en:'Wolfpelt Clasp',ru:'Застёжка из волчьей шкуры'},rarity:'rare',mods:{spd:3,hp:4}},
  {id:'b_frost3',slot:'trinket',biome:'frost',name:{en:'Heart of the Glacier',ru:'Сердце ледника'},rarity:'epic',mods:{def:3,mdef:3,hp:6}},
  {id:'b_drown1',slot:'trinket',biome:'drowned',name:{en:'Grave Pearl',ru:'Могильная жемчужина'},rarity:'common',mods:{hp:5,mdef:1}},
  {id:'b_drown2',slot:'trinket',biome:'drowned',name:{en:'Barrow Bell Clapper',ru:'Язык курганного колокола'},rarity:'rare',mods:{atk:2,mdef:2,hp:2}},
  {id:'b_drown3',slot:'trinket',biome:'drowned',name:{en:"Tide Mother's Scale",ru:'Чешуя Матери приливов'},rarity:'epic',mods:{atk:3,hp:10,spd:1}},
  {id:'b_thorn1',slot:'trinket',biome:'verdant',name:{en:'Thorn Sprig',ru:'Терновая веточка'},rarity:'common',mods:{atk:1,spd:1,hp:1}},
  {id:'b_thorn2',slot:'trinket',biome:'verdant',name:{en:'Venom Gland',ru:'Ядовитая железа'},rarity:'rare',mods:{atk:3,spd:1}},
  {id:'b_thorn3',slot:'trinket',biome:'verdant',name:{en:'Crown of Brambles',ru:'Терновый венец'},rarity:'epic',mods:{atk:4,spd:2,def:1,hp:2}},
  /* ---- biome weapons and armor: one of each per land, rare, a step above the
     generic rare of their archetype. Each land favours different classes, so
     every archetype has a land worth reaching. ---- */
  {id:'b_ash_w',slot:'weapon',biome:'ashfall',classes:GEAR_ARCHETYPES.heavy,name:{en:'Slagbreaker Maul',ru:'Шлакобойный молот'},rarity:'rare',mods:{str:5,hp:3}},
  {id:'b_ash_a',slot:'armor',biome:'ashfall',classes:ARMOR_ARCHETYPES.arcaneLight,name:{en:'Soot-veiled Robe',ru:'Закопчённое одеяние'},rarity:'rare',mods:{mdef:3,hp:4}},
  {id:'b_frost_w',slot:'weapon',biome:'frost',classes:GEAR_ARCHETYPES.finesse,name:{en:'Icicle Fang Knives',ru:'Ножи-сосульки'},rarity:'rare',mods:{str:4,spd:2}},
  {id:'b_frost_a',slot:'armor',biome:'frost',classes:ARMOR_ARCHETYPES.heavy,name:{en:'Rimebound Hauberk',ru:'Заиндевелый хауберк'},rarity:'rare',mods:{def:4,mdef:1,hp:3}},
  {id:'b_drown_w',slot:'weapon',biome:'drowned',classes:GEAR_ARCHETYPES.arcane,name:{en:'Drowned Tome',ru:'Утопленный фолиант'},rarity:'rare',mods:{int:4,hp:5}},
  {id:'b_drown_a',slot:'armor',biome:'drowned',classes:ARMOR_ARCHETYPES.light,name:{en:'Sharkskin Jerkin',ru:'Куртка из акульей кожи'},rarity:'rare',mods:{def:2,mdef:1,hp:5}},
  {id:'b_thorn_w',slot:'weapon',biome:'verdant',classes:GEAR_ARCHETYPES.holy,name:{en:'Briar Censer',ru:'Терновая кадильница'},rarity:'rare',mods:{int:4,hp:4}},
  {id:'b_thorn_a',slot:'armor',biome:'verdant',classes:ARMOR_ARCHETYPES.arcaneLight,name:{en:'Mossweave Shawl',ru:'Шаль из мохового плетения'},rarity:'rare',mods:{mdef:3,spd:2}},
];

/* Each relic's passive hook is implemented once in the combat engine (see
   hasRelic() call sites) and its log line reads the equipped relic's own
   name/passiveDesc, so several relics can safely share one passive — that's
   how this pool adds variety without new combat mechanics per item. */
const RELIC_POOL = [
  {id:'r1',slot:'relic',name:{en:'Ember Charm',ru:'Тлеющий талисман'},rarity:'rare',mods:{},passive:'vampiric',
    passiveDesc:{en:'Heals the wearer for 15% of damage they deal',ru:'Лечит владельца на 15% от нанесённого им урона'}},
  {id:'r1b',slot:'relic',name:{en:'Blood Fetish',ru:'Кровавый фетиш'},rarity:'rare',mods:{atk:1},passive:'vampiric',
    passiveDesc:{en:'Heals the wearer for 15% of damage they deal',ru:'Лечит владельца на 15% от нанесённого им урона'}},
  {id:'r2',slot:'relic',name:{en:'Thorned Bangle',ru:'Браслет с шипами'},rarity:'rare',mods:{def:1},passive:'thorns',
    passiveDesc:{en:'Reflects 20% of damage taken back at the attacker',ru:'Отражает 20% полученного урона обратно атакующему'}},
  {id:'r2b',slot:'relic',name:{en:'Spiked Guard',ru:'Шипастый нагрудник'},rarity:'epic',mods:{def:2,mdef:1},passive:'thorns',
    passiveDesc:{en:'Reflects 20% of damage taken back at the attacker',ru:'Отражает 20% полученного урона обратно атакующему'}},
  {id:'r3',slot:'relic',name:{en:'Lucky Fang',ru:'Счастливый клык'},rarity:'rare',mods:{},passive:'crit_boost',
    passiveDesc:{en:'+15% critical hit chance',ru:'+15% к шансу критического удара'}},
  {id:'r3b',slot:'relic',name:{en:"Predator's Fang",ru:'Клык хищника'},rarity:'epic',mods:{atk:1},passive:'crit_boost',
    passiveDesc:{en:'+15% critical hit chance',ru:'+15% к шансу критического удара'}},
  {id:'r4',slot:'relic',name:{en:'Phoenix Down',ru:'Перо феникса'},rarity:'epic',mods:{},passive:'revive',
    passiveDesc:{en:'The first time the wearer would fall, they survive at 1 HP instead (once per march)',ru:'Когда владелец должен пасть, он впервые вместо этого выживает с 1 HP (раз за поход)'}},
  {id:'r5',slot:'relic',name:{en:'Frostbrand Ring',ru:'Ледяное клеймо'},rarity:'epic',mods:{mdef:2},passive:'chill_on_hit',
    passiveDesc:{en:'25% chance on hit to stun the target for 1 turn',ru:'25% шанс при ударе оглушить цель на 1 ход'}},
  {id:'r5b',slot:'relic',name:{en:'Frostkissed Band',ru:'Морозный перстень'},rarity:'rare',mods:{spd:1,mdef:1},passive:'chill_on_hit',
    passiveDesc:{en:'25% chance on hit to stun the target for 1 turn',ru:'25% шанс при ударе оглушить цель на 1 ход'}},
  {id:'r6',slot:'relic',name:{en:'Iron Will Talisman',ru:'Талисман железной воли'},rarity:'rare',mods:{mdef:1},passive:'last_stand',
    passiveDesc:{en:'+30% DEF/MDEF while below 25% HP',ru:'+30% к защите/магической защите, когда HP ниже 25%'}},
  {id:'r6b',slot:'relic',name:{en:'Ward of Endurance',ru:'Оберег стойкости'},rarity:'rare',mods:{hp:5,mdef:1},passive:'last_stand',
    passiveDesc:{en:'+30% DEF/MDEF while below 25% HP',ru:'+30% к защите/магической защите, когда HP ниже 25%'}},
  /* Second relic wave: variants of the original passives plus five new ones
     (executioner, ember_brand, mender, cinderproof, reaper). Their numbers
     live in RELIC_TUNING (js/combat-core.js, shared with the server). */
  {id:'r1c',slot:'relic',name:{en:'Chalice of the Hollow',ru:'Чаша Пустоты'},rarity:'epic',mods:{atk:1,hp:3},passive:'vampiric',
    passiveDesc:{en:'Heals the wearer for 15% of damage they deal',ru:'Лечит владельца на 15% от нанесённого им урона'}},
  {id:'r2c',slot:'relic',name:{en:'Briar Bracer',ru:'Терновый наруч'},rarity:'rare',mods:{hp:4},passive:'thorns',
    passiveDesc:{en:'Reflects 20% of damage taken back at the attacker',ru:'Отражает 20% полученного урона обратно атакующему'}},
  {id:'r3c',slot:'relic',name:{en:"Gambler's Die",ru:'Кость игрока'},rarity:'rare',mods:{spd:1},passive:'crit_boost',
    passiveDesc:{en:'+15% critical hit chance',ru:'+15% к шансу критического удара'}},
  {id:'r4b',slot:'relic',name:{en:'Ember of Second Dawn',ru:'Уголёк второго рассвета'},rarity:'epic',mods:{hp:4},passive:'revive',
    passiveDesc:{en:'The first time the wearer would fall, they survive at 1 HP instead (once per march)',ru:'Когда владелец должен пасть, он впервые вместо этого выживает с 1 HP (раз за поход)'}},
  {id:'r7',slot:'relic',name:{en:"Headsman's Coin",ru:'Монета палача'},rarity:'rare',mods:{atk:1},passive:'executioner',
    passiveDesc:{en:'+30% damage to targets below 30% HP',ru:'+30% к урону по целям с HP ниже 30%'}},
  {id:'r7b',slot:'relic',name:{en:'Verdict Shard',ru:'Осколок приговора'},rarity:'epic',mods:{atk:2,spd:1},passive:'executioner',
    passiveDesc:{en:'+30% damage to targets below 30% HP',ru:'+30% к урону по целям с HP ниже 30%'}},
  {id:'r8',slot:'relic',name:{en:'Cinder Brand',ru:'Пепельное клеймо'},rarity:'rare',mods:{},passive:'ember_brand',
    passiveDesc:{en:'30% chance on hit to set the target burning (3 dmg, 2 turns)',ru:'30% шанс при ударе поджечь цель (3 урона, 2 хода)'}},
  {id:'r8b',slot:'relic',name:{en:'Ashfall Sigil',ru:'Печать пеплопада'},rarity:'epic',mods:{atk:1,mdef:1},passive:'ember_brand',
    passiveDesc:{en:'30% chance on hit to set the target burning (3 dmg, 2 turns)',ru:'30% шанс при ударе поджечь цель (3 урона, 2 хода)'}},
  {id:'r9',slot:'relic',name:{en:"Pilgrim's Censer",ru:'Кадило паломника'},rarity:'rare',mods:{hp:4},passive:'mender',
    passiveDesc:{en:'Healing done by the wearer is 25% stronger',ru:'Лечение от владельца на 25% сильнее'}},
  {id:'r9b',slot:'relic',name:{en:'Hearth Lantern',ru:'Фонарь очага'},rarity:'epic',mods:{mdef:2,hp:3},passive:'mender',
    passiveDesc:{en:'Healing done by the wearer is 25% stronger',ru:'Лечение от владельца на 25% сильнее'}},
  {id:'r10',slot:'relic',name:{en:'Frostglass Vial',ru:'Флакон из морозного стекла'},rarity:'rare',mods:{mdef:1},passive:'cinderproof',
    passiveDesc:{en:'Burns deal half damage to the wearer',ru:'Ожоги наносят владельцу вдвое меньше урона'}},
  {id:'r10b',slot:'relic',name:{en:'Salamander Scale',ru:'Чешуя саламандры'},rarity:'epic',mods:{def:1,mdef:2,hp:3},passive:'cinderproof',
    passiveDesc:{en:'Burns deal half damage to the wearer',ru:'Ожоги наносят владельцу вдвое меньше урона'}},
  {id:'r11',slot:'relic',name:{en:"Gravedigger's Tally",ru:'Счёт могильщика'},rarity:'rare',mods:{spd:1},passive:'reaper',
    passiveDesc:{en:'Killing a foe heals the wearer for 12% of max HP',ru:'Убийство врага лечит владельца на 12% от макс. HP'}},
  {id:'r11b',slot:'relic',name:{en:'Crow-Feather Pin',ru:'Булавка с вороньим пером'},rarity:'epic',mods:{atk:1,spd:1},passive:'reaper',
    passiveDesc:{en:'Killing a foe heals the wearer for 12% of max HP',ru:'Убийство врага лечит владельца на 12% от макс. HP'}},
];
const RELIC_TUNING=EmberCombatCore.RELIC_TUNING; // defined in js/combat-core.js

/* ---- rarity gating: early layers mostly common, epic gear only shows up
   once the march gets dangerous (tierForLayer 1..4). Fixes gear that used
   to drop with completely flat odds, so the best items could appear on the
   very first fight. ---- */
const RARITY_WEIGHTS_BY_TIER = {
  1:{common:80,rare:20,epic:0},
  2:{common:55,rare:40,epic:5},
  3:{common:30,rare:45,epic:25},
  4:{common:15,rare:40,epic:45},
};
function rollRarity(tier){
  const w=RARITY_WEIGHTS_BY_TIER[tier]||RARITY_WEIGHTS_BY_TIER[1];
  const total=w.common+w.rare+w.epic;
  let r=Math.random()*total;
  if(r<w.common)return 'common';
  r-=w.common;
  if(r<w.rare)return 'rare';
  return 'epic';
}
/* Biome-tagged gear (it.biome) only turns up while the march is in that land:
   rewards, shop stock and crafting all draw through here. */
function itemInCurrentBiome(it){
  return !it.biome||(typeof RUN!=='undefined'&&!!RUN&&!!RUN.map&&currentActBiomeKey()===it.biome);
}
function itemsOfRarity(rarity){return ITEM_POOL.filter(function(it){return it.rarity===rarity&&itemInCurrentBiome(it);});}
function relicsOfRarity(rarity){
  const pool=RELIC_POOL.filter(function(r){return r.rarity===rarity;});
  return pool.length?pool:RELIC_POOL.filter(function(r){return r.rarity==='rare';});
}
function randomItem(tier,forceRarity){
  const rarity=forceRarity||rollRarity(tier||1);
  const pool=itemsOfRarity(rarity);
  const base=pick(pool.length?pool:ITEM_POOL);
  return Object.assign({},base,{name:L(base.name)});
}
function randomRelic(tier){
  /* relics are rare/epic only — roll rarity but floor it at 'rare' */
  const rolled=rollRarity(tier||1);
  const rarity=rolled==='common'?'rare':rolled;
  const base=pick(relicsOfRarity(rarity));
  return Object.assign({},base,{name:L(base.name),passiveDesc:L(base.passiveDesc)});
}
function heroCanUseItem(hero,item){
  if(!item||!item.classes)return true;
  return item.classes.indexOf(hero.tplKey||hero.key)>=0;
}
/* ---- salvage: break unwanted gear down into shards (+ a little gold), so
   an item you can't use isn't just a "discard" with nothing to show for it.
   Relics salvage for more since they're rarer and can't be crafted back. */
function salvageYield(item){
  const relic=item.slot==='relic';
  const table=relic?{rare:{shards:8,gold:12},epic:{shards:15,gold:20}}
                   :{common:{shards:3,gold:5},rare:{shards:6,gold:10},epic:{shards:12,gold:18}};
  const base=table[item.rarity]||{shards:3,gold:5};
  const bonusShards=(META.upgrades.fortune_capstone||0)?1:0;
  return bonusShards?{shards:base.shards+bonusShards,gold:base.gold}:base;
}
function salvageItem(item){
  const y=salvageYield(item);
  RUN.shards=(RUN.shards||0)+y.shards;
  RUN.gold+=y.gold;
  return y;
}
function randomItemForHero(hero,tier,forceRarity){
  const rarity=forceRarity||rollRarity(tier||1);
  const tplKey=hero.tplKey||hero.key;
  const pool=itemsOfRarity(rarity).filter(function(it){return !it.classes||it.classes.indexOf(tplKey)>=0;});
  const base=pick(pool.length?pool:itemsOfRarity(rarity));
  return Object.assign({},base,{name:L(base.name)});
}

const EVENTS = [
  {id:'shrine',title:{en:'Abandoned Shrine',ru:'Заброшенное святилище'},
    text:{en:'A cracked shrine sits half-buried in ash, its offerings long gone cold. Something in the stone still hums.',
          ru:'Треснувшее святилище наполовину скрыто пеплом, его подношения давно остыли. Но камень всё ещё гудит.'},
    choices:[
      {label:{en:'Pray at the shrine',ru:'Помолиться у святилища'},resolve(run){
        if(Math.random()<0.5){const h=randAlive(run.party);const dt=dmgTypeOf(h);h[dt]=(h[dt]||0)+2;return h.name+M(' feels the old blessing settle in. (+2 '+statAbbr(dt)+' this march)',' чувствует, как его коснулось старое благословение. (+2 к '+(dt==='int'?'интеллекту':'силе')+' в этом походе)');}
        return M('Nothing answers. The shrine stays silent.','Никто не отвечает. Святилище молчит.');
      }},
      {label:{en:'Take what remains',ru:'Забрать оставшееся'},resolve(run){
        const g=15+Math.floor(Math.random()*16);run.gold+=g;
        if(Math.random()<0.3){const h=randAlive(run.party);const dmg=5;h.hp=Math.max(1,h.hp-dmg);
          run.pendingChainEvent='shrine_ward';
          return M('A ward snaps. '+h.name+' takes '+dmg+' damage, but you found '+g+' gold. The broken ward leaves a lingering unease.','Оберег срабатывает. '+h.name+' получает '+dmg+' урона, но вы нашли '+g+' золота. Разбитый оберег оставляет тревожное чувство.');}
        return M('You gather '+g+' gold from the offering bowl.','Вы собираете '+g+' золота из чаши для подношений.');
      }},
      {label:{en:'Leave it be',ru:'Оставить как есть'},resolve(){return M('You leave the shrine to its silence.','Вы оставляете святилище в тишине.');}},
    ]},
  {id:'shrine_ward',chainOnly:true,title:{en:"The Ward's Echo",ru:'Эхо оберега'},
    text:{en:'The broken ward from the shrine seems to follow the company — a faint chime in the ash, neither hostile nor kind.',
          ru:'Разбитый оберег святилища будто следует за отрядом — слабый звон в пепле, ни враждебный, ни добрый.'},
    choices:[
      {label:{en:'Let it settle over you',ru:'Позволить ему осесть на вас'},resolve(run){
        run.party.forEach(function(h){if(h.alive)h.hp=Math.min(h.maxHp,h.hp+Math.round(h.maxHp*0.12));});
        run.pendingChainEvent='shrine_gift';
        return M('The chime fades into a warm hush. The whole company feels mended. Something in the ash still lingers, grateful.','Звон стихает в тёплой тишине. Весь отряд чувствует облегчение. Но что-то в пепле всё ещё остаётся рядом, будто благодарное.');
      }},
      {label:{en:'Banish it',ru:'Изгнать его'},resolve(run){
        const g=18+Math.floor(Math.random()*12);run.gold+=g;
        return M('You scatter the last of the ward with a sharp word. It leaves behind '+g+' gold, as if in apology.','Вы резким словом разгоняете остатки оберега. Он оставляет '+g+' золота, будто в извинение.');
      }},
    ]},
  {id:'shrine_gift',chainOnly:true,title:{en:'The Ward Made Whole',ru:'Полный оберег'},
    text:{en:'The warmth you welcomed has knit itself back into a small, complete ward, offered up like a thank-you before it fades for good.',
          ru:'Тепло, которое вы приняли, срослось в маленький, целый оберег — будто в благодарность, прежде чем исчезнуть навсегда.'},
    choices:[
      {label:{en:'Bind it into your armor',ru:'Вплести его в доспехи'},resolve(run){
        const h=randAlive(run.party);h.def+=2;
        return M(h.name+" binds the ward into their armor. It settles in, solid. (+2 DEF this march)",h.name+' вплетает оберег в доспехи. Он прочно оседает. (+2 к защите в этом походе)');
      }},
      {label:{en:'Let it dissolve for its worth',ru:'Позволить ему раствориться за плату'},resolve(run){
        const g=22+Math.floor(Math.random()*14);run.gold+=g;
        return M('The ward dissolves into a handful of old coin, +'+g+' gold, and is gone for good.','Оберег рассыпается горстью старых монет, +'+g+' золота, и исчезает навсегда.');
      }},
    ]},
  {id:'traveler',title:{en:'Wounded Traveler',ru:'Раненый путник'},
    text:{en:'A stranger slumps against a burnt signpost, bleeding into the dirt, watching your company approach.',
          ru:'Незнакомец привалился к обгоревшему указателю, истекая кровью в пыль, и наблюдает за приближением отряда.'},
    choices:[
      {label:{en:'Tend their wounds (-10 gold)',ru:'Перевязать раны (-10 золота)'},resolve(run){
        run.gold=Math.max(0,run.gold-10);
        run.party.forEach(function(h){if(h.alive)h.hp=Math.min(h.maxHp,h.hp+Math.round(h.maxHp*0.1));});
        return M('The traveler presses a salve into your hands before slipping away. The company feels steadier.','Путник вкладывает вам в руки мазь и исчезает. Отряду становится легче.');
      }},
      {label:{en:'Take their pack',ru:'Забрать его вещи'},resolve(run){
        const g=15+Math.floor(Math.random()*11);run.gold+=g;
        const h=randAlive(run.party);h.def=Math.max(0,h.def-1);
        run.pendingChainEvent='traveler_return';
        return M('You take '+g+' gold. '+h.name+" can't shake the traveler's curse. (-1 DEF this march) Something tells you this isn't the last you'll see of them.",
                 'Вы забираете '+g+' золота. '+h.name+' не может избавиться от проклятия путника. (-1 к защите в этом походе) Что-то подсказывает: это ещё не конец этой истории.');
      }},
      {label:{en:'Walk on',ru:'Пройти мимо'},resolve(){return M('You leave the traveler to their fate.','Вы оставляете путника его судьбе.');}},
    ]},
  {id:'traveler_return',chainOnly:true,title:{en:'The Traveler Returns',ru:'Путник возвращается'},
    text:{en:'Days later, the same stranger catches up with your company at a rest stop — wounds healed, holding out a wrapped bundle.',
          ru:'Спустя несколько дней тот же незнакомец нагоняет отряд на привале — раны затянулись, в руках свёрток.'},
    choices:[
      {label:{en:'Accept the bundle',ru:'Принять свёрток'},special:'item',resolve(run){
        const item=randomItem();run.pendingItemPickup=item;
        return M('Inside the bundle you find something useful.','Внутри свёртка находится что-то полезное.');
      }},
      {label:{en:"Refuse it, wary of another curse",ru:'Отказаться, опасаясь нового проклятия'},resolve(run){
        const h=randAlive(run.party);h.def+=1;
        return M(h.name+' feels the old curse finally lift. (+1 DEF this march)',h.name+' чувствует, как старое проклятие наконец спадает. (+1 к защите в этом походе)');
      }},
    ]},
  {id:'battlefield',title:{en:'Old Battlefield',ru:'Старое поле боя'},
    text:{en:'Rusted arms and bleached bone litter a field where some earlier company met its end.',
          ru:'Ржавое оружие и побелевшие кости усеивают поле, где нашёл свой конец другой отряд.'},
    choices:[
      {label:{en:'Search the gear',ru:'Обыскать снаряжение'},resolve(run){
        const item=randomItem();run.pendingItemPickup=item;
        run.pendingChainEvent='battlefield_haunt';
        return null;
      },special:'item'},
      {label:{en:'Strip what glitters',ru:'Собрать всё блестящее'},resolve(run){
        const g=10+Math.floor(Math.random()*20);run.gold+=g;
        run.pendingChainEvent='battlefield_haunt';
        return M('You find '+g+' gold among the wreckage. As you leave, you feel eyes on your back.','Вы находите '+g+' золота среди обломков. Уходя, вы чувствуете взгляд в спину.');
      }},
      {label:{en:'Move on quickly',ru:'Быстро уйти'},resolve(){return M('Best not to linger here.','Лучше здесь не задерживаться.');}},
    ]},
  {id:'battlefield_haunt',chainOnly:true,title:{en:'The Fallen Company',ru:'Павший отряд'},
    text:{en:"The ghosts of the battlefield's dead have followed, drifting at the edge of the firelight — not hostile, just... waiting to be seen.",
          ru:'Призраки погибших с того поля боя последовали за отрядом и застыли на краю света костра — не враждебные, просто ждут, чтобы их заметили.'},
    choices:[
      {label:{en:'Honor their memory',ru:'Почтить их память'},resolve(run){
        run.party.forEach(function(h){if(h.alive)h.hp=Math.min(h.maxHp,h.hp+Math.round(h.maxHp*0.1));});
        run.pendingChainEvent='battlefield_blessing';
        return M('The ghosts fade, at peace. The company rests easier for it. One shade lingers a moment longer than the rest.','Призраки успокаиваются и растворяются. Отряду становится легче от этого. Одна тень задерживается дольше остальных.');
      }},
      {label:{en:'Search their old campsite',ru:'Обыскать их старую стоянку'},resolve(run){
        const g=15+Math.floor(Math.random()*15);run.gold+=g;
        return M('The ghosts watch in silence as you take what they left behind. +'+g+' gold.','Призраки молча наблюдают, как вы забираете оставленное ими. +'+g+' золота.');
      }},
      {label:{en:'Ignore them and move on',ru:'Не обращать внимания и уйти'},resolve(){return M('The ghosts linger a moment longer, then are gone.','Призраки задерживаются ещё на мгновение, затем исчезают.');}},
    ]},
  {id:'battlefield_blessing',chainOnly:true,title:{en:"Their Final Gift",ru:'Их последний дар'},
    text:{en:'The lingering shade holds out something forged in the old company\'s colors — a last piece of craft, offered rather than left to rust.',
          ru:'Задержавшаяся тень протягивает вещь, выкованную в цветах старого отряда — последнее изделие, отданное, а не брошенное ржаветь.'},
    choices:[
      {label:{en:'Accept the offering',ru:'Принять дар'},special:'item',resolve(run){
        const item=randomItem();run.pendingItemPickup=item;
        return M('You accept the gift. The shade nods once and is finally gone.','Вы принимаете дар. Тень кивает в последний раз и исчезает.');
      }},
      {label:{en:'Promise to remember their name',ru:'Пообещать помнить их имя'},resolve(run){
        run.party.forEach(function(h){if(h.alive)h.hp=Math.min(h.maxHp,h.hp+Math.round(h.maxHp*0.08));});
        return M('The shade seems satisfied with that alone. The company feels lighter for the promise kept.','Тени этого оказывается достаточно. Отряду становится легче от сдержанного обещания.');
      }},
    ]},
  {id:'idol',biome:'ashfall',title:{en:'Cursed Idol',ru:'Проклятый идол'},
    text:{en:'A small black idol watches from a hollow log. It is warm to the touch, and it wants to be carried.',
          ru:'Маленький чёрный идол смотрит из дупла бревна. Он тёплый на ощупь, и он хочет, чтобы его забрали.'},
    choices:[
      {label:{en:'Carry the idol',ru:'Забрать идола'},resolve(run){
        const h=randAlive(run.party);const dt=dmgTypeOf(h);h[dt]=(h[dt]||0)+3;h.def=Math.max(0,h.def-3);
        run.pendingChainEvent='idol_toll';
        return M(h.name+' pockets the idol. Power, and a price. (+3 '+statAbbr(dt)+' / -3 DEF this march) It feels like it wants something more from you.',
                 h.name+' прячет идола в карман. Сила требует цены. (+3 к '+(dt==='int'?'интеллекту':'силе')+' / -3 к защите в этом походе) Кажется, ему ещё что-то нужно от вас.');
      }},
      {label:{en:'Smash it',ru:'Разбить его'},resolve(){return M('The idol shatters into plain stone. Nothing happens.','Идол рассыпается в обычный камень. Ничего не происходит.');}},
    ]},
  {id:'idol_toll',chainOnly:true,title:{en:"The Idol's Hunger",ru:'Голод идола'},
    text:{en:'The idol in your pack has grown warm again, almost pulsing. It wants to be fed.',
          ru:'Идол в вашем мешке снова потеплел, почти пульсирует. Он хочет, чтобы его накормили.'},
    choices:[
      {label:{en:'Feed it a little blood (-5 HP, one hero)',ru:'Накормить кровью (-5 HP одному герою)'},resolve(run){
        const h=randAlive(run.party);h.hp=Math.max(1,h.hp-5);const dt=dmgTypeOf(h);h[dt]=(h[dt]||0)+2;
        return M(h.name+' feeds the idol. It grows quiet — and '+h.name+' feels stronger. (+2 '+statAbbr(dt)+' this march)',
                 h.name+' кормит идола. Он затихает — а '+h.name+' чувствует прилив сил. (+2 к '+(dt==='int'?'интеллекту':'силе')+' в этом походе)');
      }},
      {label:{en:'Bury it and walk away',ru:'Закопать идола и уйти'},resolve(run){
        const g=20+Math.floor(Math.random()*15);run.gold+=g;
        return M('You bury the idol deep. Whatever it wanted, it takes its silence with it — but leaves behind a few coins that fell loose. +'+g+' gold.',
                 'Вы глубоко закапываете идола. Что бы он ни хотел, он уносит это с собой в молчание — но оставляет несколько выпавших монет. +'+g+' золота.');
      }},
    ]},
  {id:'ashes',biome:'ashfall',title:{en:'Campfire Ashes',ru:'Остывший костёр'},
    text:{en:"Someone's fire, cold for days now. A little warmth might still be found in the embers.",
          ru:'Чей-то костёр, остывший уже много дней назад. Немного тепла ещё можно найти в углях.'},
    choices:[
      {label:{en:'Rest by the ashes',ru:'Отдохнуть у пепелища'},resolve(run){
        run.party.forEach(function(h){if(h.alive)h.hp=Math.min(h.maxHp,h.hp+Math.round(h.maxHp*0.15));});
        run.pendingChainEvent='ashes_ember';
        return M('The company rests a while. Everyone feels a little better. One ember from the ashes seems to follow, warm against the cold.','Отряд немного отдыхает. Всем становится чуть легче. Один уголёк из пепелища будто увязывается следом — тёплый посреди холода.');
      }},
      {label:{en:'Search the campsite',ru:'Обыскать стоянку'},resolve(run){
        const g=8+Math.floor(Math.random()*12);run.gold+=g;
        return M('A few coins were dropped in the dirt. +'+g+' gold.','В пыли завалялось несколько монет. +'+g+' золота.');
      }},
    ]},
  {id:'ashes_ember',chainOnly:true,title:{en:'The Lingering Warmth',ru:'Тепло, что не гаснет'},
    text:{en:'The ember from the cold campfire hasn’t gone out. It pulses gently in your pack, waiting for something.',
          ru:'Уголёк с того остывшего костра так и не погас. Он мягко пульсирует в мешке, будто чего-то ждёт.'},
    choices:[
      {label:{en:'Let it warm the whole company',ru:'Дать ему согреть весь отряд'},resolve(run){
        run.party.forEach(function(h){if(h.alive)h.hp=Math.min(h.maxHp,h.hp+Math.round(h.maxHp*0.18));});
        return M('The ember flares once, gently, and fades. The company feels rested and whole.','Уголёк на миг вспыхивает и гаснет. Отряд чувствует себя отдохнувшим.');
      }},
      {label:{en:'Trade it at the next stop',ru:'Обменять его на следующей стоянке'},resolve(run){
        const g=14+Math.floor(Math.random()*13);run.gold+=g;
        return M('A fellow traveler pays well for a coal that never truly cools. +'+g+' gold.','Попутчик щедро платит за уголёк, который не остывает по-настоящему. +'+g+' золота.');
      }},
    ]},
  {id:'merchant',title:{en:'Wandering Peddler',ru:'Бродячий торговец'},
    text:{en:'A hunched figure with a cart of oddities offers you a single, hurried trade before moving on.',
          ru:'Сутулая фигура с тележкой диковинок предлагает вам одну быструю сделку, прежде чем уйти.'},
    choices:[
      {label:{en:'Buy an elixir (18 gold)',ru:'Купить эликсир (18 золота)'},resolve(run){
        if(run.gold<18)return M("You don't have enough gold.",'У вас недостаточно золота.');
        run.gold-=18;const h=randAlive(run.party);h.hp=Math.min(h.maxHp,h.hp+Math.round(h.maxHp*0.6));
        run.pendingChainEvent='peddler_return';
        return M(h.name+' drinks the elixir and feels much of their strength return. The peddler nods, as if remembering a fair trade.',h.name+' выпивает эликсир и чувствует, как возвращаются силы. Торговец кивает — похоже, честную сделку он запоминает.');
      }},
      {label:{en:'Decline and move on',ru:'Отказаться и уйти'},resolve(){return M('The peddler shrugs and vanishes into the haze.','Торговец пожимает плечами и исчезает в дымке.');}},
    ]},
  {id:'peddler_return',chainOnly:true,title:{en:'The Peddler Returns',ru:'Торговец возвращается'},
    text:{en:'The same hunched peddler catches up with the company again, cart rattling — this time with better wares set aside.',
          ru:'Та же сутулая фигура снова нагоняет отряд, тележка гремит — на этот раз отложен товар получше.'},
    choices:[
      {label:{en:'Buy the good stock (-28 gold)',ru:'Купить хороший товар (-28 золота)'},special:'item',resolve(run){
        if(run.gold<28)return M("You don't have enough gold, and the peddler moves on.",'У вас недостаточно золота, и торговец уходит.');
        run.gold-=28;const item=Math.random()<0.3?randomRelic():randomItem();run.pendingItemPickup=item;
        return M('The peddler hands over the good stock with a wink.','Торговец с хитрым подмигиванием протягивает хороший товар.');
      }},
      {label:{en:"Thank them and part ways",ru:'Поблагодарить и разойтись'},resolve(){return M('The peddler tips their hat and vanishes into the haze for good.','Торговец приподнимает шляпу и исчезает в дымке уже насовсем.');}},
    ]},
  {id:'cache',title:{en:'Sealed Cache',ru:'Запертый сундук'},
    text:{en:'A iron-banded cache lies wedged between two rocks, its lock long rusted shut.',
          ru:'Окованный железом сундук застрял между камнями, его замок давно проржавел.'},
    choices:[
      {label:{en:'Force it open',ru:'Взломать силой'},resolve(run){
        if(Math.random()<0.6){
          const item=Math.random()<0.25?randomRelic():randomItem();
          run.pendingItemPickup=item;
          run.pendingChainEvent='cache_rival';
          return null;
        }
        const h=randAlive(run.party);const dmg=8;h.hp=Math.max(1,h.hp-dmg);
        return M('A hidden barb springs out. '+h.name+' takes '+dmg+' damage — the cache was empty.','Срабатывает скрытый шип. '+h.name+' получает '+dmg+' урона — сундук оказался пуст.');
      },special:'item'},
      {label:{en:'Pick the lock carefully',ru:'Аккуратно вскрыть замок'},resolve(run){
        const g=10+Math.floor(Math.random()*14);run.gold+=g;
        return M('The lock gives way quietly. +'+g+' gold.','Замок тихо поддаётся. +'+g+' золота.');
      }},
      {label:{en:'Leave it be',ru:'Оставить как есть'},resolve(){return M('You leave the cache to the ash.','Вы оставляете сундук пеплу.');}},
    ]},
  {id:'cache_rival',chainOnly:true,title:{en:'A Rival Scavenger',ru:'Соперник-мародёр'},
    text:{en:'Someone else was tracking that cache. They catch up with your company, eyeing what you took.',
          ru:'Кто-то ещё выслеживал этот сундук. Он нагоняет отряд, разглядывая то, что вы забрали.'},
    choices:[
      {label:{en:'Share the spoils (-10 gold)',ru:'Поделиться добычей (-10 золота)'},resolve(run){
        run.gold=Math.max(0,run.gold-10);
        return M('The scavenger takes their cut and leaves without trouble.','Мародёр забирает свою долю и уходит без проблем.');
      }},
      {label:{en:'Stand your ground',ru:'Не уступать'},resolve(run){
        if(Math.random()<0.5){
          const g=15+Math.floor(Math.random()*16);run.gold+=g;
          return M('The scavenger backs down and drops a purse in the scuffle. +'+g+' gold.','Мародёр отступает, роняя в потасовке кошель. +'+g+' золота.');
        }
        const h=randAlive(run.party);const dmg=6;h.hp=Math.max(1,h.hp-dmg);
        return M('A short scuffle breaks out. '+h.name+' takes '+dmg+' damage before the scavenger flees.',h.name+' получает '+dmg+' урона в короткой стычке, прежде чем мародёр сбегает.');
      }},
    ]},
  {id:'training',title:{en:'Old Training Post',ru:'Старый учебный столб'},
    text:{en:'A weathered training post stands here, scarred from countless practice strikes.',
          ru:'Здесь стоит потрёпанный учебный столб, испещрённый следами бесчисленных ударов.'},
    choices:[
      {label:{en:'Train with the post',ru:'Потренироваться у столба'},resolve(run){
        const h=randAlive(run.party);
        const leveled=grantXpAutoResolve(h,16+Math.floor(Math.random()*10));
        run.pendingChainEvent='training_veteran';run.trainingHeroKey=h.key;
        return leveled>0?M(h.name+' trains hard and reaches level '+h.level+'! Someone was watching from the treeline.',h.name+' усердно тренируется и достигает '+h.level+' уровня! Кто-то наблюдал из-за деревьев.')
                        :M(h.name+' trains and gains experience. Someone was watching from the treeline.',h.name+' тренируется и получает опыт. Кто-то наблюдал из-за деревьев.');
      }},
      {label:{en:'Rest instead',ru:'Лучше отдохнуть'},resolve(run){
        run.party.forEach(function(h){if(h.alive)h.hp=Math.min(h.maxHp,h.hp+Math.round(h.maxHp*0.12));});
        return M('The company rests by the post. Everyone feels a little better.','Отряд отдыхает у столба. Всем становится чуть легче.');
      }},
      {label:{en:'Move on',ru:'Пройти мимо'},resolve(){return M('Best to keep moving.','Лучше не задерживаться.');}},
    ]},
  {id:'training_veteran',chainOnly:true,title:{en:'The Watching Veteran',ru:'Наблюдающий ветеран'},
    text:{en:'A scarred, hooded veteran steps out from the treeline, having watched the training with a critical eye. "Form’s sloppy," they say. "Want to fix that?"',
          ru:'Из-за деревьев выходит покрытый шрамами ветеран в капюшоне — он придирчиво наблюдал за тренировкой. «Стойка хромает, — говорит он. — Поправим?»'},
    choices:[
      {label:{en:'Accept the spar (-8 HP, more XP)',ru:'Согласиться на спарринг (-8 HP, больше опыта)'},resolve(run){
        const h=run.party.find(function(x){return x.key===run.trainingHeroKey&&x.alive;})||randAlive(run.party);
        h.hp=Math.max(1,h.hp-8);
        const leveled=grantXpAutoResolve(h,26);
        return leveled>0?M('The spar is brutal but honest. '+h.name+' reaches level '+h.level+'!','Спарринг жёсткий, но честный. '+h.name+' достигает '+h.level+' уровня!')
                        :M('The spar is brutal but honest. '+h.name+' gains a rush of experience.','Спарринг жёсткий, но честный. '+h.name+' получает всплеск опыта.');
      }},
      {label:{en:'Thank them and decline',ru:'Поблагодарить и отказаться'},resolve(run){
        const h=run.party.find(function(x){return x.key===run.trainingHeroKey&&x.alive;})||randAlive(run.party);
        h.def+=1;
        return M('The veteran shrugs and offers one free piece of advice instead. '+h.name+' feels steadier. (+1 DEF this march)','Ветеран пожимает плечами и вместо этого даёт бесплатный совет. '+h.name+' чувствует себя увереннее. (+1 к защите в этом походе)');
      }},
    ]},
  {id:'spirit',title:{en:'Wandering Spirit',ru:'Блуждающий дух'},
    text:{en:'A pale, half-formed shade drifts closer, offering a pact in a voice like wind through bone.',
          ru:'Бледная полупрозрачная тень приближается, предлагая сделку голосом, похожим на ветер сквозь кости.'},
    choices:[
      {label:{en:'Accept the pact (-4 max HP, big XP)',ru:'Принять сделку (-4 к макс. HP, много опыта)'},resolve(run){
        const h=randAlive(run.party);h.maxHp=Math.max(6,h.maxHp-4);h.hp=Math.min(h.hp,h.maxHp);
        const leveled=grantXpAutoResolve(h,40);
        run.pendingChainEvent='spirit_return';run.spiritHeroKey=h.key;
        return leveled>0?M(h.name+' pays the price and surges to level '+h.level+'! The shade lingers, watching.',h.name+' платит цену и стремительно достигает '+h.level+' уровня! Тень задерживается, наблюдая.')
                        :M(h.name+' pays the price and gains a rush of experience. The shade lingers, watching.',h.name+' платит цену и получает всплеск опыта. Тень задерживается, наблюдая.');
      }},
      {label:{en:'Offer gold instead (-20 gold)',ru:'Предложить золото вместо этого (-20 золота)'},resolve(run){
        if(run.gold<20)return M("You don't have enough gold, and the spirit fades away.",'У вас недостаточно золота, и дух исчезает.');
        run.gold-=20;const h=randAlive(run.party);
        const leveled=grantXpAutoResolve(h,22);
        return leveled>0?M('The spirit accepts. '+h.name+' reaches level '+h.level+'!','Дух принимает дар. '+h.name+' достигает '+h.level+' уровня!')
                        :M('The spirit accepts. '+h.name+' gains experience.','Дух принимает дар. '+h.name+' получает опыт.');
      }},
      {label:{en:'Refuse',ru:'Отказаться'},resolve(){return M('The shade dissolves back into the ash.','Тень растворяется обратно в пепле.');}},
    ]},
  {id:'spirit_return',chainOnly:true,title:{en:"The Spirit's Gratitude",ru:'Благодарность духа'},
    text:{en:'The shade from the pact returns, drifting close to the hero who paid its price.',
          ru:'Тень, заключившая сделку, возвращается и приближается к герою, заплатившему цену.'},
    choices:[
      {label:{en:'Accept its parting gift',ru:'Принять прощальный дар'},resolve(run){
        const h=run.party.find(function(x){return x.key===run.spiritHeroKey&&x.alive;})||randAlive(run.party);
        h.maxHp+=2;h.hp=Math.min(h.maxHp,h.hp+2);
        return M(h.name+' feels a fraction of what was lost return. (+2 max HP this march)',h.name+' чувствует, как часть утраченного возвращается. (+2 к макс. HP в этом походе)');
      }},
      {label:{en:'Wave it away',ru:'Отмахнуться от неё'},resolve(run){
        const g=15+Math.floor(Math.random()*10);run.gold+=g;
        return M('The shade leaves a scatter of old coins behind and fades for good. +'+g+' gold.','Тень оставляет горсть старых монет и исчезает навсегда. +'+g+' золота.');
      }},
    ]},
  {id:'forge',biome:'ashfall',title:{en:'Abandoned Forge',ru:'Заброшенная кузница'},
    text:{en:'A cold forge sits under a collapsed roof, its coals long dead but the anvil still true.',
          ru:'Остывшая кузница стоит под обрушенной крышей — угли давно погасли, но наковальня всё ещё цела.'},
    choices:[
      {label:{en:'Temper a weapon (-15 gold)',ru:'Закалить оружие (-15 золота)'},resolve(run){
        if(run.gold<15)return M("You don't have enough gold to work the forge.",'У вас недостаточно золота, чтобы разжечь кузницу.');
        run.gold-=15;const h=randAlive(run.party);const dt=dmgTypeOf(h);h[dt]=(h[dt]||0)+2;
        run.pendingChainEvent='forge_ember';run.forgeHeroKey=h.key;
        return M(h.name+"'s weapon comes out keener than before. (+2 "+statAbbr(dt)+" this march) As the coals die back down, one ember refuses to go out.",h.name+' — оружие становится острее прежнего. (+2 к '+(dt==='int'?'интеллекту':'силе')+' в этом походе) Угли гаснут, но один уголёк отказывается тухнуть.');
      }},
      {label:{en:'Melt down the scrap',ru:'Переплавить металлолом'},resolve(run){
        const g=12+Math.floor(Math.random()*11);run.gold+=g;
        return M('You melt down the old fittings for '+g+' gold.','Вы переплавляете старую оснастку и получаете '+g+' золота.');
      }},
      {label:{en:'Leave it cold',ru:'Оставить остывшей'},resolve(){return M('The forge stays silent.','Кузница остаётся безмолвной.');}},
    ]},
  {id:'forge_ember',chainOnly:true,title:{en:'The Last Ember',ru:'Последний уголёк'},
    text:{en:'The stubborn ember from the forge has been glowing in your pack for days, warm through the cloth.',
          ru:'Упрямый уголёк из кузницы уже несколько дней тлеет в вашем мешке, тёплый даже сквозь ткань.'},
    choices:[
      {label:{en:'Work it into the tempered weapon',ru:'Вплавить его в закалённое оружие'},resolve(run){
        const h=run.party.find(function(x){return x.key===run.forgeHeroKey&&x.alive;})||randAlive(run.party);
        const dt=dmgTypeOf(h);h[dt]=(h[dt]||0)+1;h.def+=1;
        return M(h.name+"'s weapon drinks in the last ember and settles into its final shape. (+1 "+statAbbr(dt)+" / +1 DEF this march)",h.name+' — оружие вбирает последний уголёк и обретает окончательную форму. (+1 к '+(dt==='int'?'интеллекту':'силе')+' / +1 к защите в этом походе)');
      }},
      {label:{en:'Trade it to a passing tinker',ru:'Обменять его у бродячего лудильщика'},resolve(run){
        const g=18+Math.floor(Math.random()*12);run.gold+=g;
        return M('A tinker pays well for a coal that never cools. +'+g+' gold.','Лудильщик щедро платит за уголь, который никогда не остывает. +'+g+' золота.');
      }},
    ]},
  {id:'omen',title:{en:'Dark Omen',ru:'Тёмное предзнаменование'},
    text:{en:'The sky above bruises to a wrong color. Something is watching, and it is willing to bargain.',
          ru:'Небо над головой наливается неправильным цветом. Что-то наблюдает — и оно готово торговаться.'},
    choices:[
      {label:{en:'Embrace the omen',ru:'Принять предзнаменование'},resolve(run){
        run.party.forEach(function(h){if(h.alive)h.def=Math.max(0,h.def-2);});
        const item=randomRelic();run.pendingItemPickup=item;
        return null;
      },special:'item'},
      {label:{en:'Ward it off (-10 gold)',ru:'Отвадить его (-10 золота)'},resolve(run){
        if(run.gold<10)return M('You have nothing to ward it off with. It lingers, then fades.','Вам нечем от него отбиться. Оно медлит, затем исчезает.');
        run.gold-=10;
        return M('A small ward drives the omen off before it can take hold.','Небольшой оберег отгоняет предзнаменование, не дав ему укорениться.');
      }},
      {label:{en:'Look away',ru:'Отвести взгляд'},resolve(){return M('You refuse to meet its gaze. It passes.','Вы не смотрите на него. Оно проходит мимо.');}},
    ]},
  {id:'lost_scout',title:{en:'The Lost Scout',ru:'Пропавший разведчик'},
    text:{en:'A company scout lies half-buried in drift and ash, alive but too spent to walk, clutching a torn map to their chest.',
          ru:'Разведчик отряда лежит наполовину занесённый снегом и пеплом, живой, но слишком обессиленный, чтобы идти, прижимая к груди рваную карту.'},
    choices:[
      {label:{en:'Carry them along',ru:'Взять с собой'},resolve(run){
        const h=randAlive(run.party);
        run.party.forEach(function(x){if(x.alive)x.hp=Math.max(1,x.hp-2);});
        run.pendingChainEvent='scout_debt';
        return M(h.name+" shoulders the scout's weight. The march slows a little (-2 HP to the company), but the scout mutters they know a way to repay this.",
                 h.name+' взваливает разведчика на плечи. Поход замедляется (-2 HP всему отряду), но разведчик бормочет, что знает, как отплатить за это.');
      }},
      {label:{en:'Take the map and move on',ru:'Забрать карту и уйти'},resolve(run){
        const g=14+Math.floor(Math.random()*12);run.gold+=g;
        return M('You take the torn map for its markings, worth '+g+' gold to the right buyer, and leave the scout to their fate.',
                 'Вы забираете рваную карту с пометками — она стоит '+g+' золота нужному покупателю, — и оставляете разведчика его судьбе.');
      }},
      {label:{en:'Walk on',ru:'Пройти мимо'},resolve(){return M('You leave the scout where they lie.','Вы оставляете разведчика лежать там, где он есть.');}},
    ]},
  {id:'scout_debt',chainOnly:true,title:{en:"The Scout's Debt",ru:'Долг разведчика'},
    text:{en:'Recovered enough to speak, the scout traces old patrol routes from memory, offering to guide the company through the terrain ahead.',
          ru:'Придя в себя настолько, чтобы говорить, разведчик по памяти вычерчивает старые маршруты патрулей, предлагая провести отряд через земли впереди.'},
    choices:[
      {label:{en:'Follow their route',ru:'Пойти по их маршруту'},resolve(run){
        run.party.forEach(function(h){if(h.alive)h.hp=Math.min(h.maxHp,h.hp+Math.round(h.maxHp*0.15));});
        run.pendingChainEvent='scout_boon';
        return M('The scout leads you around the worst of the terrain. The whole company rests easier for it. Before parting ways, they press something into your hands.',
                 'Разведчик проводит вас в обход самых тяжёлых участков. Всему отряду становится легче. Перед расставанием он вкладывает вам в руки что-то на память.');
      }},
      {label:{en:'Send them off with supplies (-12 gold)',ru:'Отправить его с припасами (-12 золота)'},resolve(run){
        if(run.gold<12)return M("You have too little to spare. The scout thanks you anyway and limps off alone.",'У вас слишком мало, чтобы делиться. Разведчик всё равно благодарит вас и уходит один, прихрамывая.');
        run.gold-=12;
        return M('You send the scout off with what supplies you can spare. They leave grateful, and lighter for it.','Вы отправляете разведчика с припасами, которыми можете поделиться. Он уходит благодарным, и вам самим становится легче.');
      }},
    ]},
  {id:'scout_boon',chainOnly:true,title:{en:"A Debt Repaid",ru:'Возвращённый долг'},
    text:{en:'What the scout pressed into your hands turns out to be a keepsake from their old company — something worth far more than its weight.',
          ru:'То, что разведчик вложил вам в руки, оказывается памятной вещью из его прежнего отряда — она стоит куда больше, чем кажется на первый взгляд.'},
    choices:[
      {label:{en:'Keep the keepsake',ru:'Оставить памятную вещь'},special:'item',resolve(run){
        const item=randomRelic();run.pendingItemPickup=item;
        return M('You tuck the keepsake away. It hums with old purpose.','Вы прячете вещицу. Она словно хранит в себе давнюю цель.');
      }},
      {label:{en:'Sell it to a passing trader',ru:'Продать её проезжему торговцу'},resolve(run){
        const g=24+Math.floor(Math.random()*16);run.gold+=g;
        return M('A passing trader pays handsomely for it, no questions asked. +'+g+' gold.','Проезжий торговец щедро платит за неё, не задавая вопросов. +'+g+' золота.');
      }},
    ]},
  {id:'wardstone',biome:'ashfall',title:{en:'Glyph-Warded Stone',ru:'Камень с охранным знаком'},
    text:{en:'Half-buried in the ash, a smooth stone is etched with old warding glyphs. It hums faintly against anything that feels like magic.',
          ru:'Наполовину занесённый пеплом гладкий камень покрыт старинными охранными знаками. Он слабо гудит рядом со всем, что похоже на магию.'},
    choices:[
      {label:{en:'Bind it into your armor',ru:'Вплести его в доспехи'},resolve(run){
        const h=randAlive(run.party);h.mdef=(h.mdef||0)+2;
        return M(h.name+" works the glyphstone into their gear. It settles in, humming quietly. (+2 MDEF this march)",h.name+' вплетает камень-оберег в снаряжение. Он тихо гудит, устроившись на месте. (+2 к магической защите в этом походе)');
      }},
      {label:{en:'Sell the glyphstone',ru:'Продать камень-оберег'},resolve(run){
        const g=16+Math.floor(Math.random()*14);run.gold+=g;
        return M('A collector of old wards pays well for it, no questions asked. +'+g+' gold.','Коллекционер старинных оберегов щедро платит за него, не задавая вопросов. +'+g+' золота.');
      }},
      {label:{en:'Leave it — the glyphs feel like they\'re watching you',ru:'Оставить — кажется, знаки наблюдают за вами'},resolve(){return M('You leave the stone half-buried where it lay.','Вы оставляете камень там же, наполовину в пепле.');}},
    ]},
  /* Frost-only chain (see startEvent()'s biome filter): an ice-bound echo of
     the ashfall idol/shrine chains, but themed to the Frozen Reach instead of
     reusing ash flavor text in a land that has none. */
  {id:'cairn',biome:'frost',title:{en:'Frozen Cairn',ru:'Ледяной курган'},
    text:{en:'A cairn of ice-rimed stones stands alone against the wind, a dead warrior\'s blade still frozen upright atop it.',
          ru:'Курган из обледенелых камней одиноко стоит против ветра, на вершине всё ещё вмёрз клинок павшего воина.'},
    choices:[
      {label:{en:'Pry the blade free',ru:'Вырвать клинок изо льда'},resolve(run){
        const h=randAlive(run.party);const dt=dmgTypeOf(h);h[dt]=(h[dt]||0)+2;h.def=Math.max(0,h.def-1);
        run.pendingChainEvent='cairn_chill';
        return M(h.name+' works the blade loose. It bites as cold as the day it was buried. (+2 '+statAbbr(dt)+' / -1 DEF this march) The cairn\'s chill seems to cling to them now.',
                 h.name+' вырывает клинок изо льда. Он леденит руки так же, как в день, когда его похоронили. (+2 к '+(dt==='int'?'интеллекту':'силе')+' / -1 к защите в этом походе) Холод кургана будто цепляется за героя.');
      }},
      {label:{en:'Clear the frost reverently',ru:'Почтительно очистить ото льда'},resolve(run){
        const g=15+Math.floor(Math.random()*14);run.gold+=g;
        return M('Beneath the frost, old grave-coin glints. You take it with a quiet word of respect. +'+g+' gold.','Под инеем блестят старые погребальные монеты. Вы забираете их с тихим словом уважения. +'+g+' золота.');
      }},
      {label:{en:'Leave the dead undisturbed',ru:'Не тревожить мёртвых'},resolve(){return M('You leave the cairn to the wind and snow.','Вы оставляете курган ветру и снегу.');}},
    ]},
  {id:'cairn_chill',chainOnly:true,title:{en:"The Cairn's Chill",ru:'Холод кургана'},
    text:{en:'The cold from the frozen blade hasn\'t left — it settles deeper with every mile, as if the cairn wants something back.',
          ru:'Холод замёрзшего клинка не отступает — он въедается глубже с каждой милей, будто курган хочет что-то вернуть.'},
    choices:[
      {label:{en:'Let the cold settle in (-6 HP, one hero)',ru:'Позволить холоду укорениться (-6 HP одному герою)'},resolve(run){
        const h=randAlive(run.party);h.hp=Math.max(1,h.hp-6);const dt=dmgTypeOf(h);h[dt]=(h[dt]||0)+2;
        return M('The chill sinks in and goes still. '+h.name+' feels the blade\'s old purpose sharpen their own. (+2 '+statAbbr(dt)+' this march)',
                 'Холод оседает и затихает. '+h.name+' чувствует, как давняя цель клинка обостряет его собственную. (+2 к '+(dt==='int'?'интеллекту':'силе')+' в этом походе)');
      }},
      {label:{en:'Bury the blade again',ru:'Снова похоронить клинок'},resolve(run){
        const g=20+Math.floor(Math.random()*14);run.gold+=g;
        return M('You return the blade to the snow. The chill lifts at once, leaving behind a few coins shaken loose in the digging. +'+g+' gold.',
                 'Вы возвращаете клинок снегу. Холод тут же спадает, оставив несколько монет, вытряхнутых при копании. +'+g+' золота.');
      }},
    ]},
  /* Verdant-only chain: poison/thorn flavor for the Thornwild, parallel in
     shape to the ashfall idol chain and the frost cairn chain above. */
  {id:'bloom',biome:'verdant',title:{en:'Weeping Bloom',ru:'Плачущий цветок'},
    text:{en:'A heavy, thorned flower drips slow amber venom onto the path, its scent sweet enough to make the head swim.',
          ru:'Тяжёлый, покрытый шипами цветок медленно капает янтарным ядом на тропу, его запах настолько сладок, что кружится голова.'},
    choices:[
      {label:{en:'Drink the venom in a careful dose',ru:'Выпить яд малой осторожной дозой'},resolve(run){
        const h=randAlive(run.party);const dt=dmgTypeOf(h);h[dt]=(h[dt]||0)+2;h.hp=Math.max(1,h.hp-4);
        run.pendingChainEvent='bloom_seed';run.bloomHeroKey=h.key;
        return M(h.name+' swallows a careful dose. The venom burns, then sharpens everything. (+2 '+statAbbr(dt)+' / -4 HP this march) A seed from the bloom sticks to their sleeve.',
                 h.name+' проглатывает осторожную дозу. Яд жжёт, затем всё обостряет. (+2 к '+(dt==='int'?'интеллекту':'силе')+' / -4 HP в этом походе) Семя цветка прилипает к рукаву.');
      }},
      {label:{en:'Harvest the thorns carefully',ru:'Аккуратно собрать шипы'},resolve(run){
        const g=15+Math.floor(Math.random()*14);run.gold+=g;
        return M('The thorns fetch a fine price from apothecaries willing to risk the handling. +'+g+' gold.','Шипы стоят немало — есть аптекари, готовые рискнуть, работая с ними. +'+g+' золота.');
      }},
      {label:{en:'Steer well clear',ru:'Обойти стороной'},resolve(){return M('You give the bloom a wide, wary berth.','Вы осторожно обходите цветок стороной.');}},
    ]},
  {id:'bloom_seed',chainOnly:true,title:{en:'The Bloom Takes Root',ru:'Цветок прорастает'},
    text:{en:'The seed from the weeping bloom has taken root under the skin, a faint green vein creeping up toward the elbow.',
          ru:'Семя плачущего цветка проросло под кожей — слабая зелёная жилка тянется вверх, к локтю.'},
    choices:[
      {label:{en:'Let it bloom fully (-6 HP, one hero)',ru:'Дать ему полностью прорасти (-6 HP одному герою)'},resolve(run){
        const h=run.party.find(function(x){return x.key===run.bloomHeroKey&&x.alive;})||randAlive(run.party);
        h.hp=Math.max(1,h.hp-6);const dt=dmgTypeOf(h);h[dt]=(h[dt]||0)+1;h.def+=1;
        return M('The vein spreads, then stills, woven into '+h.name+"'s strength for good. (+1 "+statAbbr(dt)+' / +1 DEF this march)',
                 'Жилка расползается, затем успокаивается, навсегда вплетаясь в силу '+h.name+'. (+1 к '+(dt==='int'?'интеллекту':'силе')+' / +1 к защите в этом походе)');
      }},
      {label:{en:'Cut it out and sell the sap',ru:'Вырезать и продать сок'},resolve(run){
        const g=18+Math.floor(Math.random()*12);run.gold+=g;
        return M('A field medic cuts the vein free before it spreads further; the sap alone is worth '+g+' gold to a collector. +'+g+' gold.',
                 'Полевой лекарь вырезает жилку, пока она не разрослась дальше; один сок стоит сборщику '+g+' золота. +'+g+' золота.');
      }},
    ]},
  /* Drowned Barrows: a single (non-chain) land-specific event. */
  {id:'sunkbell',biome:'drowned',title:{en:'The Sunken Bell',ru:'Затонувший колокол'},
    text:{en:'A barrow bell hangs half-submerged from a rotten frame. Every swell of the mire nudges it, and the dead in the water turn their heads toward the sound.',
          ru:'С гнилой перекладины свисает наполовину затопленный курганный колокол. Каждая волна трясины качает его, и мертвецы в воде поворачивают головы на звук.'},
    choices:[
      {label:{en:'Cut the bell down (one hero, -5 HP)',ru:'Срезать колокол (один герой, -5 HP)'},resolve(run){
        const h=randAlive(run.party);h.hp=Math.max(1,h.hp-5);h.mdef=(h.mdef||0)+2;
        return M('The bell sinks with a last dull note. The cold water bites, but '+h.name+' comes out steadier against what whispers in it. (+2 MDEF this march)',
                 'Колокол уходит под воду с последним глухим звоном. Холодная вода жжёт, но '+h.name+' выходит из неё твёрже перед тем, что в ней шепчет. (+2 к маг. защите в этом походе)');
      }},
      {label:{en:'Search the barrow while the dead are distracted',ru:'Обыскать курган, пока мертвецы отвлечены'},resolve(run){
        if(Math.random()<0.6){const g=22+Math.floor(Math.random()*16);run.gold+=g;return M('Grave-goods, still bright under the silt. +'+g+' gold.','Погребальные дары, всё ещё блестящие под илом. +'+g+' золота.');}
        const h=randAlive(run.party);h.hp=Math.max(1,h.hp-8);
        return M('A drowned hand closes on '+h.name+"'s ankle before they tear free. -8 HP.",'Мёртвая рука смыкается на лодыжке героя '+h.name+', но он вырывается. -8 HP.');
      }},
      {label:{en:'Wade on quietly',ru:'Тихо пройти мимо'},resolve(){return M('You leave the bell to its tolling.','Вы оставляете колокол звонить дальше.');}},
    ]},
];
