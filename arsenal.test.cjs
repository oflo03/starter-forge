'use strict';
const assert=require('node:assert/strict'),A=require('./arsenal.js'),C=require('./catalog.js'),E=require('./engine.js'),T=require('./training.js');
const library=C.getLibrary(),get=id=>A.moves.find(m=>m.id===id);
assert.equal(A.moves.length,24);
for(const family of ['sure-crit','multi-hit','priority','heavy'])assert.equal(A.moves.filter(m=>m.arsenalFamily===family).length,6);
function forced(target,atk=100,spa=100) {
 const stats={hp:100,atk,def:90,spa,spd:90,spe:50};
 const context={types:[target.type,'dark'].filter((t,i,a)=>a.indexOf(t)===i),stats,classification:{...E.classify(stats),offense:'mixed',tags:['mixed','bulky','slow']}};
 const rng=E.createRng('arsenal:'+target.id+atk+spa);let first=true;
 return C.createLoadout(context,{...rng,weighted:choices=>{
  if(first){first=false;return choices.find(c=>c.value.id==='syncopation').value;}
  return choices.find(c=>c.value.id===target.id)?.value||rng.weighted(choices);
 }});
}
for(const move of A.moves)assert.ok(forced(move).moves.some(m=>m.id===move.id),'unreachable '+move.id);
for(const move of A.moves.filter(m=>m.alwaysCrit)) {
 assert.ok(move.power<=70&&!move.hitCount&&!move.hits&&!move.hitRange&&!move.hitPowers);
 for(const stat of [110,111,150]) {
  const physical=move.category==='물리',result=forced(move,physical?stat:100,physical?100:stat);
  assert.equal(result.moves.some(m=>m.id===move.id),stat<=110,move.id+' boundary '+stat);
 }
 const physical=move.category==='물리';
 assert.ok(forced(move,physical?100:150,physical?150:100).moves.some(m=>m.id===move.id),'use corresponding attacking stat');
}
const table=n=>Object.fromEntries(T.STATS.map(k=>[k,n]));
const pokemon=move=>({types:[move.type],stats:table(100),moves:[move],ability:library.abilities.find(a=>a.id==='residual-filter')});
const config=()=>({ivs:table(31),evs:table(0),nature:'hardy',item:'none',conditions:{hpPercent:100,targetHpPercent:100,targetSpeed:100,weather:'',terrain:''}});
let move=get('mind-awl'),p=pokemon(move),c=config();
assert.equal(T.calculate(p,c).moves[0].expected,60*120*1.5*1.5);
c.conditions.criticalBlocked=true;assert.equal(T.calculate(p,c).moves[0].expected,60*120*1.5);
for(const id of ['surge-drumming','vine-stitching','tiny-stampede','scale-volley','slime-shower','feather-wave']) {
 move=get(id);p=pokemon(move);c=config();
 const total=move.hitPowers?.reduce((a,b)=>a+b,0)||move.powerPerHit*move.hitCount;
 assert.equal(T.calculate(p,c).moves[0].expected,total*120*1.5);
 c.conditions.terrain='terrain-ant-colony';
 assert.equal(T.calculate(p,c).moves[0].counts.expected,move.hitPowers?1:move.hitCount);
}
p=pokemon(get('feather-wave'));p.ability=library.abilities.find(a=>a.id==='small-engine');
assert.equal(T.calculate(p,config()).moves[0].expected,Math.round(90*120*1.5*1.2));
p=pokemon(get('sprout-dash'));c=config();c.conditions.hpPercent=50;
assert.equal(T.calculate(p,c).moves[0].failureReason,'HP 조건 미충족');
c.conditions.hpPercent=51;assert.equal(T.calculate(p,c).moves[0].failed,false);
p=pokemon(get('silver-flash'));c=config();c.conditions.sameMoveLastTurn=true;
assert.equal(T.calculate(p,c).moves[0].failureReason,'연속 턴 사용 불가');
assert.ok(!get('all-in-thrust').tags.includes('recoil'));assert.ok(!get('wish-overload').tags.includes('recoil'));
// Durability follows the same final defensive stats shown in the training table.
p=pokemon(get('mind-awl'));c=config();let r=T.calculate(p,c);
assert.equal(r.durability.physical,Math.round(175*120/0.411));
assert.equal(r.durability.special,r.durability.physical);
c.item='assault-vest';r=T.calculate(p,c);
assert.equal(r.durability.special,Math.round(175*180/0.411));
assert.equal(r.durability.physical,Math.round(175*120/0.411));
c.conditions.hpPercent=1;assert.deepEqual(T.calculate(p,c).durability,r.durability);
for(const [type,weather,stat] of [['rock','weather-sandstorm','spd'],['ice','weather-snow','def']]) {
 p.types=[type];c=config();c.conditions.weather=weather;r=T.calculate(p,c);
 assert.equal(r.effective[stat],180);
 assert.equal(r.durability[stat==='def'?'physical':'special'],Math.round(175*180/0.411));
 c.conditions.weatherSuppressed=true;assert.equal(T.calculate(p,c).effective[stat],120);
}
console.log('PASS 24 reachable attacks, crit power/stat limits, fixed/progressive hits, failure conditions, physical/special durability and weather/item corrections.');
