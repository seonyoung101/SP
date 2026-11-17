// 임시 병실 — 직접 만든 방(glTF 등)이 있으면 buildRoom()만 바꿔 끼우면 됩니다.
// 좌표 규칙: 간호사 시작 위치 (0, 0, 0.9)에서 -z 방향을 봄, 침대 머리는 -z 벽, 환자 오른쪽 = -x.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const ROOM = { w: 4.6, d: 5.0, h: 2.7, zMin: -2.5, zMax: 2.5 };

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...opts });
}
function box(w, h, d, m, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  return mesh;
}

export function buildRoom() {
  const g = new THREE.Group();
  g.name = 'room';
  const { w, d, h } = ROOM;

  g.add(box(w, 0.05, d, mat(0x9aa7a8), 0, -0.025, 0)); // 바닥
  g.add(box(w, 0.05, d, mat(0xe8ecee), 0, h + 0.025, 0)); // 천장
  const wall = mat(0xdfe6e6);
  g.add(box(w, h, 0.05, wall, 0, h / 2, -d / 2)); // 머리 쪽 벽
  g.add(box(w, h, 0.05, wall, 0, h / 2, d / 2)); // 뒤 벽
  g.add(box(0.05, h, d, wall, -w / 2, h / 2, 0)); // 왼쪽 벽
  g.add(box(0.05, h, d, wall, w / 2, h / 2, 0)); // 오른쪽 벽
  g.add(box(w, 0.9, 0.06, mat(0xbcd3d0), 0, 0.45, -d / 2 + 0.03)); // 하단 패널

  // 창문 (밤) — 왼쪽 벽
  g.add(box(0.04, 1.0, 1.3, mat(0x0b1630, { emissive: 0x0b1630, emissiveIntensity: 0.6 }), -w / 2 + 0.04, 1.6, -0.8));
  g.add(box(0.05, 0.05, 1.4, mat(0xcfd6d6), -w / 2 + 0.05, 2.12, -0.8));
  g.add(box(0.05, 0.05, 1.4, mat(0xcfd6d6), -w / 2 + 0.05, 1.08, -0.8));

  // 문 (오른쪽 뒤)
  g.add(box(0.05, 2.05, 0.95, mat(0x8a9a9c), w / 2 - 0.03, 1.025, 1.2));
  // 문 위 피난구 유도등 (초록 바탕 + 달리는 사람 픽토그램). 밤에도 보이도록 조명 영향을 받지 않는 재질로 그린다
  {
    const S = 256; const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const c = cv.getContext('2d');
    c.fillStyle = '#12b866'; c.fillRect(0, 0, S, S);
    c.fillStyle = '#f4fff8'; c.fillRect(70, 26, 150, 204); // 열린 문
    c.fillStyle = '#12b866'; c.beginPath(); c.moveTo(70, 26); c.lineTo(70, 230); c.lineTo(40, 230); c.lineTo(40, 26); c.fill(); // 문틀 쪽 여백
    c.fillStyle = '#12b866'; c.strokeStyle = '#12b866'; c.lineCap = 'round'; c.lineJoin = 'round';
    c.save(); c.translate(128, 128); c.scale(1.22, 1.22); c.translate(-128, -132);
    c.beginPath(); c.arc(128, 62, 17, 0, 7); c.fill(); // 머리
    c.lineWidth = 22; c.beginPath(); c.moveTo(124, 90); c.lineTo(140, 138); c.stroke(); // 몸통
    c.lineWidth = 18;
    c.beginPath(); c.moveTo(126, 98); c.lineTo(98, 126); c.moveTo(130, 98); c.lineTo(168, 112); c.stroke(); // 팔
    c.beginPath(); c.moveTo(140, 138); c.lineTo(112, 186); c.lineTo(88, 206); c.moveTo(140, 138); c.lineTo(172, 160); c.lineTo(190, 156); c.stroke(); // 다리
    c.restore();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const SZ = 0.3; const sy = 2.33, sz = 1.2;
    g.add(box(0.06, SZ + 0.04, SZ + 0.04, mat(0xc9cfd1, { roughness: 0.6 }), w / 2 - 0.055, sy, sz));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(SZ, SZ), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    face.rotation.y = -Math.PI / 2; face.position.set(w / 2 - 0.0865, sy, sz); g.add(face); // 방 안쪽(-x)을 향함
  }

  // 보호자 침상/의자, 협탁
  g.add(box(0.5, 0.5, 0.5, mat(0x5b7a8a), 1.7, 0.25, -0.6)); // 보호자 의자
  g.add(box(0.5, 0.75, 0.45, mat(0xc9b79a), 0.75, 0.375, -2.05)); // 협탁
  g.add(box(0.5, 0.03, 0.45, mat(0xe8dcc4), 0.75, 0.765, -2.05));

  // 손 위생 코너 (뒤 벽, 왼쪽): GLB가 로드되기 전/실패 시에는 단순 상자로 대체
  const station = new THREE.Group(); station.name = 'handStation'; g.add(station);
  const stationFallback = new THREE.Group(); station.add(stationFallback);
  stationFallback.add(box(0.4, 0.85, 0.6, mat(0xd8dfe0), 2.05, 0.425, 0.35));
  stationFallback.add(box(0.1, 0.2, 0.1, mat(0x3a8dde), 2.2, 1.3, 0.52));

  // 침상 머리 벽 패널: 콘센트 · 조명 · 호출 · 산소 · 흡인
  {
    const W = 1280, H = 220;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const rr = (x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
    const grad = c.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, '#f6f8f8'); grad.addColorStop(1, '#e3e8e9');
    c.fillStyle = grad; c.fillRect(0, 0, W, H);
    c.fillStyle = '#c9d0d2'; c.fillRect(0, 0, W, 6); c.fillRect(0, H - 8, W, 8);
    const plug = (cx) => {
      c.fillStyle = '#d4dadc'; rr(cx - 42, 50, 84, 84, 14); c.fill();
      c.strokeStyle = '#b9c1c3'; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#eef1f1'; c.beginPath(); c.arc(cx, 92, 31, 0, 7); c.fill();
      c.fillStyle = '#333'; c.beginPath(); c.arc(cx - 10, 92, 5, 0, 7); c.arc(cx + 10, 92, 5, 0, 7); c.fill();
    };
    [62, 158].forEach(plug); // 220V 콘센트 2구
    c.fillStyle = '#6b7476'; c.font = 'bold 20px sans-serif'; c.textAlign = 'center';
    c.fillText('220V', 110, 170);
    // 낙상주의 표지: 침대에서 떨어지는 사람 그림 + 문구 (직접 그린 단순 픽토그램)
    {
      const X = 214, Y = 30, PW2 = 228, PH2 = 150;
      c.fillStyle = '#fbfcfc'; rr(X, Y, PW2, PH2, 12); c.fill();
      c.strokeStyle = '#b9c1c3'; c.lineWidth = 3; c.stroke();
      c.lineCap = 'round'; c.lineJoin = 'round';
      // 침대(옆모습)
      c.strokeStyle = '#3d4648'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(X + 16, Y + 52); c.lineTo(X + 16, Y + 112); c.moveTo(X + 16, Y + 96); c.lineTo(X + 88, Y + 96); c.moveTo(X + 88, Y + 96); c.lineTo(X + 88, Y + 112); c.stroke();
      c.lineWidth = 6; c.beginPath(); c.moveTo(X + 16, Y + 84); c.lineTo(X + 78, Y + 84); c.stroke();
      // 떨어지는 사람(빨강)
      c.strokeStyle = '#c0392b'; c.fillStyle = '#c0392b'; c.lineWidth = 5;
      c.beginPath(); c.arc(X + 92, Y + 52, 9, 0, 7); c.fill();
      c.beginPath(); c.moveTo(X + 86, Y + 66); c.lineTo(X + 76, Y + 90); c.lineTo(X + 98, Y + 104); c.lineTo(X + 100, Y + 128); // 몸통·다리
      c.moveTo(X + 84, Y + 70); c.lineTo(X + 104, Y + 76); // 팔
      c.stroke();
      // 충격 표시
      c.lineWidth = 3; [[X + 70, Y + 132, X + 62, Y + 142], [X + 82, Y + 136, X + 80, Y + 148], [X + 116, Y + 134, X + 126, Y + 142]].forEach(([x1, y1, x2, y2]) => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); });
      // 문구
      c.fillStyle = '#c0392b'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center';
      c.fillText('낙상주의', X + 168, Y + 62);
      c.fillStyle = '#c0392b'; c.fillRect(X + 126, Y + 74, 84, 3);
      c.fillStyle = '#4b5557'; c.font = '13px sans-serif';
      c.fillText('낙상 위험 환자', X + 168, Y + 98); c.fillText('침상 난간을 올려 주세요', X + 168, Y + 118);
      c.textAlign = 'center'; c.lineCap = 'butt';
    }
    // 조명 스위치
    c.fillStyle = '#cfd6d8'; rr(458, 50, 92, 84, 10); c.fill();
    [470, 506].forEach((x) => { c.fillStyle = '#f7f9f9'; rr(x, 58, 32, 68, 6); c.fill(); c.strokeStyle = '#aab3b5'; c.lineWidth = 2; c.stroke(); });
    c.fillStyle = '#6b7476'; c.fillText('조명', 504, 170);
    // NURSE CALL
    c.fillStyle = '#e1e6e7'; rr(594, 50, 84, 84, 14); c.fill(); c.strokeStyle = '#b9c1c3'; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#a31f1f'; c.beginPath(); c.arc(636, 92, 25, 0, 7); c.fill();
    c.fillStyle = '#d65a5a'; c.beginPath(); c.arc(628, 84, 8, 0, 7); c.fill();
    c.fillStyle = '#6b7476'; c.fillText('NURSE CALL', 636, 170);
    // OXYGEN
    c.fillStyle = '#1f8a4d'; rr(758, 24, 152, 30, 4); c.fill();
    c.fillStyle = '#fff'; c.font = 'bold 20px sans-serif'; c.fillText('OXYGEN · O₂', 834, 47);
    c.fillStyle = '#2c3b35'; c.beginPath(); c.arc(834, 100, 36, 0, 7); c.fill();
    c.fillStyle = '#1c8a4d'; c.beginPath(); c.arc(834, 100, 29, 0, 7); c.fill();
    c.fillStyle = '#1a2a22'; c.beginPath(); c.arc(834, 100, 12, 0, 7); c.fill();
    // SUCTION
    c.fillStyle = '#f2b400'; rr(960, 24, 126, 30, 4); c.fill();
    c.fillStyle = '#5a4300'; c.font = 'bold 20px sans-serif'; c.fillText('SUCTION', 1023, 47);
    c.fillStyle = '#4a3a10'; c.beginPath(); c.arc(1023, 100, 36, 0, 7); c.fill();
    c.fillStyle = '#d29d00'; c.beginPath(); c.arc(1023, 100, 29, 0, 7); c.fill();
    c.fillStyle = '#3a2d08'; c.beginPath(); c.arc(1023, 100, 12, 0, 7); c.fill();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const PW = 1.3, PH = PW * H / W;
    const body = box(PW, PH, 0.04, mat(0xdfe5e6, { roughness: 0.6 }), 0, 1.55, -d / 2 + 0.045);
    g.add(body);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0 }));
    face.position.set(0, 1.55, -d / 2 + 0.0655);
    g.add(face);
  }

  // 환자 오른쪽(왼쪽 벽, 머리 쪽 모서리)의 옷장 — 단순 가구 (캔버스 질감)
  {
    const CW = 512, CH = 1024;
    const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
    const c = cv.getContext('2d');
    const wood = c.createLinearGradient(0, 0, CW, 0); wood.addColorStop(0, '#cdbfa5'); wood.addColorStop(0.5, '#d6c9b0'); wood.addColorStop(1, '#c8baa0');
    c.fillStyle = wood; c.fillRect(0, 0, CW, CH);
    // 나뭇결
    for (let i = 0; i < 260; i++) {
      c.strokeStyle = `rgba(120,100,70,${0.04 + Math.random() * 0.06})`; c.lineWidth = 1 + Math.random() * 2;
      const x = Math.random() * CW; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (Math.random() - 0.5) * 10, CH); c.stroke();
    }
    // 위 수납장(문 2) + 아래 큰 문(2)
    const door = (x, y, w, h) => {
      c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(x, y, w, h);
      c.strokeStyle = '#8c7d63'; c.lineWidth = 4; c.strokeRect(x, y, w, h);
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; c.strokeRect(x + 4, y + 4, w - 8, h - 8);
    };
    door(8, 8, 244, 250); door(260, 8, 244, 250);
    door(8, 266, 244, 700); door(260, 266, 244, 700);
    c.fillStyle = '#5b5143'; c.fillRect(0, 976, CW, 48); // 걸레받이
    c.fillStyle = '#4d4639';
    [[236, 760, 8, 90], [268, 760, 8, 90], [236, 120, 8, 60], [268, 120, 8, 60]].forEach(([x, y, w2, h2]) => { c.beginPath(); c.roundRect(x, y, w2, h2, 3); c.fill(); });
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const CWm = 1.0, CHm = 2.0, CDm = 0.55;
    const cx = -w / 2 + 0.025 + CDm / 2 + 0.005, cz = -1.95;
    const closet = new THREE.Group(); closet.name = 'closet'; closet.position.set(cx, CHm / 2, cz);
    closet.add(box(CDm, CHm, CWm, mat(0xcabc9f, { roughness: 0.7 }), 0, 0, 0));
    const front = new THREE.Mesh(new THREE.PlaneGeometry(CWm, CHm), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65, metalness: 0 }));
    front.rotation.y = Math.PI / 2; front.position.set(CDm / 2 + 0.002, 0, 0);
    closet.add(front);
    closet.add(box(CDm + 0.03, 0.04, CWm + 0.03, mat(0xbfb095, { roughness: 0.7 }), 0.0, CHm / 2 - 0.02, 0)); // 윗면 몰딩
    g.add(closet);
  }

  // 보호자용 소파 — 옷장 옆, 왼쪽 벽
  {
    const sofa = new THREE.Group(); sofa.name = 'sofa';
    const vinyl = mat(0x4d6870, { roughness: 0.55 });
    const vinylDk = mat(0x3f565d, { roughness: 0.6 });
    const rb = (w2, h2, d2, m, x, y, z, r = 0.04) => { const o = new THREE.Mesh(new RoundedBoxGeometry(w2, h2, d2, 4, r), m); o.position.set(x, y, z); sofa.add(o); return o; };
    const SW = 1.6, SD = 0.88;
    rb(SD, 0.2, SW, vinylDk, 0, 0.2, 0, 0.03); // 하부 프레임
    rb(SD - 0.2, 0.17, SW / 2 - 0.1, vinyl, 0.09, 0.39, -SW / 4 + 0.0, 0.06); // 좌석 쿠션 2
    rb(SD - 0.2, 0.17, SW / 2 - 0.1, vinyl, 0.09, 0.39, SW / 4 + 0.0, 0.06);
    rb(0.2, 0.46, SW - 0.3, vinyl, -SD / 2 + 0.12, 0.58, 0, 0.07); // 등받이
    rb(0.16, 0.26, SW / 2 - 0.1, vinyl, -SD / 2 + 0.3, 0.55, -SW / 4, 0.06); // 등 쿠션
    rb(0.16, 0.26, SW / 2 - 0.1, vinyl, -SD / 2 + 0.3, 0.55, SW / 4, 0.06);
    rb(SD - 0.04, 0.2, 0.14, vinylDk, 0, 0.5, -SW / 2 + 0.07, 0.05); // 팔걸이
    rb(SD - 0.04, 0.2, 0.14, vinylDk, 0, 0.5, SW / 2 - 0.07, 0.05);
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([a, b2]) => { const leg = box(0.05, 0.1, 0.05, mat(0x2a2d30), a * (SD / 2 - 0.06), 0.05, b2 * (SW / 2 - 0.06)); sofa.add(leg); });
    sofa.position.set(-w / 2 + 0.025 + SD / 2 + 0.01, 0, -0.55);
    g.add(sofa);
  }

  // 천장 매달린 TV — 환자 정면(발치 쪽), 화면은 침대를 향함
  {
    const tv = new THREE.Group(); tv.name = 'ceilingTV';
    const metalM = mat(0xb9bec2, { roughness: 0.4, metalness: 0.3 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 16), metalM); rod.position.set(0, h - 0.275, 0.1); tv.add(rod);
    tv.add(box(0.2, 0.03, 0.2, metalM, 0, h - 0.015, 0.1)); // 천장 플랜지
    tv.add(box(0.12, 0.1, 0.14, metalM, 0, h - 0.58, 0.07)); // 하단 브라켓
    const tvBody = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.66, 0.06, 4, 0.02), mat(0x15181b, { roughness: 0.5 })); tvBody.position.set(0, h - 0.68, 0); tv.add(tvBody);
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 600;
    const c = cv.getContext('2d');
    const gr = c.createLinearGradient(0, 0, 1024, 600); gr.addColorStop(0, '#0b1018'); gr.addColorStop(1, '#16202c');
    c.fillStyle = gr; c.fillRect(0, 0, 1024, 600);
    c.fillStyle = 'rgba(120,150,190,0.10)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(520, 0); c.lineTo(180, 600); c.lineTo(0, 600); c.fill(); // 반사광
    c.fillStyle = 'rgba(180,200,225,0.35)'; c.font = '28px sans-serif'; c.textAlign = 'center'; c.fillText('병실 TV · 대기 화면', 512, 310);
    const stex = new THREE.CanvasTexture(cv); stex.colorSpace = THREE.SRGBColorSpace; stex.anisotropy = 4;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.6), new THREE.MeshBasicMaterial({ map: stex, toneMapped: false }));
    scr.rotation.y = Math.PI; scr.position.set(0, h - 0.68, -0.032); tv.add(scr);
    tv.position.set(0, 0, 2.05);
    g.add(tv);
  }

  // 활력징후 모니터 화면(캔버스): 측정 전에는 '--'
  const monCanvas = document.createElement('canvas'); monCanvas.width = 640; monCanvas.height = 420;
  const monTex = new THREE.CanvasTexture(monCanvas); monTex.colorSpace = THREE.SRGBColorSpace; monTex.anisotropy = 4;
  let monMeasured = null; let monPhase = 0;
  function drawMonitor(measured, t = 0) {
    const c = monCanvas.getContext('2d'); const W = 640, H = 420;
    c.fillStyle = '#04070a'; c.fillRect(0, 0, W, H);
    c.font = 'bold 22px sans-serif'; c.textAlign = 'left';
    const v = measured ? { bp: '148/86', map: '(107)', hr: '106', spo2: '95', bt: '38.4', rr: '22' } : { bp: '--/--', map: '(--)', hr: '--', spo2: '--', bt: '--.-', rr: '--' };
    const col = measured ? 1 : 0.35;
    c.fillStyle = `rgba(255,255,255,${col})`; c.fillText('NIBP mmHg', 20, 34);
    c.font = 'bold 84px sans-serif'; c.fillText(v.bp, 20, 120);
    c.font = 'bold 26px sans-serif'; c.fillText(v.map, 20, 156);
    c.fillStyle = `rgba(80,255,120,${col})`; c.font = 'bold 22px sans-serif'; c.fillText('HR bpm', 400, 34);
    c.font = 'bold 96px sans-serif'; c.fillText(v.hr, 400, 120);
    c.fillStyle = `rgba(90,210,255,${col})`; c.font = 'bold 22px sans-serif'; c.fillText('SpO₂ %', 400, 178);
    c.font = 'bold 84px sans-serif'; c.fillText(v.spo2, 400, 262);
    c.fillStyle = `rgba(255,200,60,${col})`; c.font = 'bold 22px sans-serif'; c.fillText('TEMP °C', 20, 340);
    c.font = 'bold 64px sans-serif'; c.fillText(v.bt, 20, 405);
    c.fillStyle = `rgba(255,255,255,${col})`; c.font = 'bold 22px sans-serif'; c.fillText('RR', 240, 340);
    c.font = 'bold 64px sans-serif'; c.fillText(v.rr, 240, 405);
    // 파형
    c.strokeStyle = measured ? '#50ff78' : '#1f3a28'; c.lineWidth = 3; c.beginPath();
    for (let x = 0; x < 360; x++) {
      const ph = ((x + t * 90) % 120) / 120;
      const y = 218 - (measured ? (ph < 0.08 ? -ph * 40 : ph < 0.12 ? (ph - 0.08) * 1500 : ph < 0.16 ? 60 - (ph - 0.12) * 1900 : Math.sin(ph * 6.3) * 4) : 0);
      if (x === 0) c.moveTo(20, y); else c.lineTo(20 + x, y);
    }
    c.stroke();
    monTex.needsUpdate = true;
  }
  drawMonitor(false);
  function setMonitor(measured) { if (measured !== monMeasured) { monMeasured = measured; drawMonitor(measured, monPhase); } }

  // GLB 로드: 손 위생 코너(오른쪽 벽, 문 오른쪽) + 모니터·거치대
  const loadFixtures = async () => {
    const base = new URL('../assets/', import.meta.url);
    const L = new GLTFLoader();
    const get = async (n) => {
      const gl = await L.loadAsync(new URL(n, base).href);
      gl.scene.traverse((o) => { if (o.isMesh) { const m = o.material; m.metalness = Math.min(m.metalness || 0, 0.25); m.metalnessMap = null; m.roughness = Math.max(m.roughness ?? 0.6, 0.45); m.needsUpdate = true; } });
      return gl.scene;
    };
    const place = (obj, scale, x, y, z, ry) => { obj.scale.setScalar(scale); obj.position.set(x, y, z); obj.rotation.y = ry; station.add(obj); };
    try {
      const [sink, towel, san, soap] = await Promise.all([get('sink.glb'), get('towel.glb'), get('sanitizer.glb'), get('soap.glb')]);
      const wall = w / 2 - 0.025; // 오른쪽 벽 안쪽 면 x
      const toRoom = -Math.PI / 2; // 모델 앞(+z)을 방 안쪽(-x)으로
      const sS = 0.28; // 세면대 길이 약 0.53 m
      // 문(z 0.73~1.68)을 열고 들어온 간호사의 오른쪽 = 문보다 -z쪽(침대 쪽)
      place(sink, sS, wall - 1.07 * sS / 2 - 0.01, 0.86 - 0.57 * sS, 0.35, Math.PI);
      place(towel, 0.2, wall - 0.59 * 0.2 / 2, 1.42, 0.18, toRoom);
      place(san, 0.13, wall - 1.27 * 0.13 / 2, 1.30, 0.52, toRoom);
      place(soap, 0.115, wall - 0.05, 0.86 + 0.95 * 0.115, 0.15, toRoom);
      stationFallback.visible = false;
    } catch (e) { console.warn('세면 코너 GLB 로드 실패(기본 상자로 대체):', e); }
    try {
      const [mon, stand] = await Promise.all([get('monitor.glb'), get('mstand.glb')]);
      const grp = new THREE.Group(); grp.name = 'vitalMonitor';
      // 환자 왼쪽(+x) 머리 쪽, 간호사 쪽(+z)을 향하게
      grp.position.set(1.4, 0, -1.45); grp.rotation.y = -0.55;
      const sSt = 0.58; stand.scale.setScalar(sSt); stand.position.y = 0.951 * sSt; grp.add(stand);
      const sM = 0.2; mon.scale.setScalar(sM); mon.position.set(0, 0.951 * sSt * 2 + 0.951 * sM + 0.02, 0); grp.add(mon);
      // 화면 위치: 정면(+z)에서 화면 중앙으로 광선을 쏴서 표면 깊이를 찾는다
      mon.updateMatrixWorld(true);
      const rc = new THREE.Raycaster(new THREE.Vector3(0.02 * sM, mon.position.y + 0.1 * sM, 5), new THREE.Vector3(0, 0, -1));
      const hit = rc.intersectObject(mon, true)[0];
      const zFront = hit ? hit.point.z - mon.position.z : 0.5 * sM; // 월드(스케일 적용) 기준 깊이
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.2 * sM, 0.76 * sM), new THREE.MeshBasicMaterial({ map: monTex, toneMapped: false }));
      screen.position.set(0.02 * sM, mon.position.y + 0.1 * sM, mon.position.z + zFront + 0.003);
      grp.add(screen);
      g.add(grp);
    } catch (e) { console.warn('모니터 GLB 로드 실패:', e); }
  };
  const fixturesReady = loadFixtures();

  // 시계 (캔버스 텍스처)
  const clockCanvas = document.createElement('canvas');
  clockCanvas.width = 256; clockCanvas.height = 96;
  const clockTex = new THREE.CanvasTexture(clockCanvas);
  clockTex.colorSpace = THREE.SRGBColorSpace;
  const clock = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.19),
    new THREE.MeshBasicMaterial({ map: clockTex, toneMapped: false }),
  );
  clock.position.set(-w / 2 + 0.06, 2.25, 0.9);
  clock.rotation.y = Math.PI / 2;
  g.add(clock);

  function setClock(text) {
    const c = clockCanvas.getContext('2d');
    c.fillStyle = '#10151c'; c.fillRect(0, 0, 256, 96);
    c.fillStyle = '#ff5b4a'; c.font = 'bold 68px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 128, 50);
    clockTex.needsUpdate = true;
  }
  setClock('02:00');

  // 조명: 야간 상태 ↔ 점등 상태
  const hemi = new THREE.HemisphereLight(0x8aa0c8, 0x202030, 0.35);
  g.add(hemi);
  const night = new THREE.PointLight(0x7f9bff, 0.6, 5);
  night.position.set(-1.5, 1.2, -2.0); // 야간등
  g.add(night);
  const ceiling = new THREE.PointLight(0xffffff, 0, 9, 1.2);
  ceiling.position.set(0, 2.5, -0.8);
  g.add(ceiling);
  const lampMesh = box(0.6, 0.04, 0.3, mat(0xffffff, { emissive: 0x222222 }), 0, 2.68, -0.8);
  g.add(lampMesh);

  let lit = false;
  function setLight(on) {
    lit = on;
  }
  function update(dt) {
    if (monMeasured) { monPhase += dt; if (((monPhase * 10) | 0) !== (((monPhase - dt) * 10) | 0)) drawMonitor(true, monPhase); }
    const k = Math.min(1, dt * 3);
    ceiling.intensity += ((lit ? 2.6 : 0) - ceiling.intensity) * k;
    hemi.intensity += ((lit ? 1.0 : 0.35) - hemi.intensity) * k;
    night.intensity += ((lit ? 0.2 : 0.6) - night.intensity) * k;
    lampMesh.material.emissive.setScalar(lit ? 0.9 : 0.1);
  }

  return { group: g, setLight, setClock, setMonitor, update, bounds: ROOM, ready: fixturesReady };
}
