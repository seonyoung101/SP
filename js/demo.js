// 시연 영상 모드 — 메뉴 없이 시나리오를 자동 재생하고, SP의 촉진 cue·정서 강도 조절을 자막으로 설명한다.
// 발표(시뮬레이션 운영)에서 화면을 녹화해 보여 주는 용도. 간호 수행은 "학습자"가 하는 것으로 보여 주고,
// 환자(김두두) 역할은 SP가 수행하는 상호작용이라는 점을 강조한다.
import { META } from './scenario-data.js';

const NUDESC = { orientation: 2, behavior: 1, communication: 1, hallucination: 2, psychomotor: 0 };
const SBAR_OK = ['s1', 's2', 'b1', 'b2', 'a1', 'a2', 'a3', 'r1', 'r2'];

// 카메라 위치(눈높이 기준 world 좌표). 침대는 (0, 0, -1.3), 머리 쪽이 -z.
const SHOTS = {
  wide: { eye: [0.0, 1.62, 0.95], at: [0, 0.95, -1.7] },
  foot: { eye: [0.0, 1.55, 0.15], at: [0, 0.95, -1.7] },
  right: { eye: [-0.62, 1.45, -0.55], at: [-0.15, 1.1, -1.55] }, // 환자 오른팔(정맥주사 쪽)
  face: { eye: [0.55, 1.45, -1.0], at: [0, 1.25, -1.9] },
  pump: { eye: [-0.15, 1.35, -0.45], at: [-0.72, 1.12, -1.2] },
  foley: { eye: [1.1, 1.15, -0.1], at: [0.5, 0.75, -0.85] },
  bugs: { eye: [-1.1, 1.75, 0.9], at: [1.0, 1.6, -1.7] },
  side: { eye: [1.3, 1.5, -0.7], at: [0, 1.0, -1.5] },
  wall: { eye: [0.0, 1.55, -0.55], at: [0, 1.5, -2.5] }, // 침상 머리 벽 패널
  monitor: { eye: [0.5, 1.45, 0.3], at: [1.4, 1.25, -1.45] }, // 활력징후 모니터(환자 왼쪽)
  tv: { eye: [0.0, 1.5, -0.7], at: [0, 1.95, 2.05] }, // 천장 TV (환자 정면)
  sofa: { eye: [-0.2, 1.5, 0.75], at: [-1.9, 0.8, -0.9] }, // 보호자 소파·옷장
  sink: { eye: [0.5, 1.5, 1.0], at: [2.3, 1.15, 0.3] }, // 손 위생 코너
};

const CUE = {
  env: '환경·장비',
  say: 'SP 촉진 cue',
  obs: 'Nu-DESC 관찰 단서',
  emo: 'SP 정서 강도 조절',
  call: '전화 cue (당직의)',
  time: '시간 관리 cue',
  safe: '개입 기준',
  end: '종료 cue',
};

// 시연 대본. t = 시나리오 경과 초(앞으로 빨리 감기), act = 학습자 수행, cam = 카메라, cue = 설명 카드
const SCRIPT = [
  // ---- 환경·장비 안내 (시연 시작 전) ----
  { env: true, cam: 'wide', camDur: 0, hold: 2.5, cue: { kind: CUE.env, title: '시연 환경', text: '야간(02:00) 병실 · 감염내과 입원 첫날 · 보호자 귀가 · 간호사 단독 근무', secs: 5 } },
  { env: true, cam: 'pump', hold: 3.5, cue: { kind: CUE.env, title: '수액 펌프·폴대', text: 'NS 40 mL/hr + ceftriaxone 2 g. 우측 손등·전완 말초정맥 — 환자가 스스로 제거해 출혈 중', secs: 6 } },
  { env: true, cam: 'foley', hold: 3.5, cue: { kind: CUE.env, title: 'Foley 카테터·소변주머니', text: '바지 허리에서 나온 소변줄이 꺾여 소변이 나오지 않는 상태 (요폐 → 통증·불안의 원인)', secs: 6 } },
  { env: true, cam: 'wall', hold: 3, cue: { kind: CUE.env, title: '벽 패널 — 호출벨·산소·흡인', text: '콘센트·조명 스위치·NURSE CALL·산소(O₂)·흡인(SUCTION). 환자 상태가 악화되면 가장 먼저 쓰는 위치', secs: 6 } },
  { env: true, cam: 'monitor', hold: 3, cue: { kind: CUE.env, title: '활력징후 모니터', text: '환자 왼쪽 머리 쪽, 혈압 커프는 왼쪽 위팔에 감겨 있다(오른팔은 정맥주사 부위). 측정 전에는 수치가 비어 있고, 학습자가 활력징후를 측정하면 값이 표시된다', secs: 6 } },
  { env: true, cam: 'tv', hold: 2.5, cue: { kind: CUE.env, title: '천장 TV', text: '환자 정면(발치 쪽)에 매달린 TV. 야간이라 대기 화면 — 환경 단서(소리·빛)로 쓸 수 있다', secs: 5 } },
  { env: true, cam: 'sofa', hold: 2.5, cue: { kind: CUE.env, title: '보호자 소파·옷장', text: '환자 오른쪽 벽의 옷장과 보호자 소파. 보호자는 귀가한 상태 — 야간에는 간호사 단독 근무', secs: 5 } },
  { env: true, cam: 'sink', hold: 3, cue: { kind: CUE.env, title: '손 위생 코너', text: '문 오른쪽의 세면대·손소독제·페이퍼타월. 시연 첫 행동(손 위생)이 여기서 이루어진다', secs: 6 } },
  { env: true, cam: 'face', hold: 3, cue: { kind: CUE.env, title: '환자 — 김두두 (80세 남, SP)', text: '입원 시 지남력 정상 → 급성 변화. 좌측 경도 편마비(10년 전 뇌경색), 고혈압', secs: 6 } },

  // ---- 0~3분: 발견·안전 확보 ----
  { t: 0, start: true, cam: 'wide', camDur: 0.1, hold: 1, cue: { kind: CUE.say, title: '① 최초 단서', text: 'SP가 소리를 지르며 학습자를 호출 — 학습자가 병실로 가서 안전부터 확보하는지 관찰', secs: 7 } },
  { t: 12, act: 'handwash', cam: 'foot', camDur: 4, hold: 0.8 },
  { t: 24, act: 'identify', hold: 1, cue: { kind: CUE.emo, title: '정서 강도 7 / 10', text: '시작 시점은 가장 격앙된 상태. 학습자의 말과 행동에 따라 SP가 강도를 조절한다 (최종 3)', secs: 7 } },
  { t: 40, act: 'intro', hold: 1, cue: { kind: CUE.say, title: '비언어 반응', text: '불이 켜지고 눈높이를 맞춘 소개 → SP는 말 없이 쳐다보기만 한다 (학습자의 태도를 본다)', secs: 6 } },
  { t: 62, act: 'stopIV', cam: 'right', camDur: 3, hold: 1.5, cue: { kind: CUE.say, title: '책임 전가 반응', text: '피 묻은 팔을 내밀며 흥분한 어조 — 감정에 휘말리지 않고 출혈 처치를 먼저 하는지 관찰', secs: 8 } },
  { t: 110, act: 'organizeFoley', cam: 'foley', camDur: 3, hold: 1.2, cue: { kind: CUE.obs, title: '부적절한 행동', text: '소변줄을 만지작거리며 불편 호소 — Nu-DESC 항목 2 관찰 단서', secs: 6 } },
  { t: 150, act: 'bedLow', cam: 'side', camDur: 3, hold: 1.2 },

  // ---- 3~7분: 사정·섬망 선별 ----
  { t: 195, act: 'orientation', cam: 'bugs', camDur: 3, hold: 0.6, cue: { kind: CUE.obs, title: '착각·환각 / 지남력 장애', text: '천장 구석의 벌레를 쫓는 연기 + 장소·시간·사람을 혼동 — 항목 1·4 단서를 한꺼번에 노출', secs: 9 } },
  { t: 205, cam: 'face', camDur: 3, hold: 0.5 },
  { t: 225, act: 'compareRecord', hold: 0.8 },
  { t: 250, act: 'vitals', cam: 'right', camDur: 3, hold: 1, cue: { kind: CUE.obs, title: '부적절한 의사소통', text: '맥락에 맞지 않는 횡설수설 — 항목 3 관찰 단서', secs: 6 } },
  { t: 290, act: 'assessBladder', cam: 'foley', camDur: 3, hold: 1 },
  { t: 330, act: 'fixKink', hold: 2, cue: { kind: CUE.emo, title: '정서 강도 7 → 5', text: '원인(요폐)을 해결하자 SP가 고함을 멈추고 난간을 놓는다 — 학습자 행동에 대한 즉각적 반응', secs: 8 } },
  { t: 365, act: 'neuro', cam: 'face', camDur: 3, hold: 0.8 },
  { t: 400, fn: 'nudesc', cam: 'foot', camDur: 3, hold: 1.5, cue: { kind: CUE.obs, title: '관찰자 체크리스트', text: 'Nu-DESC 5항목 채점 — 총점 2점 이상이면 섬망 선별 양성', secs: 7 } },

  // ---- 7~9분: 비약물적 중재 ----
  { t: 424, wait: true, hold: 0.5, cue: { kind: CUE.time, title: '종료 3분 전 알림', text: '시간 관리 cue — 진행자가 남은 시간을 알린다', secs: 5 } },
  { t: 440, act: 'reorient', cam: 'face', camDur: 3, hold: 1 },
  { t: 470, act: 'validate', hold: 1.5, cue: { kind: CUE.emo, title: '감정 인정 → 반응 완화', text: '환시를 반박하지 않고 감정을 인정하면 SP가 누그러진다 (반박하면 오히려 격해지는 분기)', secs: 8 } },
  { t: 495, act: 'explainUrine', cam: 'foley', camDur: 3, hold: 1 },
  { t: 510, act: 'reinsertIV', cam: 'right', camDur: 3, hold: 1 },
  { t: 525, act: 'callWife', cam: 'face', camDur: 3, hold: 1 },
  { t: 543, wait: true, hold: 0.6, cue: { kind: CUE.say, title: '지남력 재확인 cue', text: '9분 시점에 SP가 “여기가 어디라고 했지?” — 학습자가 재안내를 반복하는지 확인', secs: 7 } },

  // ---- 9~10분: 보고·재평가·기록 ----
  { t: 550, fn: 'sbar', cam: 'foot', camDur: 3, hold: 1.2, cue: { kind: CUE.call, title: 'SBAR 전화 보고', text: '보조 인물(당직의) 음성으로 구두 처방 제공 — 학습자는 Nu-DESC 결과를 포함해 보고', secs: 8 } },
  { t: 565, fn: 'readback_wrong', hold: 1.2, cue: { kind: CUE.safe, title: 'read-back 오류 → 개입', text: '복창이 틀리면 당직의가 바로 교정 (안전 문제에서의 개입 기준)', secs: 7 } },
  { t: 572, fn: 'readback', hold: 1 },
  { t: 580, act: 'antipyretic', hold: 0.8 },
  { t: 588, act: 'chart', hold: 0.8 },
  { t: 596, act: 'reassess', cam: 'side', camDur: 3, hold: 2.5, cue: { kind: CUE.end, title: '종료 신호', text: '중재가 충분하면 SP가 “그래.. 좀 누워있을 게.” (정서 강도 3) — 미흡하면 일어나 집에 가려는 반응으로 마무리', secs: 9 } },
];

const WHY_SP = [
  ['의사소통·정서가 핵심', '섬망 환자에게는 어조·눈높이·감정 인정 같은 관계 기술이 학습목표입니다. 이는 스크립트가 아니라 사람의 반응으로만 학습됩니다.'],
  ['학습자 말에 실시간 반응', '같은 수행도 말투에 따라 반응이 달라집니다. SP는 학습자의 즉흥 발화에 맞춰 정서 강도를 7 → 3으로 조절합니다 (버튼을 고르는 시뮬레이션은 불가).'],
  ['관찰이 곧 평가 대상', 'Nu-DESC는 지남력·행동·의사소통·환각을 눈과 귀로 알아채야 하는 선별 도구입니다. SP의 표정·목소리·행동이 곧 단서입니다.'],
  ['환자 관점 피드백', '디브리핑에서 SP가 “어떤 말에 안정이 됐는지”를 환자 입장에서 직접 전달합니다.'],
  ['표준화와 안전', '훈련된 SP는 모든 학습자에게 같은 cue와 정서 강도를 제공해 공정하게 평가하며, 실제 환자에게 위험 없이 반복 연습할 수 있습니다.'],
];

export function createDemo(ctx) {
  const { sc, app, patient, speakAsync, beep, setView, rig, camera } = ctx;
  const speedMul = Math.max(0.2, parseFloat(new URLSearchParams(location.search).get('speed') || '1'));
  const qs = new URLSearchParams(location.search);
  const showEnv = qs.get('env') !== '0';

  // ---------------- DOM ----------------
  const root = document.createElement('div'); root.id = 'demo';
  root.innerHTML = `
    <div id="d-title"><b>섬망 SP 시뮬레이션 · 시연 영상</b><span id="d-phase"></span></div>
    <div id="d-emo" hidden><span>SP 정서 강도</span><div class="bar"><i></i></div><b id="d-emo-n">7</b></div>
    <div id="d-cue" hidden><small id="d-cue-kind"></small><b id="d-cue-title"></b><span id="d-cue-text"></span></div>
    <div id="d-sub" hidden><span id="d-who"></span><span id="d-tag" hidden></span><p id="d-text"></p></div>
    <div id="d-start">
      <div class="card">
        <small>시뮬레이션 운영 · 시연 영상</small>
        <h1>${META.title}</h1>
        <p>학습자: 입사 1년 이내 신규간호사 &nbsp;·&nbsp; 환자: 김두두(80세 남, <b>SP</b>)</p>
        <p class="dim">이 영상은 환경·장비 안내와 운영 설명용입니다. 실제 시연에서 환자 역할(대사·표정·정서)은 SP가 즉흥적으로 수행합니다.</p>
        <button id="d-go" disabled>모델 불러오는 중…</button>
        <p class="dim keys">Space 일시정지 · R 처음부터 · 음성이 필요 없으면 주소 뒤에 ?voice=0</p>
      </div>
    </div>
    <div id="d-end" hidden>
      <div class="card wide">
        <small>정리</small>
        <h1>왜 이 시나리오에는 SP가 필요한가</h1>
        <ol>${WHY_SP.map(([h, t]) => `<li><b>${h}</b><span>${t}</span></li>`).join('')}</ol>
        <p class="dim">영상(가상 환경)은 시연 환경을 보여 주는 보조 자료이며, 학습자와 상호작용하며 반응을 만들어 내는 역할은 SP가 합니다.</p>
      </div>
    </div>`;
  document.body.appendChild(root);
  const $ = (id) => root.querySelector('#' + id);
  const el = { phase: $('d-phase'), emo: $('d-emo'), emoBar: $('d-emo').querySelector('i'), emoN: $('d-emo-n'), cue: $('d-cue'), cueKind: $('d-cue-kind'), cueTitle: $('d-cue-title'), cueText: $('d-cue-text'), sub: $('d-sub'), who: $('d-who'), tag: $('d-tag'), text: $('d-text'), start: $('d-start'), go: $('d-go'), end: $('d-end') };

  // ---------------- 재생 제어 ----------------
  let paused = false; let aborted = false;
  const sleep = (sec) => new Promise((res) => {
    let left = (sec * 1000) / speedMul; let last = performance.now();
    const tick = () => {
      const n = performance.now(); if (!paused) left -= n - last; last = n;
      if (aborted || left <= 0) res(); else setTimeout(tick, 40);
    };
    tick();
  });

  // ---------------- 자막 큐 ----------------
  const queue = []; let showing = false; let cueTimer = 0;
  function enqueue(entry) { queue.push(entry); if (!showing) drain(); }
  async function drain() {
    showing = true;
    while (queue.length) {
      const e = queue.shift();
      const who = e.who === 'nurse' ? ['학습자 · 간호사', 'nurse'] : e.who === 'patient' ? ['SP · 김두두', 'patient'] : e.who === 'doctor' ? ['당직의 (전화)', 'doctor'] : ['', 'sys'];
      el.who.textContent = who[0]; el.sub.dataset.k = who[1];
      el.text.textContent = e.who === 'system' ? `※ ${e.text}` : e.text;
      el.tag.hidden = !e.tag; if (e.tag) el.tag.textContent = `Nu-DESC 단서 · ${e.tag}`;
      el.sub.hidden = false;
      if (e.who === 'patient') patient.speak(e.text);
      const minSec = Math.max(2.4, e.text.length * 0.07 + 1.2);
      await Promise.all([sleep(minSec), e.who === 'nurse' || e.who === 'system' ? Promise.resolve() : speakAsync(e.text, e.who, speedMul)]);
      if (e.who === 'nurse') await sleep(0.2);
    }
    showing = false;
    setTimeout(() => { if (!showing) el.sub.hidden = true; }, 600 / speedMul);
  }
  async function drained() { while (showing || queue.length) await sleep(0.2); }

  function showCue(c) {
    if (!c) return;
    el.cueKind.textContent = c.kind; el.cueTitle.textContent = c.title; el.cueText.textContent = c.text;
    el.cue.hidden = false; el.cue.classList.remove('in'); void el.cue.offsetWidth; el.cue.classList.add('in');
    clearTimeout(cueTimer);
    cueTimer = setTimeout(() => { el.cue.hidden = true; }, ((c.secs || 6) * 1000) / speedMul);
  }

  // ---------------- 카메라 ----------------
  const eyeNow = { x: 0, y: 1.62, z: 0.9 }; let yawNow = 0; let pitchNow = 0;
  let tween = null;
  function aim(shot) {
    const [ex, ey, ez] = shot.eye; const [ax, ay, az] = shot.at;
    const dx = ax - ex; const dz = az - ez;
    return { x: ex, y: ey, z: ez, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(ay - ey, Math.hypot(dx, dz)) };
  }
  function go(name, dur = 3) {
    const to = aim(SHOTS[name]);
    if (!dur) { Object.assign(eyeNow, { x: to.x, y: to.y, z: to.z }); yawNow = to.yaw; pitchNow = to.pitch; tween = null; apply(); return; }
    tween = { from: { ...eyeNow, yaw: yawNow, pitch: pitchNow }, to, t: 0, dur: dur / speedMul };
  }
  function apply() {
    if (camera.parent === rig) rig.position.set(eyeNow.x, eyeNow.y - 1.6, eyeNow.z);
    setView(yawNow, pitchNow);
  }
  const ease = (x) => x * x * (3 - 2 * x);
  function update(dt) {
    if (tween && !paused) {
      tween.t += dt; const k = ease(Math.min(1, tween.t / tween.dur));
      const f = tween.from; const t = tween.to;
      eyeNow.x = f.x + (t.x - f.x) * k; eyeNow.y = f.y + (t.y - f.y) * k; eyeNow.z = f.z + (t.z - f.z) * k;
      yawNow = f.yaw + (t.yaw - f.yaw) * k; pitchNow = f.pitch + (t.pitch - f.pitch) * k;
      if (k >= 1) tween = null;
    }
    // 아주 작은 흔들림 (핸드헬드 느낌 없이 정지 화면이 죽어 보이지 않게)
    apply();
    // 상단 표시
    if (sc.started) {
      el.phase.textContent = `${Math.floor(sc.t / 60)}분 경과 · ${sc.phase.label}`;
      el.emo.hidden = false;
      el.emoBar.style.width = `${(sc.emotion / 10) * 100}%`;
      el.emoN.textContent = (Math.round(sc.emotion * 10) / 10).toString();
    }
  }

  // ---------------- 시나리오 진행 ----------------
  function fastForward(target) {
    while (sc.t < target) {
      const evs = sc.tick(Math.min(1, target - sc.t));
      for (const ev of evs) {
        if (ev.type === 'alert') { app.say({ who: 'system', text: ev.text }); beep(); }
        if (ev.type === 'line') app.say(ev.line);
      }
    }
  }
  const FN = {
    nudesc: () => app.submitNuDesc(NUDESC),
    sbar: () => app.submitSBAR(new Set(SBAR_OK)),
    readback_wrong: () => app.submitReadback('rb2'),
    readback: () => app.submitReadback('rb1'),
  };

  async function run() {
    aborted = false;
    for (const st of SCRIPT) {
      if (aborted) return;
      if (st.env && !showEnv) continue;
      if (st.t != null && sc.started) fastForward(st.t);
      if (st.cam) go(st.cam, st.camDur ?? 3);
      if (st.cue) showCue(st.cue);
      if (st.start) { app.startSim(); }
      if (st.act) app.act(st.act);
      if (st.fn) FN[st.fn]();
      await drained();
      await sleep(st.hold ?? 1);
    }
    // 마무리: 정리 카드
    el.cue.hidden = true; el.sub.hidden = true;
    await sleep(1.5);
    el.end.hidden = false;
  }

  function begin() {
    el.start.hidden = true; el.end.hidden = true;
    queue.length = 0; showing = false;
    go('wide', 0);
    run();
  }
  el.go.addEventListener('click', begin);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); paused = !paused; if ('speechSynthesis' in window) { paused ? speechSynthesis.pause() : speechSynthesis.resume(); } }
    if (e.key === 'r' || e.key === 'R') { aborted = true; location.reload(); }
  });

  go('wide', 0);
  return {
    update, enqueue,
    ready() { el.go.disabled = false; el.go.textContent = '▶ 시연 시작'; },
  };
}
