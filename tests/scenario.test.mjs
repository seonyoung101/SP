// 실행: node tests/scenario.test.mjs
import assert from 'node:assert/strict';
import { Scenario } from '../js/scenario.js';

const ok = (s, id) => { const r = s.perform(id); assert.ok(r.ok, `${id}: ${r.reason}`); return r; };
const blocked = (s, id) => { const r = s.perform(id); assert.equal(r.ok, false, `${id} 는 막혀야 함`); return r; };

// 1) 모범 수행 → 28점
{
  const s = new Scenario(); s.start();
  for (const id of ['handwash', 'identify', 'intro', 'stopIV', 'organizeFoley', 'bedLow']) ok(s, id);
  assert.equal(s.emotion, 7);
  ok(s, 'orientation'); ok(s, 'compareRecord'); ok(s, 'vitals'); ok(s, 'assessBladder'); ok(s, 'fixKink'); ok(s, 'neuro');
  assert.equal(s.emotion, 5);
  s.submitNuDesc({ orientation: 2, behavior: 1, communication: 1, hallucination: 2, psychomotor: 0 });
  for (const id of ['reorient', 'validate', 'explainUrine', 'reinsertIV', 'callWife']) ok(s, id);
  assert.ok(s.emotion <= 3.5, `정서 강도 ${s.emotion}`);
  blocked(s, 'readback'); blocked(s, 'antipyretic');
  const r = s.submitSBAR(['s1', 's2', 'b1', 'b2', 'a1', 'a2', 'a3', 'r1', 'r2']);
  assert.ok(r.orderGiven);
  blocked(s, 'antipyretic'); // read-back 전에는 투여 불가
  const w = s.submitReadback('rb2'); assert.equal(w.ok, false);
  blocked(s, 'chart');
  const g = s.submitReadback('rb1'); assert.equal(g.ok, true);
  ok(s, 'antipyretic'); ok(s, 'chart'); ok(s, 'reassess');
  assert.equal(s.posture, 'lying');
  const rep = s.finish();
  assert.equal(rep.total, 28, JSON.stringify(rep.items.filter((i) => i.score < 2)));
  assert.deepEqual(rep.objectives.map((o) => o.max), [8, 14, 6]);
  assert.equal(rep.firstReadbackWrong, true);
}

// 2) 아무것도 안 한 경우 → 신체보호대 미사용(2점)만
{
  const s = new Scenario(); s.start();
  const rep = s.finish();
  assert.equal(rep.total, 2);
}

// 3) 신체보호대 + 환시 반박 + 비약물 중재 부족
{
  const s = new Scenario(); s.start();
  ok(s, 'orientation'); ok(s, 'restraint'); ok(s, 'deny'); ok(s, 'validate');
  assert.equal(s.emotion, 9); // 7 → 9 → 10(상한) → 9
  ok(s, 'reassess');
  assert.equal(s.posture, 'edge');
  const rep = s.finish();
  const it = (n) => rep.items.find((i) => i.n === n).score;
  assert.equal(it(11), 0); assert.equal(it(7), 1);
}

// 4) 게이트·중복 방지
{
  const s = new Scenario();
  assert.equal(s.perform('handwash').ok, false); // 시작 전
  s.start();
  blocked(s, 'compareRecord'); blocked(s, 'fixKink'); blocked(s, 'explainUrine'); blocked(s, 'reinsertIV');
  ok(s, 'handwash'); blocked(s, 'handwash');
  ok(s, 'reorient'); ok(s, 'reorient'); // 반복 가능, 정서 감소는 1회만
  assert.equal(s.emotion, 6);
}

// 5) SBAR: 오답 선택·미수행 사정 반영
{
  const s = new Scenario(); s.start();
  s.submitSBAR(['s1', 's2', 's3', 'b1', 'b2', 'a2', 'a3', 'r3']);
  assert.deepEqual(s.sbar.complete, { S: false, B: true, A: false, R: false });
  assert.equal(s.order, null);
  const rep = s.report();
  assert.equal(rep.items.find((i) => i.n === 13).score, 0);
  assert.equal(rep.items.find((i) => i.n === 12).score, 0); // B만 충족 → 1요소
}

// 6) 타이머: 7분 알림, 9분 대사, 10분 종료
{
  const s = new Scenario(); s.start();
  ok(s, 'reorient');
  let ev = []; for (let i = 0; i < 421; i++) ev.push(...s.tick(1));
  assert.equal(ev.filter((e) => e.type === 'alert').length, 1);
  for (let i = 0; i < 125; i++) ev.push(...s.tick(1));
  assert.equal(ev.filter((e) => e.type === 'line').length, 1);
  for (let i = 0; i < 60; i++) ev.push(...s.tick(1));
  assert.ok(ev.some((e) => e.type === 'timeup'));
  const p = new Scenario({ practice: true }); p.start();
  for (let i = 0; i < 700; i++) assert.ok(!p.tick(1).some((e) => e.type === 'timeup'));
}

console.log('scenario tests passed');
