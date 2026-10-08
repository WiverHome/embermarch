// Embermarch client: Utilities: seeded RNG, SFX, music, combat visual effects.
// Classic script: shares the global scope with the other js/*.js files; load order is set in index.html.
"use strict";

/* ============================= UTIL ============================= */

function $(id){return document.getElementById(id);}
function escHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function el(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!==undefined)e.innerHTML=html;return e;}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function randInt(a,b){return a+Math.floor(Math.random()*(b-a+1));}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}
/* ---- seeded RNG for daily challenge runs ---- */
let ORIG_MATH_RANDOM=null;
function xmur3(str){
  let h=1779033703^str.length;
  for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}
  return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return (h^=h>>>16)>>>0;};
}
function mulberry32(a){
  return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
}
function todayDateStr(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
/* ISO-8601 week, e.g. "W2026-41": the Weekly Trial seed. Starts with 'W', which is
   how a seeded run tells a weekly seed from a daily "YYYY-MM-DD" one. */
function isoWeekStr(){
  const d=new Date();d.setHours(0,0,0,0);
  d.setDate(d.getDate()+3-((d.getDay()+6)%7));
  const w1=new Date(d.getFullYear(),0,4);
  const wk=1+Math.round(((d-w1)/86400000-3+((w1.getDay()+6)%7))/7);
  return 'W'+d.getFullYear()+'-'+String(wk).padStart(2,'0');
}
function isWeeklySeed(seed){return typeof seed==='string'&&seed.charAt(0)==='W';}
/* Weekly Trial rules: everyone gets the same seeded map, Ascension WEEKLY_ASCENSION
   and WEEKLY_MODIFIER_COUNT modifiers picked from the week's seed (a separate hash,
   so picking them doesn't consume the run's own RNG sequence). */
const WEEKLY_ASCENSION=2;
const WEEKLY_MODIFIER_COUNT=2;
const WEEKLY_WIN_EMBERS=25;
const WEEKLY_LOSS_EMBERS=8;
function weeklySpec(seed){
  const h=xmur3('weekly-mods:'+seed);
  const keys=MODIFIER_DEFS.map(function(m){return m.key;});
  const mods={};keys.forEach(function(k){mods[k]=false;});
  for(let i=0;i<WEEKLY_MODIFIER_COUNT&&keys.length;i++){mods[keys.splice(h()%keys.length,1)[0]]=true;}
  return {ascension:WEEKLY_ASCENSION,modifiers:mods};
}
/* Daily/Weekly bookkeeping at march end (win, loss or abandon). Abandoning pays
   no challenge bonus, same as the daily always did. */
function recordChallengeResult(win,layer,abandoned){
  if(!RUN||!RUN.daily)return;
  if(RUN.weekly){
    META.weeklyLastWeek=RUN.daily;META.weeklyLastResult={win:win,layer:layer};
    if(win)META.weeklyWinsCount=(META.weeklyWinsCount||0)+1;
    if(!abandoned)META.embers+=win?WEEKLY_WIN_EMBERS:WEEKLY_LOSS_EMBERS;
  } else {
    META.dailyLastDate=RUN.daily;META.dailyLastResult={win:win,layer:layer};
    if(win)META.dailyWinsCount=(META.dailyWinsCount||0)+1;
    if(!abandoned)META.embers+=win?10:5;
  }
  restoreRandom();
}
function applyDailySeed(seedStr){
  if(!ORIG_MATH_RANDOM)ORIG_MATH_RANDOM=Math.random;
  Math.random=mulberry32(xmur3(seedStr)());
}
function restoreRandom(){
  if(ORIG_MATH_RANDOM){Math.random=ORIG_MATH_RANDOM;}
}
/* ---- sound effects (Web Audio API) ----
   Recorded CC0 one-shots (audio/sfx/, built by tools/build-audio.js, credits
   in audio/CREDITS.md). A name can have several variants, picked at random so
   repeated hits don't sound identical. Until a buffer has loaded (first
   seconds of a session, slow connection) or if it failed to load, the old
   single-oscillator beep plays instead so the game is never silent.
   Disabled entirely if the browser has no AudioContext, or if the player
   turns off "Sound Effects" in settings. */
let SFX_CTX=null;
function sfxEnabled(){return !!(META&&META.settings&&META.settings.sound!==false);}
function sfxCtx(){
  if(!sfxEnabled())return null;
  if(SFX_CTX)return SFX_CTX;
  try{
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
    SFX_CTX=new AC();
    sfxLoadAll();
    return SFX_CTX;
  }catch(e){return null;}
}
function sfxTone(freq,dur,opts){
  const ctx=sfxCtx();if(!ctx)return;
  opts=opts||{};
  try{
    if(ctx.state==='suspended')ctx.resume();
    const t0=ctx.currentTime;
    const osc=ctx.createOscillator();osc.type=opts.type||'sine';
    const gain=ctx.createGain();
    const vol=opts.vol!==undefined?opts.vol:0.12;
    osc.frequency.setValueAtTime(freq,t0);
    if(opts.slideTo)osc.frequency.exponentialRampToValueAtTime(Math.max(20,opts.slideTo),t0+dur);
    gain.gain.setValueAtTime(0.0001,t0);
    gain.gain.exponentialRampToValueAtTime(vol,t0+0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    osc.connect(gain);gain.connect(ctx.destination);
    osc.start(t0);osc.stop(t0+dur+0.02);
  }catch(e){}
}
/* Fallback synthesis, used only until the matching file is loaded, or if it never loads. */
const SFX_FALLBACK={
  hit:function(){sfxTone(180,0.12,{type:'square',slideTo:70,vol:0.1});},
  hit_magic:function(){sfxTone(330,0.18,{type:'sawtooth',slideTo:120,vol:0.08});},
  crit:function(){sfxTone(260,0.16,{type:'sawtooth',slideTo:60,vol:0.14});setTimeout(function(){sfxTone(420,0.1,{type:'square',vol:0.08});},40);},
  heal:function(){sfxTone(440,0.14,{type:'sine',slideTo:660,vol:0.1});},
  buff:function(){sfxTone(520,0.1,{type:'triangle',slideTo:780,vol:0.08});},
  dodge:function(){sfxTone(300,0.08,{type:'triangle',slideTo:500,vol:0.07});},
  death:function(){sfxTone(220,0.3,{type:'sawtooth',slideTo:50,vol:0.11});},
  click:function(){sfxTone(600,0.05,{type:'square',vol:0.05});},
  levelup:function(){[523,659,784].forEach(function(f,i){setTimeout(function(){sfxTone(f,0.16,{type:'triangle',vol:0.1});},i*90);});},
  victory:function(){[392,523,659,784].forEach(function(f,i){setTimeout(function(){sfxTone(f,0.22,{type:'triangle',vol:0.12});},i*110);});},
  defeat:function(){[330,262,220].forEach(function(f,i){setTimeout(function(){sfxTone(f,0.3,{type:'sawtooth',vol:0.1});},i*140);});},
  coin:function(){sfxTone(880,0.05,{type:'square',vol:0.08});setTimeout(function(){sfxTone(1175,0.09,{type:'square',slideTo:1320,vol:0.07});},45);},
  equip:function(){sfxTone(220,0.04,{type:'square',vol:0.06});setTimeout(function(){sfxTone(660,0.05,{type:'triangle',vol:0.05});},30);},
  page:function(){},chest:function(){},roar:function(){},step:function(){},
};
/* name -> [files, volume, fx?]. Files are peak-normalised, so the volume here is
   what balances them against each other. 'step' is per biome (see SFX.step).
   fx {rate, lowpass} reshapes a borrowed recording into a sound of its own. */
const SFX_DEFS={
  hit:[['sfx/hit_1','sfx/hit_2','sfx/hit_3','sfx/hit_4','sfx/hit_5'],0.55],
  hit_magic:[['sfx/hit_magic_1','sfx/hit_magic_2','sfx/hit_magic_3'],0.5],
  crit:[['sfx/crit_1','sfx/crit_2','sfx/crit_3'],0.75],
  heal:[['sfx/heal_1','sfx/heal_2'],0.45],
  buff:[['sfx/buff_1','sfx/buff_2'],0.8],
  dodge:[['sfx/dodge_1','sfx/dodge_2'],0.7],
  death:[['sfx/death_1','sfx/death_2'],0.6],
  click:[['sfx/click'],0.3],
  coin:[['sfx/coin_1','sfx/coin_2','sfx/coin_3'],0.6],
  equip:[['sfx/equip_1','sfx/equip_2','sfx/equip_3'],0.5],
  page:[['sfx/page_1','sfx/page_2'],0.4],
  chest:[['sfx/chest'],0.5],
  roar:[['sfx/roar_1','sfx/roar_2'],0.5],
  step_ashfall:[['sfx/step_ashfall_1','sfx/step_ashfall_2'],0.35],
  step_frost:[['sfx/step_frost_1','sfx/step_frost_2'],0.3],
  step_verdant:[['sfx/step_verdant_1','sfx/step_verdant_2'],0.55],
  /* Drowned Barrows: the grass steps slowed and muffled into wading through mire. */
  step_drowned:[['sfx/step_verdant_1','sfx/step_verdant_2'],0.45,{rate:0.7,lowpass:900}],
  levelup:[['levelup'],0.85],
  victory:[['victory'],0.85],
  defeat:[['defeat'],0.85],
};
/* Per-file trim for variants much louder or quieter than their siblings
   (measured short-term loudness), so a random pick doesn't jump in level. */
const SFX_FILE_TRIM={'sfx/hit_magic_2':0.6,'sfx/hit_magic_3':1.3,'sfx/equip_3':0.55,'sfx/death_1':0.6,'sfx/step_frost_2':0.7};
/* file -> undefined (not requested yet) | 'loading' | 'failed' | AudioBuffer */
const SFX_BUFFERS={};
function sfxLoadAll(){
  const ctx=SFX_CTX;if(!ctx)return;
  Object.keys(SFX_DEFS).forEach(function(name){
    SFX_DEFS[name][0].forEach(function(file){
      if(SFX_BUFFERS[file])return;
      SFX_BUFFERS[file]='loading';
      fetch('audio/'+file+'.mp3').then(function(r){
        if(!r.ok)throw new Error('http '+r.status);
        return r.arrayBuffer();
      }).then(function(buf){
        /* callback form: older Safari has no promise-returning decodeAudioData */
        return new Promise(function(res,rej){ctx.decodeAudioData(buf,res,rej);});
      }).then(function(decoded){
        SFX_BUFFERS[file]=decoded;
      }).catch(function(){
        SFX_BUFFERS[file]='failed';
      });
    });
  });
}
function sfxPlayBuffer(name){
  const ctx=sfxCtx();if(!ctx)return false;
  const def=SFX_DEFS[name];if(!def)return false;
  const ready=def[0].filter(function(f){const b=SFX_BUFFERS[f];return b&&b!=='loading'&&b!=='failed';});
  if(!ready.length)return false;
  try{
    if(ctx.state==='suspended')ctx.resume();
    const file=ready[Math.floor(Math.random()*ready.length)];
    const src=ctx.createBufferSource();src.buffer=SFX_BUFFERS[file];
    const fx=def[2]||{};
    src.playbackRate.value=(fx.rate||1)*(0.94+Math.random()*0.12); // slight pitch spread against repetition
    const gain=ctx.createGain();gain.gain.value=def[1]*(SFX_FILE_TRIM[file]||1);
    if(fx.lowpass){
      const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=fx.lowpass;
      src.connect(lp);lp.connect(gain);
    } else src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    return true;
  }catch(e){return false;}
}
const SFX={};
Object.keys(SFX_FALLBACK).forEach(function(name){
  SFX[name]=function(){
    if(!sfxCtx())return;
    if(!sfxPlayBuffer(name))SFX_FALLBACK[name]();
  };
});
/* Footstep on the map, matching the current biome's ground. */
SFX.step=function(){
  if(!sfxCtx())return;
  sfxPlayBuffer('step_'+(currentActBiomeKey()||'ashfall'));
};

/* ---- background music: recorded CC0 tracks (audio/music/, credits in
   audio/CREDITS.md) ----
   One playlist per mood: menu, each biome's map and battle, the boss, the
   arena, the victory fanfare. setMusicMood() is called from show(); moods
   crossfade. Tracks are fetched whole (so the service worker can cache them
   and a phone doesn't keep a range request open), handed to an <audio>
   element as a blob URL and routed through Web Audio for the fades. Only
   the tracks actually reached get downloaded. Nothing plays before the first
   click/tap (browser autoplay rules), when music is off, or without Web Audio.
   gain: per-mood level evening out the measured loudness of the tracks. */
const MUSIC_TRACKS={
  title:{files:['title'],gain:0.8},
  ashfall_map:{files:['ashfall_map']},
  frost_map:{files:['frost_map'],loop:true,gain:1.1},
  verdant_map:{files:['verdant_map'],gain:1.25},
  /* Drowned Barrows: the Frozen Reach tracks (the other second chapter, so
     never both in one march) played slower, lower and muffled, as if heard
     from under the water. fx: playback rate (pitch drops with it), lowpass Hz. */
  drowned_map:{files:['frost_map'],loop:true,gain:1.1,fx:{rate:0.85,lowpass:1100}},
  ashfall_battle:{files:['ashfall_battle'],gain:0.9},
  frost_battle:{files:['frost_battle'],gain:1.15},
  verdant_battle:{files:['verdant_battle']},
  drowned_battle:{files:['frost_battle'],gain:1.15,fx:{rate:0.92,lowpass:2400}},
  boss:{files:['boss1','boss2']},
  arena:{files:['arena'],gain:0.8},
  /* plays once over the run-won screen, then the menu theme takes over */
  victory:{files:['victory'],then:'title'},
};
const MUSIC_GAP=1.2;      // seconds of silence before a playlist repeats/advances
const MUSIC_FADE=1.2;     // crossfade between moods, seconds
const MUSIC_LP_OPEN=20000; // deck lowpass when the mood has no fx: effectively off
const MUSIC_LEVEL=0.55;   // master level at "High"; the tracks are loudness-normalised
const MUSIC_VOLUMES=[{k:0.35,en:'Low',ru:'Тихо'},{k:0.65,en:'Mid',ru:'Средне'},{k:1,en:'High',ru:'Громко'}];
/* Two persistent decks (<audio> element -> MediaElementSource -> gain ->
   master) alternate for crossfades. Keeping the same two elements matters on
   iOS, which allows play() per element only after that element was touched by
   a user gesture: every gesture pokes both (see musicGesture). */
const MUSIC={ctx:null,master:null,decks:null,cur:null,mood:null,playing:null,urls:{},unlocked:false};
function musicEnabled(){return !!(META&&META.settings&&META.settings.music!==false);}
function musicVolume(){const v=META&&META.settings&&META.settings.musicVolume;return typeof v==='number'?v:0.65;}
function musicCtx(){
  if(MUSIC.ctx)return MUSIC.ctx;
  try{
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
    const ctx=new AC();
    MUSIC.master=ctx.createGain();MUSIC.master.gain.value=MUSIC_LEVEL*musicVolume();
    MUSIC.master.connect(ctx.destination);
    MUSIC.decks=[0,1].map(function(){
      const el=new Audio();el.preload='auto';
      const d={el:el,gain:ctx.createGain(),lp:ctx.createBiquadFilter(),mood:null,idx:0,token:0,gapTimer:null};
      d.gain.gain.value=0;
      d.lp.type='lowpass';d.lp.frequency.value=MUSIC_LP_OPEN;
      ctx.createMediaElementSource(el).connect(d.lp);d.lp.connect(d.gain);d.gain.connect(MUSIC.master);
      el.addEventListener('ended',function(){musicOnEnded(d);});
      el.addEventListener('error',function(){if(el.getAttribute('src'))musicOnFail(d);});
      return d;
    });
    MUSIC.ctx=ctx;
    return ctx;
  }catch(e){return null;}
}
/* file -> Promise<blob URL>; failed fetches are forgotten so a later visit retries. */
function musicUrl(file){
  if(!MUSIC.urls[file]){
    MUSIC.urls[file]=fetch('audio/music/'+file+'.mp3').then(function(r){
      if(!r.ok)throw new Error('http '+r.status);
      return r.blob();
    }).then(function(b){return URL.createObjectURL(b);});
    MUSIC.urls[file].catch(function(){delete MUSIC.urls[file];});
  }
  return MUSIC.urls[file];
}
function musicRamp(d,to){
  const t=MUSIC.ctx.currentTime,g=d.gain.gain;
  /* hold the level reached so far (Safari reports a running ramp's target as .value) */
  if(g.cancelAndHoldAtTime)g.cancelAndHoldAtTime(t);else{g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);}
  g.linearRampToValueAtTime(to,t+MUSIC_FADE);
}
function musicFadeOut(d){
  if(!d)return;
  const token=++d.token;clearTimeout(d.gapTimer);
  musicRamp(d,0);
  setTimeout(function(){if(d.token===token){d.el.pause();d.el.removeAttribute('src');d.el.load();}},MUSIC_FADE*1000+100);
}
/* Starts file #idx of the deck's playlist; a stale token means the deck moved on meanwhile. */
function musicPlayIndex(d,idx){
  const def=MUSIC_TRACKS[d.mood],token=d.token;
  d.idx=idx%def.files.length;
  musicUrl(def.files[d.idx]).then(function(url){
    if(d.token!==token)return;
    d.el.loop=!!def.loop&&def.files.length===1;
    d.el.src=url;
    musicApplyFx(d,def.fx||{});
    const p=d.el.play();if(p&&p.catch)p.catch(function(){}); // blocked: the next gesture retries
  }).catch(function(){if(d.token===token)musicOnFail(d);});
}
/* Set after src: loading a new source resets playbackRate to the default. */
function musicApplyFx(d,fx){
  const el=d.el,rate=fx.rate||1;
  el.preservesPitch=el.webkitPreservesPitch=el.mozPreservesPitch=false; // pitch follows the rate
  el.defaultPlaybackRate=rate;el.playbackRate=rate;
  d.lp.frequency.setValueAtTime(fx.lowpass||MUSIC_LP_OPEN,MUSIC.ctx.currentTime);
}
function musicAfterGap(d,fn){
  const token=d.token;
  d.gapTimer=setTimeout(function step(){
    if(d.token!==token)return;
    if(document.hidden){d.gapTimer=setTimeout(step,1000);return;} // don't advance in a hidden tab
    fn();
  },MUSIC_GAP*1000);
}
function musicOnEnded(d){
  if(d!==MUSIC.cur)return;
  const def=MUSIC_TRACKS[d.mood];
  if(def.then){MUSIC.playing=null;setMusicMood(def.then);return;}
  musicAfterGap(d,function(){musicPlayIndex(d,d.idx+1);});
}
/* A track that can't be fetched or decoded: skip to the next one of a
   playlist, or give up on the mood so coming back to it retries. */
function musicOnFail(d){
  if(d!==MUSIC.cur)return;
  const def=MUSIC_TRACKS[d.mood];
  if(def.then){MUSIC.playing=null;setMusicMood(def.then);return;}
  if(def.files.length>1){const token=d.token;d.gapTimer=setTimeout(function(){if(d.token===token)musicPlayIndex(d,d.idx+1);},5000);return;}
  MUSIC.playing=null;
}
function musicStart(mood){
  const ctx=musicCtx();if(!ctx)return false;
  if(ctx.state!=='running')try{ctx.resume();}catch(e){}
  const prev=MUSIC.cur;
  const d=MUSIC.decks[0]===prev?MUSIC.decks[1]:MUSIC.decks[0];
  musicFadeOut(prev);
  d.token++;clearTimeout(d.gapTimer);
  d.mood=mood;
  MUSIC.cur=d;
  musicRamp(d,MUSIC_TRACKS[mood].gain||1);
  musicPlayIndex(d,0);
  return true;
}
function musicStop(){
  if(MUSIC.cur){musicFadeOut(MUSIC.cur);MUSIC.cur=null;}
  MUSIC.playing=null;
}
function setMusicMood(mood){
  MUSIC.mood=mood;
  if(!musicEnabled()||!MUSIC_TRACKS[mood]){musicStop();return;}
  if(!MUSIC.unlocked)return; // starts on the first click/tap (autoplay policy)
  if(MUSIC.playing===mood)return;
  if(musicStart(mood))MUSIC.playing=mood;
}
/* One-off mood over the current screen (the victory fanfare); the playlist's
   `then` mood takes over when it ends. Returns false when nothing will play. */
function playMusicCue(mood){setMusicMood(mood);return MUSIC.playing===mood;}
function moodForScreen(screenId){
  if(screenId==='screen-combat'){
    const c=RUN&&RUN.combat;
    if(c&&c.node&&c.node.type==='boss')return 'boss';
    if(RUN&&RUN.isArenaTemp)return 'arena';
    const bt=(currentActBiomeKey()||'ashfall')+'_battle';
    return MUSIC_TRACKS[bt]?bt:'ashfall_battle';
  }
  if(['screen-map','screen-reward','screen-event','screen-shop','screen-rest'].indexOf(screenId)>=0){
    const mt=(currentActBiomeKey()||'ashfall')+'_map';
    return MUSIC_TRACKS[mt]?mt:'ashfall_map';
  }
  /* keep the fanfare over the run-won screen instead of cutting to the menu theme */
  if(screenId==='screen-gameover'&&MUSIC.playing==='victory')return 'victory';
  return 'title';
}
function musicApplySettings(){
  if(!musicEnabled()){musicStop();return;}
  if(MUSIC.ctx&&MUSIC.master){const t=MUSIC.ctx.currentTime;MUSIC.master.gain.cancelScheduledValues(t);MUSIC.master.gain.setValueAtTime(MUSIC_LEVEL*musicVolume(),t);}
  if(MUSIC.mood&&!MUSIC.playing)setMusicMood(MUSIC.mood);
}
/* Every user gesture: resume the context (iOS may leave it 'interrupted'),
   retry a play() the browser refused, and touch the idle deck so iOS lets it
   play later. Touch pointerdown isn't a user activation on mobile, hence the
   extra event types. */
function musicGesture(){
  if(!musicEnabled()){MUSIC.unlocked=true;return;}
  const ctx=musicCtx();if(!ctx)return;
  if(ctx.state!=='running')try{ctx.resume();}catch(e){}
  MUSIC.decks.forEach(function(d){
    if(d===MUSIC.cur&&d.el.getAttribute('src')){
      if(d.el.paused&&!d.el.ended){const p=d.el.play();if(p&&p.catch)p.catch(function(){});}
    } else if(!d.el.getAttribute('src')){
      const p=d.el.play();if(p&&p.catch)p.catch(function(){}); // no source: rejects, but unlocks the element
    }
  });
  if(!MUSIC.unlocked){MUSIC.unlocked=true;if(MUSIC.mood)setMusicMood(MUSIC.mood);}
}
['pointerdown','pointerup','touchend','click','keydown'].forEach(function(t){document.addEventListener(t,musicGesture,true);});
/* Pause with the tab hidden (phones keep playing otherwise), resume on return. */
document.addEventListener('visibilitychange',function(){
  if(!MUSIC.ctx)return;
  const d=MUSIC.cur;
  try{
    if(document.hidden){MUSIC.ctx.suspend();if(d)d.el.pause();}
    else if(d){
      MUSIC.ctx.resume();
      if(d.el.getAttribute('src')&&d.el.paused&&!d.el.ended){const p=d.el.play();if(p&&p.catch)p.catch(function(){});}
    }
  }catch(e){}
});
/* ---- combat visual feedback: floating numbers + card shake/flash/glow ---- */
function spawnFloatText(uid,text,cls){
  if(!uid||(META.settings&&META.settings.animations===false))return;
  const card=document.querySelector('.unit-card[data-uid="'+uid+'"]');
  if(!card)return;
  const t=document.createElement('div');
  t.className='float-text '+(cls||'');
  t.textContent=text;
  card.appendChild(t);
  setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},950);
}
function playUnitFx(uid,cls){
  if(!uid||(META.settings&&META.settings.animations===false))return;
  const card=document.querySelector('.unit-card[data-uid="'+uid+'"]');
  if(!card)return;
  card.classList.remove(cls);
  void card.offsetWidth;
  card.classList.add(cls);
  if(cls!=='fx-die')setTimeout(function(){card.classList.remove(cls);},700);
}
function playCombatFx(fx){
  if(!fx||!fx.length)return;
  fx.forEach(function(f){
    if(f.shakeCls)playUnitFx(f.uid,f.shakeCls);
    if(f.text)spawnFloatText(f.uid,f.text,f.textCls);
    if(f.dieCls)setTimeout(function(){playUnitFx(f.uid,f.dieCls);},260);
  });
}
function randAlive(list){const a=list.filter(function(h){return h.alive;});return a.length?pick(a):list[0];}
/* Stat helpers (statOf, dmgTypeOf, powerOf, mitigationKeyFor, defenseOf) and
   statAbbr live in js/combat-core.js, shared with the server. */
const statOf=EmberCombatCore.statOf;
const dmgTypeOf=EmberCombatCore.dmgTypeOf;
const powerOf=EmberCombatCore.powerOf;
const mitigationKeyFor=EmberCombatCore.mitigationKeyFor;
const defenseOf=EmberCombatCore.defenseOf;
function statAbbr(key){return COMBAT_CORE.statAbbr(key);}
function statInfo(key){
  return {
    str:M('Strength — increases the damage of every physical hit and ability this hero lands.','Сила — увеличивает урон от всех физических ударов и способностей этого героя.'),
    int:M('Intellect — increases the damage of every magical hit and ability this hero lands.','Интеллект — увеличивает урон от всех магических ударов и способностей этого героя.'),
    atk:M('Attack power — increases the damage of every hit and ability this hero lands.','Сила атаки — увеличивает урон от всех ударов и способностей этого героя.'),
    def:M('Defense — reduces the physical damage taken from every incoming hit.','Защита — уменьшает физический урон, получаемый от каждого вражеского удара.'),
    mdef:M('Magic Defense — reduces the magical damage taken from every incoming hit.','Магическая защита — уменьшает магический урон, получаемый от каждого вражеского удара.'),
    spd:M('Speed — determines turn order; a faster hero acts sooner (and more often across a long fight).','Скорость — определяет порядок ходов; чем быстрее герой, тем раньше (и чаще за долгий бой) он действует.'),
    hp:M('Max HP — the total health pool before this hero falls in battle.','Максимальное здоровье — общий запас HP, прежде чем герой падёт в бою.'),
  }[key]||'';
}
function slotName(slot){
  return {weapon:M('weapon','оружие'),armor:M('armor','броня'),trinket:M('trinket','аксессуар'),relic:M('relic','реликвия')}[slot]||slot;
}
function rarityLabel(r){
  return {common:M('common','обычный'),rare:M('rare','редкий'),epic:M('epic','эпический')}[r]||r;
}
function rowLabel(row){return row==='front'?M('front','перед'):M('back','тыл');}
/* With the march now moving through all three biomes in one run (see
   BIOME_ACT_ORDER), the screen tint has to track where the story currently
   is rather than one fixed RUN.biome: mid-fight, that's the node being
   fought; on the map, it's whichever layer the reachable nodes sit in
   (there's no single "current" node while choosing the next step). */
function currentActBiomeKey(){
  if(RUN&&RUN.combat&&RUN.combat.node)return biomeKeyForLayer(RUN.combat.node.layer);
  if(RUN&&RUN.availableNodeIds&&RUN.availableNodeIds.length){
    const n=findNode(RUN.map,RUN.availableNodeIds[0]);
    if(n)return biomeKeyForLayer(n.layer);
  }
  if(RUN&&RUN.currentNodeId){
    const n=findNode(RUN.map,RUN.currentNodeId);
    if(n)return biomeKeyForLayer(n.layer);
  }
  return runRoute()[0];
}
function show(screenId){
  ['screen-auth','screen-title','screen-legacy','screen-profile','screen-arena','screen-hero-select','screen-map','screen-combat','screen-reward','screen-event','screen-shop','screen-rest','screen-gameover']
    .forEach(function(id){$(id).hidden=(id!==screenId);});
  $(screenId).scrollTop=0; // screens scroll inside themselves (see .screen-head CSS)
  requestAnimationFrame(function(){updateScreenScrollState($(screenId));});
  $('topbar').hidden=(screenId==='screen-auth'||screenId==='screen-title'||screenId==='screen-legacy'||screenId==='screen-profile'||screenId==='screen-arena'||screenId==='screen-hero-select');
  if(screenId==='screen-map'||screenId==='screen-combat'){
    const el2=$(screenId);
    const cur=currentActBiomeKey();
    Object.keys(BIOME_DEFS).forEach(function(bk){el2.classList.toggle('biome-'+bk, cur===bk);});
  }
  setMusicMood(moodForScreen(screenId));
}
/* Pinned .screen-head/.screen-foot get a backdrop only while content is under them. */
function updateScreenScrollState(sec){
  if(!sec||sec.tagName!=='SECTION')return;
  sec.classList.toggle('scrolled-top',sec.scrollTop>2);
  sec.classList.toggle('more-below',sec.scrollTop+sec.clientHeight<sec.scrollHeight-2);
}
$('app').addEventListener('scroll',function(e){updateScreenScrollState(e.target);},true);
function refreshScreenScrollState(){document.querySelectorAll('#app > section:not([hidden])').forEach(updateScreenScrollState);}
window.addEventListener('resize',refreshScreenScrollState);
/* Tabs, presets and purchases change the content height without any scroll. */
$('app').addEventListener('click',function(){requestAnimationFrame(refreshScreenScrollState);});
function closeModal(){$('modal-root').innerHTML='';}
/* opts.required: the player must pick one of the modal's own buttons (the
   choice already cost gold or an item), so no close button and no click-away. */
function openModal(node,opts){
  const required=!!(opts&&opts.required);
  const back=el('div','modal-backdrop');const box=el('div','modal-box');
  if(!required){
    const x=el('button','modal-close','&times;');
    x.type='button';x.setAttribute('aria-label',M('Close','Закрыть'));x.title=M('Close','Закрыть');
    x.addEventListener('click',closeModal);
    box.appendChild(x);
    back.addEventListener('click',function(e){if(e.target===back)closeModal();});
  }
  box.appendChild(node);back.appendChild(box);
  $('modal-root').innerHTML='';$('modal-root').appendChild(back);
}
