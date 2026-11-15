// 임시 병실 — 직접 만든 방(glTF 등)이 있으면 buildRoom()만 바꿔 끼우면 됩니다.
// 좌표 규칙: 간호사 시작 위치 (0, 0, 0.9)에서 -z 방향을 봄, 침대 머리는 -z 벽, 환자 오른쪽 = -x.
import * as THREE from 'three';

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

  // 보호자 침상/의자, 협탁
  g.add(box(0.5, 0.5, 0.5, mat(0x5b7a8a), 1.7, 0.25, -0.6)); // 보호자 의자
  g.add(box(0.5, 0.75, 0.45, mat(0xc9b79a), 0.75, 0.375, -2.05)); // 협탁
  g.add(box(0.5, 0.03, 0.45, mat(0xe8dcc4), 0.75, 0.765, -2.05));

  // 손 소독제·세면대
  g.add(box(0.7, 0.85, 0.5, mat(0xd8dfe0), -1.9, 0.425, 1.9));
  g.add(box(0.12, 0.2, 0.08, mat(0x3a8dde), -1.9, 1.2, 2.2));

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
    const k = Math.min(1, dt * 3);
    ceiling.intensity += ((lit ? 2.6 : 0) - ceiling.intensity) * k;
    hemi.intensity += ((lit ? 1.0 : 0.35) - hemi.intensity) * k;
    night.intensity += ((lit ? 0.2 : 0.6) - night.intensity) * k;
    lampMesh.material.emissive.setScalar(lit ? 0.9 : 0.1);
  }

  return { group: g, setLight, setClock, update, bounds: ROOM };
}
