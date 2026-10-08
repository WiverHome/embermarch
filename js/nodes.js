// Embermarch client: Reward and map nodes: events, shop, crafting, rest.
// Classic script: shares the global scope with the other js/*.js files; load order is set in index.html.
"use strict";

/* ============================= REWARD / NODES ============================= */

function buildRewardCards(layer){
  const tier=tierForLayer(layer);
  const cards=[];
  cards.push({type:'item',item:randomItem(tier)});
  const r=Math.random();
  if(r<0.4)cards.push({type:'gold',amount:14+tier*6+randInt(0,8)});
  else if(r<0.75)cards.push({type:'elixir'});
  else cards.push({type:'item',item:randomItem(tier)});
  const r2=Math.random();
  if(r2<0.34)cards.push({type:'gold',amount:10+tier*5+randInt(0,8)});
  else if(r2<0.67)cards.push({type:'elixir'});
  else cards.push({type:'item',item:randomItem(tier)});
  if(Math.random()<0.16+relicChanceBonus())cards.push({type:'item',item:randomRelic(tier)});
  return cards;
}

function completeCurrentNode(node){
  node.cleared=true;
  RUN.currentNodeId=node.id;
  RUN.availableNodeIds=node.next;
  saveRun();
}

function goToMap(){
  show('screen-map');
  renderTopbar();
  renderMap();
  saveRun();
}

function enterNode(node){
  SFX.step();
  if(node.type==='battle'||node.type==='elite'){startCombat(node);}
  else if(node.type==='event'){startEvent(node);}
  else if(node.type==='shop'){startShop(node);}
  else if(node.type==='rest'){startRest(node);}
  else if(node.type==='boss'){startCombat(node);}
}

/* ---- events ---- */
let currentEvent=null;
function startEvent(node){
  let def=null;
  if(RUN.pendingChainEvent){
    def=EVENTS.find(function(e){return e.id===RUN.pendingChainEvent;})||null;
    RUN.pendingChainEvent=null;
  }
  if(!def){
    /* Biome-tagged events (see CHAPTER_ARRIVAL/BIOME_ACT_ORDER above) only
       fire in their own act; untagged events are generic and can fire
       anywhere. A chain already in flight (looked up by id above) always
       continues regardless of which biome it started in. */
    const curBiome=biomeKeyForLayer(node.layer);
    def=pick(EVENTS.filter(function(e){return !e.chainOnly&&(!e.biome||e.biome===curBiome);}));
  }
  currentEvent={node:node,def:def};
  SFX.page();
  $('event-title').textContent=L(currentEvent.def.title);
  $('event-text').textContent=L(currentEvent.def.text);
  const box=$('event-choices');box.innerHTML='';
  currentEvent.def.choices.forEach(function(choice){
    const b=el('button','card-choice',L(choice.label));
    b.addEventListener('click',function(){
      RUN.pendingItemPickup=null;
      const msg=choice.resolve(RUN);
      completeCurrentNode(node);
      if(choice.special==='item'&&RUN.pendingItemPickup){
        const item=RUN.pendingItemPickup;RUN.pendingItemPickup=null;
        showEventResult(M('You find: '+item.name+'.','Вы находите: '+item.name+'.'),function(){promptEquip(item,goToMap);});
      } else {
        showEventResult(msg,goToMap);
      }
    });
    box.appendChild(b);
  });
  show('screen-event');
  renderTopbar();
}
function showEventResult(msg,after){
  $('event-title').textContent='…';
  $('event-text').textContent=msg;
  const box=$('event-choices');box.innerHTML='';
  const b=el('button','primary',M('Continue','Продолжить'));
  b.addEventListener('click',after);
  box.appendChild(b);
}

/* ---- shop ---- */
function startShop(node){
  /* Stock is keyed per node id (not one shared RUN.shopStock) — a march can have
     several separate shop nodes, and each needs its own fresh, layer-scaled stock
     rather than inheriting whatever was left over (already bought / wrong tier)
     from the first shop the player ever visited this run. A node is marked
     .cleared on leaving and can't be re-entered (see completeCurrentNode/the map
     modal), so in practice each key is only ever built once — but keying by node
     still means a given shop's remaining stock survives being re-rendered while
     still inside it (e.g. after a purchase calls renderShop() again). */
  RUN.shopStockByNode = RUN.shopStockByNode||{};
  RUN.shopStockByNode[node.id] = RUN.shopStockByNode[node.id]||buildShopStock(node.layer);
  RUN._shopNode=node;
  renderShop();
  show('screen-shop');
  renderTopbar();
}
/* Shops now carry more stock (4 gear items instead of 2, higher relic odds
   at deeper tiers) so the gold the march hands out actually has somewhere
   to go — see CHANGELOG for the economy pass this belongs to. */
function buildShopStock(layer){
  const tier=tierForLayer(layer||0);
  const stock=[
    {kind:'item',item:randomItem(tier),price:0},
    {kind:'item',item:randomItem(tier),price:0},
    {kind:'item',item:randomItem(tier),price:0},
    {kind:'item',item:randomItem(tier),price:0},
    {kind:'elixir',price:20},
    {kind:'vigor',price:32},
  ];
  const relicChance=(tier>=3?0.6:(tier===2?0.4:0.25))+relicChanceBonus();
  if(Math.random()<relicChance)stock.push({kind:'item',item:randomRelic(tier),price:0});
  return stock.map(function(s){if(s.kind==='item')s.price=({common:20,rare:38,epic:70})[s.item.rarity];return s;});
}
function goldSuffix(){return M(' gold',' золота');}
function renderShop(){
  $('shop-gold').textContent=RUN.gold;
  const box=$('shop-items');box.innerHTML='';
  const stockList=RUN.shopStockByNode[RUN._shopNode.id];
  stockList.forEach(function(stock){
    if(stock.sold)return;
    const b=el('button','card-choice');
    let label='';
    if(stock.kind==='item'){
      const hint=itemClassHint(stock.item);
      label='<strong>'+stock.item.name+'</strong> <span class="item-tag rarity-'+stock.item.rarity+'">'+rarityLabel(stock.item.rarity)+'</span><br><span style="color:var(--muted);font-size:12px;">'+itemDescText(stock.item)+(hint?' · <span style="color:var(--accent);">'+hint+'</span>':'')+'</span>';
    }
    else if(stock.kind==='elixir')label='<strong>'+M('Elixir','Эликсир')+'</strong><br><span style="color:var(--muted);font-size:12px;">'+M('Restores 60% of one member\'s HP.','Восстанавливает 60% здоровья одному бойцу.')+'</span>';
    else if(stock.kind==='vigor')label='<strong>'+M('Vial of Deep Vigor','Флакон глубокой бодрости')+'</strong><br><span style="color:var(--muted);font-size:12px;">'+M('+6 max HP, permanently, to one member.','Даёт одному бойцу +6 к макс. здоровью навсегда.')+'</span>';
    label+='<br><span class="gold-badge" style="font-size:13px;">'+stock.price+goldSuffix()+'</span>';
    b.innerHTML=label;
    b.disabled=RUN.gold<stock.price;
    b.addEventListener('click',function(){
      if(RUN.gold<stock.price)return;
      RUN.gold-=stock.price;stock.sold=true;SFX.coin();
      if(stock.kind==='item'){promptEquip(stock.item,function(){renderShop();saveRun();});}
      else if(stock.kind==='elixir'){promptChooseHero(M('Elixir on whom?','Кому дать эликсир?'),function(h){h.hp=Math.min(h.maxHp,h.hp+Math.round(h.maxHp*0.6));renderShop();saveRun();});}
      else if(stock.kind==='vigor'){promptChooseHero(M('Vigor for whom?','Кому дать флакон бодрости?'),function(h){h.maxHp+=6;h.hp+=6;renderShop();saveRun();});}
    });
    box.appendChild(b);
  });
  if(!box.children.length)box.appendChild(el('div','','<span style="color:var(--muted);">'+M('The cart is empty. Nothing left to buy.','Тележка пуста. Больше нечего купить.')+'</span>'));
  renderShopCraft();
}
/* ---- crafting: spend shards (from salvaging unwanted gear) on an item of a
   chosen slot & rarity. The exact item within that slot/rarity is still
   random, same as a battle drop, but the player controls what kind of
   upgrade they're gambling shards on instead of pure chance. */
const CRAFT_RECIPES=[
  {slot:'weapon',rarity:'common',cost:10},{slot:'weapon',rarity:'rare',cost:20},{slot:'weapon',rarity:'epic',cost:38},
  {slot:'armor',rarity:'common',cost:10},{slot:'armor',rarity:'rare',cost:20},{slot:'armor',rarity:'epic',cost:38},
  {slot:'trinket',rarity:'common',cost:9},{slot:'trinket',rarity:'rare',cost:18},{slot:'trinket',rarity:'epic',cost:34},
  {slot:'relic',rarity:'rare',cost:26},{slot:'relic',rarity:'epic',cost:45},
];
function craftItemFromRecipe(r){
  if(r.slot==='relic'){
    const base=pick(relicsOfRarity(r.rarity));
    return Object.assign({},base,{name:L(base.name),passiveDesc:L(base.passiveDesc)});
  }
  const pool=ITEM_POOL.filter(function(it){return it.slot===r.slot&&it.rarity===r.rarity&&itemInCurrentBiome(it);});
  const base=pick(pool);
  return Object.assign({},base,{name:L(base.name)});
}
function renderShopCraft(){
  const box=$('shop-craft');box.innerHTML='';
  const shardsLine=el('div','',"<span style='color:var(--muted);font-size:12px;'>"+M('Shards: ','Осколки: ')+'<strong>'+(RUN.shards||0)+'</strong> · '+M('earned by salvaging gear in the backpack (Formation & Gear).','получены разбором снаряжения в рюкзаке (Строй и снаряжение).')+"</span>");
  box.appendChild(shardsLine);
  CRAFT_RECIPES.forEach(function(r){
    const b=el('button','card-choice');
    b.innerHTML='<strong>'+M('Craft ','Скрафтить ')+slotName(r.slot)+'</strong> <span class="item-tag rarity-'+r.rarity+'">'+rarityLabel(r.rarity)+'</span><br><span style="color:var(--muted);font-size:12px;">'+M('Random item of this slot &amp; rarity.','Случайный предмет этого слота и редкости.')+'</span><br><span class="gold-badge" style="font-size:13px;">'+r.cost+' '+M('shards','осколков')+'</span>';
    b.disabled=(RUN.shards||0)<r.cost;
    b.addEventListener('click',function(){
      if((RUN.shards||0)<r.cost)return;
      RUN.shards-=r.cost;SFX.coin();
      const item=craftItemFromRecipe(r);
      promptEquip(item,function(){renderShop();saveRun();});
    });
    box.appendChild(b);
  });
}
function modsToText(mods){
  const parts=[];
  if(mods.str)parts.push((mods.str>0?'+':'')+mods.str+' '+statAbbr('str'));
  if(mods.int)parts.push((mods.int>0?'+':'')+mods.int+' '+statAbbr('int'));
  if(mods.atk)parts.push((mods.atk>0?'+':'')+mods.atk+' '+M('power (STR/INT)','сила/инт.'));
  if(mods.def)parts.push((mods.def>0?'+':'')+mods.def+' '+statAbbr('def'));
  if(mods.mdef)parts.push((mods.mdef>0?'+':'')+mods.mdef+' '+statAbbr('mdef'));
  if(mods.spd)parts.push((mods.spd>0?'+':'')+mods.spd+' '+statAbbr('spd'));
  if(mods.hp)parts.push((mods.hp>0?'+':'')+mods.hp+' '+statAbbr('hp'));
  return parts.join(', ');
}
function itemDescText(item){
  const parts=[];
  const mt=modsToText(item.mods||{});
  if(mt)parts.push(mt);
  if(item.passiveDesc)parts.push(item.passiveDesc);
  if(item.biome&&BIOME_DEFS[item.biome])parts.push(M('from ','из края: ')+L(BIOME_DEFS[item.biome].name));
  return parts.join(' · ')||M('No bonus','Без бонуса');
}

/* ---- rest ---- */
function startRest(node){
  show('screen-rest');
  renderTopbar();
  RUN._restNode=node;
  const pct=Math.round(restHealFrac()*100);
  $('rest-heal-desc').textContent=M('Heal the whole company for '+pct+'% of their max health.','Восстановить всему отряду '+pct+'% максимального здоровья.');
}
