// 섬망 SP 시뮬레이션 — WebXR 진입점
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { Scenario } from './scenario.js';
import { META } from './scenario-data.js';
import { buildRoom } from './room.js';
import { buildPatient } from './patient.js';
import { createPanels, fmt } from './panels.js';

const params = new URLSearchParams(location.search);
const practice = params.get('practice') === '1';
const debug = params.get('debug') === '1';
const showHallucination = params.get('hallu') !== '0';

// ------------------------------------------------------------------ 상태
const sc = new Scenario({ practice });
const ui = { tab: 0, cards: [], transcript: [], form: null, voice: true, toast: null, debug };

// ------------------------------------------------------------------ 3D 기본
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05080d);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 30);
camera.rotation.order = 'YXZ';
const rig = new THREE.Group(); // 간호사 서 있는 위치
rig.position.set(0, 0, 0.9);
rig.add(camera);
camera.position.set(0, 1.6, 0);
scene.add(rig);

const room = buildRoom();
scene.add(room.group);
const patient = buildPatient();
scene.add(patient.group);

// ------------------------------------------------------------------ 패널
let app; // 아래에서 정의
const panels = createPanels({ get sc() { return sc; }, get ui() { return ui; }, invalidate: () => invalidateAll(), act: (id) => app.act(id), toggleVoice: () => app.toggleVoice(), restart: () => app.restart(), openForm: (f) => app.openForm(f), closeForm: () => app.closeForm(), startSim: () => app.startSim(), submitNuDesc: (s) => app.submitNuDesc(s), submitSBAR: (s) => app.submitSBAR(s), submitReadback: (id) => app.submitReadback(id) });

const nurseEye = new THREE.Vector3(0, 1.5, 0.9);
function place(panel, x, y, z, look = nurseEye) {
  panel.mesh.position.set(x, y, z);
  panel.mesh.lookAt(look);
  scene.add(panel.mesh);
}
place(panels.menu, -0.98, 1.42, -0.45);
panels.transcript.mesh.position.set(0, 2.17, -2.43);
scene.add(panels.transcript.mesh);
place(panels.form, 0, 1.5, -0.6);
panels.form.mesh.visible = false;
// 모달 폼은 침대 등에 가려지지 않도록 항상 맨 앞에 그린다
panels.form.mesh.material.depthTest = false;
panels.form.mesh.renderOrder = 10;

function invalidateAll() { panels.all.forEach((p) => p.invalidate()); }

// ------------------------------------------------------------------ 음성·효과음
let koVoice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  koVoice = speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith('ko')) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

function speak(text, who) {
  if (!ui.voice || !('speechSynthesis' in window)) return;
  const clean = text.replace(/\([^)]*\)/g, '').trim();
  if (!clean) return;
  try {
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'ko-KR';
    if (koVoice) u.voice = koVoice;
    u.pitch = who === 'doctor' ? 1.0 : 0.55;
    u.rate = who === 'doctor' ? 1.05 : 0.95 + Math.max(0, sc.emotion - 3) * 0.03;
    speechSynthesis.speak(u);
  } catch (e) { /* 일부 XR 브라우저는 TTS 미지원 */ }
}

let audioCtx = null;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < 2; i++) {
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      const t0 = audioCtx.currentTime + i * 0.35;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
      o.start(t0); o.stop(t0 + 0.3);
    }
  } catch (e) { /* ignore */ }
}

// ------------------------------------------------------------------ 앱 동작
function say(entry) {
  ui.transcript.push(entry);
  if (ui.transcript.length > 60) ui.transcript.shift();
  if (entry.who === 'patient') { patient.speak(entry.text); speak(entry.text, 'patient'); }
  if (entry.who === 'doctor') speak(entry.text, 'doctor');
  invalidateAll();
}
function toast(text) { ui.toast = { text, until: performance.now() + 4000 }; invalidateAll(); }
// 수행 결과(활력징후 등)는 별도 패널 없이 자막 한 줄로 남긴다
function addCard(card) {
  if (!card) return;
  const body = card.rows.map(([k, v]) => `${k} ${v}`).join(' · ');
  say({ who: 'system', text: `${card.title} — ${body}` });
}

function applyEnv() { room.setLight(sc.lightOn); }

app = {
  act(id) {
    const r = sc.perform(id);
    if (!r.ok) { toast(r.reason); return; }
    if (r.finish) { app.finishSim(); return; }
    if (r.panel) {
      if (r.panel === 'nudesc') app.openForm({ type: 'nudesc', scores: { ...(sc.nudesc ? sc.nudesc.scores : {}) } });
      if (r.panel === 'sbar') app.openForm({ type: 'sbar', sel: new Set(sc.sbar ? sc.sbar.selected : []) });
      if (r.panel === 'readback') app.openForm({ type: 'readback' });
      return;
    }
    say({ who: 'nurse', text: r.nurse });
    r.patient.forEach((l) => say(l));
    addCard(r.info);
    applyEnv();
    invalidateAll();
  },
  openForm(f) { ui.form = f; panels.form.mesh.visible = true; invalidateAll(); },
  closeForm() { ui.form = null; panels.form.mesh.visible = false; invalidateAll(); },
  toggleVoice() { ui.voice = !ui.voice; if (!ui.voice && 'speechSynthesis' in window) speechSynthesis.cancel(); invalidateAll(); },
  startSim() {
    app.closeForm();
    sc.start().forEach((l) => say(l));
    invalidateAll();
  },
  restart() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    sc.reset(); ui.cards = []; ui.transcript = []; ui.tab = 0; ui.toast = null;
    applyEnv();
    app.openForm({ type: 'intro' });
  },
  submitNuDesc(scores) {
    const r = sc.submitNuDesc(scores);
    say({ who: 'nurse', text: r.nurse });
    addCard(r.info);
    app.closeForm();
  },
  submitSBAR(sel) {
    const r = sc.submitSBAR([...sel]);
    say({ who: 'nurse', text: r.nurse });
    r.lines.forEach((l) => say(l));
    if (r.orderGiven) addCard({ title: '구두 처방', rows: [['약명', '아세트아미노펜'], ['용량·경로', '650mg 경구 1회'], ['추적', '1시간 뒤 체온 재측정']] });
    app.closeForm();
  },
  submitReadback(id) {
    const r = sc.submitReadback(id);
    if (!r.ok && !r.lines) return;
    say({ who: 'nurse', text: r.nurse });
    r.lines.forEach((l) => say(l));
    if (r.ok) app.closeForm(); else toast('복창 내용을 다시 확인하세요.');
  },
  finishSim() {
    if (sc.ended) return;
    const report = sc.finish();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    say({ who: 'system', text: '시뮬레이션이 종료되었습니다.' });
    app.openForm({ type: 'report', report });
  },
};
// 폼 패널이 app 객체의 메서드를 호출할 수 있도록 노출
window.__sim = { sc, ui, app, camera, rig, panels, look: (y, p) => { yaw = y; pitch = p; } };

// ------------------------------------------------------------------ 입력 (마우스 + VR 컨트롤러)
const raycaster = new THREE.Raycaster();
raycaster.far = 12;
const pickables = () => panels.all.map((p) => p.mesh).filter((m) => m.visible);

function pickRay(origin, dir) {
  raycaster.set(origin, dir);
  const hits = raycaster.intersectObjects(pickables(), false);
  if (!hits.length) return null;
  const h = hits[0];
  const panel = h.object.userData.panel;
  return { panel, btn: panel.hitTest(h.uv), distance: h.distance };
}

function applyHover(results) {
  const byPanel = new Map();
  for (const r of results) if (r && r.btn) byPanel.set(r.panel, r.btn);
  panels.all.forEach((p) => p.setHover(byPanel.get(p) || null));
}

// 마우스
const ndc = new THREE.Vector2();
let drag = null; let yaw = 0; let pitch = 0;
const dom = renderer.domElement;
function pickMouse(e) {
  const rect = dom.getBoundingClientRect();
  ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return pickRay(raycaster.ray.origin.clone(), raycaster.ray.direction.clone());
}
dom.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; dom.setPointerCapture(e.pointerId); });
dom.addEventListener('pointermove', (e) => {
  if (renderer.xr.isPresenting) return;
  if (drag) {
    const dx = e.clientX - drag.x; const dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
    if (drag.moved) {
      yaw -= dx * 0.004; pitch = Math.max(-1.0, Math.min(1.0, pitch - dy * 0.004));
      drag.x = e.clientX; drag.y = e.clientY;
      return;
    }
  }
  const r = pickMouse(e);
  applyHover([r]);
  dom.style.cursor = r && r.btn ? 'pointer' : drag ? 'grabbing' : 'grab';
});
dom.addEventListener('pointerup', (e) => {
  if (renderer.xr.isPresenting) return;
  const wasDrag = drag && drag.moved;
  drag = null;
  if (wasDrag) return;
  const r = pickMouse(e);
  if (r && r.btn && r.btn.onClick) r.btn.onClick();
});

// VR 컨트롤러
const controllers = [];
const tmpMat = new THREE.Matrix4();
for (let i = 0; i < 2; i++) {
  const c = renderer.xr.getController(i);
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x7fc0ff }));
  line.scale.z = 2; c.add(line);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  dot.position.z = -0.05; c.add(dot);
  c.userData.line = line;
  c.visible = false;
  c.addEventListener('connected', () => { c.visible = true; });
  c.addEventListener('disconnected', () => { c.visible = false; });
  c.addEventListener('selectstart', (ev) => {
    const r = pickController(c);
    if (r && r.btn && r.btn.onClick) {
      r.btn.onClick();
      const gp = ev.data && ev.data.gamepad;
      try { gp && gp.hapticActuators && gp.hapticActuators[0] && gp.hapticActuators[0].pulse(0.4, 40); } catch (e) { /* ignore */ }
    }
  });
  rig.add(c);
  controllers.push(c);
}
function pickController(c) {
  c.updateMatrixWorld(true);
  tmpMat.identity().extractRotation(c.matrixWorld);
  const origin = new THREE.Vector3().setFromMatrixPosition(c.matrixWorld);
  const dir = new THREE.Vector3(0, 0, -1).applyMatrix4(tmpMat).normalize();
  return pickRay(origin, dir);
}

renderer.xr.addEventListener('sessionstart', () => { document.body.classList.add('in-xr'); });
renderer.xr.addEventListener('sessionend', () => { document.body.classList.remove('in-xr'); camera.position.set(0, 1.6, 0); });

// H 키: 메뉴·자막을 숨겨 장면만 보여 준다 (시연 녹화용)
let hudOn = true;
window.addEventListener('keydown', (e) => {
  if (e.key !== 'h' && e.key !== 'H') return;
  hudOn = !hudOn;
  panels.menu.mesh.visible = hudOn;
  panels.transcript.mesh.visible = hudOn;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ------------------------------------------------------------------ 루프
const clock = new THREE.Clock();
let lastSecShown = -1; let lastClockMin = -1;
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.1, clock.getDelta());

  if (!renderer.xr.isPresenting) { camera.rotation.y = yaw; camera.rotation.x = pitch; }

  // 시나리오 시간
  for (const ev of sc.tick(dt)) {
    if (ev.type === 'alert') { say({ who: 'system', text: ev.text }); toast(ev.text); beep(); }
    if (ev.type === 'line') say(ev.line);
    if (ev.type === 'timeup') { say({ who: 'system', text: '러닝 시간(10분)이 끝났습니다.' }); app.finishSim(); }
  }
  const secNow = Math.floor(sc.practice ? sc.t : sc.remaining);
  if (secNow !== lastSecShown) { lastSecShown = secNow; panels.menu.invalidate(); }
  if (ui.toast && ui.toast.until < performance.now()) { ui.toast = null; panels.menu.invalidate(); }

  // 시계 (02:00 + 경과 분)
  const min = Math.floor(sc.t / 60);
  if (min !== lastClockMin) {
    lastClockMin = min;
    const total = META.clockStart.h * 60 + META.clockStart.m + min;
    room.setClock(`${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`);
  }

  // VR 컨트롤러 호버
  if (renderer.xr.isPresenting) {
    const results = controllers.filter((c) => c.visible).map((c) => {
      const r = pickController(c);
      c.userData.line.scale.z = r ? Math.max(0.2, r.distance) : 2.5;
      return r;
    });
    applyHover(results);
  }

  room.update(dt);
  patient.update(dt, sc, { showHallucination });
  panels.all.forEach((p) => p.update());
  renderer.render(scene, camera);
});

// 시작 화면
app.openForm({ type: 'intro' });
void fmt;
