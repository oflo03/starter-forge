'use strict';
const assert=require('node:assert/strict');
const C=require('./catalog.js'),E=require('./engine.js'),R=require('./rankups.js');
const library=C.getLibrary();
const creativeAbilities=library.abilities.filter(m=>m.collection==='creative-1.8'),creativeMoves=library.moves.filter(m=>m.collection==='creative-1.8');
assert.equal(creativeAbilities.length,6);assert.equal(creativeMoves.length,10);
assert.equal(creativeMoves.filter(m=>m.category==='변화').length,2);
assert.ok([...creativeAbilities,...creativeMoves].every(m=>m.source==='창작'&&m.mechanics));
assert.ok(creativeMoves.every(m=>m.templateId==='creative'&&library.types.some(t=>t.id===m.type)));
const cushion=creativeAbilities.find(a=>a.id==='overflow-bank');
assert.equal(cushion.mechanics.substitute,true);assert.equal(cushion.mechanics.usesStandardSubstituteRules,true);assert.equal(cushion.mechanics.hpCost,0);
assert.equal(cushion.mechanics.thresholdOverhealFraction,1/4);assert.equal(cushion.mechanics.substituteHpFraction,1/4);
assert.equal(cushion.mechanics.accumulates,false);assert.equal(cushion.mechanics.replaceExisting,false);assert.equal(cushion.mechanics.allowHealingAtFullHp,true);
assert.equal(cushion.mechanics.thresholdRounding,'floor-min-1');assert.equal(cushion.mechanics.capacityFraction,undefined);
const checkContext={types:['normal'],stats:{hp:140,atk:70,def:100,spa:60,spd:100,spe:60},classification:{offense:'support',tags:['bulky']}};
assert.ok(C.enhancedBy(cushion,library.moves.find(m=>m.id==='purify-water'),checkContext));
assert.equal(C.enhancedBy(cushion,creativeMoves.find(m=>m.id==='held-breath'),checkContext),false);
assert.equal(C.enhancedBy(cushion,creativeMoves.find(m=>m.id==='safe-knot'),checkContext),false);
assert.equal(creativeMoves.find(m=>m.id==='fork-claw').category,'물리');
assert.equal(creativeMoves.find(m=>m.id==='fork-claw').mechanics.targetDefense,'lower-of-def-spd');
for(const target of creativeMoves) {
 const stats={hp:100,atk:100,def:90,spa:100,spd:90,spe:50};
 const context={types:['dark','psychic'],stats,classification:{...E.classify(stats),offense:'mixed',tags:['mixed','bulky','slow']}};
 const rng=E.createRng('creative-fixture:'+target.id);let first=true;
 const result=C.createLoadout(context,{...rng,weighted:choices=>{
   if(first){first=false;return choices.find(c=>c.value.id==='syncopation').value;}
   return choices.find(c=>c.value.id===target.id)?.value||rng.weighted(choices);
 }});
 assert.ok(result.moves.some(m=>m.id===target.id),target.name+' must be reachable in generation');
 assert.equal(result.moves.length,4);
}
assert.equal(library.moves.filter(m=>['strike','beam'].includes(m.templateId)).length,34);
assert.ok(!library.moves.some(m=>m.type==='normal'&&['strike','beam'].includes(m.templateId)));
assert.equal(library.moves.filter(m=>m.templateId==='rankup'&&m.source==='창작').length,2);
assert.ok(!library.moves.some(m=>m.variant==='type-support'));
for(const move of library.moves.filter(m=>m.templateId==='drain'))assert.equal(move.name.includes('드레인펀치'),move.type==='fighting');
assert.equal(library.moves.find(m=>m.id==='drain-fire').name,'잿불주먹');
assert.equal(library.moves.find(m=>m.id==='drain-water').name,'물살훔치기');
const originalNames=library.moves.filter(m=>m.source==='원작 기반').map(m=>m.name);
assert.equal(new Set(originalNames).size,originalNames.length,'Repeated original move names');
for(const id of ['heal','purify','guard','reset'])assert.equal(library.moves.filter(m=>m.templateId===id&&!m.variant).length,1,'Repeated base support '+id);
assert.ok(library.moves.some(m=>m.source==='타입 확장'));
assert.ok(!library.moves.some(m=>m.source==='창작'&&m.name==='땅고르기'));
for(const key of ['abilities','moves','environments']) {
  assert.equal(new Set(library[key].map(i=>i.id)).size,library[key].length,key+' duplicate IDs');
  assert.ok(library[key].every(i=>i.name && (i.effect||i.description)),key+' missing text');
}
for(const move of library.moves.filter(m=>m.hits)) {
  if(move.templateId==='mixed-twin') {
    assert.equal(move.hits[0].type,move.hits[1].type);
    assert.deepEqual(move.hits.map(h=>h.category),['물리','특수']);
  } else {
    assert.notEqual(move.hits[0].type,move.hits[1].type);
    assert.equal(move.hits[0].category,move.hits[1].category);
    assert.notEqual(move.category,'혼합');
  }
  assert.ok(move.effect.length<65);
}
const twoWay=library.moves.filter(m=>m.templateId==='mixed-twin');
assert.equal(twoWay.length,18);
assert.equal(new Set(twoWay.map(m=>m.name)).size,18);
assert.ok(twoWay.every(m=>m.name.endsWith('경정권')&&!m.name.startsWith(C.TYPES.find(t=>t.id===m.type).name)));
assert.equal(twoWay.find(m=>m.type==='fire').name,'화염경정권');
assert.equal(twoWay.find(m=>m.type==='water').name,'수류경정권');
for(const move of library.moves.filter(m=>m.templateId==='dual-twin')) {
 const letters=move.name.split(' ')[1];
 if(move.type==='rock')assert.equal(letters[0],'석');
 if(move.secondaryType==='rock')assert.equal(letters[1],'석');
 if(move.type==='dragon')assert.equal(letters[0],'용');
 if(move.secondaryType==='dragon')assert.equal(letters[1],'룡');
}
const dualOrder=['normal','fairy','psychic','fire','water','electric','grass','ice','poison','ground','flying','bug','rock','ghost','dark','steel','fighting','dragon'];
const dualStats={hp:90,atk:120,def:80,spa:50,spd:80,spe:110};
const forcedDual=types=>C.createLoadout({types,stats:dualStats,classification:E.classify(dualStats)},{...E.createRng('type-order'),weighted:choices=>choices[0].value,int:min=>min,pick:values=>values[0]}).moves.find(m=>m.templateId==='dual-twin');
for(let i=0;i<dualOrder.length;i++)for(let j=i+1;j<dualOrder.length;j++) {
 const a=dualOrder[i],b=dualOrder[j];
 const move=forcedDual([a,b]);
 assert.deepEqual(move,forcedDual([b,a]));
 assert.deepEqual(move.hits.map(h=>h.type),[a,b]);
 assert.equal(move.type,a);assert.equal(move.secondaryType,b);
 const catalogMove=library.moves.find(m=>m.id===move.id);assert.deepEqual(catalogMove,move);
}
assert.equal(forcedDual(['dragon','fairy']).name,'이원 요룡 연격');
assert.equal(forcedDual(['fighting','steel']).name,'이원 철투 연격');
const vector=m=>['atk','def','spa','spd','spe'].map(k=>m.boosts[k]||0).join(',');
assert.equal(new Set(R.custom.map(vector)).size,R.custom.length);
const originals=new Set(R.originals.map(vector));
for(const move of R.custom) {
  assert.ok(!originals.has(vector(move)));
  assert.ok(library.types.some(t=>t.id===move.type));
  if(move.gainTotal>=3)assert.ok(move.penalties.some(p=>p.kind==='hp-cost'));
  if(move.gainTotal>=5)assert.ok(move.penalties.some(p=>p.kind==='stat-stage'));
}
// Exercise every classifier template against all types, without re-running stat distribution experiments.
for(const role of E.getRules().templates) for(const type of C.TYPES) {
  const stats=Object.fromEntries(E.STATS.map(k=>[k,Math.round(role.stats[k])]));
  stats.hp+=530-Object.values(stats).reduce((a,b)=>a+b,0);
  const classification=E.classify(stats);
  const context={types:[type.id],stats,classification};
  const rng=E.createRng('content:'+role.label+':'+type.id);
  const loadout=C.createLoadout(context,rng);
  assert.ok(loadout.moves.every(m=>m.type!=='normal'||!['strike','beam'].includes(m.templateId)));
  assert.equal(loadout.moves.length,4);
  assert.ok(loadout.moves.every(m=>m.source!=='원작 기반'),'Signature slots must not contain original moves');
  assert.equal(new Set(loadout.moves.map(m=>m.id)).size,4);
  assert.ok(loadout.moves.some(m=>m.category!=='변화'));
  if(classification.offense==='mixed')assert.ok(loadout.moves.some(m=>m.hits?.some(h=>h.category==='물리')&&m.hits.some(h=>h.category==='특수')));
  for(const item of [loadout.ability,...loadout.moves])for(const id of item.requiresEnvironment) assert.ok([loadout.ability,...loadout.moves,...loadout.supportMoves].some(i=>i.setsEnvironment.includes(id)));
  for(const move of loadout.moves.filter(m=>m.templateId==='rankup')) {
    const fixed=[...R.originals,...R.custom].find(m=>m.id===move.id);
    assert.deepEqual(move,fixed);
    if(classification.tags.includes('slow'))assert.ok(!move.boosts.spe);
  }
}
for(const type of ['normal','grass']) {
 const stats={hp:90,atk:110,def:75,spa:60,spd:75,spe:120},classification=E.classify(stats);
 const result=C.createLoadout({types:[type],stats,classification},E.createRng('utility:'+type));
 assert.ok(result.moves.some(m=>m.category==='변화'));
}
for(const offense of ['physical','special','mixed']) {
 const stats={hp:90,atk:offense==='special'?50:120,def:80,spa:offense==='physical'?50:120,spd:80,spe:100};
 const classification={...E.classify(stats),offense};
 let found=false;
 for(let i=0;i<12;i++) {
   const result=C.createLoadout({types:['ghost','dark'],stats,classification},E.createRng('dual:'+offense+i));
   const move=result.moves.find(m=>m.templateId==='dual-twin');
   if(move){assert.ok(library.moves.some(m=>m.id===move.id&&m.name===move.name));found=true;break;}
 }
 assert.ok(found);
}
let forcedCases=0,twoWayCases=0,foreignSkinCases=0;
for(const role of E.getRules().templates) for(const types of [['fire'],['grass','ghost']]) {
 const stats=Object.fromEntries(E.STATS.map(k=>[k,Math.round(role.stats[k])]));
 stats.hp+=530-Object.values(stats).reduce((a,b)=>a+b,0);
 const context={types,stats,classification:E.classify(stats)};
 for(const ability of library.abilities) {
   const rng=E.createRng('ability-check:'+role.label+types.join()+ability.id);
   let first=true,selected=false;
   const forced={...rng,weighted:choices=>{
     if(first){first=false;const choice=choices.find(c=>c.value.id===ability.id);selected=Boolean(choice);return (choice||choices[0]).value;}
     return rng.weighted(choices);
   }};
   const result=C.createLoadout(context,forced);
   if(!selected) {
     if(ability.id==='two-rhythms')assert.ok(types.length===1||context.classification.offense!=='mixed');
     continue;
   }
   forcedCases++;
   assert.equal(result.moves.length,4);
   assert.ok(result.moves.every(m=>m.source!=='원작 기반'),ability.id+' received an original move');
   assert.ok(result.supportMoves.length<=2);
   assert.ok(result.supportMoves.every(m=>m.source==='원작 기반'&&!result.moves.some(x=>x.id===m.id)));
   for(const m of result.supportMoves)assert.ok(library.moves.some(x=>x.id===m.id&&x.name===m.name));
   for(const move of result.moves) {
     if(move.templateId==='body')assert.ok(stats.def>=100&&stats.def>=stats.atk,JSON.stringify({stats,move}));
     if(move.templateId==='spirit')assert.ok(stats.spd>=100&&stats.spd>=stats.spa,JSON.stringify({stats,move}));
   }
   if(ability.id==='weak-point') {
     const debuffs=result.moves.filter(m=>m.targetDebuffs?.def||m.targetDebuffs?.spd);
     assert.ok(debuffs.length>=2);
     assert.ok(!C.enhancedBy(ability,library.moves.find(m=>m.id==='critical-fire'),context));
   }
   if([...result.moves,...result.supportMoves].some(m=>C.enhancedBy(ability,m,context)))assert.ok([...result.moves,...result.supportMoves].filter(m=>C.enhancedBy(ability,m,context)).length>=2,ability.id);
   if(ability.id==='two-rhythms') {
     twoWayCases++;
     assert.equal(types.length,2);assert.equal(context.classification.offense,'mixed');
     assert.deepEqual(result.moves.filter(m=>m.templateId==='mixed-twin').map(m=>m.type).sort(),[...types].sort());
   }
   if(ability.tags.includes('skin')) {
     if(!types.includes(ability.type))foreignSkinCases++;
     assert.ok(result.moves.filter(m=>m.category!=='변화'&&(m.hits?m.hits.some(h=>h.type==='normal'):m.type==='normal')).length>=2);
     if(context.classification.offense==='mixed')assert.ok(result.moves.some(m=>m.templateId==='mixed-twin'&&m.type==='normal'));
   }
   for(const item of [result.ability,...result.moves])for(const id of item.requiresEnvironment) assert.ok([result.ability,...result.moves,...result.supportMoves].some(i=>i.setsEnvironment.includes(id)));
 }
}
assert.ok(twoWayCases>0&&foreignSkinCases>0);
// A bulk role alone must never grant a weak defensive-stat attack.
for(const types of [['normal'],['fighting'],['fire','grass']]) {
 const stats={hp:140,atk:100,def:45,spa:100,spd:45,spe:100};
 const context={types,stats,classification:{...E.classify(stats),tags:['armored','physical-bulk','special-bulk','bulky'],offense:'support'}};
 let armorOffered=false;
 const rng=E.createRng('weak-defense:'+types.join());
 let first=true;
 const loadout=C.createLoadout(context,{...rng,weighted:choices=>{
   if(first){first=false;armorOffered=choices.some(c=>c.value.id==='fitted-armor');}
   return rng.weighted(choices);
 }});
 assert.equal(armorOffered,false);
 assert.ok(!loadout.moves.some(m=>['body','spirit'].includes(m.templateId)));
}
const skinNames={fire:'블레이즈스킨',water:'아쿠아스킨',grass:'리프스킨',poison:'베놈스킨',rock:'스톤스킨',dragon:'와이번스킨'};
for(const [type,name] of Object.entries(skinNames))assert.equal(library.abilities.find(a=>a.id==='skin-'+type).name,name);
for(const id of ['flurry-rock','volley-rock'])assert.ok(C.enhancedBy(library.abilities.find(a=>a.id==='small-engine'),library.moves.find(m=>m.id===id),{}));
for(const types of [['fire'],['fire','grass']]) {
 const stats={hp:90,atk:120,def:75,spa:60,spd:75,spe:110};
 const context={types,stats,classification:E.classify(stats)},rng=E.createRng('skin-weights:'+types.join());
 let first=true;
 C.createLoadout(context,{...rng,weighted:choices=>{
   if(first) {
     first=false;
     const skins=choices.filter(c=>c.value.tags.includes('skin'));
     assert.equal(skins.length,18);
     for(const candidate of skins)assert.equal(candidate.weight,types.includes(candidate.value.type)?10:1);
     assert.equal(choices.find(c=>c.value.id==='muscle-focus').weight,50,'Other ability weights must keep their previous relative proportions');
   }
   return rng.weighted(choices);
 }});
}
console.log(`PASS content integrity, 486 role/type fixtures, ${forcedCases} forced ability cases (${twoWayCases} two-way, ${foreignSkinCases} foreign skins), environment companions, dual formats.`);
