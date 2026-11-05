'use strict';
const fs=require('node:fs');
const path=require('node:path');
const C=require('./catalog.js'), E=require('./engine.js');
const library=C.getLibrary(), typeMap=Object.fromEntries(library.types.map(t=>[t.id,t.name]));
const stat={atk:'공격',def:'방어',spa:'특공',spd:'특방',spe:'스피드'};
const type=item=>[item.type,item.secondaryType].filter(Boolean).map(id=>typeMap[id]).join(' / ')||'공통';
const cell=value=>String(value??'—').replaceAll('|','／').replaceAll('\n',' ');
const lines=[`# 스타터 포지 — 생성 콘텐츠 전체 목록`, '', `규칙 버전 ${E.VERSION} · 문서판 ${E.VERSION}-doc1. 실제 카탈로그에서 자동 추출한 목록입니다.`, '',
  '## 현재 사용하는 전장 목록', '',
  `현재 전장 효과는 아래 ${library.environments.length}개입니다. 이전에 타입별로 양산했던 날씨·필드는 사용하지 않습니다. 아래 목록과 상세 표는 생성기가 사용하는 동일한 카탈로그에서 추출합니다.`, '',
  '| 구분 | 창작 | 원작 기반 | 합계 |','|---|---|---|---:|',
  ...['날씨','필드','공간 변화','설치물'].map(kind=>{
    const items=library.environments.filter(e=>e.kind===kind);
    return '| '+[kind,...['창작','원작 기반'].map(source=>items.filter(e=>e.source===source).map(e=>e.name).join(' · ')||'없음'),items.length].join(' | ')+' |';
  }), '',
  '‘창작’은 새 효과·조건을 조합한 항목, ‘타입 확장’은 기존 기술·특성 계열의 타입 파생, ‘원작 기반’은 기존 이름을 사용한 항목입니다. 단순 타입 파생을 신규 효과로 세지 않습니다. 원작 기반 항목도 위력·배율 등이 조정될 수 있으므로 아래 수치를 기준으로 합니다.', '',
  '투웨이는 같은 타입의 물리 1타·특수 1타, 이원 기술은 서로 다른 타입의 물리 2타 또는 특수 2타입니다. 고정 타입 전용기는 스타팅의 타입과 달라도 배정될 수 있습니다.', '', '## 수록 수', '', '| 분류 | 창작 | 타입 확장 | 원작 기반 | 합계 |','|---|---:|---:|---:|---:|'];
for(const [key,label] of [['abilities','특성'],['moves','기술'],['environments','전장 효과']]) {
 const items=library[key],counts=['창작','타입 확장','원작 기반'].map(source=>items.filter(i=>i.source===source).length);
 lines.push(`| ${label} | ${counts.join(' | ')} | ${items.length} |`);
}
lines.push('', `전장 효과는 ${[...new Set(library.environments.map(e=>e.kind))].map(kind=>kind+' '+library.environments.filter(e=>e.kind===kind).length+'개').join('·')}입니다. 기술 수는 타입별 파생과 이원 기술의 분류별 변형을 포함한 항목 수이며, 서로 다른 기본 효과의 수를 뜻하지 않습니다.`, '', '## 읽는 법과 공통 규칙', '', ...library.rules.map(r=>'- '+r), '',
 '## 타입별 기술 선택 성향', '', '| 타입 | 가중치를 높인 태그 | 추가 규칙 |', '|---|---|---|');
const tags={support:'변화·지원',heal:'회복',protect:'방어',boost:'랭업',drain:'흡수',pivot:'공격 후 교체',physical:'물리',special:'특수',recoil:'반동',fast:'속도',priority:'선공',debuff:'능력치 하락',critical:'급소',body:'방어 기반 공격',hazard:'설치물',slow:'후공',reset:'능력치 초기화',mixed:'쌍두','physical-bulk':'물리 내구'};
for(const t of library.types) lines.push(`| ${t.name} | ${library.typeStyles[t.id].map(tag=>tags[tag]||tag).join('·')} | ${['normal','grass'].includes(t.id)?'빈 슬롯에 변화기 우선 배정':t.id==='rock'?'공격 명중 −10, 고정 위력 약 1.1배':'선택 가중치 3배(다른 역할 가중치와 곱함)'} |`);
const table=(title,items,headers,render)=>{lines.push('',`## ${title}`,'','| '+headers.join(' | ')+' |','| '+headers.map(()=>'---').join(' | ')+' |');for(const item of items) lines.push('| '+render(item).map(cell).join(' | ')+' |');};
const createdMoves=library.moves.filter(m=>m.source==='창작');
table('채택한 팬 창작 기반 특성 4개',library.abilities.filter(m=>m.collection==='fan-selection-1.10'),['이름','효과','규칙','참고 출처'],m=>[m.name,m.description,m.rules.join(' '),m.referenceUrl||'이 프로젝트의 창작']);
table('채택한 공격기 — 녹물세례',library.moves.filter(m=>m.collection==='fan-selection-1.10'),['이름','타입','분류','위력','명중','PP','효과','규칙','출처'],m=>[m.name,type(m),m.category,m.power,m.accuracy,m.pp,m.effect,m.rules.join(' '),m.referenceUrl]);
lines.push('','미래예지·파멸의소원은 원작 이름과 수치로 별도 연계칸에 제공합니다. 지연 특성에는 두 기술을 모두 배정하며 전용기 4칸에는 넣지 않습니다. 실전 설정에서 연속 사용 배율, 연장된 룸 기간과 지연 공격의 발동별 결정력을 확인할 수 있습니다. 예약·반복·지속시간은 규칙 데이터로 제공하며 턴 전투를 자동 진행하지 않습니다.','');
for(const [family,label] of [['sure-crit','확정 급소'],['multi-hit','연타'],['priority','선공'],['heavy','페널티 고위력']])table('추가 '+label+' 공격기 6종',library.moves.filter(m=>m.arsenalFamily===family),['이름','타입','분류','위력','명중','PP','우선도','효과','규칙'],m=>[m.name,type(m),m.category,m.power,m.accuracy,m.pp,m.priority,m.effect,(m.rules||[]).join(' ')]);
lines.push('','실전 설정의 실내구도는 최대 HP × 적용 방어/특방 ÷ 0.411을 반올림한 비교 지표입니다. IV·EV·성격·도구·날씨의 능력치 보정을 반영하고 상성·급소·장막·조건부 피해 감소는 제외합니다. 실제 버티는 피해량은 아닙니다.','');
table('새 이색 특성 6개',library.abilities.filter(m=>m.collection==='creative-1.8'),['이름','효과','적용 규칙','ID'],m=>[m.name,m.description,m.rules.join(' '),m.id]);
table('새 고정 타입 전용기 10개',library.moves.filter(m=>m.collection==='creative-1.8'),['이름','타입','분류','위력','명중','PP','우선도','효과','적용 규칙','ID'],m=>[m.name,type(m),m.category,m.power||'—',m.accuracy??'판정 없음',m.pp,m.priority,m.effect,(m.rules||[]).join(' '),m.id]);
lines.push('','새 기술은 타입별로 복제하지 않고 고정 타입 하나씩만 갖습니다. 엇박자·거울우편·봉합찌르기의 조건부 화력은 실전 설정에서 비교합니다. 여분쿠션의 대타 생성·도구 복원·PP 회복·표식·설치물 이동·턴 진행은 처리 규칙 데이터로 제공하며 전투를 자동 진행하지 않습니다.','');
table('날씨 수혜 특성 밸런스 기준',library.abilities.filter(m=>m.source==='창작'&&m.tags.includes('weather')&&m.tags.includes('beneficiary')),['특성','효과','원작 비교 기준','처리 규칙'],m=>[m.name,m.description,m.balanceReference,(m.rules||[]).join(' ')]);
lines.push('','날씨 생성 특성은 가뭄·잔비와 같이 등장 시 5턴 생성입니다. 수혜 특성의 스피드 2배에는 추가 공격 강화·회복·피해 감소를 겹쳐 붙이지 않습니다. 독가스·뇌우의 전용 수혜 특성만 모래헤치기와 같은 범위의 해당 날씨 턴 종료 피해 면역을 갖습니다. 독가스 금지 기술의 실패 피해는 면제하지 않습니다. 원작 선파워·모래의힘·젖은접시·아이스바디의 배율·회복량·페널티는 유지합니다. 실전 승률을 검증한 결과가 아니라 원작 효과를 기준으로 맞춘 수치입니다.','');
for(const source of ['창작','원작 기반'])for(const kind of ['날씨','필드','공간 변화','설치물']) {
  const items=library.environments.filter(m=>m.kind===kind&&m.source===source);
  if(items.length)table(source+' '+kind,items,['이름','소속 타입','기간','효과','개별 규칙','ID'],m=>[m.name,type(m),m.duration?m.duration+'턴':'제거 전까지',m.effect,m.rules.join(' '),m.id]);
}
table('창작 특성',library.abilities.filter(m=>m.source==='창작'),['이름','타입','효과','ID'],m=>[m.name,type(m),m.description,m.id]);
table('창작 랭업기 — 타입·상승량·페널티 고정',createdMoves.filter(m=>m.templateId==='rankup'),['이름','타입','상승','PP','페널티·처리','ID'],m=>[m.name,type(m),Object.entries(m.boosts).map(([s,n])=>stat[s]+' +'+n).join(' / '),m.pp,m.effect,m.id]);
table('그 밖의 창작 기술',createdMoves.filter(m=>m.templateId!=='rankup'&&m.variant!=='type-support'),['이름','타입','분류','위력','명중','PP','우선도','효과','ID'],m=>[m.name,type(m),m.category,m.power||'—',m.accuracy??'판정 없음/필중',m.pp,m.priority,m.effect,m.id]);
table('유지한 타입 확장 특성',library.abilities.filter(m=>m.source==='타입 확장'),['이름','타입','기반 계열','효과','ID'],m=>[m.name,type(m),m.referenceName,m.description,m.id]);
table('유지한 타입 확장 기술',library.moves.filter(m=>m.source==='타입 확장'),['이름','타입','기반 계열','분류','위력','명중','PP','효과','ID'],m=>[m.name,type(m),m.referenceName,m.category,m.power||'—',m.accuracy??'판정 없음/필중',m.pp,m.effect,m.id]);
table('별도 수록 — 원작 기반 특성',library.abilities.filter(m=>m.source==='원작 기반'),['이름','타입','이 도구의 효과','ID'],m=>[m.name,type(m),m.description,m.id]);
table('별도 수록 — 원작 기반 기술',library.moves.filter(m=>m.source==='원작 기반'),['이름','타입','분류','위력','명중','PP','우선도','이 도구의 효과','ID'],m=>[m.name,type(m),m.category,m.power||'—',m.accuracy??'판정 없음/필중',m.pp,m.priority,m.effect,m.id]);
lines.push('', '## 이름·기존 상승 조합 확인 자료', '',
 '- [PokeAPI 한국어 기술 이름](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/move_names.csv)',
 '- [PokeAPI 한국어 특성 이름](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/ability_names.csv)',
 '- [PokeAPI 기술 데이터](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/moves.csv)',
 '- [PokeAPI 능력치 변화 데이터](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/move_meta_stat_changes.csv)', '',
 '- [비 날씨 등 기본 효과 참고 데이터](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/move_effect_prose.csv)', '',
 '- [날씨 관련 특성의 배율·피해 면역 비교 구현](https://github.com/smogon/pokemon-showdown/blob/master/data/abilities.ts)', '',
 '고정 랭업기 파일은 build_rankups.py로 사전 생성하며 실행 중에는 네트워크나 AI를 사용하지 않습니다. 참조 CSV에서 능력치 변화가 누락된 승리의춤·제살깎기는 별도로 보완합니다. 변화가 없는 부가 조건까지 모든 원작 기술과 중복을 비교한 목록은 아닙니다.', '');
const write=(name,text)=>fs.writeFileSync(path.join(__dirname,name),text,'utf8');
write('NEW_CONTENT.md',lines.join('\n'));
write('content-catalog.json',JSON.stringify({version:E.VERSION,...library},null,2));
const csvRow=values=>values.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',');
const rows=[['구분','출처','ID','이름','타입','분류','위력','명중','PP','우선도','효과','상승','페널티','기간']];
for(const [key,label] of [['abilities','특성'],['moves','기술'],['environments','전장 효과']]) for(const m of library[key]) rows.push([label,m.source,m.id,m.name,type(m),m.category||m.kind,m.power,m.accuracy,m.pp,m.priority,m.description||m.effect,m.boosts?JSON.stringify(m.boosts):'',m.penalties?JSON.stringify(m.penalties):'',m.duration]);
write('content-catalog.csv','\ufeff'+rows.map(csvRow).join('\r\n'));
console.log(JSON.stringify({abilities:library.abilities.length,moves:library.moves.length,environments:library.environments.length,newRankups:createdMoves.filter(m=>m.templateId==='rankup').length}));
