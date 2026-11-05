'use strict';
const assert=require('node:assert/strict'),F=require('./fan-content.js'),C=require('./catalog.js'),E=require('./engine.js'),T=require('./training.js');
const library=C.getLibrary(),table=n=>Object.fromEntries(T.STATS.map(k=>[k,n]));
assert.deepEqual(F.abilities.map(a=>a.name),['끈질긴손길','탄력붙이기','다시도는별','이른혜성']);
assert.deepEqual(F.moves.map(m=>m.name),['녹물세례']);
const rust=F.moves[0];
assert.equal(F.effectiveness(rust,['steel','grass'],{steel:0,grass:2}),4);
assert.equal(F.effectiveness(rust,['steel','poison'],{steel:0,poison:0.5}),1);
assert.equal(F.effectiveness(rust,['steel','grass'],{steel:0,grass:2},{inverse:true}),1);
assert.equal(F.effectiveness(rust,['steel','ghost'],{steel:0.5,ghost:0}),0,'non-steel immunity remains after a move type change');
const config=()=>({ivs:table(31),evs:table(0),nature:'hardy',item:'none',conditions:{hpPercent:100,targetHpPercent:100,targetSpeed:100,weather:'',terrain:'',repeatUses:1}});
const mon=id=>({stats:table(100),types:['psychic'],moves:[library.moves.find(m=>m.id==='mixed-twin-psychic')],supportMoves:F.originals,ability:F.abilities.find(a=>a.id===id)});
let p=mon('pendulum'),c=config(),base=T.calculate(p,c).moves[0].expected;
for(let uses=1;uses<=6;uses++){c.conditions.repeatUses=uses;assert.equal(T.calculate(p,c).moves[0].expected,Math.round(base*(10+uses-1)/10));}
c.conditions.repeatUses=1;assert.equal(T.calculate(p,c).moves[0].expected,base);
for(const value of [0,7,1.5,NaN]){c.conditions.repeatUses=value;assert.throws(()=>T.calculate(p,c),/연속 사용/);}
for(const [id,turns,multipliers] of [['periodic-orbit',[2,5],[1,0.5]],['early-comet',[0],[1]]]) {
 p=mon(id);c=config();const r=T.calculate(p,c);
 for(const move of r.supportMoves){assert.deepEqual(move.activations.map(a=>a.turn),turns);assert.deepEqual(move.activations.map(a=>a.multiplier),multipliers);assert.equal(move.activations[0].expected,move.expected);}
 if(id==='periodic-orbit')assert.equal(r.supportMoves[0].activations[1].expected,10800);
 else assert.ok(r.supportMoves.every(m=>m.effect.includes('즉시')));
 assert.deepEqual(F.describe({category:'특수',mechanics:{mark:{}}},p.ability).activations,[],'marks are not delayed attacks');
}
const persistent=F.abilities.find(a=>a.id==='persistent');
assert.equal(F.describe({name:'순풍',category:'변화'},persistent).duration,6);
assert.equal(F.describe({name:'트릭룸',category:'변화'},persistent).duration,7);
for(const name of ['거꾸로룸','비바라기','일렉트릭필드','스텔스록'])assert.equal(F.describe({name,category:'변화'},persistent).duration,undefined);
for(const ability of F.abilities) {
 const stats={hp:100,atk:80,def:100,spa:110,spd:100,spe:40};
 const context={stats,types:['poison','psychic'],classification:{...E.classify(stats),offense:'special',tags:['special','bulky','slow']}};
 const rng=E.createRng('fan:'+ability.id);let first=true;
 const result=C.createLoadout(context,{...rng,weighted:choices=>{if(first){first=false;const choice=choices.find(c=>c.value.id===ability.id);assert.ok(choice,ability.id);return choice.value;}return rng.weighted(choices);}});
 assert.equal(result.ability.id,ability.id);assert.equal(result.moves.length,4);
 assert.ok(result.moves.every(m=>m.source!=='원작 기반'));
 assert.ok([...result.moves,...result.supportMoves].filter(m=>C.enhancedBy(result.ability,m,context)).length>=2);
 if(ability.id==='persistent'){
  assert.ok(result.supportMoves.every(m=>m.effectiveDuration===7&&m.effect.includes('7턴')));
  assert.ok(result.environment.filter(e=>e.kind==='공간 변화'&&e.id!=='room-inverse').every(e=>e.duration===7));
 }else if(ability.mechanics.requiresDelayedAttack)assert.deepEqual(result.supportMoves.map(m=>m.name),['미래예지','파멸의소원']);
 const recommended=T.recommend({...context,...result}),r=T.calculate({...context,...result},recommended);
 assert.equal(r.supportMoves.length,result.supportMoves.length);
}
// Library entries remain base rules, not a previous creature's boosted duration.
assert.equal(library.environments.find(e=>e.id==='room-trick').duration,5);
assert.ok(library.moves.find(m=>m.id==='original-trick-room').effect.includes('5턴'));
const stats={hp:100,atk:70,def:100,spa:110,spd:100,spe:50},context={stats,types:['poison'],classification:E.classify(stats)};
const rng=E.createRng('rust-reach');let first=true;
const result=C.createLoadout(context,{...rng,weighted:choices=>{if(first){first=false;return choices.find(c=>c.value.id==='syncopation')?.value||choices[0].value;}return choices.find(c=>c.value.id==='corrode')?.value||rng.weighted(choices);}});
assert.ok(result.moves.some(m=>m.id==='corrode'));
console.log('PASS selected 4 abilities/1 move, linked original moves, duration isolation, repetition, activation schedules and steel-only type override.');
