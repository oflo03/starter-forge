(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./environments.js'):root.StarterEnvironments,typeof module==='object'&&module.exports?require('./fan-content.js'):root.StarterFanContent);if(typeof module==='object'&&module.exports)module.exports=api;else root.StarterTraining=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Env,Fan){
  'use strict';
  const STATS=['hp','atk','def','spa','spd','spe'];
  const NATURES=[
    ['hardy','노력'],['lonely','외로움','atk','def'],['brave','용감','atk','spe'],['adamant','고집','atk','spa'],['naughty','개구쟁이','atk','spd'],
    ['bold','대담','def','atk'],['docile','온순'],['relaxed','무사태평','def','spe'],['impish','장난꾸러기','def','spa'],['lax','촐랑','def','spd'],
    ['timid','겁쟁이','spe','atk'],['hasty','성급','spe','def'],['serious','성실'],['jolly','명랑','spe','spa'],['naive','천진난만','spe','spd'],
    ['modest','조심','spa','atk'],['mild','의젓','spa','def'],['quiet','냉정','spa','spe'],['bashful','수줍음'],['rash','덜렁','spa','spd'],
    ['calm','차분','spd','atk'],['gentle','얌전','spd','def'],['sassy','건방','spd','spe'],['careful','신중','spd','spa'],['quirky','변덕']
  ].map(([id,name,up,down])=>({id,name,up,down}));
  const ITEMS=[
    ['none','도구 없음','도구 보정 없음.'],['life-orb','생명의구슬','공격 피해 ×1.3. 공격 후 최대 HP의 1/10 반동.'],
    ['choice-band','구애머리띠','공격 ×1.5. 교체 전까지 한 기술에 고정.'],['choice-specs','구애안경','특공 ×1.5. 교체 전까지 한 기술에 고정.'],
    ['choice-scarf','구애스카프','스피드 ×1.5. 교체 전까지 한 기술에 고정.'],['muscle-band','힘의머리띠','물리 공격 피해 ×1.1.'],
    ['wise-glasses','박식안경','특수 공격 피해 ×1.1.'],['leftovers','먹다남은음식','턴 종료 시 최대 HP의 1/16 회복.'],
    ['sitrus-berry','자뭉열매','HP가 절반 이하가 되면 최대 HP의 1/4 회복. 한 번 소모.'],['focus-sash','기합의띠','HP가 가득 찼을 때 일격에 기절할 공격을 HP 1로 버팀. 한 번 소모.'],
    ['rocky-helmet','울퉁불퉁멧','접촉 공격을 받으면 상대 최대 HP의 1/6 피해.'],['assault-vest','돌격조끼','특방 ×1.5. 변화 기술 사용 불가.']
  ].map(([id,name,description])=>({id,name,description}));
  const PRESETS={
    'physical-fast':[[4,252,0,0,0,252],'jolly'],'physical-mid':[[4,252,0,0,0,252],'adamant'],
    'physical-bulky':[[252,252,0,0,4,0],'adamant'],'physical-slow':[[252,252,0,0,4,0],'brave'],
    'special-fast':[[4,0,0,252,0,252],'timid'],'special-mid':[[4,0,0,252,0,252],'modest'],
    'special-bulky':[[252,0,4,252,0,0],'modest'],'special-slow':[[252,0,4,252,0,0],'quiet'],
    'mixed-fast':[[0,128,0,128,0,252],'naive'],'mixed-mid':[[0,128,0,128,0,252],'naive'],
    'mixed-bulky':[[252,128,0,128,0,0],'brave'],'mixed-physical':[[0,200,0,56,0,252],'naive'],'mixed-special':[[0,56,0,200,0,252],'naive'],
    'physical-wall':[[252,0,252,0,4,0],'impish'],'special-wall':[[252,0,4,0,252,0],'careful'],
    'dual-wall':[[252,0,128,0,128,0],'impish'],'balloon':[[252,0,128,0,128,0],'impish'],'armored':[[252,0,128,0,128,0],'relaxed'],
    'physical-fortress':[[252,128,128,0,0,0],'adamant'],'special-fortress':[[252,0,0,128,128,0],'modest'],
    'physical-specialtank':[[252,128,0,0,128,0],'adamant'],'special-physicaltank':[[252,0,128,128,0,0],'modest'],
    'speed-support':[[252,0,4,0,0,252],'timid'],'fast-physicalwall':[[128,0,128,0,0,252],'timid'],
    'fast-specialwall':[[128,0,0,0,128,252],'timid'],'slow-pivot':[[252,0,128,0,128,0],'sassy'],'balanced':[[252,0,128,0,128,0],'impish']
  };
  const table=values=>Object.fromEntries(STATS.map((key,i)=>[key,values[i]]));
  const getItem=id=>ITEMS.find(item=>item.id===id);
  function recommend(pokemon,roleId=pokemon.classification.id) {
    const actual=pokemon.classification,c={...actual,id:roleId,label:actual.scores?.find(role=>role.id===roleId)?.label||actual.label},preset=PRESETS[c.id]||PRESETS.balanced;
    const evs=table(preset[0]),ivs=table([31,31,31,31,31,31]);
    const physical=pokemon.moves.some(m=>m.category==='물리'&&m.attackStat!=='def'||m.hits?.some(h=>h.attackStat==='atk'));
    const special=pokemon.moves.some(m=>m.category==='특수'&&m.attackStat!=='spd'||m.hits?.some(h=>h.attackStat==='spa'));
    const transfer=(from,to)=>{let n=evs[from];evs[from]=0;for(const key of [to,'hp','def','spd','spe']){const add=Math.min(n,252-evs[key]);evs[key]+=add;n-=add;if(!n)break;}};
    if(!physical&&pokemon.moves.some(m=>m.attackStat==='def'))transfer('atk','def');
    if(!special&&pokemon.moves.some(m=>m.attackStat==='spd'))transfer('spa','spd');
    let nature=preset[1];
    if(!physical)ivs.atk=0;
    if(c.speed==='slow') {ivs.spe=0;nature=c.offense==='mixed'||c.offense==='physical'?'brave':c.offense==='special'?'quiet':pokemon.stats.def<=pokemon.stats.spd?'relaxed':'sassy';}
    else if(['physical-wall','special-wall','dual-wall','balloon','balanced','armored'].includes(c.id)) nature=pokemon.stats.def<=pokemon.stats.spd?(physical?'impish':'bold'):(physical?'careful':'calm');
    else if(c.offense==='support'&&physical&&nature==='timid')nature='jolly';
    if(!physical&&!special&&pokemon.moves.some(m=>m.attackStat))nature=c.speed==='fast'?'jolly':c.speed==='slow'?(pokemon.stats.def<=pokemon.stats.spd?'relaxed':'sassy'):(pokemon.stats.def<=pokemon.stats.spd?'bold':'calm');
    const hasStatus=pokemon.moves.some(m=>m.category==='변화');
    const choices=[];
    const add=(id,reason)=>{if(!choices.some(item=>item.id===id))choices.push({id,reason});};
    if(pokemon.ability.id==='thrifty-pocket')add('sitrus-berry','알뜰주머니로 소모한 열매를 한 번 복원해 회복 기회를 확보.');
    if(c.offense==='support'||c.tags.includes('bulky')||c.tags.includes('balloon')) {
      add('leftovers','내구를 활용해 여러 턴 머무는 운영.');add('sitrus-berry','즉시 회복으로 다음 행동 기회 확보.');
      if(c.tags.includes('physical-bulk'))add('rocky-helmet','물리 내구를 활용한 접촉 공격 견제.');
    } else {
      if(c.tags.includes('frail'))add('focus-sash','약한 내구를 보완해 행동 기회 확보.');
      add('life-orb',c.offense==='mixed'?'물리·특수 두 타격을 함께 강화.':'주력 공격의 화력 강화.');
      add(c.offense==='special'?'wise-glasses':c.offense==='physical'?'muscle-band':'sitrus-berry','기술 고정 없이 운용.');
    }
    if(!hasStatus) {
      if(c.offense==='physical'&&pokemon.moves.some(m=>m.category==='물리'&&!m.attackStat))add('choice-band','공격 기술만 사용하는 물리 운용.');
      if(c.offense==='special')add('choice-specs','공격 기술만 사용하는 특수 운용.');
      if(c.tags.includes('special-bulk'))add('assault-vest','변화기가 없는 구성에서 특수 내구 보강.');
    }
    const environments=[...pokemon.ability.setsEnvironment,...pokemon.ability.requiresEnvironment,...pokemon.moves.flatMap(m=>m.setsEnvironment),...(pokemon.supportMoves||[]).flatMap(m=>m.setsEnvironment)];
    const conditions={weather:environments.find(id=>id.startsWith('weather-'))||'',terrain:environments.find(id=>id.startsWith('terrain-'))||'',hpPercent:100,targetHpPercent:100,targetSpeed:100,actedFirst:c.speed==='fast',targetActed:false,tookHit:false,targetDebuffed:false,targetGrounded:true,previousCategory:'',weatherSuppressed:false,criticalBlocked:false,sameMoveLastTurn:false,repeatUses:1};
    return {level:50,roleId:c.id,ivs,evs,nature,item:choices[0].id,conditions,recommendations:choices,reason:`${c.label}의 추천 분배입니다. 총 508 EV를 사용하며, 특정 상대에 대한 최적 분배는 아닙니다.${c.speed==='slow'?' 저속 운용을 위해 스피드 IV 0.':''}${!physical?' 공격을 쓰는 타격이 없어 공격 IV 0.':''}`};
  }
  function validate(config,pokemon) {
    if(!NATURES.some(n=>n.id===config.nature)||!getItem(config.item))throw new RangeError('성격·도구를 확인해 주세요.');
    for(const key of STATS) {
      if(!Number.isInteger(config.evs[key])||config.evs[key]<0||config.evs[key]>252)throw new RangeError('노력치는 각 0~252 사이 정수여야 합니다.');
      if(!Number.isInteger(config.ivs[key])||config.ivs[key]<0||config.ivs[key]>31)throw new RangeError('개체값은 각 0~31 사이 정수여야 합니다.');
    }
    if(STATS.reduce((sum,key)=>sum+config.evs[key],0)>510)throw new RangeError('노력치 합계는 510 이하여야 합니다.');
    if(config.item==='assault-vest'&&pokemon.moves.some(m=>m.category==='변화'))throw new RangeError('변화기가 있는 구성에는 돌격조끼를 적용할 수 없습니다.');
    for(const [key,min,max] of [['hpPercent',1,100],['targetHpPercent',1,100],['targetSpeed',1,999]])if(!Number.isFinite(config.conditions[key])||config.conditions[key]<min||config.conditions[key]>max)throw new RangeError('HP 비율·상대 스피드 범위를 확인해 주세요.');
    if(!Number.isInteger(config.conditions.repeatUses??1)||(config.conditions.repeatUses??1)<1||(config.conditions.repeatUses??1)>6)throw new RangeError('연속 사용 횟수는 1~6 사이 정수여야 합니다.');
    if(!Number.isInteger(config.conditions.targetSpeed))throw new RangeError('상대 실효 스피드는 정수로 입력해 주세요.');
    if(!['','물리','특수'].includes(config.conditions.previousCategory??''))throw new RangeError('직전 기술 분류를 확인해 주세요.');
    for(const [key,kind] of [['weather','날씨'],['terrain','필드']])if(config.conditions[key]&&!Env.list.some(e=>e.id===config.conditions[key]&&e.kind===kind))throw new RangeError('전장 설정을 확인해 주세요.');
  }
  function level50(base,config) {
    const nature=NATURES.find(n=>n.id===config.nature);
    if(!nature)throw new RangeError('알 수 없는 성격입니다.');
    return Object.fromEntries(STATS.map(key=>{
      const n=Math.floor((2*base[key]+config.ivs[key]+Math.floor(config.evs[key]/4))/2);
      return [key,key==='hp'?n+60:Math.floor((n+5)*(nature.up===key?11:nature.down===key?9:10)/10)];
    }));
  }
  function effectiveStats(pokemon,stats,config) {
    const result={...stats},c=config.conditions;
    const boost=(key,multiplier)=>{result[key]=Math.max(1,Math.floor(result[key]*multiplier));};
    if(config.item==='choice-band')boost('atk',1.5);
    if(config.item==='choice-specs')boost('spa',1.5);
    if(config.item==='choice-scarf')boost('spe',1.5);
    if(config.item==='assault-vest')boost('spd',1.5);
    const ability=pokemon.ability,activeWeather=ability.suppressesWeather||c.weatherSuppressed?'':c.weather,w=Env.list.find(e=>e.id===activeWeather);
    if(ability.statModifier&&ability.activeEnvironments.some(id=>id===activeWeather||id===c.terrain))boost(ability.statModifier.stat,ability.statModifier.multiplier);
    if(w?.mechanics.statBoost&&Env.fieldPokemonEffects(pokemon.types,c.terrain).types.some(t=>w.mechanics.statBoost.types.includes(t)))boost(w.mechanics.statBoost.stat,w.mechanics.statBoost.multiplier);
    boost('spe',Env.fieldPokemonEffects(pokemon.types,c.terrain).speedMultiplier);
    return result;
  }
  function powerForMove(pokemon,move,stats,config) {
    const timing=Fan.describe(move,pokemon.ability,config.conditions.repeatUses??1);
    if(move.category==='변화')return {id:move.id,name:move.name,status:true,duration:timing.duration,effect:timing.duration?move.effect.replace('5턴',timing.duration+'턴'):move.effect};
    const c=config.conditions,w=Env.list.find(e=>e.id===c.weather),t=Env.list.find(e=>e.id===c.terrain),ability=pokemon.ability;
    const suppressWeather=Boolean(ability.suppressesWeather||c.weatherSuppressed),activeWeather=suppressWeather?'':c.weather;
    let p=move.power,conditional=false;
    if(move.templateId==='gyro')p=Math.min(150,Math.max(1,Math.floor(25*c.targetSpeed/stats.spe)));
    if(move.templateId==='vital')p=60+Math.floor(60*Math.max(1,Math.floor(stats.hp*c.hpPercent/100))/stats.hp);
    if(move.templateId==='revenge'&&c.tookHit){p=120;conditional=true;}
    if(move.templateId==='finish'&&c.targetHpPercent<=50){p=105;conditional=true;}
    if(move.mechanics?.powerWhenTookHit&&c.tookHit){p=move.mechanics.powerWhenTookHit;conditional=true;}
    if(move.mechanics?.powerWhenTargetDebuffed&&c.targetDebuffed){p=move.mechanics.powerWhenTargetDebuffed;conditional=true;}
    if(['weather-hit','terrain-hit'].includes(move.templateId)&&[activeWeather,c.terrain].includes(move.environmentId)){p=105;conditional=true;}
    if(conditional&&move.type==='rock')p=Math.round(p*1.1/5)*5;
    let counts={min:1,max:1,expected:1};
    if(move.hitRange) {
      const linked=Boolean(t?.mechanics.skillLink);
      counts=linked?{min:move.hitRange[1],max:move.hitRange[1],expected:move.hitRange[1]}:{min:move.hitRange[0],max:move.hitRange[1],expected:Object.entries(move.hitProbabilities).reduce((n,[k,chance])=>n+Number(k)*chance,0)};
    }
    if(move.hitCount&&!move.hitPowers&&!move.hits)counts={min:move.hitCount,max:move.hitCount,expected:move.hitCount};
    const hit=power=>({type:move.type,category:move.category,power,attackStat:move.attackStat||(move.category==='물리'?'atk':'spa')});
    const hits=move.hits||(move.hitPowers?move.hitPowers.map(hit):[hit(move.hitRange||move.hitCount?move.powerPerHit:Number(p))]);
    const parts=hits.map(hit=>{
      const env=Env.describeMove({...move,type:hit.type,category:hit.category,accuracy:move.accuracy},{weather:w,terrain:t,userTypes:pokemon.types,skinType:ability.tags.includes('skin')?ability.type:null,grounded:!pokemon.types.includes('flying')&&ability.id!=='levitate',targetGrounded:c.targetGrounded??true,suppressWeather});
      const rawPower=hit.power;
      if(!Number.isFinite(rawPower))throw new Error('위력을 해석하지 못했습니다: '+move.id);
      const stat=hit.attackStat,attack=stats[stat],stab=env.pokemonTypes.includes(env.type)?1.5:1;
      let a=1;const active=[];
      const apply=(factor,label)=>{a*=factor;active.push(label+' ×'+factor);};
      if(timing.repeatMultiplier>1)apply(timing.repeatMultiplier,ability.name);
      if(ability.id==='muscle-focus'&&hit.category==='물리')apply(1.15,ability.name);
      if(ability.id==='mind-focus'&&hit.category==='특수')apply(1.15,ability.name);
      if(ability.id==='two-rhythms'&&move.templateId==='mixed-twin')apply(1.15,ability.name);
      if(ability.id==='syncopation'&&['물리','특수'].includes(move.category)&&['물리','특수'].includes(c.previousCategory)&&move.category!==c.previousCategory)apply(1.25,ability.name);
      if(ability.id==='first-step'&&c.actedFirst)apply(1.2,ability.name);
      if(ability.id==='late-force'&&c.targetActed)apply(1.25,ability.name);
      if(ability.id==='weak-point'&&c.targetDebuffed)apply(1.2,ability.name);
      if(ability.id==='fitted-armor'&&['def','spd'].includes(stat))apply(1.2,ability.name);
      if(ability.id==='small-engine'&&rawPower<=60)apply(1.2,ability.name);
      if(ability.id==='balanced-gears'&&(stats.atk===stats.spa||stat===(stats.atk<stats.spa?'atk':'spa')))apply(1.2,ability.name);
      if(ability.attackModifier&&ability.activeEnvironments.some(id=>id===activeWeather||id===c.terrain)&&ability.attackModifier.types.includes(env.type))apply(ability.attackModifier.multiplier,ability.name);
      const currentHp=Math.max(1,Math.floor(stats.hp*c.hpPercent/100));
      if(ability.tags.includes('low-hp')&&currentHp<=stats.hp/3&&env.type===ability.type)apply(1.5,ability.name);
      const itemMultiplier=config.item==='life-orb'?1.3:config.item==='muscle-band'&&hit.category==='물리'||config.item==='wise-glasses'&&hit.category==='특수'?1.1:1;
      const power=rawPower*env.powerMultiplier;
      const criticalMultiplier=move.alwaysCrit&&!c.criticalBlocked?1.5:1;
      const value=power*attack*stab*a*itemMultiplier*env.damageMultiplier*criticalMultiplier;
      return {type:env.type,category:hit.category,stat,attack,power,stab,abilityMultiplier:a,active,itemMultiplier,criticalMultiplier,environmentMultiplier:env.damageMultiplier,skinActive:env.skinActive,accuracy:env.alwaysHit?null:move.accuracy*env.accuracyMultiplier,fails:env.fails,value};
    });
    const failureReason=parts.some(part=>part.fails)?'독가스로 사용 실패':move.mechanics?.requiresUserHpAbove&&Math.max(1,Math.floor(stats.hp*c.hpPercent/100))<=stats.hp*move.mechanics.requiresUserHpAbove?'HP 조건 미충족':move.mechanics?.noConsecutive&&c.sameMoveLastTurn?'연속 턴 사용 불가':'';
    const sum=parts.reduce((n,part)=>n+part.value,0),failed=Boolean(failureReason);
    return {id:move.id,name:move.name,effect:timing.effect||move.effect,parts,counts,failed,failureReason,activations:timing.activations.map(event=>({...event,expected:failed?null:Math.round(sum*counts.expected*event.multiplier)})),min:failed?null:Math.round(sum*counts.min),max:failed?null:Math.round(sum*counts.max),expected:failed?null:Math.round(sum*counts.expected),conditional:move.templateId==='gyro'?'상대 스피드 '+c.targetSpeed:move.templateId==='vital'?'현재 HP '+c.hpPercent+'%':move.mechanics?.targetDefense?'대상의 낮은 방어 능력치를 사용합니다. 이 지표에는 상대 내구를 곱하지 않습니다.':move.mechanics?.powerWhenTookHit?'공격 피해를 받은 경우 위력 '+move.mechanics.powerWhenTookHit:move.mechanics?.powerWhenTargetDebuffed?'대상 방어・특방 하락 시 위력 '+move.mechanics.powerWhenTargetDebuffed:null};
  }
  function calculate(pokemon,config) {
    validate(config,pokemon);
    const stats=level50(pokemon.stats,config),effective=effectiveStats(pokemon,stats,config);
    const durability={physical:Math.round(effective.hp*effective.def/0.411),special:Math.round(effective.hp*effective.spd/0.411),hp:effective.hp,def:effective.def,spd:effective.spd,coefficient:0.411};
    return {level:50,stats,effective,durability,evTotal:STATS.reduce((n,key)=>n+config.evs[key],0),moves:pokemon.moves.map(move=>powerForMove(pokemon,move,effective,config)),supportMoves:(pokemon.supportMoves||[]).map(move=>powerForMove(pokemon,move,effective,config))};
  }
  return {STATS,NATURES,ITEMS,PRESETS,recommend,validate,level50,calculate};
});
