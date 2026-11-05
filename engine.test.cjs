'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('./engine.js');
const sum=stats=>E.STATS.reduce((s,k)=>s+stats[k],0);
const from=values=>Object.fromEntries(E.STATS.map((key,i)=>[key,values[i]]));

test('171 unique unordered combinations remain selectable, including 18 singles',()=>{
  assert.equal(E.COMBINATIONS.length,171);
  assert.equal(E.COMBINATIONS.filter(c=>c.length===1).length,18);
  assert.equal(new Set(E.COMBINATIONS.map(c=>c.slice().sort().join('/'))).size,171);
  E.TYPE_IDS.forEach(t=>assert.equal(E.COMBINATIONS.filter(c=>c.includes(t)).length,18));
});
test('profiles exactly match requested midpoints, radii and approved constants',()=>{
  assert.deepEqual(E.STAT_PROFILES.map(p=>[p.stat,p.midpoint,p.radius,p.c,p.cAbove??p.c]),[
    ['hp',90,50,.1,.5],['atk',100,50,.5,.5],['def',100,60,.1,.5],['spa',90,60,.1,.5],['spd',80,70,.15,.15],['spe',80,70,.85,.85]
  ]);
  assert.equal(E.STAT_PROFILES.reduce((s,p)=>s+p.midpoint,0),540);
  assert.ok(E.STAT_PROFILES.every(Object.isFrozen));
});
test('three real draws are seeded, reproducible and in [0,10)',()=>{
  const a=E.createRng('난수3개'),b=E.createRng('난수3개');
  for(let i=0;i<10000;i++){
    assert.equal(a.int(0,100),b.int(0,100));
    const x=a.real();assert.equal(x,b.real());assert.ok(x>=0&&x<10);
  }
  for(const seed of [null,{},[],NaN,Infinity])assert.throws(()=>E.createRng(seed),TypeError);
  assert.throws(()=>a.int(2,1),RangeError);
});
test('50,000 samples obey heterogeneous bounds, exact formula and final remainder',()=>{
  const orders=new Set();
  for(let i=0;i<50000;i++){
    const r=E.generateStats('new-allocation-'+i),pending=new Set(E.STATS);
    let remaining=530;assert.equal(sum(r.stats),530);
    for(const step of r.allocation){
      const p=E.STAT_PROFILES.find(p=>p.stat===step.stat);assert.ok(pending.delete(step.stat));
      const rest=E.STAT_PROFILES.filter(p=>pending.has(p.stat));
      const lo=rest.reduce((s,p)=>s+p.min,0),hi=rest.reduce((s,p)=>s+p.max,0);
      assert.equal(step.min,Math.max(p.min,remaining-hi));assert.equal(step.max,Math.min(p.max,remaining-lo));
      assert.equal(step.midpoint,(step.min+step.max)/2);
      assert.equal(step.c,step.side==='above'?p.cAbove:p.c);
      assert.equal(step.remainingMin,lo);assert.equal(step.remainingMax,hi);
      assert.ok(Number.isInteger(step.value)&&step.value>=p.min&&step.value<=p.max&&step.value>=step.min&&step.value<=step.max);
      assert.equal(step.value,r.stats[step.stat]);
      if(step.forced){assert.equal(step.step,6);assert.equal(step.value,remaining);assert.equal(step.rolls,null);assert.equal(step.min,step.max);}
      else{
        assert.equal(step.rolls.length,3);const [r1,r2,r3]=step.rolls,c=step.c,m=step.midpoint;
        step.rolls.forEach(v=>assert.ok(v>=0&&v<=10));
        const raw=m+((1+2*c)*(r1-5)+(1-c)*(r2+r3-10))/15*(step.max-m);
        assert.equal(step.raw,raw);assert.equal(step.value,Math.round(raw));
        if(step.side==='below')assert.ok(raw<=m);
        if(step.side==='above')assert.ok(raw>=m);
      }
      remaining-=step.value;assert.equal(step.remaining,remaining);assert.ok(remaining>=lo&&remaining<=hi);
    }
    assert.equal(remaining,0);assert.equal(pending.size,0);orders.add(r.allocation.map(s=>s.stat).join('/'));
    if(i%1000===0)assert.deepEqual(E.generateStats(r.seed),r);
  }
  assert.equal(orders.size,720);
});
test('stats-only results exactly match the full maker; loadouts remain coherent',()=>{
  for(let i=0;i<2000;i++){
    const a=E.generateStats('parity-'+i),b=E.generate('parity-'+i);
    assert.deepEqual(a.stats,b.stats);assert.deepEqual(a.allocation,b.allocation);
    assert.equal(b.moves.length,4);assert.equal(new Set(b.moves.map(m=>m.id)).size,4);
    if(b.classification.offense==='mixed')assert.ok(b.moves.some(m=>m.hits?.some(h=>h.attackStat==='atk')&&m.hits.some(h=>h.attackStat==='spa')));
    const items=[b.ability,...b.moves];
    for(const item of items)for(const id of item.requiresEnvironment||[])assert.ok(items.some(x=>x.setsEnvironment?.includes(id)));
  }
});
test('continuous stats sampler is deterministic and keeps all six bounds',()=>{
  const a=E.createStatSampler('stream'),b=E.createStatSampler('stream'),out=new Int16Array(6);
  for(let i=0;i<1000;i++){
    assert.equal(a.next(out),out);assert.deepEqual(out,b.next());assert.equal(out.reduce((s,v)=>s+v,0),530);
    out.forEach((v,j)=>assert.ok(v>=E.STAT_PROFILES[j].min&&v<=E.STAT_PROFILES[j].max));
  }
});
test('common caps intersect individual ranges and reject infeasible totals',()=>{
  for(const options of [{min:88,max:89},{min:70,max:120},{min:30,max:160}])for(let i=0;i<200;i++){
    const r=E.generateStats('cap-'+i,options);assert.equal(sum(r.stats),530);
    E.STAT_PROFILES.forEach(p=>assert.ok(r.stats[p.stat]>=Math.max(p.min,options.min)&&r.stats[p.stat]<=Math.min(p.max,options.max)));
  }
  for(const options of [null,[],'30'])assert.throws(()=>E.validateOptions(options),TypeError);
  for(const options of [{min:0},{max:256},{min:89},{max:88},{min:90,max:80},{min:1.5},{max:NaN},{min:'1'},{min:140}])assert.throws(()=>E.generateStats('invalid',options),RangeError);
});
test('classification safeguards and all 27 published templates are preserved',()=>{
  const low=E.classify(from([120,40,130,40,130,70]));assert.equal(low.offense,'support');assert.equal(low.id,'dual-wall');
  const hpOnly=E.classify(from([230,90,20,90,20,80]));assert.equal(hpOnly.id,'balloon');assert.equal(hpOnly.bulk,'frail');
  assert.equal(E.classify(from([80,130,80,60,70,110])).id,'physical-fast');
  assert.equal(E.classify(from([70,110,65,110,65,110])).id,'mixed-fast');
  const rules=E.getRules();assert.equal(rules.templates.length,27);assert.equal(rules.allocation.profiles.length,6);
  rules.templates.forEach(t=>{assert.ok(t.condition);assert.ok(Math.abs(sum(t.stats)-530)<.00001);});
  assert.ok(rules.allocation.samplingFormula.includes('R₁'));
  assert.ok(!E.classify(from([130,85,80,85,80,70])).tags.includes('balloon'));
  assert.ok(E.classify(from([131,85,80,85,80,69])).tags.includes('balloon'));
});
test('10,000-run evidence has exact totals, counts and zero range violations',()=>{
  const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
  const report=JSON.parse(fs.readFileSync(path.join(__dirname,'distribution/distribution.json'),'utf8'));
  assert.equal(report.count,10000);assert.equal(report.totalMin,530);assert.equal(report.totalMax,530);assert.equal(report.violations,0);
  assert.equal(report.engineSha256,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'engine.js'))).digest('hex'));
  for(const row of report.summary){assert.equal(row.bins.reduce((a,b)=>a+b,0),10000);assert.equal(row.orderCounts.reduce((a,b)=>a+b,0),10000);}
  const spd=report.summary.find(r=>r.stat==='spd'),spe=report.summary.find(r=>r.stat==='spe');assert.ok(spe.sd>spd.sd*1.15);
});
