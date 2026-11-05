import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Browser, sleep } from 'file:///C:/Users/oFlo/.codex/plugins/cache/taste-skill/taste-skill/2.1.4/skills/taste-skill/scripts/lib/cdp.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const downloads = mkdtempSync(join(tmpdir(), 'starter-forge-test-'));
const browser = await Browser.launch();
const page = await browser.newPage();
const failures = [];
const requests = [];
let passed = 0;
const test = async (name, run) => {
  try { await run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
};
const click = async selector => {
  const point = await page.eval(selector => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    element.scrollIntoView({ block: 'center' });
    const r = element.getBoundingClientRect();
    if (!r.width || !r.height) throw new Error(`Hidden ${selector}`);
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, selector);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
};
const field = (selector, value, event = 'input') => page.eval(({ selector, value, event }) => {
  const element = document.querySelector(selector);
  element.value = value;
  element.dispatchEvent(new Event(event, { bubbles: true }));
}, { selector, value, event });
const snapshot = () => page.eval(() => ({
  seed: document.querySelector('#seed').value,
  heading: document.querySelector('#result-heading').textContent,
  values: [...document.querySelectorAll('.stat-value')].map(el => el.textContent),
  moves: document.querySelector('#moves').innerHTML,
  identity: document.querySelector('#identity').innerHTML,
  total: document.querySelector('#total-display strong').textContent,
  disabled: document.querySelector('#export').disabled,
  trace: [...document.querySelectorAll('#allocation tbody tr')].map(tr => tr.textContent),
}));
const press = (key, code = key, modifiers = 0) => page.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers, windowsVirtualKeyCode: key === 'Tab' ? 9 : key === 'Escape' ? 27 : undefined });
const noOverflow = async () => {
  const sizes = await page.eval(() => ({ viewport: innerWidth, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert.ok(sizes.doc <= sizes.viewport + 1 && sizes.body <= sizes.viewport + 1, JSON.stringify(sizes));
};

try {
  await page.send('Network.enable');
  browser.on(page.sessionId, 'Network.requestWillBeSent', params => {
    if (/^https?:/.test(params.request.url)) requests.push(params.request.url);
  });
  await page.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await browser.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads, eventsEnabled: true });
  await page.goto(pathToFileURL(join(root, 'index.html')).href, { settleMs: 300 });

  await test('standalone file works offline and initial stats sum to 530', async () => {
    const state = await snapshot();
    assert.equal(state.total, '530');
    assert.equal(state.values.reduce((sum, value) => sum + Number(value), 0), 530);
    assert.equal(state.values.length, 6);
    assert.equal(state.disabled, false);
    assert.equal(await page.eval(() => document.querySelectorAll('#moves .move-card').length), 4);
    await noOverflow();
  });

  await test('same seed and options reproduce the same complete result', async () => {
    await field('#seed', 'browser-regression-530');
    await click('#generator-form button[type="submit"]');
    const first = await snapshot();
    await click('#generator-form button[type="submit"]');
    assert.deepEqual(await snapshot(), first);
    const expected = await page.eval(() => {
      const E = window.StarterEngine;
      const result = E.generate(document.querySelector('#seed').value, { min: 1, max: 255 });
      return E.STATS.map(stat => String(result.stats[stat]));
    });
    assert.deepEqual(first.values, expected);
  });

  await test('new starter replaces the seed and creates a valid result', async () => {
    const before = await snapshot();
    await click('#randomize');
    const after = await snapshot();
    assert.notEqual(after.seed, before.seed);
    assert.equal(after.total, '530');
    assert.equal(after.values.reduce((sum, value) => sum + Number(value), 0), 530);
  });

  await test('stepwise draw reveals six distinct stats and the last remainder', async () => {
    await field('#seed', 'stepwise-regression-530');
    const expected = await page.eval(() => window.StarterEngine.generate('stepwise-regression-530', { min: 1, max: 255 }));
    await click('#step-start');
    let state = await snapshot();
    assert.equal(state.total, '0');
    assert.equal(state.disabled, true);
    assert.equal(state.values.filter(value => value === '—').length, 6);
    assert.equal(await page.eval(() => document.querySelectorAll('#moves .move-card').length), 0);
    for (let step = 1; step <= 6; step++) {
      await click('#step-next');
      state = await snapshot();
      assert.equal(state.values.filter(value => value !== '—').length, step);
      assert.equal(state.total, String(expected.allocation.slice(0, step).reduce((sum, row) => sum + row.value, 0)));
      assert.equal(state.trace.length, step);
      assert.equal(state.disabled, step < 6);
      if (step === 5) {
        assert.equal(530 - Number(state.total), expected.allocation[5].value);
        assert.equal(await page.eval(() => document.querySelector('#step-next').textContent), '마지막 값 배정');
      }
    }
    assert.ok(state.trace[5].includes('잔여 배정'));
    assert.equal(state.total, '530');
    assert.equal(await page.eval(() => document.querySelectorAll('#moves .move-card').length), 4);
    assert.equal(await page.eval(() => document.querySelector('#step-controls').hidden), true);
  });

  await test('finish remaining draw reveals the reproducible final result', async () => {
    const before = await snapshot();
    await click('#step-start');
    await click('#step-next');
    await click('#step-finish');
    assert.deepEqual(await snapshot(), before);
  });

  await test('invalid ranges show an error and preserve the last generated result', async () => {
    const before = await snapshot();
    for (const [min, max] of [[200, 100], [100, 255], [1, 80], [1.5, 255]]) {
      await field('#stat-min', String(min));
      await field('#stat-max', String(max));
      // The step control validates through the same generation path without native form validation.
      await click('#step-start');
      assert.equal(await page.eval(() => document.querySelector('#form-error').hidden), false);
      assert.ok(await page.eval(() => document.querySelector('#form-error').textContent.length > 0));
      assert.deepEqual(await snapshot(), before);
    }
    await field('#stat-min', '1');
    await field('#stat-max', '255');
    await click('#generator-form button[type="submit"]');
    assert.equal(await page.eval(() => document.querySelector('#form-error').hidden), true);
  });

  await test('rules tab shows formulas, 171 combinations and all role templates', async () => {
    await click('#tab-rules');
    const result = await page.eval(() => ({ hidden: document.querySelector('#view-rules').hidden, text: document.querySelector('#view-rules').textContent, roles: document.querySelectorAll('.roles-table tbody tr').length, expected: window.StarterEngine.getRules().templates.length }));
    assert.equal(result.hidden, false);
    assert.equal(result.roles, result.expected);
    assert.ok(result.text.includes('171') && result.text.includes('RMSE') && result.text.includes('현재 스타팅의 판정 근거'));
    await noOverflow();
  });

  await test('catalog kind, type, search, load more and empty results work', async () => {
    await click('#tab-library');
    const first = await page.eval(() => document.querySelectorAll('.library-card').length);
    assert.equal(first, 24);
    await click('#library-more');
    assert.ok(await page.eval(() => document.querySelectorAll('.library-card').length > 24));
    for (const kind of ['abilities', 'moves', 'environments']) {
      await field('#library-kind', kind, 'change');
      await field('#library-type', 'poison', 'change');
      const filtered = await page.eval(({ kind }) => {
        const expected = window.StarterCatalog.getLibrary()[kind].filter(item => item.type === 'poison' || item.types?.includes('poison'));
        return { expected: Math.min(24, expected.length), actual: document.querySelectorAll('.library-card').length };
      }, { kind });
      assert.equal(filtered.actual, filtered.expected);
      assert.ok(filtered.actual > 0);
    }
    await field('#library-kind', 'abilities', 'change');
    await field('#library-type', 'all', 'change');
    await field('#library-search', '스킨');
    assert.equal(await page.eval(() => document.querySelectorAll('.library-card').length), 18);
    await field('#library-search', 'not-an-item-9838942084');
    assert.equal(await page.eval(() => document.querySelectorAll('.library-card').length), 0);
    assert.ok(await page.eval(() => document.querySelector('#library-results').textContent.includes('검색에 맞는 항목이 없습니다')));
    assert.equal(await page.eval(() => document.querySelector('#library-more').hidden), true);
    await field('#library-search', '');
    await noOverflow();
  });

  await test('training tab edits EVs, validates budgets and updates item/field power', async () => {
    await click('#tab-training');
    assert.equal(await page.eval(()=>document.querySelectorAll('#training-power .battle-move').length),4);
    assert.ok(await page.eval(()=>document.querySelector('#training-ev-total').textContent.includes('508')));
    assert.ok(await page.eval(()=>['physical','special'].every((key,i)=>{
      const hp=Number(document.querySelector('#training-effective-hp').textContent),def=Number(document.querySelector('#training-effective-'+(i?'spd':'def')).textContent);
      return document.querySelector('#training-durability-'+key).textContent===Math.round(hp*def/0.411).toLocaleString('ko-KR');
    })));
    const originalDurability=await page.eval(()=>document.querySelector('#training-durability').textContent);
    await field('#training-nature','lax','change');
    await field('[data-training-ev="hp"]','0','change');
    await field('[data-training-ev="def"]','0','change');
    assert.notEqual(await page.eval(()=>document.querySelector('#training-durability').textContent),originalDurability);
    await click('#training-reset');
    for(const key of ['hp','atk','def','spa','spd','spe'])await field(`[data-training-ev="${key}"]`,'252','change');
    assert.equal(await page.eval(()=>document.querySelector('#training-error').hidden),false);
    assert.equal(await page.eval(()=>document.querySelector('#export').disabled),true);
    assert.equal(await page.eval(()=>document.querySelector('#training-durability').hidden),true);
    await click('#training-reset');
    assert.equal(await page.eval(()=>document.querySelector('#training-error').hidden),true);
    const roles=await page.eval(()=>[...document.querySelector('#training-role').options].map(o=>o.value));
    if(roles.length>1){await field('#training-role',roles[1],'change');assert.equal(await page.eval(()=>document.querySelector('#training-role').value),roles[1]);await click('#training-reset');}
    const before=await page.eval(()=>document.querySelector('#training-power').textContent);
    await field('#training-item','life-orb','change');
    const after=await page.eval(()=>document.querySelector('#training-power').textContent);
    assert.notEqual(after,before);
    await field('#training-terrain','terrain-white-paint','change');
    assert.ok(await page.eval(()=>document.querySelector('#training-power').textContent.includes('노말')));
    await field('#training-item','assault-vest','change');
    const hasStatus=await page.eval(()=>window.StarterEngine.generate(document.querySelector('#seed').value).moves.some(m=>m.category==='변화'));
    assert.equal(await page.eval(()=>document.querySelector('#training-error').hidden),!hasStatus);
    await click('#training-reset');
    await click('.battle-conditions summary');
    await click('[data-training-condition="tookHit"]');
    assert.ok(await page.eval(()=>document.querySelector('[data-training-condition="targetActed"]').checked));
    assert.equal(await page.eval(()=>document.querySelector('[data-training-condition="actedFirst"]').checked),false);
    await click('[data-training-condition="actedFirst"]');
    assert.equal(await page.eval(()=>document.querySelector('[data-training-condition="tookHit"]').checked),false);
    assert.equal(await page.eval(()=>document.querySelector('[data-training-condition="targetActed"]').checked),false);
    await click('#training-reset');
    await noOverflow();
    await click('#step-start');await click('#tab-training');
    assert.ok(await page.eval(()=>document.querySelector('#view-training').textContent.includes('종족값 배정 후')));
    assert.equal(await page.eval(()=>document.querySelectorAll('#training-power').length),0);
    await click('#tab-starter');await click('#step-finish');
  });

  await test('creative rules and category alternation change power without changing stats', async () => {
    await click('#tab-starter');await field('#seed','fan-browser:65');await click('#generator-form button[type="submit"]');
    assert.equal(await page.eval(()=>document.querySelector('#ability-heading').textContent),'엇박자');
    assert.ok((await page.eval(()=>document.querySelector('.ability-panel').textContent)).includes('종족값·실능치는 바꾸지 않습니다'));
    await click('#tab-training');await click('.battle-conditions summary');
    const before=await page.eval(()=>[...document.querySelectorAll('[id^="training-stat-"]')].map(el=>el.textContent));
    for(const previous of ['물리','특수']) {
      await field('#training-previous-category',previous,'change');
      const result=await page.eval(previous=>{
        const p=window.StarterEngine.generate(document.querySelector('#seed').value),c=window.StarterTraining.recommend(p);
        c.conditions.previousCategory=previous;
        return {expected:window.StarterTraining.calculate(p,c).moves.map(m=>m.status?'—':m.expected.toLocaleString('ko-KR')),actual:[...document.querySelectorAll('#training-power .battle-value')].map(el=>el.textContent),stats:[...document.querySelectorAll('[id^="training-stat-"]')].map(el=>el.textContent)};
      },previous);
      assert.deepEqual(result.actual,result.expected);assert.deepEqual(result.stats,before);
    }
    await click('#tab-library');await field('#library-kind','abilities','change');await field('#library-search','여분쿠션');
    const rules=await page.eval(()=>document.querySelector('.library-card').textContent);
    assert.ok(rules.includes('대타출동과 같은 대타'));assert.ok(rules.includes('누적 없음'));
    await click('#tab-starter');
  });

  await test('selected fan abilities show linked moves, timing and repeat power', async () => {
    for(const [seed,name] of [['fan-browser:5','끈질긴손길'],['fan-browser:14','탄력붙이기'],['fan-browser:72','이른혜성'],['fan-browser:322','다시도는별']]) {
      await click('#tab-starter');await field('#seed',seed);await click('#generator-form button[type="submit"]');
      assert.equal(await page.eval(()=>document.querySelector('#ability-heading').textContent),name);
      await click('#tab-training');
      assert.equal(await page.eval(()=>document.querySelectorAll('#training-power .battle-move').length),4);
      const text=await page.eval(()=>document.querySelector('#training-support-power').textContent);
      if(name==='끈질긴손길')assert.ok(text.includes('7턴')&&!text.includes('5턴'));
      if(name==='이른혜성')assert.ok(text.includes('사용한 턴')&&text.includes('즉시'));
      if(name==='다시도는별')assert.ok(text.includes('2턴 뒤')&&text.includes('5턴 뒤')&&text.includes('0.5'));
      if(name==='탄력붙이기') {
        const before=await page.eval(()=>Number(document.querySelector('#training-power .battle-value').textContent.replaceAll(',','')));
        await click('.battle-conditions summary');await field('#training-repeat-uses','6','change');
        const after=await page.eval(()=>Number(document.querySelector('#training-power .battle-value').textContent.replaceAll(',','')));
        assert.equal(after,Math.round(before*1.5));
        await field('#training-repeat-uses','0','change');assert.equal(await page.eval(()=>document.querySelector('#training-error').hidden),false);
        await click('#training-reset');
      }
      await page.setViewport({width:390,height:844,mobile:true});await noOverflow();
      await page.setViewport({width:1440,height:900});
    }
  });

  await test('original environments, support techniques and training options are available', async () => {
    const fixture=await page.eval(()=>{
      for(let i=0;i<100;i++) {
        const seed='browser-environment:'+i,p=window.StarterEngine.generate(seed);
        if(p.supportMoves.length)return {seed,names:p.supportMoves.map(m=>m.name)};
      }
      throw new Error('No support move fixture');
    });
    await click('#tab-starter');await field('#seed',fixture.seed);await click('#generator-form button[type="submit"]');
    assert.equal(await page.eval(()=>document.querySelectorAll('#moves .move-card').length),4);
    const support=await page.eval(()=>document.querySelector('.environment-support').textContent);
    for(const name of fixture.names)assert.ok(support.includes(name));
    await click('#tab-training');
    assert.equal(await page.eval(()=>document.querySelectorAll('#training-weather option').length),11);
    assert.equal(await page.eval(()=>document.querySelectorAll('#training-terrain option').length),9);
    await click('#tab-library');await field('#library-kind','environments','change');await field('#library-search','스텔스록');
    assert.equal(await page.eval(()=>document.querySelectorAll('.library-card').length),1);
    assert.ok((await page.eval(()=>document.querySelector('.library-card').textContent)).includes('원작 기반'));
    await field('#library-kind','moves','change');await field('#library-search','고속스핀');
    assert.equal(await page.eval(()=>document.querySelector('.library-card h3').textContent),'고속스핀');
    await click('#tab-starter');
  });

  await test('JSON button downloads a real valid complete starter file', async () => {
    await click('#tab-starter');
    const expected = await page.eval(() => window.StarterEngine.generate(document.querySelector('#seed').value, { min: Number(document.querySelector('#stat-min').value), max: Number(document.querySelector('#stat-max').value) }));
    await click('#export');
    let file;
    for (let attempt = 0; attempt < 40; attempt++) {
      file = readdirSync(downloads).find(name => name.endsWith('.json'));
      if (file) break;
      await sleep(100);
    }
    assert.ok(file, 'No JSON file was downloaded');
    const downloaded = JSON.parse(readFileSync(join(downloads, file), 'utf8'));
    for (const key of ['seed', 'types', 'stats', 'allocation', 'classification', 'ability', 'moves', 'environment', 'synergy']) assert.deepEqual(downloaded[key], expected[key], key);
    assert.equal(downloaded.rules.combinationCount, 171);
    assert.equal(downloaded.total, 530);
    assert.equal(downloaded.training.level,50);
    assert.equal(downloaded.training.moves.length,4);
    assert.equal(downloaded.training.evTotal,508);
    assert.ok(downloaded.training.durability.physical>0&&downloaded.training.durability.special>0);
  });

  await test('mobile drawer manages focus, keyboard trap, Escape and hidden focus', async () => {
    await page.setViewport({ width: 390, height: 844, mobile: true });
    await sleep(150);
    await noOverflow();
    await click('#open-settings');
    assert.equal(await page.eval(() => document.activeElement.id), 'close-settings');
    assert.equal(await page.eval(() => document.querySelector('.main-shell').inert), true);
    await page.eval(() => document.querySelector('#sidebar-rules').focus());
    await press('Tab');
    assert.equal(await page.eval(() => document.activeElement.className), 'brand');
    await press('Tab', 'Tab', 8);
    assert.equal(await page.eval(() => document.activeElement.id), 'sidebar-rules');
    await press('Escape');
    assert.equal(await page.eval(() => document.querySelector('#sidebar').classList.contains('is-open')), false);
    assert.equal(await page.eval(() => document.activeElement.id), 'open-settings');
    assert.equal(await page.eval(() => document.querySelector('.main-shell').inert), false);
    await sleep(250);
    await press('Tab', 'Tab', 8);
    assert.equal(await page.eval(() => Boolean(document.activeElement.closest('#sidebar'))), false, 'Closed offscreen sidebar still receives keyboard focus');
    await click('#open-settings');
    await page.setViewport({ width: 1440, height: 900 });
    await sleep(150);
    assert.equal(await page.eval(() => document.querySelector('#sidebar').classList.contains('is-open')), false);
    assert.equal(await page.eval(() => document.querySelector('.main-shell').inert), false);
    assert.equal(await page.eval(() => document.querySelector('#scrim').hidden), true);
  });

  await test('390px and 768px pages have no document overflow on all views', async () => {
    for (const width of [390, 768]) {
      await page.setViewport({ width, height: width === 390 ? 844 : 1024, mobile: width === 390 });
      for (const view of ['starter', 'training', 'rules', 'library']) {
        await click(`#tab-${view}`);
        await noOverflow();
      }
    }
  });

  await test('no external HTTP requests and no JavaScript runtime errors', async () => {
    assert.deepEqual(requests, []);
    assert.deepEqual(page.consoleErrors, []);
  });
} finally {
  await browser.close();
  rmSync(downloads, { recursive: true, force: true });
}
console.log(JSON.stringify({ passed, failed: failures.length, failures, httpRequests: requests.length }, null, 2));
if (failures.length) process.exitCode = 1;
