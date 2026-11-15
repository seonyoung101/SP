// 병원 침대·환자 아바타·수액 폴대/펌프·Foley/소변주머니·환시 연출.
// Scenario 상태(s)를 매 프레임 읽어 반영한다.
// 환자 좌표계: +z = 얼굴 방향, +y = 머리 쪽, 환자의 오른쪽 = -x (간호사 기준 왼쪽).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadMan } from './man.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
const rbox = (w, h, d, mat, r = 0.02) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const BED_POS = new THREE.Vector3(0, 0, -1.3);
const MATTRESS_TOP = 0.73;

// ---------------------------------------------------------------- 재질·텍스처
function gownTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#b7d3e8'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#e4f0f8';
  for (let y = 0; y < 128; y += 32) for (let x = 0; x < 128; x += 32) {
    g.beginPath(); g.arc(x + 16 + ((y / 32) % 2) * 16, y + 16, 3, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function labelTexture(draw, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return { canvas: c, ctx: g, tex: t };
}
function blobShadow(w, d, op) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, `rgba(0,0,0,${op})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.004;
  return m;
}

// ---------------------------------------------------------------- 형상 도우미
function limb(r0, r1, len, mat) { // 원점에서 -y 방향으로 뻗는 테이퍼 원통
  const g = new THREE.CylinderGeometry(r0, r1, len, 16, 1); g.translate(0, -len / 2, 0);
  return new THREE.Mesh(g, mat);
}
function ball(r, mat, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat); m.scale.set(sx, sy, sz); return m;
}
function tubeGeo(points, radius, seg = 36) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (Array.isArray(p) ? new THREE.Vector3(...p) : p.clone())), false, 'catmullrom', 0.35);
  return new THREE.TubeGeometry(curve, seg, radius, 6, false);
}
function tube(points, radius, mat, seg) { return new THREE.Mesh(tubeGeo(points, radius, seg), mat); }

// 이불: 다리 모양을 따라 주름·늘어짐이 있는 높이장 메쉬
function buildBlanket(mat) {
  const W = 1.14, L = 0.98;
  const geo = new THREE.PlaneGeometry(W, L, 60, 60);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i); const zz = p.getZ(i) + L / 2; const ax = Math.abs(x);
    const mound = Math.exp(-(((ax - 0.095) / 0.075) ** 2));
    const feet = 1 + 0.5 * Math.exp(-(((zz - 0.8) / 0.07) ** 2));
    let h = 0.13 + 0.14 * mound * (1 - 0.1 * zz) * feet * smooth(0.0, 0.2, zz);
    h += 0.1 * (1 - smooth(0, 0.16, zz)); // 골반 부근은 높게
    h += 0.006 * Math.sin(zz * 38 + ax * 22) + 0.004 * Math.sin(x * 33 + zz * 9);
    h -= 0.32 * smooth(0.40, 0.57, ax); // 옆으로 늘어짐
    h -= 0.30 * smooth(0.80, 0.97, zz); // 발쪽으로 늘어짐
    p.setY(i, h);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.position.set(0, MATTRESS_TOP, 0.02 + L / 2);
  return m;
}

export function buildPatient() {
  const root = new THREE.Group();
  root.name = 'bedArea';
  root.position.copy(BED_POS);

  const skin = std(0xd7a183, { roughness: 0.55 });
  const skinDark = std(0xb97c66, { roughness: 0.6 });
  const hairM = std(0xd8d8d2, { roughness: 0.9 });
  const gown = std(0xffffff, { map: gownTexture(), roughness: 0.95, side: THREE.DoubleSide });
  const metal = std(0xc4ccd2, { roughness: 0.35, metalness: 0.7 });
  const darkM = std(0x2b2f33, { roughness: 0.7 });
  const plastic = std(0xeef2f4, { roughness: 0.5 });
  const wood = std(0xb48b5c, { roughness: 0.7 });
  const woodInner = std(0xcaa57a, { roughness: 0.75 });

  root.add(blobShadow(1.7, 2.9, 0.5));

  // ============================================================ 침대
  const bed = new THREE.Group(); root.add(bed);
  const bedHW = new THREE.Group(); bed.add(bedHW); // GLB 병상이 로드되면 숨기는 절차적 병상 부품

  // 하부 프레임·바퀴
  for (const sx of [-1, 1]) {
    const beam = rbox(0.06, 0.06, 1.55, metal, 0.015); beam.position.set(sx * 0.34, 0.16, 0); bedHW.add(beam);
    for (const sz of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), darkM);
      wheel.rotation.z = Math.PI / 2; wheel.position.set(sx * 0.34, 0.05, sz * 0.7); bedHW.add(wheel);
      const fork = rbox(0.05, 0.07, 0.05, metal, 0.01); fork.position.set(sx * 0.34, 0.1, sz * 0.7); bedHW.add(fork);
    }
  }
  const cross = rbox(0.74, 0.05, 0.08, metal, 0.01); cross.position.set(0, 0.16, 0); bedHW.add(cross);
  const column = rbox(0.2, 0.36, 0.2, std(0x7f8b93, { metalness: 0.4, roughness: 0.5 }), 0.03); column.position.set(0, 0.34, 0); bedHW.add(column);
  const deck = rbox(0.94, 0.05, 2.05, std(0x8d98a0, { metalness: 0.4, roughness: 0.5 }), 0.012); deck.position.set(0, 0.56, 0); bedHW.add(deck);

  // 머리·발 보드 (움직이지 않음)
  const hbOuter = rbox(0.98, 0.66, 0.05, wood, 0.015); hbOuter.position.set(0, 0.92, -1.06); bedHW.add(hbOuter);
  const hbInner = rbox(0.84, 0.5, 0.058, woodInner, 0.012); hbInner.position.set(0, 0.92, -1.06); bedHW.add(hbInner);
  const fbOuter = rbox(0.98, 0.42, 0.05, wood, 0.015); fbOuter.position.set(0, 0.8, 1.06); bedHW.add(fbOuter);
  const fbInner = rbox(0.84, 0.28, 0.058, woodInner, 0.012); fbInner.position.set(0, 0.8, 1.06); bedHW.add(fbInner);
  const control = rbox(0.18, 0.04, 0.07, plastic, 0.01); control.position.set(0.3, 1.02, 1.06); bedHW.add(control);

  // 매트리스: 다리 쪽(고정) + 등받이(회전)
  const mattM = std(0xdce8ee, { roughness: 0.55 });
  const legMattress = rbox(0.9, 0.16, 1.06, mattM, 0.05); legMattress.position.set(0, 0.65, 0.53); bedHW.add(legMattress);
  const backDeck = new THREE.Group(); backDeck.position.set(0, 0.65, 0); bedHW.add(backDeck);
  const backMattress = rbox(0.9, 0.16, 1.0, mattM, 0.05); backMattress.position.set(0, 0, -0.5); backDeck.add(backMattress);
  const pillow = rbox(0.44, 0.11, 0.3, std(0xffffff, { roughness: 0.95 }), 0.05); pillow.position.set(0, 0.12, -0.86); backDeck.add(pillow);
  const sheetFold = rbox(0.86, 0.035, 0.09, std(0xffffff, { roughness: 0.95 }), 0.015); sheetFold.position.set(0, MATTRESS_TOP + 0.235, 0.06); bed.add(sheetFold);

  // 난간 (올림/내림)
  const rails = [];
  for (const x of [-0.5, 0.5]) {
    const rail = new THREE.Group();
    const top = rbox(0.045, 0.05, 1.35, plastic, 0.02); top.position.set(0, 0.3, 0); rail.add(top);
    const mid = rbox(0.03, 0.035, 1.35, plastic, 0.012); mid.position.set(0, 0.17, 0); rail.add(mid);
    for (const z of [-0.62, 0, 0.62]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 10), metal); post.position.set(0, 0.17, z); rail.add(post);
    }
    rail.position.set(x, 0.73, 0.08);
    bed.add(rail); rails.push(rail);
  }

  // 이불
  const blanketM = std(0x9ec5b3, { roughness: 1.0 });
  const blanket = buildBlanket(blanketM); bed.add(blanket);
  const pile = new THREE.Group(); pile.visible = false; bed.add(pile);
  for (const [x, z, sx, sz] of [[-0.12, 0.8, 0.28, 0.2], [0.1, 0.9, 0.24, 0.18], [0, 0.7, 0.3, 0.16]]) {
    const lump = ball(0.12, blanketM, sx / 0.12, 0.5, sz / 0.12); lump.position.set(x, MATTRESS_TOP + 0.05, z); pile.add(lump);
  }

  // ============================================================ 환자
  const patient = new THREE.Group(); bed.add(patient);

  // 몸통 (환자복)
  const torsoPivot = new THREE.Group(); patient.add(torsoPivot);
  const prof = [[0.001, 0.0], [0.12, 0.01], [0.14, 0.08], [0.135, 0.18], [0.145, 0.29], [0.163, 0.39], [0.158, 0.47], [0.125, 0.52], [0.055, 0.555], [0.001, 0.565]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), gown); torso.scale.set(1.12, 1, 0.68); torsoPivot.add(torso);
  const pelvis = ball(0.15, gown, 1.1, 0.8, 0.78); torsoPivot.add(pelvis);
  const chestSkin = ball(0.055, skin, 1, 0.8, 0.45); chestSkin.position.set(0, 0.53, 0.07); torsoPivot.add(chestSkin);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.047, 0.1, 14), skin); neck.position.y = 0.6; torsoPivot.add(neck);

  // 머리
  const head = new THREE.Group(); head.position.set(0, 0.73, 0.012); torsoPivot.add(head);
  head.add(ball(0.1, skin, 0.88, 1.12, 1.0));
  const nose = ball(0.014, skin, 0.9, 1.7, 1.3); nose.position.set(0, -0.012, 0.104); head.add(nose);
  const noseTip = ball(0.012, skinDark, 1.2, 0.9, 1.0); noseTip.position.set(0, -0.03, 0.112); head.add(noseTip);
  const lids = [];
  for (const sx of [-1, 1]) {
    const ear = ball(0.026, skin, 0.4, 1.15, 0.8); ear.position.set(sx * 0.088, -0.005, -0.005); head.add(ear);
    const eyeW = ball(0.0125, std(0xf3f3ee, { roughness: 0.3 }), 1, 0.9, 0.7); eyeW.position.set(sx * 0.034, 0.02, 0.087); head.add(eyeW);
    const iris = ball(0.0075, std(0x3a2a20, { roughness: 0.3 }), 1, 1, 0.5); iris.position.set(sx * 0.034, 0.02, 0.0935); head.add(iris);
    const lid = ball(0.0138, skinDark, 1, 0.55, 0.8); lid.position.set(sx * 0.034, 0.03, 0.0865); head.add(lid); lids.push(lid);
    const cheek = ball(0.03, skin, 1.1, 0.8, 0.5); cheek.position.set(sx * 0.052, -0.03, 0.078); head.add(cheek);
  }
  const browL = new THREE.Mesh(new THREE.CapsuleGeometry(0.0055, 0.034, 4, 8), hairM); browL.rotation.z = Math.PI / 2; browL.position.set(0.034, 0.05, 0.088); head.add(browL);
  const browR = browL.clone(); browR.position.x = -0.034; head.add(browR);
  for (const y of [0.074, 0.064]) { // 이마 주름
    const w = new THREE.Mesh(new THREE.CapsuleGeometry(0.0018, 0.05, 2, 6), skinDark); w.rotation.z = Math.PI / 2; w.position.set(0, y, 0.083); w.scale.z = 0.5; head.add(w);
  }
  // 턱·입
  const lipM = std(0xa8605a, { roughness: 0.5 });
  const lipUp = ball(0.016, lipM, 1.5, 0.45, 0.6); lipUp.position.set(0, -0.031, 0.088); head.add(lipUp);
  const jaw = new THREE.Group(); jaw.position.set(0, -0.045, 0.02); head.add(jaw);
  const chin = ball(0.045, skin, 0.95, 0.62, 0.9); chin.position.set(0, -0.025, 0.045); jaw.add(chin);
  const mouthInside = ball(0.017, std(0x3a1414, { roughness: 0.9 }), 1.3, 0.35, 0.5); mouthInside.position.set(0, 0.006, 0.078); jaw.add(mouthInside);
  const lipLow = ball(0.016, lipM, 1.5, 0.45, 0.6); lipLow.position.set(0, 0.0, 0.083); jaw.add(lipLow);
  const stubble = ball(0.05, std(0xbfa89a, { roughness: 1, transparent: true, opacity: 0.45 }), 0.95, 0.62, 0.92); stubble.position.set(0, -0.025, 0.048); jaw.add(stubble);
  // 머리카락
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.104, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), hairM);
  hair.scale.set(0.9, 1.12, 1.0); hair.position.set(0, 0.006, -0.012); hair.rotation.x = -0.12; head.add(hair);
  for (const sx of [-1, 1]) { const tuft = ball(0.03, hairM, 0.7, 1.1, 1); tuft.position.set(sx * 0.08, 0.025, -0.022); head.add(tuft); }

  // 팔
  function buildArm(side) {
    const shoulder = new THREE.Group(); shoulder.position.set(side * 0.2, 0.5, 0); torsoPivot.add(shoulder);
    shoulder.add(ball(0.056, gown, 1, 1, 1));
    shoulder.add(limb(0.047, 0.039, 0.28, skin));
    shoulder.add(limb(0.058, 0.054, 0.13, gown)); // 소매
    const elbow = new THREE.Group(); elbow.position.y = -0.28; shoulder.add(elbow);
    elbow.add(ball(0.04, skin));
    elbow.add(limb(0.039, 0.03, 0.25, skin));
    const wrist = new THREE.Group(); wrist.position.y = -0.25; elbow.add(wrist);
    const palm = rbox(0.075, 0.08, 0.028, skin, 0.012); palm.position.y = -0.045; wrist.add(palm);
    const fingers = new THREE.Group(); fingers.position.y = -0.085; fingers.rotation.x = -0.45; wrist.add(fingers);
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, 0.045, 3, 6), skin); f.position.set(-0.027 + i * 0.018, -0.03, 0); fingers.add(f);
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.04, 3, 6), skin); thumb.position.set(side * -0.042, -0.04, 0.02); thumb.rotation.z = side * 0.5; wrist.add(thumb);
    return { shoulder, elbow, wrist };
  }
  const rArm = buildArm(-1); // 환자 오른팔 (출혈·정맥주사)
  const lArm = buildArm(+1); // 환자 왼팔 (편마비 쪽)

  const band = new THREE.Mesh(new THREE.TorusGeometry(0.033, 0.006, 8, 18), std(0xffffff, { roughness: 0.5 })); // 환자 팔찌
  band.rotation.x = Math.PI / 2; band.position.y = -0.235; lArm.elbow.add(band);

  // 출혈·거즈·필름·카테터 허브 (오른 아래팔)
  const blood = ball(0.028, std(0xb3121a, { roughness: 0.25, emissive: 0x3a0000 }), 1.1, 1.8, 0.45); blood.position.set(0, -0.12, 0.034); rArm.elbow.add(blood);
  const smear = ball(0.02, std(0x8a0e14, { roughness: 0.4 }), 0.8, 2.2, 0.3); smear.position.set(0.012, -0.17, 0.03); rArm.elbow.add(smear);
  const gauze = rbox(0.078, 0.075, 0.03, std(0xffffff, { roughness: 1 }), 0.01); gauze.position.set(0, -0.12, 0.04); gauze.visible = false; rArm.elbow.add(gauze);
  const tape = rbox(0.1, 0.014, 0.032, std(0xe8dfc9, { roughness: 1 }), 0.004); tape.position.set(0, -0.12, 0.041); tape.visible = false; rArm.elbow.add(tape);
  const film = rbox(0.085, 0.1, 0.012, std(0xdff0ff, { transparent: true, opacity: 0.45, roughness: 0.2 }), 0.004); film.position.set(0, -0.15, 0.04); film.visible = false; rArm.elbow.add(film);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.007, 0.03, 10), std(0x2d7fd6, { roughness: 0.4 })); hub.rotation.x = Math.PI / 2; hub.position.set(0, -0.14, 0.055); hub.visible = false; rArm.elbow.add(hub);
  const ivPort = new THREE.Object3D(); ivPort.position.set(0, -0.14, 0.07); rArm.elbow.add(ivPort);

  // 다리 (이불 아래; 앉을 때 무릎이 굽는다)
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sx * 0.09, -0.06, 0); hip.rotation.x = -Math.PI / 2; patient.add(hip);
    hip.add(ball(0.075, gown, 1, 1, 1));
    hip.add(limb(0.075, 0.056, 0.45, gown));
    const knee = new THREE.Group(); knee.position.y = -0.45; hip.add(knee);
    knee.add(ball(0.056, gown, 1, 1, 1));
    knee.add(limb(0.054, 0.04, 0.42, gown));
    const foot = ball(0.045, skin, 0.9, 0.8, 2.3); foot.position.set(0, -0.44, 0.07); knee.add(foot);
    legs.push({ hip, knee });
  }

  // ============================================================ Foley·소변주머니
  const tubeM = std(0xe7eef1, { transparent: true, opacity: 0.85, roughness: 0.3 });
  // 소변줄은 바지 허리(왼쪽 옆구리 앞)에서 나와 침대 옆으로 내려간다
  const foleyOk = tube([[0.15, 0.975, -0.25], [0.26, 0.965, -0.2], [0.38, 0.84, -0.12], [0.5, 0.66, 0.1], [0.57, 0.5, 0.5]], 0.011, tubeM, 40);
  const foleyKink = tube([[0.15, 0.975, -0.25], [0.2, 0.97, -0.21], [0.19, 1.03, -0.19], [0.26, 0.955, -0.17], [0.38, 0.84, -0.12], [0.5, 0.66, 0.1], [0.57, 0.5, 0.5]], 0.011, tubeM, 40);
  bed.add(foleyOk, foleyKink);
  const kinkMark = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.007, 8, 20), std(0xff8a1f, { emissive: 0x663300 }));
  kinkMark.position.set(0.19, 1.0, -0.19); kinkMark.rotation.y = Math.PI / 2; bed.add(kinkMark);

  // 소변주머니 (눈금 라벨 + 소변 수위): 간호사가 서 있는 발쪽에서 보이도록 앞면이 +z를 향함
  const bagGroup = new THREE.Group(); bagGroup.position.set(0.58, 0.3, 0.5); bed.add(bagGroup);
  const bagTex = labelTexture((g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#46515a'; g.fillStyle = '#46515a'; g.lineWidth = 3; g.font = 'bold 22px sans-serif';
    for (let i = 0; i <= 8; i++) {
      const y = h - 14 - (i / 8) * (h - 40);
      g.beginPath(); g.moveTo(w - 56, y); g.lineTo(w - (i % 2 ? 40 : 26), y); g.stroke();
      if (i % 2 === 0 && i > 0) g.fillText(String(i * 100), w - 100, y + 7);
    }
  }, 128, 256);
  bagGroup.add(rbox(0.16, 0.3, 0.02, std(0xe9f2f6, { transparent: true, opacity: 0.55, roughness: 0.2 }), 0.008));
  const urine = rbox(0.14, 1, 0.012, std(0xe6c53a, { transparent: true, opacity: 0.9, roughness: 0.2 }), 0.004); urine.position.set(0, -0.14, 0.004); bagGroup.add(urine);
  const bagScale = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.3), new THREE.MeshBasicMaterial({ map: bagTex.tex, transparent: true, depthWrite: false })); bagScale.position.z = 0.0125; bagGroup.add(bagScale);
  const bagHook = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 14, Math.PI), metal); bagHook.position.set(0, 0.17, 0); bagGroup.add(bagHook);
  let urineLevel = 0.02;

  // ============================================================ 수액 폴대·펌프
  const pole = new THREE.Group(); pole.position.set(-0.86, 0, 0.1); root.add(pole);
  const poleHW = new THREE.Group(); pole.add(poleHW); // GLB 폴대·수액백이 로드되면 숨기는 절차적 부품
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 1.85, 12), metal); stand.position.y = 0.95; poleHW.add(stand);
  for (let i = 0; i < 5; i++) {
    const arm = new THREE.Group(); arm.rotation.y = (i / 5) * Math.PI * 2; poleHW.add(arm);
    const leg = rbox(0.28, 0.025, 0.04, metal, 0.01); leg.position.set(0.14, 0.05, 0); arm.add(leg);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 12), darkM); w.rotation.x = Math.PI / 2; w.position.set(0.27, 0.03, 0); arm.add(w);
  }
  const hookBar = rbox(0.34, 0.02, 0.02, metal, 0.008); hookBar.position.y = 1.86; poleHW.add(hookBar);
  function ivBag(x, w, h, color) {
    const g = new THREE.Group(); g.position.set(x, 1.86 - h / 2 - 0.04, 0.0); poleHW.add(g);
    g.add(rbox(w, h, 0.035, std(0xeaf4fb, { transparent: true, opacity: 0.55, roughness: 0.15 }), 0.012));
    const fluid = rbox(w * 0.86, h * 0.78, 0.028, std(color, { transparent: true, opacity: 0.8, roughness: 0.2 }), 0.01); fluid.position.y = -h * 0.06; g.add(fluid);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, h * 0.22), new THREE.MeshBasicMaterial({ color: 0xffffff })); label.position.set(0, h * 0.22, 0.019); g.add(label);
  }
  ivBag(-0.08, 0.13, 0.24, 0xcfe8ff); // NS
  ivBag(0.09, 0.1, 0.17, 0xfff3c4); // ceftriaxone
  const chamber = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.08, 12), std(0xdff0ff, { transparent: true, opacity: 0.5, roughness: 0.1 }));
  chamber.position.set(-0.08, 1.5, 0.0); poleHW.add(chamber);
  const chamberDrop = ball(0.006, std(0xbfe3ff, { roughness: 0.1 })); pole.add(chamberDrop);
  const dropAt = { x: -0.08, y: 1.52 };
  // 펌프
  const pump = new THREE.Group(); pump.position.set(0, 1.18, 0.03); pole.add(pump);
  pump.add(rbox(0.15, 0.2, 0.1, std(0xdfe5e8, { roughness: 0.5 }), 0.015));
  const pumpTex = labelTexture(() => {}, 160, 100);
  function drawPump(running) {
    const g = pumpTex.ctx; g.fillStyle = '#0b1b12'; g.fillRect(0, 0, 160, 100);
    g.fillStyle = running ? '#53f08a' : '#ff5a4a'; g.font = 'bold 26px monospace'; g.textAlign = 'center';
    g.fillText(running ? '40 mL/h' : 'STOPPED', 80, 44);
    g.font = '16px monospace'; g.fillStyle = running ? '#9ff0bb' : '#ffb0a8'; g.fillText(running ? 'NS RUNNING' : 'PAUSED', 80, 74);
    pumpTex.tex.needsUpdate = true;
  }
  drawPump(true);
  const pumpScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.07), new THREE.MeshBasicMaterial({ map: pumpTex.tex })); pumpScreen.position.set(0, 0.04, 0.052); pump.add(pumpScreen);
  const ledM = new THREE.MeshBasicMaterial({ color: 0x40ff80 });
  const led = ball(0.007, ledM); led.position.set(0.05, -0.06, 0.052); pump.add(led);
  let pumpState = true;
  // 튜브 (펌프 → 환자): 끝점이 바뀔 때만 다시 만든다
  const ivTube = new THREE.Mesh(tubeGeo([[0, 0, 0], [0, -0.1, 0], [0, -0.2, 0.1]], 0.007), std(0xdff0ff, { transparent: true, opacity: 0.8, roughness: 0.2 })); root.add(ivTube);
  const ivFreeEnd = new THREE.Object3D(); ivFreeEnd.position.set(-0.36, MATTRESS_TOP + 0.012, 0.12); bed.add(ivFreeEnd);
  const ivFreeHub = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.007, 0.03, 8), std(0x2d7fd6)); ivFreeHub.rotation.z = Math.PI / 2; ivFreeEnd.add(ivFreeHub);
  const pumpOut = new THREE.Vector3(pole.position.x, 1.07, pole.position.z + 0.04);
  const drip = ball(0.008, std(0xbfe3ff, { roughness: 0.1 })); root.add(drip);
  const lastEnd = new THREE.Vector3(1e9, 0, 0);
  const tmpV = new THREE.Vector3(); const tmpV2 = new THREE.Vector3(); const yellow = new THREE.Color(0xf3e08a); const clear = new THREE.Color(0xe7eef1);

  function retubeIV(end) {
    if (end.distanceToSquared(lastEnd) < 1e-6) return;
    lastEnd.copy(end);
    const mid1 = pumpOut.clone().lerp(end, 0.35); mid1.y -= 0.1;
    const mid2 = pumpOut.clone().lerp(end, 0.72); mid2.y = Math.max(end.y + 0.03, mid2.y - 0.06);
    const geo = tubeGeo([pumpOut, mid1, mid2, end], 0.007, 28);
    ivTube.geometry.dispose(); ivTube.geometry = geo;
  }

  // ============================================================ 환시 (환자에게만 보이는 벌레)
  const bugs = new THREE.Group();
  const bugM = std(0x1c1c1c, { transparent: true, opacity: 0.75 });
  for (let i = 0; i < 9; i++) { const b = ball(0.03, bugM, 1.3, 0.6, 1); b.userData.ph = i * 1.7; bugs.add(b); }
  bugs.position.set(1.7, 2.45, -1.05); // root 기준 (월드 x 1.7, y 2.45, z -2.35)
  bugs.visible = false; root.add(bugs);

  // ============================================================ 상태
  let talk = 0; let blink = 0; let nextBlink = 2;
  let bedY = 0; const railY = [0, 0];
  const cur = { a: 0.75, torso: -0.82, yaw: 0, knee: 0, hx: 0, hz: -0.15 };
  const T = {
    half: { a: 0.75, torso: -(Math.PI / 2 - 0.75), yaw: 0, knee: 0, hx: 0, hz: -0.15 },
    lying: { a: 0.12, torso: -(Math.PI / 2 - 0.12), yaw: 0, knee: 0, hx: 0, hz: -0.02 },
    edge: { a: 0.4, torso: -0.03, yaw: Math.PI / 2, knee: Math.PI / 2, hx: 0.2, hz: 0.4 },
  };
  const state = { time: 0, frame: 0 };
  let hipY = MATTRESS_TOP + 0.115;

  // ============================================================ GLB 에셋 (로드되면 절차적 모델을 대체)
  const ASSET_URL = new URL('../assets/', import.meta.url);
  const qs = new URLSearchParams(location.search);
  let man = null; let manGroup = null; let backrest = null; let glbBags = false;
  const HQ = (side) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), side > 0 ? -Math.PI / 2 : Math.PI / 2); // 팔을 아래로 늘어뜨리는 회전
  const qSh = new THREE.Quaternion(); const qEl = new THREE.Quaternion(); const eul = new THREE.Euler();
  const handLoader = new GLTFLoader();
  // 환경맵이 없으므로 금속성은 끄고(검게 보임) 텍스처 질감만 쓴다
  const matte = (scene) => scene.traverse((o) => { if (o.isMesh) { const m = o.material; m.metalness = 0; m.metalnessMap = null; m.roughness = 0.75; m.needsUpdate = true; } });
  const loadGLB = (name) => handLoader.loadAsync(new URL(name, ASSET_URL).href).then((g) => { matte(g.scene); return g; });

  async function upgrade() {
    const tasks = [];
    // 병상
    tasks.push(loadGLB('bed.glb').then((g) => {
      const m = g.scene; m.scale.setScalar(1.06); m.rotation.y = Math.PI / 2; m.position.y = 0.53;
      bed.add(m); bedHW.visible = false;
      backrest = new THREE.Group(); backrest.visible = false; bed.add(backrest);
      const wedge = rbox(0.72, 0.66, 0.1, std(0xdfe2ee, { roughness: 0.75 }), 0.04); wedge.position.set(0, 0.33, -0.31); backrest.add(wedge);
    }));
    // 수액 폴대 + 수액백
    tasks.push(Promise.all([loadGLB('pole.glb'), loadGLB('bag.glb')]).then(([pg, bg]) => {
      pg.scene.position.y = 0.951; pole.add(pg.scene); poleHW.visible = false;
      glbBags = true;
      const plasticTube = std(0xe9f3f7, { transparent: true, opacity: 0.8, roughness: 0.25 });
      pump.position.set(0, 0.95, 0.075);
      pumpOut.set(pole.position.x, 0.85, pole.position.z + 0.075);
      const hookY = 1.79;
      [[-0.257, 0.5], [0.257, 0.4]].forEach(([x, sc], i) => {
        const b = bg.scene.clone(true); b.scale.setScalar(sc);
        const y = hookY - 0.935 * sc + 0.012; b.position.set(x, y, 0); pole.add(b);
        const endY = y - 0.49 * sc;
        const t = tube([[x, endY, 0], [x * 0.55, endY - 0.06, 0.03], [x * 0.12, 1.12, 0.06], [0, 1.06, 0.075]], 0.0065, plasticTube, 24); pole.add(t);
        if (i === 0) { dropAt.x = x; dropAt.y = y + 0.06; }
      });
      lastEnd.set(1e9, 0, 0);
    }));
    // 환자 (남편 모델)
    tasks.push(loadMan(new URL('man.glb', ASSET_URL).href, { gown: qs.get('clothes') !== '1' }).then((m) => {
      man = m; manGroup = new THREE.Group(); manGroup.scale.setScalar(0.9); manGroup.add(m.mesh); bed.add(manGroup);
      patient.visible = false; hipY = MATTRESS_TOP + 0.15;
      // 정맥주사 부위: 오른 손등 (소매가 아래팔을 덮고 있어서)
      const hf = new THREE.Group(); hf.position.set(-0.235, 0, 0); hf.quaternion.copy(HQ(+1)); m.bones.rElbow.add(hf);
      const site = new THREE.Group(); site.position.set(0, -0.085, 0.036); site.scale.setScalar(0.7); hf.add(site);
      const put = (o, x, y, z) => { o.position.set(x, y, z); site.add(o); };
      put(blood, 0, 0, 0); put(smear, 0.012, -0.035, -0.004); put(gauze, 0, 0, 0.006); put(tape, 0, 0, 0.007);
      put(film, 0, -0.015, 0.006); put(hub, 0, -0.025, 0.02); put(ivPort, 0, -0.025, 0.035);
    }));
    const res = await Promise.allSettled(tasks);
    res.forEach((r) => { if (r.status === 'rejected') console.warn('GLB 로드 실패:', r.reason); });
    return { man: !!man, bed: !!backrest, bags: glbBags };
  }
  const ready = upgrade();

  function driveMan(dt, s, k) {
    const B = man.bones;
    manGroup.position.set(cur.hx, hipY, cur.hz); manGroup.rotation.y = cur.yaw;
    B.pelvis.rotation.set(-Math.PI / 2, 0, 0);
    const bend = (cur.torso + Math.PI / 2) / 2;
    B.spine1.rotation.set(bend, 0, 0); B.spine2.rotation.set(bend, 0, torsoPivot.rotation.z);
    const tilt = 0.14 * Math.min(1, Math.max(0, (cur.a - 0.12) / 0.63));
    B.neck.rotation.set(tilt * 0.5, 0, 0);
    B.head.rotation.set(head.rotation.x + tilt * 0.5, head.rotation.y, 0);
    B.jaw.rotation.set(jaw.rotation.x * 0.15, 0, 0);
    for (const [side, arm, sh, el] of [[-1, rArm, B.rShoulder, B.rElbow], [+1, lArm, B.lShoulder, B.lElbow]]) {
      const h = HQ(side); // 팔을 아래로 늘어뜨리는 기준 회전
      eul.set(arm.shoulder.rotation.x, 0, arm.shoulder.rotation.z);
      sh.quaternion.setFromEuler(eul).multiply(h);
      eul.set(arm.elbow.rotation.x, 0, 0);
      qEl.setFromEuler(eul); el.quaternion.copy(h).invert().multiply(qEl).multiply(h);
    }
    B.lKnee.rotation.set(cur.knee, 0, 0); B.rKnee.rotation.set(cur.knee, 0, 0);
    if (backrest) {
      backrest.visible = s.posture !== 'edge' && cur.a > 0.3;
      backrest.position.copy(manGroup.position); backrest.rotation.set(cur.torso, 0, 0);
    }
  }

  function speak(text) { talk = Math.min(8, 0.5 + text.length * 0.085); }

  function update(dt, s, opts = {}) {
    state.time += dt; state.frame++;
    const t = state.time;
    const e = Math.max(0, (s.emotion - 3) / 7);
    const k = 1 - Math.exp(-dt * 4);

    // 침대 높이·난간
    bedY += ((s.bedLow ? -0.22 : 0) - bedY) * k;
    bed.position.y = bedY;
    const edge = s.posture === 'edge';
    rails.forEach((r, i) => {
      const wantUp = s.railUp && !(edge && i === 1);
      railY[i] += ((wantUp ? 0 : -0.36) - railY[i]) * k;
      r.position.y = 0.73 + railY[i];
    });

    // 자세 보간
    const tg = T[s.posture] || T.half;
    for (const key of Object.keys(cur)) cur[key] += (tg[key] - cur[key]) * k * 0.7;
    backDeck.rotation.x = cur.a;
    torsoPivot.rotation.x = cur.torso;
    patient.rotation.y = cur.yaw;
    patient.position.set(cur.hx, hipY, cur.hz);
    legs.forEach((l) => { l.knee.rotation.x = cur.knee; });
    blanket.visible = false; sheetFold.visible = false; pile.visible = false; // 담요는 치웠다 (시연 장면에서 환자·소변줄이 잘 보이도록)

    // 팔 움직임: 흥분할수록 크게
    const amp = 0.25 + e * 0.75;
    const calm = s.emotion <= 3.5 || s.posture === 'lying';
    const pointing = s.started && !s.done.has('stopIV');
    const rT = pointing ? -1.15 : calm ? -0.12 : -0.5 + Math.sin(t * 3.1) * 0.35 * amp;
    rArm.shoulder.rotation.x += (rT - rArm.shoulder.rotation.x) * k;
    rArm.elbow.rotation.x += ((pointing ? -0.45 : -0.2) - rArm.elbow.rotation.x) * k;
    rArm.shoulder.rotation.z += ((s.hallucinating ? 0.5 + Math.sin(t * 5) * 0.4 * amp : -0.05) - rArm.shoulder.rotation.z) * k;
    const lT = calm ? -0.08 : -0.35 + Math.sin(t * 4.3) * 0.18 * amp;
    lArm.shoulder.rotation.x += (lT - lArm.shoulder.rotation.x) * k;
    lArm.elbow.rotation.x += ((calm ? -0.1 : -0.6) - lArm.elbow.rotation.x) * k;
    lArm.shoulder.rotation.z += ((calm ? 0.02 : 0.08) - lArm.shoulder.rotation.z) * k;
    torsoPivot.rotation.z = calm ? 0 : Math.sin(t * 2.4) * 0.04 * amp;
    head.rotation.y = calm ? 0 : Math.sin(t * 1.7) * 0.5 * amp;
    head.rotation.x = s.posture === 'lying' ? 0.05 : 0.12;

    // 얼굴: 입·눈썹·눈 깜빡임
    talk = Math.max(0, talk - dt);
    jaw.rotation.x = talk > 0 ? 0.08 + Math.abs(Math.sin(t * 14)) * 0.32 : (s.emotion > 5 ? 0.12 : 0.03);
    browL.rotation.z = Math.PI / 2 + 0.28 * e; browR.rotation.z = Math.PI / 2 - 0.28 * e;
    blink -= dt; nextBlink -= dt;
    if (nextBlink <= 0) { blink = 0.12; nextBlink = 1.5 + Math.random() * 3; }
    lids.forEach((l) => { l.scale.y = blink > 0 ? 1.5 : 0.55; });

    if (man) driveMan(dt, s, k);

    // 출혈·거즈·필름
    blood.visible = s.bleeding; smear.visible = s.bleeding;
    if (s.bleeding) blood.scale.y = 1.8 + Math.sin(t * 6) * 0.1;
    gauze.visible = !!s.gauze && !s.ivBack; tape.visible = gauze.visible;
    film.visible = !!s.ivBack; hub.visible = !!s.ivBack;

    // Foley
    foleyOk.visible = !s.kinked; foleyKink.visible = s.kinked;
    kinkMark.visible = s.kinked && s.done.has('assessBladder');
    tubeM.color.lerp(s.urineFlowing ? yellow : clear, k * 0.5);
    if (s.urineFlowing) urineLevel = Math.min(0.15, urineLevel + dt * 0.006); else urineLevel = 0.02;
    urine.scale.y = urineLevel * 1.6;
    urine.position.y = -0.14 + (urineLevel * 1.6) / 2;

    // 수액: 펌프 표시·튜브·점적
    if (pumpState !== s.ivRunning) { pumpState = s.ivRunning; drawPump(pumpState); ledM.color.set(pumpState ? 0x40ff80 : 0xff4a3a); }
    if (state.frame % 2 === 0) {
      const src = s.ivBack ? ivPort : ivFreeEnd;
      src.getWorldPosition(tmpV); root.worldToLocal(tmpV); retubeIV(tmpV);
    }
    ivFreeEnd.visible = !s.ivBack;
    chamberDrop.visible = s.ivRunning && !glbBags;
    if (s.ivRunning) chamberDrop.position.set(dropAt.x, dropAt.y - ((t * 1.4) % 1) * 0.05, 0);
    drip.visible = s.ivRunning && !s.ivBack;
    if (drip.visible) { ivFreeEnd.getWorldPosition(tmpV2); root.worldToLocal(tmpV2); drip.position.set(tmpV2.x, tmpV2.y - ((t * 1.3) % 1) * 0.25, tmpV2.z); }

    // 환시
    bugs.visible = opts.showHallucination !== false && s.hallucinating;
    if (bugs.visible) {
      bugs.children.forEach((b) => {
        const p = b.userData.ph;
        b.position.set(Math.sin(t * 1.3 + p) * 0.2, Math.cos(t * 1.1 + p * 1.3) * 0.15, Math.sin(t * 0.9 + p * 2) * 0.1);
      });
    }
  }

  return { group: root, update, speak, ready, parts: { rArm, lArm }, get man() { return man; } };
}
