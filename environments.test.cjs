'use strict';
const assert=require('node:assert/strict');
const R=require('./environments.js'),C=require('./catalog.js'),E=require('./engine.js');
const lib=C.getLibrary(), weather=R.list.filter(e=>e.kind==='날씨'),fields=R.list.filter(e=>e.kind==='필드');
assert.equal(weather.length,10);assert.equal(fields.length,8);assert.equal(R.list.filter(e=>e.kind==='공간 변화').length,4);
assert.equal(R.list.filter(e=>e.kind==='설치물').length,4);
const customWeatherReceivers=lib.abilities.filter(a=>a.source==='창작'&&a.tags.includes('weather')&&a.tags.includes('beneficiary'));
assert.equal(customWeatherReceivers.length,5);
for(const a of customWeatherReceivers) {
 assert.deepEqual(a.statModifier,{stat:'spe',multiplier:2});
 assert.equal(a.attackModifier,undefined);
 const weather=a.requiresEnvironment[0],env=R.list.find(e=>e.id===weather);
 assert.deepEqual(a.weatherResidualImmunity,env.mechanics.endTurnDamage||env.mechanics.lightning?[weather]:[]);
 assert.ok(a.balanceReference);
}
for(const a of lib.abilities.filter(a=>a.source==='창작'&&a.tags.includes('weather')&&a.tags.includes('setter')))assert.ok(a.description.includes('5턴'));
const move=(type,extra={})=>({type,category:'특수',accuracy:100,tags:[],...extra});
const resolve=(m,weather,terrain,extra={})=>R.describeMove(m,{weather,terrain,userTypes:['fire','flying'],...extra});
assert.equal(resolve(move('dark'),'weather-dark-aura').damageMultiplier,1.2);
assert.equal(resolve(move('fairy'),'weather-dark-aura').damageMultiplier,0.5);
assert.equal(resolve(move('grass',{name:'솔라빔'}),'weather-dark-aura').powerMultiplier,0.5);
assert.equal(resolve(move('normal',{name:'광합성'}),'weather-quiet-fog').recoveryFraction,0.25);
assert.equal(resolve(move('normal',{flinchChance:0.3}),'weather-quiet-fog').flinchChance,0.6);
assert.equal(resolve(move('normal',{flinchChance:0.8}),'weather-quiet-fog').flinchChance,1);
assert.equal(resolve(move('normal'),'weather-quiet-fog').flinchChance,0);
assert.equal(resolve(move('normal'),'weather-quiet-fog').accuracyMultiplier,0.7);
assert.equal(resolve(move('normal',{accuracy:null}),'weather-quiet-fog').accuracyMultiplier,1);
for(const name of ['기충전','용의숨결'])assert.ok(resolve(move('normal',{name}),'weather-poison-gas').fails);
for(const tag of ['sound','sonic'])assert.equal(resolve(move('normal',{tags:[tag]}),'weather-poison-gas').failureDamageFraction,1/8);
assert.ok(resolve(move('flying',{tags:['wind']}),'weather-poison-gas').clearsWeather);
assert.ok(!resolve(move('flying',{tags:['wind','sound']}),'weather-poison-gas').clearsWeather);
assert.equal(resolve(move('water'),'weather-thunderstorm').damageMultiplier,1.5);
assert.ok(resolve(move('electric',{name:'번개'}),'weather-thunderstorm').alwaysHit);
assert.equal(R.inverseEffectiveness([0],false),0);assert.equal(R.inverseEffectiveness([0],true),2);
assert.equal(R.inverseEffectiveness([2,2],true),0.25);assert.equal(R.inverseEffectiveness([0,0.5],true),4);
assert.equal(resolve(move('bug'),null,'terrain-ant-colony').damageMultiplier,1.2);
assert.equal(resolve(move('normal',{hitRange:[2,5]}),null,'terrain-ant-colony').hitCount,5);
assert.equal(resolve(move('normal',{hits:[{},{}]}),null,'terrain-ant-colony').hitCount,2);
assert.equal(R.fieldPokemonEffects(['bug','ground'],'terrain-ant-colony').evasionStages,1);
assert.equal(resolve(move('fighting'),null,'terrain-octagon').damageMultiplier,1.2);
assert.ok(resolve(move('normal'),null,'terrain-octagon').ignoreEvasion);
assert.equal(resolve(move('normal'),null,'terrain-octagon').accuracyMultiplier,1);
for(const w of weather) {
 const result=resolve(move('normal',{templateId:'weather-ball'}),w.id,'terrain-white-paint',{skinType:'fire'});
 assert.equal(result.type,'normal');assert.equal(result.powerMultiplier,2);assert.equal(result.skinActive,false);
 assert.deepEqual(result.pokemonTypes,['normal']);
 assert.equal(resolve(move('normal',{templateId:'weather-ball'}),w.id).type,w.mechanics.weatherBallType);
}
assert.equal(resolve(move('normal',{templateId:'terrain-pulse'}),null,'terrain-white-paint',{skinType:'ice'}).powerMultiplier,2);
for(const [terrain,type] of [['terrain-ant-colony','bug'],['terrain-octagon','fighting'],['terrain-swamp','ground']]) {
 const result=resolve(move('normal',{templateId:'terrain-pulse'}),null,terrain);
 assert.equal(result.type,type);assert.equal(result.powerMultiplier,2);
}
assert.equal(R.fieldPokemonEffects(['water'],'terrain-swamp').speedMultiplier,1);
assert.equal(R.fieldPokemonEffects(['ground'],'terrain-swamp').speedMultiplier,1);
assert.equal(R.fieldPokemonEffects(['flying'],'terrain-swamp').speedMultiplier,0.5);
let count=null;
for(let turn=1;turn<=5;turn++){const step=R.tickSwamp(count);count=step.count;assert.equal(count,5-turn);assert.equal(step.faints,turn===5);}
count=null;for(const n of [3,1,0]){const step=R.tickSwamp(count,{weather:'weather-thunderstorm'});assert.equal(step.count,n);count=step.count;}
assert.deepEqual(R.tickSwamp(1,{affected:false,weather:'weather-thunderstorm'}),{count:null,faints:false});
assert.equal(R.tickSwamp(null).count,4);
// Every new environment has a setter in the selectable catalog, including the room and swamp.
for(const env of R.list)assert.ok(lib.moves.some(m=>m.setsEnvironment.includes(env.id)));
for(const role of E.getRules().templates) {
 const stats=Object.fromEntries(E.STATS.map(k=>[k,Math.round(role.stats[k])]));stats.hp+=530-Object.values(stats).reduce((a,b)=>a+b,0);
 for(const ability of lib.abilities.filter(a=>a.setsEnvironment.length||a.requiresEnvironment.length)) {
  const types=[ability.type,'flying'].filter((t,i,a)=>a.indexOf(t)===i),context={types,stats,classification:E.classify(stats)},rng=E.createRng('env:'+role.label+ability.id);
  let first=true,selected=false;const forced={...rng,weighted:choices=>{if(first){first=false;const item=choices.find(c=>c.value.id===ability.id);selected=!!item;return (item||choices[0]).value;}return rng.weighted(choices);}};
  const result=C.createLoadout(context,forced);if(!selected)continue;
  assert.equal(result.moves.length,4);
  for(const item of [result.ability,...result.moves])for(const id of item.requiresEnvironment)assert.ok([result.ability,...result.moves,...result.supportMoves].some(x=>x.setsEnvironment.includes(id)));
 }
}
// Original weather, grounded terrains, legacy hail, rooms and persistent hazards.
assert.equal(resolve(move('fire'),'weather-sun').damageMultiplier,1.5);
assert.equal(resolve(move('water'),'weather-sun').damageMultiplier,0.5);
assert.equal(resolve(move('water'),'weather-rain').damageMultiplier,1.5);
assert.equal(resolve(move('electric',{name:'번개',accuracy:70}),'weather-sun').accuracyMultiplier,50/70);
assert.equal(resolve(move('ice',{name:'눈보라'}),'weather-snow').alwaysHit,true);
assert.equal(resolve(move('grass',{name:'솔라블레이드'}),'weather-rain').powerMultiplier,0.5);
assert.equal(resolve(move('electric'),null,'terrain-electric').damageMultiplier,1,'Flying user is not grounded');
assert.equal(resolve(move('electric'),null,'terrain-electric',{grounded:true}).damageMultiplier,1.3);
assert.equal(resolve(move('dragon'),null,'terrain-misty',{targetGrounded:true}).damageMultiplier,0.5);
assert.equal(resolve(move('dragon'),null,'terrain-misty',{targetGrounded:false}).damageMultiplier,1);
assert.equal(resolve(move('normal',{templateId:'terrain-pulse'}),null,'terrain-electric').powerMultiplier,1);
assert.equal(resolve(move('normal',{templateId:'terrain-pulse'}),null,'terrain-electric',{grounded:true}).powerMultiplier,2);
assert.equal(resolve(move('normal',{templateId:'weather-ball'}),'weather-rain',null,{suppressWeather:true}).type,'normal');
assert.equal(resolve(move('normal',{templateId:'weather-ball'}),'weather-rain',null,{suppressWeather:true}).powerMultiplier,1);
assert.equal(resolve(move('psychic',{referenceId:797}),null,'terrain-psychic',{grounded:true}).powerMultiplier,1.5);
assert.equal(resolve(move('electric',{referenceId:804}),null,'terrain-electric',{targetGrounded:true}).powerMultiplier,2);
assert.equal(resolve(move('grass',{referenceId:803}),null,'terrain-grassy',{grounded:true}).priorityBonus,1);
const byId=Object.fromEntries(R.list.map(e=>[e.id,e]));
assert.equal(byId['weather-snow'].mechanics.endTurnDamage,undefined);
assert.equal(byId['weather-hail'].mechanics.endTurnDamage.fraction,1/16);
assert.equal(byId['room-trick'].mechanics.changesSpeedOrder,true);
assert.equal(byId['room-magic'].mechanics.suppressItems,true);
assert.equal(byId['room-wonder'].mechanics.swapDefenses,true);
assert.deepEqual(byId['hazard-spikes'].mechanics.damageByLayers,[1/8,1/6,1/4]);
assert.equal(byId['hazard-stealth-rock'].mechanics.groundedOnly,false);
for(const env of R.list.filter(e=>e.kind==='설치물'))assert.equal(env.duration,null);
for(const name of ['쾌청','비바라기','설경','모래바람','압정뿌리기','독압정','스텔스록','끈적끈적네트','고속스핀','안개제거','코트체인지','정리정돈'])assert.ok(lib.moves.some(m=>m.name===name&&m.source==='원작 기반'));
console.log('PASS 10 weather / 8 fields / 4 rooms / 4 hazards, original names, grounded conditions and environment loadout fixtures.');
