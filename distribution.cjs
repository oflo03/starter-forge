'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const count=10000, seedPrefix='starter-forge-distribution-v1.2';
const rows=[], bins=E.STATS.map(()=>new Array(256).fill(0));
const firstBins=E.STATS.map(()=>new Array(256).fill(0));
const lastBins=E.STATS.map(()=>new Array(256).fill(0));
const orderCounts=Array.from({length:6},()=>new Array(6).fill(0));
let adjusted=0;
for(let i=0;i<count;i++) {
  // Stats only: skip type construction, classification, ability and move selection.
  const result=E.generateStats(`${seedPrefix}:${i}`);
  const values=E.STATS.map(stat=>result.stats[stat]);
  assert.equal(values.reduce((a,b)=>a+b,0),530);
  values.forEach((value,j)=>{ assert.ok(value>=E.STAT_PROFILES[j].min&&value<=E.STAT_PROFILES[j].max); bins[j][value]++; });
  result.allocation.forEach((step,index)=>{
    const j=E.STATS.indexOf(step.stat); orderCounts[j][index]++;
    if(index===0) firstBins[j][step.value]++;
    if(index===5) lastBins[j][step.value]++;
    if(!step.forced&&step.midpoint!==step.baseMidpoint) adjusted++;
  });
  rows.push(values);
}
function quantile(sorted,p) { const i=(sorted.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return sorted[lo]+(sorted[hi]-sorted[lo])*(i-lo); }
const summary=E.STATS.map((stat,j)=>{
  const values=rows.map(row=>row[j]).sort((a,b)=>a-b);
  const mean=values.reduce((a,b)=>a+b,0)/count;
  const sd=Math.sqrt(values.reduce((sum,value)=>sum+(value-mean)**2,0)/count);
  return {stat,label:E.getRules().labels[stat],...E.STAT_PROFILES[j],count,mean,sd,min:values[0],max:values.at(-1),p05:quantile(values,.05),median:quantile(values,.5),p95:quantile(values,.95),firstCount:orderCounts[j][0],lastCount:orderCounts[j][5],bins:bins[j],firstBins:firstBins[j],lastBins:lastBins[j],orderCounts:orderCounts[j]};
});
const report={version:E.VERSION,count,seedPrefix,engineSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'engine.js'))).digest('hex'),protocol:'10,000 independent seeds, stats-only generateStats; type RNG draw is consumed for seed parity with the maker, but no type, classification or loadout is constructed.',formula:E.getRules().allocation,rounding:'nearest integer; final stat is exact remaining total',adjustedNonfinalSteps:adjusted,violations:0,totalMin:530,totalMax:530,summary};
const out=path.join(__dirname,'distribution');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'distribution.json'),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(out,'samples.csv'),['sample,seed,'+E.STATS.join(','),...rows.map((row,i)=>`${i},${seedPrefix}:${i},${row.join(',')}`)].join('\n')+'\n');
fs.writeFileSync(path.join(out,'summary.csv'),['stat,midpoint,radius,c_below,c_above,mean,median,sd,min,max,p05,p95',...summary.map(s=>[s.stat,s.midpoint,s.radius,s.c,s.cAbove??s.c,s.mean,s.median,s.sd,s.min,s.max,s.p05,s.p95].join(','))].join('\n')+'\n');
console.table(summary.map(({stat,c,cAbove,min,max,mean,median,sd,lastCount})=>({stat,c:cAbove===undefined?c:`${c}/${cAbove}`,min,max,mean:mean.toFixed(2),median,sd:sd.toFixed(2),lastCount})));
console.log(`${count.toLocaleString()} samples × 6 stats. Total 530 on every sample; range violations 0. Adjusted nonfinal steps ${adjusted}.`);
