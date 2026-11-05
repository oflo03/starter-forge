(function () {
  'use strict';
  const E = window.StarterEngine;
  const C = window.StarterCatalog;
  const T = window.StarterTraining;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const typeMap = Object.fromEntries(C.TYPES.map(type => [type.id, type]));
  const labels = E.getRules().labels;
  const offenseName = {physical:'물리', special:'특수', mixed:'쌍두', support:'지원'};
  let current;
  let trainingConfig,trainingInvalid=false;
  let revealed = 6;
  let currentView = 'starter';
  let libraryLimit = 24;
  const library = C.getLibrary();
  const chip = (type, secondary = false) => `<span class="type-chip${secondary ? ' secondary' : ''}">${esc(typeMap[type]?.name || type || '공통')}</span>`;
  const textList = values => (values || []).map(value => `<li>${esc(value)}</li>`).join('');
  const announce = message => { $('announcement').textContent = message; };

  function settings() {
    const seed = $('seed').value.trim();
    if (!seed) throw new Error('재현할 시드를 입력해 주세요.');
    if (!$('stat-min').value || !$('stat-max').value) throw new Error('종족값의 최소와 최대를 입력해 주세요.');
    return {seed, options:E.validateOptions({min:Number($('stat-min').value), max:Number($('stat-max').value)})};
  }

  function generate(stepwise = false, fresh = false) {
    try {
      if (fresh) {
        const values = crypto.getRandomValues(new Uint32Array(2));
        $('seed').value = `forge-${Array.from(values, n => n.toString(36)).join('-')}`;
      }
      const config = settings();
      const result = E.generate(config.seed, config.options);
      current = result;
      trainingConfig=T.recommend(current);trainingInvalid=false;
      revealed = stepwise ? 0 : 6;
      $('form-error').hidden = true;
      showView('starter');
      renderResult();
      closeSettings();
      announce(stepwise ? '타입을 정했습니다. 다음 능력치 뽑기로 진행하세요.' : `${current.types.map(t => typeMap[t].name).join('·')} 타입의 ${current.classification.label}을 생성했습니다.`);
      if (stepwise) $('step-next').focus();
    } catch (error) {
      $('form-error').textContent = error.message;
      $('form-error').hidden = false;
      if (window.innerWidth <= 1100) openSettings();
      $('form-error').scrollIntoView({block:'nearest'});
    }
  }

  function showView(view) {
    currentView = view;
    for (const name of ['starter','training','rules','library']) {
      $(`view-${name}`).hidden = view !== name;
      const tab = $(`tab-${name}`);
      tab.classList.toggle('active', view === name);
      if (view === name) tab.setAttribute('aria-current','page');
      else tab.removeAttribute('aria-current');
    }
    if (view === 'rules') renderRules();
    if (view === 'library') renderLibrary();
    if (view === 'training') renderTraining();
  }

  function renderResult() {
    const complete = revealed === 6;
    const records = current.allocation.slice(0, revealed);
    const visible = new Set(records.map(row => row.stat));
    const total = records.reduce((sum, row) => sum + row.value, 0);
    const form = current.classification;
    $('result-heading').innerHTML = `<div class="result-heading"><div class="result-main"><div class="type-pair">${current.types.map((type,i) => chip(type,i>0)).join('')}</div><p class="role-name">${complete ? esc(form.label) : '종족값 추첨 중'}</p></div><p class="result-seed">재현 시드<strong>${esc(current.seed)}</strong></p></div>`;
    $('step-controls').hidden = complete;
    $('step-message').textContent = `${revealed}/6개 배정 · 남은 종족값 ${E.TOTAL-total}${revealed === 5 ? ' · 마지막은 남은 값으로 확정합니다.' : ''}`;
    $('step-next').textContent = revealed === 5 ? '마지막 값 배정' : '다음 능력치 뽑기';
    $('total-display').innerHTML = `<strong>${total}</strong> / ${E.TOTAL}`;
    $('stats').innerHTML = E.STATS.map(stat => `<div class="stat-row${visible.has(stat)?'':' unassigned'}"><span>${labels[stat]}</span><span class="stat-value">${visible.has(stat)?current.stats[stat]:'—'}</span><div class="stat-track" role="meter" aria-label="${labels[stat]}${visible.has(stat)?'':' 미배정'}" aria-valuemin="0" aria-valuemax="160" ${visible.has(stat)?`aria-valuenow="${current.stats[stat]}"`:''}><div class="stat-fill" style="width:${visible.has(stat)?current.stats[stat]/160*100:0}%"></div></div></div>`).join('');
    $('export').disabled = !complete;
    $('export').title = complete ? '타입·종족값·특성·기술·규칙을 JSON으로 저장' : '6개 종족값을 모두 배정하면 저장할 수 있습니다.';
    if (complete) {
      $('identity').innerHTML = `<div class="identity-stack"><section class="ability-panel" aria-labelledby="ability-heading"><div class="ability-head"><h3 id="ability-heading">${esc(current.ability.name)}</h3><span class="mini-label">특성 · ${esc(current.ability.source || '창작')}</span></div><p>${esc(current.ability.description)}</p>${renderItemRules(current.ability)}<p class="ability-reason">${esc(current.ability.reason || `${offenseName[form.offense]} 성향의 후보군에서 시드 난수로 선택했습니다.`)}</p></section><div class="classification-summary"><div><span>공격 성향</span><strong>${offenseName[form.offense]}</strong></div><div><span>물리 내구 지수</span><strong>${form.metrics.physicalBulk.toFixed(2)}</strong></div><div><span>특수 내구 지수</span><strong>${form.metrics.specialBulk.toFixed(2)}</strong></div><button class="text-button" type="button" id="explain-role">판정 근거 ↗</button></div></div>`;
      const summary=$('identity').querySelector('.classification-summary');
      const proof=document.createElement('section');
      proof.className='role-proof';
      summary.before(proof);
      proof.innerHTML=`<div class="proof-heading"><h3>수식으로 고른 형태</h3></div><p class="muted small">공격·특공 비율 ${form.metrics.attackRatio.toFixed(2)} · 진입 조건을 통과한 ${form.scores.length}개 형태 중 분배 거리가 가장 가깝습니다.</p>`;
      proof.querySelector('.proof-heading').append($('explain-role'));
      proof.append(summary);
      $('explain-role').addEventListener('click', () => { showView('rules'); $('view-rules').scrollIntoView({block:'start'}); });
      $('moves').innerHTML = current.moves.map(renderMove).join('');
      $('move-note').textContent = '형태에 맞춘 4개의 기술';
      const environments = Array.isArray(current.environment) ? current.environment : current.environment ? [current.environment] : [];
      $('environment').innerHTML = environments.length ? `<div class="environment-layout">${environments.map(env => `<div class="environment-box"><h3>${esc(env.name)}<span>${esc(env.kind)}${env.duration?` · ${esc(env.duration)}${typeof env.duration === 'number'?'턴':''}`:''}</span></h3><p>${esc(env.effect)}</p><details class="move-extra"><summary>적용·교체 규칙</summary><ul>${textList(env.rules)}</ul></details></div>`).join('')}${current.synergy.length?`<div><ul class="synergy-list">${textList(current.synergy)}</ul></div>`:''}</div>` : `<div class="no-environment">이 구성에는 전장 효과가 없습니다.${current.synergy.length?`<ul class="synergy-list">${textList(current.synergy)}</ul>`:''}</div>`;
      if(current.supportMoves?.length)$('environment').insertAdjacentHTML('beforeend',`<div class="environment-box environment-support"><h3>함께 쓸 원작 기술<span>환경용 기술 추천 · 전용기 4칸과 별도</span></h3>${current.supportMoves.map(move=>`<p><strong>${esc(move.name)}</strong> · ${esc(typeMap[move.type].name)} / ${esc(move.category)} / PP ${move.pp}<br>${esc(move.effect)}</p>`).join('')}</div>`);
    } else {
      $('identity').innerHTML = '<div class="identity-stack"><div class="empty-state"><h3>형태는 배정이 끝난 뒤 결정됩니다.</h3><p>종족값을 모두 뽑으면 고정 수식으로 형태를 고르고,<br>타입과 형태에 맞는 특성을 배정합니다.</p></div></div>';
      $('moves').innerHTML = '<div class="empty-state">전용기 4개는 종족값 배정 후 공개됩니다. 쌍두 성향에는 공격·특공을 각각 사용하는 2연타가 포함됩니다.</div>';
      $('move-note').textContent = '종족값 배정 대기';
      $('environment').innerHTML = '<p class="no-environment">특성과 전용기를 정한 뒤, 필요한 날씨·필드·공간 변화과 시너지를 확인합니다.</p>';
    }
    $('trace-summary').textContent = `${revealed}/6개 배정 · 3난수 분포 · 합계 530`;
    $('allocation').innerHTML = records.length ? `<p class="muted small">시드에서 생성한 실제 수식 입력 난수와 조정된 중간점입니다. 비대칭 능력치는 방향을 먼저 뽑고 필요하면 Rᵢ → 10−Rᵢ로 반사합니다. 표의 난수만 소수 4자리로 표시하며 계산에는 원래 정밀도를 사용합니다.</p><div class="table-wrap"><table><thead><tr><th>순서</th><th>능력치</th><th class="numeric">가능 범위</th><th class="numeric">중간점 M</th><th class="numeric">c</th><th>R₁ / R₂ / R₃</th><th class="numeric">배정값</th><th class="numeric">남은 값</th></tr></thead><tbody>${records.map(row => `<tr><td>${row.step}</td><td>${esc(row.label)} ${row.forced?'<span class="forced-label">잔여 배정</span>':''}</td><td class="numeric">${row.min}–${row.max}</td><td class="numeric">${row.midpoint}</td><td class="numeric">${row.forced?'—':row.c.toFixed(2)}</td><td>${row.rolls?row.rolls.map(n=>n.toFixed(4)).join(' / '):'잔여값 확정'}</td><td class="numeric">${row.value}</td><td class="numeric">${row.remaining}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">아직 배정된 종족값이 없습니다.</p>';
  }

  function renderItemRules(item) {
    return item.rules?.length?`<details class="move-extra"><summary>적용 규칙</summary><ul>${textList(item.rules)}</ul></details>`:'';
  }
  function renderMove(move) {
    const hits = Array.isArray(move.hits) ? move.hits : [];
    const effect=move.hitRule?move.effect.replace(` ${move.hitRule}`,''):move.effect;
    return `<article class="move-card"><div class="move-top">${chip(move.type)}<span class="category">${esc(move.category)}</span></div><h3>${esc(move.name)}</h3><div class="move-facts"><div>위력<strong>${esc(move.power || '—')}</strong></div><div>명중<strong>${move.accuracy == null ? '—' : esc(move.accuracy)}</strong></div><div>PP<strong>${esc(move.pp)}</strong></div>${move.priority?`<div>우선도<strong>${move.priority>0?'+':''}${move.priority}</strong></div>`:''}</div><p class="move-effect">${esc(effect)}</p>${renderItemRules(move)}${hits.length || move.hitRule ? `<details class="move-extra"><summary>타격별 판정</summary>${hits.map((hit,i) => `<p>${i+1}타 · ${esc(typeMap[hit.type]?.name || hit.type)} · ${esc(hit.category)} · 위력 ${esc(hit.power)}<br>${esc(labels[hit.attackStat] || hit.attackStat)} → ${esc(labels[hit.defenseStat] || hit.defenseStat)}</p>`).join('')}${move.hitRule?`<p>${esc(move.hitRule)}</p>`:''}</details>` : ''}</article>`;
  }

  function renderTraining() {
    const root=$('view-training');
    if(revealed!==6){root.innerHTML='<div class="empty-state"><h2>종족값 배정 후 실전 설정을 볼 수 있습니다.</h2><p>스타팅 탭에서 남은 추첨을 완료해 주세요.</p></div>';return;}
    const options=(items,value)=>items.map(item=>`<option value="${esc(item.id)}" ${item.id===value?'selected':''}>${esc(item.name)}</option>`).join('');
    const config=trainingConfig;
    root.innerHTML=`<div class="battle-heading"><div><h2>레벨 50 · ${esc(current.classification.label)}</h2><p class="muted">노력치·성격·아이템을 바꾸며 실능치와 기술별 결정력을 비교하세요.</p></div><button id="training-reset" type="button">형태 추천 다시 적용</button></div>
      <div class="battle-recommendations"><label class="battle-role" for="training-role">추천 형태<select id="training-role">${current.classification.scores.map(role=>`<option value="${esc(role.id)}" ${role.id===config.roleId?'selected':''}>${esc(role.label)}</option>`).join('')}</select></label><span class="muted">추천 도구</span>${config.recommendations.map(r=>`<button type="button" data-training-item="${esc(r.id)}" title="${esc(r.reason)}">${esc(T.ITEMS.find(i=>i.id===r.id).name)}</button>`).join('')}</div>
      <div id="training-form"><div class="battle-controls">
      <label for="training-nature">성격<select id="training-nature">${T.NATURES.map(n=>`<option value="${n.id}" ${n.id===config.nature?'selected':''}>${n.name}${n.up?' · '+labels[n.up]+'↑ '+labels[n.down]+'↓':''}</option>`).join('')}</select></label>
      <label for="training-item">아이템<select id="training-item">${options(T.ITEMS,config.item)}</select></label>
      <label for="training-weather">날씨<select id="training-weather"><option value="">없음</option>${options(library.environments.filter(e=>e.kind==='날씨'),config.conditions.weather)}</select></label>
      <label for="training-terrain">필드<select id="training-terrain"><option value="">없음</option>${options(library.environments.filter(e=>e.kind==='필드'),config.conditions.terrain)}</select></label></div>
      <p id="training-item-note" class="muted battle-note"></p><p id="training-error" class="battle-error" role="alert" hidden></p>
      <div class="battle-grid"><section><div class="section-title"><h3>실능치와 노력치</h3><span id="training-ev-total" class="muted small"></span></div>
      <div class="table-wrap"><table class="battle-stat-table"><thead><tr><th>능력치</th><th>종족값</th><th>IV</th><th>EV</th><th>Lv.50</th><th>적용값</th></tr></thead><tbody>${E.STATS.map(key=>`<tr><th scope="row">${labels[key]}</th><td class="numeric">${current.stats[key]}</td><td><input data-training-iv="${key}" type="number" min="0" max="31" step="1" value="${config.ivs[key]}" aria-label="${labels[key]} 개체값"></td><td><input data-training-ev="${key}" type="number" min="0" max="252" step="1" value="${config.evs[key]}" aria-label="${labels[key]} 노력치"></td><td class="numeric" id="training-stat-${key}"></td><td class="numeric" id="training-effective-${key}"></td></tr>`).join('')}</tbody></table></div>
      <p class="muted battle-note">Lv.50은 성격까지, 적용값은 도구·전장까지 반영합니다. 능력치 랭크는 0단계입니다.</p><p class="battle-note">${esc(config.reason)}</p><div id="training-durability" class="battle-power-grid" aria-live="polite"></div><p class="muted battle-note">실내구도 = 최대 HP × 적용 방어 또는 특방 ÷ 0.411 (최종값 반올림). 도구·날씨의 능력치 보정 반영. 상성·급소·장막·조건부 피해 감소는 제외한 비교 지표입니다.</p></section>
      <section><div class="section-title"><h3>전용기 결정력</h3><span class="muted small">상대 내구 적용 전</span></div><div id="training-power" class="battle-power-grid" aria-live="polite"></div><div id="training-support-section" hidden><div class="section-title"><h3>원작 연계기</h3><span class="muted small">전용기 4칸과 별도</span></div><div id="training-support-power" class="battle-power-grid"></div></div></section></div>
      <details class="battle-conditions"><summary>HP·행동 순서·가변 위력 조건</summary><div class="battle-controls">
      <label for="training-hp">자신 HP (%)<input id="training-hp" type="number" min="1" max="100" value="${config.conditions.hpPercent}"></label>
      <label for="training-target-hp">대상 HP (%)<input id="training-target-hp" type="number" min="1" max="100" value="${config.conditions.targetHpPercent}"></label>
      <label for="training-target-speed">대상 실효 스피드<input id="training-target-speed" type="number" min="1" max="999" value="${config.conditions.targetSpeed}"></label>
      <label for="training-repeat-uses">같은 공격기 연속 사용 횟수<input id="training-repeat-uses" type="number" min="1" max="6" step="1" value="${config.conditions.repeatUses??1}"></label><label for="training-previous-category">직전 기술 분류<select id="training-previous-category"><option value="">기록 없음</option>${['물리','특수'].map(value=>`<option value="${value}" ${config.conditions.previousCategory===value?'selected':''}>${value}</option>`).join('')}</select></label></div>
      <div class="battle-checks">${[['actedFirst','같은 우선도에서 먼저 행동'],['targetActed','대상이 이미 행동'],['tookHit','이 턴 대상의 공격으로 HP 피해'],['targetDebuffed','대상 방어 또는 특방 하락'],['targetGrounded','대상이 접지한 상태'],['weatherSuppressed','날씨 효과 무효(날씨부정·에어록)'],['criticalBlocked','대상이 급소를 막음'],['sameMoveLastTurn','비교 기술을 직전 턴에도 사용']].map(([key,label])=>`<label><input type="checkbox" data-training-condition="${key}" ${config.conditions[key]?'checked':''}>${label}</label>`).join('')}</div></details></div>
      <details class="battle-formula"><summary>계산 기준</summary><p>결정력 = Σ(타격 위력 × 사용하는 실능치 × 자속 × 특성·도구·전장 보정). 확정 급소는 ×1.5를 반영합니다. 명중률·일반 급소 확률·상성·상대 방어/특방·피해 난수는 곱하지 않습니다. 혼합 타격의 합은 비교용 지표이며 실제 피해량이 아닙니다. 지표는 합산 후 반올림합니다.</p><p>레벨 50: HP = ⌊(2B+IV+⌊EV/4⌋)/2⌋+60. 나머지 = ⌊(⌊(2B+IV+⌊EV/4⌋)/2⌋+5)×성격⌋. 노력치는 각 252·합계 510까지입니다.</p><p>탄력붙이기의 연속 사용 횟수는 각 비교 기술을 연속 사용했다고 가정합니다. 지연 공격은 각 발동의 결정력을 따로 표시하며 미래의 날씨·도구·능력치도 현재 조건과 같다고 가정합니다. 전장 선택은 발동을 가정한 비교 조건입니다. 거꾸로룸은 상성 지표에만 영향을 주므로 여기서는 별도 보정하지 않습니다.</p><p><a href="https://github.com/smogon/pokemon-showdown/blob/master/sim/battle.ts" target="_blank" rel="noreferrer">능력치 공식 참고</a> · <a href="https://github.com/smogon/pokemon-showdown/blob/master/data/items.ts" target="_blank" rel="noreferrer">도구 효과 참고</a></p></details>`;
    root.querySelector('#training-reset').addEventListener('click',()=>{trainingConfig=T.recommend(current);trainingInvalid=false;renderTraining();});
    $('training-role').addEventListener('change',()=>{trainingConfig=T.recommend(current,$('training-role').value);trainingInvalid=false;renderTraining();});
    root.querySelectorAll('[data-training-item]').forEach(button=>button.addEventListener('click',()=>{$('training-item').value=button.dataset.trainingItem;updateTraining();}));
    $('training-form').addEventListener('change',updateTraining);
    updateTraining();
  }
  function updateTraining(event) {
    const key=event?.target?.dataset.trainingCondition;
    const check=name=>document.querySelector(`[data-training-condition="${name}"]`);
    if(key==='actedFirst'&&event.target.checked){check('targetActed').checked=false;check('tookHit').checked=false;}
    if(key==='targetActed'){if(event.target.checked)check('actedFirst').checked=false;else check('tookHit').checked=false;}
    if(key==='tookHit'&&event.target.checked){check('targetActed').checked=true;check('actedFirst').checked=false;}
    const config={...trainingConfig,ivs:{},evs:{},conditions:{...trainingConfig.conditions}};
    for(const key of E.STATS) {
      const number=selector=>{const value=document.querySelector(selector).value;return value.trim()===''?NaN:Number(value);};
      config.ivs[key]=number(`[data-training-iv="${key}"]`);config.evs[key]=number(`[data-training-ev="${key}"]`);
    }
    config.nature=$('training-nature').value;config.item=$('training-item').value;
    config.conditions.weather=$('training-weather').value;config.conditions.terrain=$('training-terrain').value;
    config.conditions.previousCategory=$('training-previous-category').value;
    for(const [key,id] of [['hpPercent','training-hp'],['targetHpPercent','training-target-hp'],['targetSpeed','training-target-speed'],['repeatUses','training-repeat-uses']])config.conditions[key]=$(id).value.trim()===''?NaN:Number($(id).value);
    document.querySelectorAll('[data-training-condition]').forEach(input=>config.conditions[input.dataset.trainingCondition]=input.checked);
    try {
      const result=T.calculate(current,config);trainingConfig=config;trainingInvalid=false;
      $('training-error').hidden=true;$('training-power').hidden=false;$('export').disabled=false;
      $('training-ev-total').textContent=result.evTotal+' / 510 EV';
      for(const key of E.STATS){$('training-stat-'+key).textContent=result.stats[key];$('training-effective-'+key).textContent=result.effective[key];}
      const item=T.ITEMS.find(i=>i.id===config.item),recommendation=config.recommendations.find(i=>i.id===config.item);
      $('training-item-note').textContent=item.description+(recommendation?' '+recommendation.reason:'');
      const n=value=>Number(value.toFixed(2)).toLocaleString('ko-KR');
      $('training-durability').hidden=false;
      $('training-durability').innerHTML=[['physical','물리 실내구도','def'],['special','특수 실내구도','spd']].map(([key,label,stat])=>`<article class="battle-move"><h3>${label}</h3><p class="battle-value" id="training-durability-${key}">${n(result.durability[key])}</p><p class="muted">HP ${result.effective.hp} × ${labels[stat]} ${result.effective[stat]} ÷ 0.411</p></article>`).join('');
      const renderPower=moves=>moves.map(move=>move.status?`<article class="battle-move"><h3>${esc(move.name)}</h3><p class="battle-value">—</p><p class="muted">변화기 · 공격 결정력 없음</p><p>${esc(move.effect)}</p></article>`:`<article class="battle-move"><h3>${esc(move.name)}</h3><p class="battle-value">${move.failed?'—':move.min===move.max?n(move.expected):n(move.min)+'–'+n(move.max)}</p><p class="muted">${move.failed?esc(move.failureReason):move.min!==move.max?'연타 기대 지표 '+n(move.expected):move.parts.length>1?move.parts.length+'타 합산':move.counts.max>1?move.counts.max+'타 합산':'공격 지표'}</p><p>${move.parts.map(p=>`${esc(typeMap[p.type].name)} · ${esc(p.category)} · ${labels[p.stat]} ${p.attack}`).join('<br>')}</p><details><summary>계산식·조건</summary>${move.parts.map((p,i)=>`<p>${move.parts.length>1?i+1+'타 · ':''}${n(p.power)} × ${p.attack} × 자속 ${p.stab} × 특성 ${n(p.abilityMultiplier)} × 도구 ${n(p.itemMultiplier)} × 전장·스킨 ${n(p.environmentMultiplier)}${p.criticalMultiplier>1?' × 급소 '+n(p.criticalMultiplier):''} = ${n(p.value)}<br>${p.active.map(esc).join(' / ')}${p.skinActive?' · 스킨 발동':''}<br>명중 ${p.accuracy==null?'필중':n(p.accuracy)}</p>`).join('')}${move.counts.max>1?`<p>${move.counts.min}–${move.counts.max}타 · 기대 ${n(move.counts.expected)}타</p>`:''}${move.activations?.length?`<p>${move.activations.map(event=>`${event.turn===0?'사용한 턴':event.turn+'턴 뒤'}: ${event.expected==null?'실패':n(event.expected)}${event.multiplier!==1?' (피해 ×'+event.multiplier+')':''}`).join('<br>')}</p>`:''}${move.effect?`<p>${esc(move.effect)}</p>`:''}${move.conditional?`<p>${esc(move.conditional)}</p>`:''}</details></article>`).join('');
      $('training-power').innerHTML=renderPower(result.moves);
      $('training-support-section').hidden=!result.supportMoves.length;
      $('training-support-power').innerHTML=renderPower(result.supportMoves);
    } catch(error) {
      trainingInvalid=true;$('training-support-section').hidden=true;$('training-durability').hidden=true;$('training-error').textContent=error.message;$('training-error').hidden=false;$('training-power').hidden=true;$('export').disabled=true;
      $('training-ev-total').textContent='입력 확인';
      for(const key of E.STATS){$('training-stat-'+key).textContent='—';$('training-effective-'+key).textContent='—';}
    }
  }

  function profileTable() {
    return `<table class="profile-table"><thead><tr><th>능력치</th><th class="numeric">중간점 ± 범위</th><th class="numeric">c ↓ / ↑</th></tr></thead><tbody>${E.STAT_PROFILES.map(p=>`<tr><td>${labels[p.stat]}</td><td class="numeric">${p.midpoint} ± ${p.radius}</td><td class="numeric">${p.cAbove===undefined?p.c.toFixed(2):p.c.toFixed(1)+' / '+p.cAbove.toFixed(1)}</td></tr>`).join('')}</tbody></table>`;
  }

  function renderRules() {
    const rules = E.getRules();
    const complete = revealed === 6;
    const classification = current?.classification;
    $('view-rules').innerHTML = `<div class="view-heading"><h2>공개된 수식으로만 판정합니다.</h2><p class="muted">실행 중 AI 호출 없이, 같은 규칙과 시드로 결과를 다시 만들 수 있습니다.</p></div><div class="rules-grid"><section class="rule-block"><h3>타입과 530 배정</h3><p>18개 단일 타입 + 서로 다른 두 타입의 조합 153개 = <strong>171개</strong>. 순서가 바뀐 조합은 같은 것으로 봅니다. 각 조합의 추첨 확률은 1/171입니다.</p><code class="formula">${esc(rules.allocation.formula)}</code><code class="formula">${esc(rules.allocation.samplingFormula)}</code><p>R은 남은 종족값입니다. 나머지 능력치 각각의 지정 범위를 합산합니다. ${esc(rules.allocation.steps)}</p><p class="muted small">${esc(rules.allocation.distribution)}</p></section><section class="rule-block"><h3>공격 성향과 속도</h3><code class="formula">${esc(rules.offense.formula)}</code><p>A = 공격, C = 특공, S = 스피드.</p><p>${esc(rules.speed.formula)}</p><p class="muted small">공격과 특공이 비슷해도 둘 다 낮으면 쌍두가 되지 않습니다.</p></section><section class="rule-block"><h3>HP를 함께 보는 내구</h3><code class="formula">${esc(rules.bulk.formula)}</code><p>${esc(rules.bulk.baseline)} 양쪽 내구 1.05 이상을 양면 내구로 봅니다.</p><p class="muted small">HP가 높은 것만으로 물리막이나 특수막이가 되지는 않습니다. 풍선형도 별도의 형태입니다.</p></section><section class="rule-block"><h3>형태 선택과 난수</h3><code class="formula">${esc(rules.matching.formula)}</code><p>${esc(rules.matching.filtering)} 가장 가까운 형태를 선택하며, 동점은 목록 순서로 결정합니다.</p><p class="muted small">형태·타입으로 적합한 특성/기술 후보를 만들고, 같은 시드의 난수로 가중 추첨합니다. 분배 전체의 균등 확률을 보장하지는 않습니다.</p></section></div>${complete ? `<section class="rules-section"><h3>현재 스타팅의 판정 근거</h3><ul class="synergy-list">${textList(classification.explanation)}</ul><div class="table-wrap"><table><thead><tr><th>후보 형태</th><th class="numeric">RMSE ↓</th><th class="numeric">적합 점수 ↑</th></tr></thead><tbody>${classification.scores.map((score,i) => `<tr><td>${esc(score.label)}${i===0?' · 선택':''}</td><td class="numeric">${score.distance.toFixed(2)}</td><td class="numeric">${score.score.toFixed(2)}</td></tr>`).join('')}</tbody></table></div><p class="muted small">점수는 템플릿과의 분배 유사도이며 승률이나 성능 평가가 아닙니다.</p></section>` : '<p class="rules-note">현재 스타팅을 모두 뽑으면 이곳에 실제 판정 근거가 표시됩니다.</p>'}<section class="rules-section"><h3>${rules.templates.length}개 포지션 형태</h3><p class="muted">기준 분배는 총합 530으로 정규화한 비교용 실수입니다. 실제 스타팅 종족값은 항상 정수입니다.</p><div class="table-wrap"><table class="roles-table"><thead><tr><th>형태</th><th class="role-values">HP / 공격 / 방어 / 특공 / 특방 / 스피드</th><th>후보 진입 조건</th></tr></thead><tbody>${rules.templates.map(role => `<tr><td>${esc(role.label)}</td><td>${E.STATS.map(stat => role.stats[stat].toFixed(1)).join(' / ')}</td><td>${esc(role.condition)}</td></tr>`).join('')}</tbody></table></div></section><section class="rules-section"><h3>특성과 전장 선택 규칙</h3><div class="rules-note">${Array.isArray(library.rules) ? `<ul class="synergy-list">${textList(library.rules.map(rule => typeof rule==='string'?rule:rule.description||rule.effect||JSON.stringify(rule)))}</ul>` : '<p>타입과 형태에 맞는 후보를 가중 추첨합니다. 환경 수혜 효과가 나오면 해당 환경을 만드는 특성 또는 기술을 함께 배정합니다.</p>'}</div><p class="muted small">전투 시뮬레이터는 포함하지 않습니다. 타입 상성·자속·연타·전장 효과는 출력된 창작 규칙을 게임에 구현할 때 적용합니다.</p></section>`;
    $('view-rules').insertAdjacentHTML('afterbegin', `<section class="rules-section profile-rule"><h3>능력치별 기준 분포 · 규칙 ${E.VERSION}</h3>${profileTable()}<p class="muted small">표의 중간점은 기본 범위의 중심입니다. 남은 총합 때문에 가능 범위가 줄면 실제 M도 함께 이동합니다. HP·방어·특방은 M 아래 c=0.1, 위 c=0.5의 반쪽 분포입니다. 방향은 50:50으로 고른 뒤 필요하면 난수 3개를 반사합니다. 반올림 전 값 기준이며 잔여 배정은 제외합니다. 풍선형은 HP > 130, 방어·특방 ≤ 90입니다.</p></section>`);
  }

  function renderLibrary(reset = false) {
    if (reset) libraryLimit = 24;
    const kind = $('library-kind').value;
    const type = $('library-type').value;
    const query = $('library-search').value.trim().toLocaleLowerCase();
    const items = (library[kind] || []).filter(item => (type === 'all' || item.type === type || item.secondaryType === type || item.types?.includes(type)) && (!query || [item.name,item.effect,item.description,item.source,...(item.tags||[])].join(' ').toLocaleLowerCase().includes(query)));
    $('library-count').textContent = `${items.length.toLocaleString()}개 항목 · ${Math.min(items.length,libraryLimit)}개 표시`;
    $('library-results').innerHTML = items.length ? items.slice(0,libraryLimit).map(item => `<article class="library-card">${item.type?chip(item.type):'<span class="type-chip secondary">공통</span>'}<h3>${esc(item.name)}</h3><p class="small muted">${esc(item.source || "창작")}</p><p>${esc(item.description || item.effect || '')}</p>${item.category?`<p class="small">${esc(item.category)} · 위력 ${esc(item.power || '—')} · 명중 ${item.accuracy == null?'—':esc(item.accuracy)} · PP ${esc(item.pp)}</p>`:''}${item.kind?`<p class="small">${esc(item.kind)}${item.duration?' · '+esc(item.duration)+(typeof item.duration==='number'?'턴':''):''}</p>`:''}${renderItemRules(item)}${item.hits?.length?`<p class="small">${item.hits.map((hit,i) => `${i+1}타 ${esc(typeMap[hit.type]?.name || hit.type)} / ${esc(hit.category)} / ${esc(labels[hit.attackStat] || hit.attackStat)}`).join('<br>')}</p>`:''}</article>`).join('') : '<p class="empty-state">검색에 맞는 항목이 없습니다. 다른 타입이나 검색어를 선택해 주세요.</p>';
    $('library-more').hidden = items.length <= libraryLimit;
  }

  function openSettings() {
    $('sidebar').classList.add('is-open');
    $('scrim').hidden = false;
    $('open-settings').setAttribute('aria-expanded','true');
    if (window.innerWidth <= 1100) {
      $('sidebar').setAttribute('role','dialog');
      $('sidebar').setAttribute('aria-modal','true');
      document.querySelector('.main-shell').inert = true;
      document.body.style.overflow = 'hidden';
      $('close-settings').focus();
    }
  }
  function closeSettings() {
    const wasOpen = $('sidebar').classList.contains('is-open');
    $('sidebar').classList.remove('is-open');
    $('scrim').hidden = true;
    $('open-settings').setAttribute('aria-expanded','false');
    $('sidebar').removeAttribute('role');
    $('sidebar').removeAttribute('aria-modal');
    document.querySelector('.main-shell').inert = false;
    document.body.style.overflow = '';
    if (wasOpen && window.innerWidth <= 1100) $('open-settings').focus();
  }

  $('generator-form').addEventListener('submit', event => { event.preventDefault(); generate(); });
  $('randomize').addEventListener('click', () => generate(false, true));
  $('step-start').addEventListener('click', () => generate(true));
  $('step-next').addEventListener('click', () => {
    if (revealed >= 6) return;
    revealed++;
    const row = current.allocation[revealed-1];
    renderResult();
    announce(`${row.label}에 ${row.value} 배정. ${revealed === 6 ? `완료. ${current.classification.label}.` : `남은 값 ${row.remaining}.`}`);
    if (revealed === 6) $('export').focus();
  });
  $('step-finish').addEventListener('click', () => { revealed=6; renderResult(); announce('모든 종족값 배정을 완료했습니다.'); $('export').focus(); });
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  $('sidebar-rules').addEventListener('click', () => { closeSettings(); showView('rules'); $('workspace').focus(); });
  document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); closeSettings(); showView('starter'); });
  $('export').addEventListener('click', () => {
    if (!current || revealed !== 6 || trainingInvalid) return;
    const data = {...current, training:{config:trainingConfig,...T.calculate(current,trainingConfig)}, rules:E.getRules(), catalogRules:library.rules, note:'팬 제작 스타팅 설정. 전투 시뮬레이션 결과가 아닙니다.'};
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=`starter-${current.seed.replace(/[^a-zA-Z0-9가-힣_-]/g,'_').slice(0,70)}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url),1000);
    announce('스타팅 설정을 JSON 파일로 저장했습니다.');
  });
  $('library-type').insertAdjacentHTML('beforeend', C.TYPES.map(type => `<option value="${esc(type.id)}">${esc(type.name)}</option>`).join(''));
  for (const id of ['library-kind','library-type']) $(id).addEventListener('change', () => renderLibrary(true));
  $('library-search').addEventListener('input', () => renderLibrary(true));
  $('library-more').addEventListener('click', () => { libraryLimit+=24; renderLibrary(); });
  $('open-settings').addEventListener('click', openSettings);
  $('close-settings').addEventListener('click', closeSettings);
  $('scrim').addEventListener('click', closeSettings);
  document.addEventListener('keydown', event => {
    if (!$('sidebar').classList.contains('is-open')) return;
    if (event.key === 'Escape') closeSettings();
    if (event.key === 'Tab') {
      const nodes = Array.from($('sidebar').querySelectorAll('button,input,summary,a')).filter(node=>node.getClientRects().length&&!node.disabled);
      const first=nodes[0], last=nodes[nodes.length-1];
      if (event.shiftKey && document.activeElement===first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); }
    }
  });
  window.addEventListener('resize', () => { if (window.innerWidth>1100 && $('sidebar').classList.contains('is-open')) closeSettings(); });
  document.querySelector('.version').firstChild.textContent='규칙 v'+E.VERSION+' ';
  $('profile-settings').innerHTML=profileTable();
  generate();
})();
