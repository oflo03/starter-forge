'use strict';
const assert=require('node:assert/strict'),T=require('./training.js'),E=require('./engine.js'),C=require('./catalog.js');
const l=C.getLibrary(),keys=T.STATS,table=n=>Object.fromEntries(keys.map(k=>[k,n]));
const get=id=>{const item=l.moves.find(m=>m.id===id);assert.ok(item,id);return item;};
const ability=id=>l.abilities.find(a=>a.id===id);
const config=()=>({ivs:table(31),evs:table(0),nature:'hardy',item:'none',conditions:{weather:'',terrain:'',hpPercent:100,targetHpPercent:100,targetSpeed:100,actedFirst:false,targetActed:false,tookHit:false,targetDebuffed:false}});
const pokemon=(moves,types=['fire','water'],id='residual-filter')=>({stats:table(100),types,moves,ability:ability(id),classification:{id:'mixed-fast',label:'고속 쌍두형',offense:'mixed',speed:'fast',tags:['mixed','fast']}});
const calc=(p,c=config())=>T.calculate(p,c);
let c=config();c.evs.hp=252;c.evs.atk=252;c.nature='adamant';
assert.deepEqual(T.level50(table(100),c),{hp:207,atk:167,def:120,spa:108,spd:120,spe:120});
c.ivs.spe=0;c.nature='brave';assert.equal(T.level50({...table(100),spe:30},c).spe,31);
let p=pokemon([get('mixed-twin-fire')],['fire'],'two-rhythms');
assert.equal(calc(p).moves[0].expected,18630);
c=config();c.item='life-orb';assert.equal(calc(p,c).moves[0].expected,24219);
p=pokemon([get('mixed-twin-normal')],['water','dark'],'skin-fire');
assert.equal(calc(p).moves[0].expected,12960);
c=config();c.conditions.terrain='terrain-white-paint';assert.equal(calc(p,c).moves[0].expected,16200);assert.ok(calc(p,c).moves[0].parts.every(h=>h.type==='normal'&&!h.skinActive));
p=pokemon([get('body-fighting')],['fighting']);c=config();c.item='choice-band';assert.equal(calc(p,c).moves[0].expected,14400);
p=pokemon([get('spirit-psychic')],['psychic']);c.item='assault-vest';assert.equal(calc(p,c).moves[0].expected,21600);
p=pokemon([get('flurry-bug')],['bug']);c=config();const range=calc(p,c).moves[0];assert.deepEqual([range.min,range.max,range.expected],[9000,22500,13950]);
c.conditions.terrain='terrain-ant-colony';assert.equal(calc(p,c).moves[0].expected,27000);
p=pokemon([get('gyro-steel')],['steel']);assert.equal(calc(p).moves[0].parts[0].power,20);c=config();c.item='choice-scarf';assert.equal(calc(p,c).moves[0].parts[0].power,13);
p=pokemon([get('vital-normal')],['normal']);c=config();c.conditions.hpPercent=50;assert.equal(calc(p,c).moves[0].parts[0].power,89);
p=pokemon([get('sound-wave-normal')],['normal']);c=config();c.conditions.weather='weather-poison-gas';assert.ok(calc(p,c).moves[0].failed);assert.equal(calc(p,c).moves[0].expected,null);
p=pokemon([get('weather-ball')],['electric']);c=config();c.conditions.weather='weather-thunderstorm';assert.equal(calc(p,c).moves[0].expected,18000);assert.equal(calc(p,c).moves[0].parts[0].type,'electric');
c.conditions.terrain='terrain-white-paint';assert.equal(calc(p,c).moves[0].parts[0].type,'normal');
for(const [terrain,type] of [['terrain-ant-colony','bug'],['terrain-octagon','fighting'],['terrain-swamp','ground']]) {
 p=pokemon([get('terrain-pulse')],['normal']);c=config();c.conditions.terrain=terrain;
 const part=calc(p,c).moves[0].parts[0];assert.equal(part.type,type);assert.equal(part.power,100);
}
p=pokemon([get('mixed-twin-fire')],['fire'],'surge-fire');c=config();c.conditions.hpPercent=33;assert.equal(calc(p,c).moves[0].expected,24300);
c=config();c.evs=table(252);assert.throws(()=>calc(p,c),/510/);c=config();c.ivs.hp=32;assert.throws(()=>calc(p,c),/개체값/);
p=pokemon([get('guard-normal')]);c=config();c.item='assault-vest';assert.throws(()=>calc(p,c),/돌격조끼/);
// Category alternation changes damage, never the move category or actual stats.
p=pokemon([get('crush-fire'),get('erode-fire'),get('mixed-twin-fire')],['fire'],'syncopation');c=config();
const unchangedStats=calc(p,c).stats;
c.conditions.previousCategory='특수';let creativeResult=calc(p,c);
assert.equal(creativeResult.moves[0].expected,15750);assert.equal(creativeResult.moves[1].expected,12600);assert.equal(creativeResult.moves[2].expected,16200);
assert.deepEqual(creativeResult.stats,unchangedStats);assert.equal(creativeResult.moves[0].parts[0].category,'물리');
c.conditions.previousCategory='물리';creativeResult=calc(p,c);assert.equal(creativeResult.moves[0].expected,12600);assert.equal(creativeResult.moves[1].expected,15750);
c.conditions.previousCategory='';assert.equal(calc(p,c).moves[0].expected,12600);
c.conditions.previousCategory='혼합';assert.throws(()=>calc(p,c),/직전 기술/);
p=pokemon([get('mirror-mail')],['psychic']);c=config();assert.equal(calc(p,c).moves[0].expected,11700);c.conditions.tookHit=true;assert.equal(calc(p,c).moves[0].expected,17100);
p=pokemon([get('seam-thrust')],['steel'],'weak-point');c=config();assert.equal(calc(p,c).moves[0].expected,10800);c.conditions.targetDebuffed=true;assert.equal(calc(p,c).moves[0].expected,23760);
p=pokemon([get('fork-claw')],['dark']);assert.equal(calc(p).moves[0].parts[0].stat,'atk');assert.equal(calc(p).moves[0].parts[0].category,'물리');
p=pokemon([get('crush-normal')],['normal'],'thrifty-pocket');assert.equal(T.recommend(p).item,'sitrus-berry');
// Original environmental abilities and grounded field power use the same calculator.
p=pokemon([get('erode-water')],['water'],'swift-swim');c=config();
assert.equal(calc(p,c).effective.spe,120);c.conditions.weather='weather-rain';assert.equal(calc(p,c).effective.spe,240);
c.conditions.weather='weather-thunderstorm';assert.equal(calc(p,c).effective.spe,240);
p=pokemon([get('erode-fire')],['fire'],'solar-power');c=config();c.conditions.weather='weather-sun';assert.equal(calc(p,c).effective.spa,180);
p=pokemon([get('crush-ground')],['ground'],'sand-force');c=config();c.conditions.weather='weather-sandstorm';assert.equal(calc(p,c).moves[0].expected,16380);
p=pokemon([get('body-ice')],['ice']);c=config();c.conditions.weather='weather-snow';assert.equal(calc(p,c).effective.def,180);assert.equal(calc(p,c).moves[0].expected,21600);
p=pokemon([get('spirit-rock')],['rock']);c=config();c.conditions.weather='weather-sandstorm';assert.equal(calc(p,c).effective.spd,180);
c.conditions.terrain='terrain-white-paint';assert.equal(calc(p,c).effective.spd,120,'White paint removes the rock-type sand boost');
p=pokemon([get('weather-ball')],['fire'],'air-lock');c=config();c.conditions.weather='weather-sun';assert.equal(calc(p,c).moves[0].parts[0].type,'normal');assert.equal(calc(p,c).moves[0].expected,6000);
p=pokemon([get('erode-electric')],['electric'],'levitate');c=config();c.conditions.terrain='terrain-electric';assert.equal(calc(p,c).moves[0].parts[0].environmentMultiplier,1);
p=pokemon([get('erode-grass')],['grass'],'grass-pelt');c=config();c.conditions.terrain='terrain-grassy';assert.equal(calc(p,c).effective.def,180);
for(const a of l.abilities.filter(a=>a.source==='창작'&&a.tags.includes('weather')&&a.tags.includes('beneficiary'))) {
 const weather=a.requiresEnvironment[0];p=pokemon([get('crush-normal')],['normal'],a.id);c=config();
 assert.equal(calc(p,c).effective.spe,120);
 c.conditions.weather=weather;assert.equal(calc(p,c).effective.spe,240,a.name);
 c.item='choice-scarf';assert.equal(calc(p,c).effective.spe,360,a.name+' must not double-apply');
 c.conditions.weatherSuppressed=true;assert.equal(calc(p,c).effective.spe,180);
 c.item='none';assert.equal(calc(p,c).effective.spe,120);
}
p=pokemon([get('weather-hit-weather-dark-aura-physical')],['normal'],'weather-receiver-weather-dark-aura');c=config();c.conditions.weather='weather-dark-aura';
assert.equal(calc(p,c).moves[0].parts[0].power,105);c.conditions.weatherSuppressed=true;
assert.equal(calc(p,c).moves[0].parts[0].power,70);assert.equal(calc(p,c).moves[0].parts[0].environmentMultiplier,1);
p=pokemon([get('sound-wave-normal')],['normal'],'weather-receiver-weather-poison-gas');c=config();c.conditions.weather='weather-poison-gas';assert.equal(calc(p,c).moves[0].failed,true,'Residual immunity does not allow forbidden sound moves');
p=pokemon([get('erode-dragon')],['dragon']);c=config();c.conditions.terrain='terrain-misty';c.conditions.targetGrounded=true;assert.equal(calc(p,c).moves[0].parts[0].environmentMultiplier,0.5);c.conditions.targetGrounded=false;assert.equal(calc(p,c).moves[0].parts[0].environmentMultiplier,1);
// All role presets produce usable EV budgets, and all attack formulas resolve.
for(const role of E.getRules().templates) {
 const stats=Object.fromEntries(keys.map(k=>[k,Math.round(role.stats[k])]));stats.hp+=530-Object.values(stats).reduce((a,b)=>a+b,0);
 const classification=E.classify(stats),ctx={stats,classification,types:['fire','water']},loadout=C.createLoadout(ctx,E.createRng('training:'+role.id)),mon={...ctx,...loadout};
 const rec=T.recommend(mon),result=calc(mon,rec);
 assert.equal(result.evTotal,508);assert.ok(Object.values(rec.evs).every(v=>v<=252&&v>=0));
 if(classification.speed==='slow')assert.equal(rec.ivs.spe,0);
 assert.ok(rec.recommendations.every(i=>i.id!=='assault-vest'||!mon.moves.some(m=>m.category==='변화')));
 assert.ok(result.moves.every(m=>m.status||m.failed||Number.isFinite(m.expected)));
}
p=pokemon([]);c=config();for(const move of l.moves)assert.doesNotThrow(()=>calc({...p,moves:[move]},c),move.id);
console.log('PASS level-50 floors, nature, EV bounds, 27 role settings, mixed/dual/skin/item/field interactions and every move formula.');
