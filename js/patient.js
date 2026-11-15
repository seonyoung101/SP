// 침대·환자 아바타·수액/Foley·환시 연출. Scenario 상태(s)를 매 프레임 읽어 반영한다.
// 환자 좌표계(torsoPivot 안): +z = 얼굴 방향, +y = 머리 쪽, 환자의 오른쪽 = -x (간호사 기준 왼쪽).
import * as THREE from 'three';

const m = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
const SKIN = 0xd9a98a;

function capsule(r, len, mat) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat);
}

function tube(points, radius, mat) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.3);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 6, false), mat);
}

export const BED_POS = new THREE.Vector3(0, 0, -1.3);

export function buildPatient() {
  const root = new THREE.Group();
  root.name = 'bedArea';
  root.position.copy(BED_POS);

  // ---------- 침대 ----------
  const bed = new THREE.Group();
  root.add(bed);
  const frameM = m(0x6f7d86);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 2.1), frameM); frame.position.y = 0.5; bed.add(frame);
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 2.0), m(0xcfe3ee)); mattress.position.y = 0.64; bed.add(mattress);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.06), m(0x8b6b4a)); head.position.set(0, 0.8, -1.06); bed.add(head);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.45, 0.05), m(0x8b6b4a)); foot.position.set(0, 0.7, 1.06); bed.add(foot);
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.3), m(0xffffff)); pillow.position.set(0, 0.76, -0.82); bed.add(pillow);
  for (const [x, z] of [[-0.45, -0.95], [0.45, -0.95], [-0.45, 0.95], [0.45, 0.95]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), frameM); leg.position.set(x, 0.25, z); bed.add(leg);
  }
  // 난간 (올림/내림)
  const rails = [];
  for (const x of [-0.5, 0.5]) {
    const rail = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 1.3), m(0xb9c4cb)); bar.position.set(0, 0.28, 0); rail.add(bar);
    const bar2 = bar.clone(); bar2.position.y = 0.12; rail.add(bar2);
    for (const z of [-0.6, 0, 0.6]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.03), m(0xb9c4cb)); post.position.set(0, 0.2, z); rail.add(post);
    }
    rail.position.set(x, 0.72, 0.05);
    bed.add(rail); rails.push(rail);
  }

  // ---------- 환자 ----------
  const patient = new THREE.Group(); // 골반 기준점
  patient.position.set(0, 0.84, 0.05);
  bed.add(patient);

  const gown = m(0xa8c7e6);
  const skin = m(SKIN);
  const torsoPivot = new THREE.Group(); patient.add(torsoPivot);
  const torso = capsule(0.16, 0.45, gown); torso.position.y = 0.3; torso.scale.set(1.1, 1, 0.7); torsoPivot.add(torso);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 16), skin); headMesh.position.set(0, 0.82, 0.01); torsoPivot.add(headMesh);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), m(0xcfcfcf));
  hair.position.set(0, 0.835, -0.005); hair.rotation.x = -0.15; torsoPivot.add(hair);
  for (const x of [-0.04, 0.04]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), m(0x222222)); eye.position.set(x, 0.83, 0.11); torsoPivot.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), m(0x5a1f1f)); mouth.position.set(0, 0.775, 0.108); mouth.scale.set(1.3, 0.3, 0.5); torsoPivot.add(mouth);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.01), m(0x888888)); brow.position.set(0, 0.86, 0.108); torsoPivot.add(brow);

  // 팔: 어깨 pivot → 위팔 → 팔꿈치 pivot → 아래팔(+손)
  function buildArm(side) {
    const shoulder = new THREE.Group(); shoulder.position.set(side * 0.21, 0.52, 0); torsoPivot.add(shoulder);
    const upper = capsule(0.04, 0.2, gown); upper.position.y = -0.15; shoulder.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.31; shoulder.add(elbow);
    const fore = capsule(0.035, 0.18, skin); fore.position.y = -0.13; elbow.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), skin); hand.position.y = -0.27; elbow.add(hand);
    return { shoulder, elbow, fore, hand };
  }
  const rArm = buildArm(-1); // 환자 오른팔 (출혈)
  const lArm = buildArm(+1); // 환자 왼팔 (편마비 쪽)

  // 출혈·거즈 (오른 아래팔)
  const blood = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), m(0xb3121a, { emissive: 0x400000 }));
  blood.scale.set(1.2, 1.4, 0.6); blood.position.set(0, -0.12, 0.034); rArm.elbow.add(blood);
  const gauze = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.07, 0.03), m(0xffffff)); gauze.position.set(0, -0.12, 0.038); gauze.visible = false; rArm.elbow.add(gauze);
  const stain = new THREE.Mesh(new THREE.CircleGeometry(0.06, 14), m(0x9e1018)); stain.rotation.x = -Math.PI / 2; stain.position.set(-0.28, 0.725, 0.05); bed.add(stain);

  // 다리 + 이불
  for (const x of [-0.1, 0.1]) {
    const leg = capsule(0.07, 0.7, gown); leg.rotation.x = Math.PI / 2; leg.position.set(x, 0.0, 0.5); patient.add(leg);
  }
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.12, 0.85), m(0x86b59d)); blanket.position.set(0, 0.1, 0.55); patient.add(blanket);

  // ---------- Foley ----------
  const urineM = m(0xe3c43a, { transparent: true, opacity: 0.85 });
  const tubeM = m(0xdde6ea, { transparent: true, opacity: 0.8 });
  const foleyOk = tube([[0.05, 0.8, 0.12], [0.2, 0.76, 0.2], [0.42, 0.64, 0.3], [0.55, 0.45, 0.32]], 0.012, tubeM);
  const foleyKink = tube([[0.05, 0.8, 0.12], [0.11, 0.73, 0.16], [0.09, 0.81, 0.19], [0.2, 0.73, 0.22], [0.42, 0.64, 0.3], [0.55, 0.45, 0.32]], 0.012, m(0xc9a46a));
  bed.add(foleyOk, foleyKink);
  const kinkMark = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 16), m(0xff8a1f, { emissive: 0x663300 }));
  kinkMark.position.set(0.1, 0.77, 0.18); kinkMark.rotation.x = Math.PI / 2; bed.add(kinkMark);
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.04), m(0xffffff, { transparent: true, opacity: 0.35 })); bag.position.set(0.55, 0.33, 0.32); bed.add(bag);
  const urine = new THREE.Mesh(new THREE.BoxGeometry(0.085, 1, 0.03), urineM); urine.position.set(0.55, 0.25, 0.32); bed.add(urine);
  let urineLevel = 0.01; // 0.01 ≈ 50 mL

  // ---------- 수액 폴대 ----------
  const pole = new THREE.Group(); pole.position.set(-0.75, 0, -0.1); root.add(pole);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.9, 8), m(0xb9c4cb)); stand.position.y = 0.95; pole.add(stand);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 16), m(0x555f66)); base.position.y = 0.02; pole.add(base);
  const ivBag = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.04), m(0xdff0ff, { transparent: true, opacity: 0.6 })); ivBag.position.set(0, 1.54, 0); pole.add(ivBag);
  const ivDangle = tube([[-0.75, 1.45, -0.1], [-0.75, 1.2, -0.1], [-0.72, 0.98, -0.05], [-0.66, 0.72, 0.0]], 0.006, m(0xdff0ff, { transparent: true, opacity: 0.7 }));
  const ivConn = tube([[-0.75, 1.45, -0.1], [-0.75, 1.2, -0.12], [-0.6, 1.05, -0.05], [-0.34, 1.0, 0.0]], 0.006, m(0xdff0ff, { transparent: true, opacity: 0.7 }));
  ivConn.visible = false;
  root.add(ivDangle, ivConn);
  const drip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), m(0xbfe3ff));
  root.add(drip);

  // ---------- 환시 (환자에게만 보이는 벌레) ----------
  const bugs = new THREE.Group();
  const bugM = m(0x1c1c1c, { transparent: true, opacity: 0.75 });
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), bugM); b.userData.ph = i * 1.7; bugs.add(b);
  }
  bugs.position.set(1.7, 2.45, -2.35 - BED_POS.z); // root 좌표 (월드: x 1.7, y 2.45, z -2.35)
  bugs.visible = false;
  root.add(bugs);

  // ---------- 상태 ----------
  let talk = 0; // 말하는 시간(초)
  let bedY = 0, railY = [0, 0];
  let torsoRot = -1.1, rootX = 0, legsVisible = true;
  const state = { time: 0 };

  function speak(text) { talk = Math.min(8, 0.5 + text.length * 0.085); }

  function update(dt, s, opts = {}) {
    state.time += dt;
    const t = state.time;
    const e = (s.emotion - 3) / 7; // 0..1
    const k = Math.min(1, dt * 4);

    // 침대 높이·난간
    bedY += ((s.bedLow ? -0.22 : 0) - bedY) * k;
    bed.position.y = bedY;
    rails.forEach((r, i) => {
      railY[i] += ((s.railUp ? 0 : -0.3) - railY[i]) * k;
      r.position.y = 0.72 + railY[i];
    });

    // 자세
    const target = s.posture === 'lying' ? -1.5 : s.posture === 'edge' ? -0.05 : -0.8;
    torsoRot += (target - torsoRot) * k * 0.8;
    torsoPivot.rotation.x = torsoRot;
    const tx = s.posture === 'edge' ? 0.18 : 0;
    rootX += (tx - rootX) * k;
    patient.position.x = rootX;

    // 팔 움직임: 흥분할수록 크게
    const amp = 0.25 + e * 0.7;
    const calm = s.emotion <= 3.5 || s.posture === 'lying';
    const pointing = !s.done.has('stopIV') && s.started;
    const rTarget = pointing ? -1.15 : calm ? -0.15 : -0.5 + Math.sin(t * 3.1) * 0.35 * amp;
    rArm.shoulder.rotation.x += (rTarget - rArm.shoulder.rotation.x) * k;
    rArm.elbow.rotation.x += ((pointing ? -0.5 : -0.2) - rArm.elbow.rotation.x) * k;
    rArm.shoulder.rotation.z = s.hallucinating ? 0.5 + Math.sin(t * 5) * 0.4 * amp : -0.05;
    // 왼손: 소변줄을 만지작
    const lTarget = calm ? -0.1 : -0.35 + Math.sin(t * 4.3) * 0.2 * amp;
    lArm.shoulder.rotation.x += (lTarget - lArm.shoulder.rotation.x) * k;
    lArm.elbow.rotation.x += ((calm ? -0.1 : -0.6) - lArm.elbow.rotation.x) * k;
    lArm.shoulder.rotation.z = calm ? 0.02 : 0.08;

    // 몸을 뒤척임
    const fidget = calm ? 0 : Math.sin(t * 2.4) * 0.04 * amp;
    torsoPivot.rotation.z = fidget;
    headMesh.rotation.y = calm ? 0 : Math.sin(t * 1.7) * 0.5 * amp;

    // 입
    talk = Math.max(0, talk - dt);
    const open = talk > 0 ? 0.3 + Math.abs(Math.sin(t * 14)) * 0.9 : 0.3;
    mouth.scale.y = open * (s.emotion > 5 ? 1.3 : 1);
    brow.rotation.z = s.emotion > 5 ? 0.25 : 0.02;

    // 출혈·거즈
    blood.visible = s.bleeding;
    gauze.visible = !!s.gauze;
    stain.visible = s.started && !s.gauze;
    if (s.bleeding) blood.scale.setScalar(1 + Math.sin(t * 6) * 0.06);

    // Foley
    foleyOk.visible = !s.kinked;
    foleyKink.visible = s.kinked;
    kinkMark.visible = s.kinked && s.done.has('assessBladder');
    if (s.urineFlowing) urineLevel = Math.min(0.085, urineLevel + dt * 0.012); else urineLevel = 0.01;
    const uh = Math.max(0.01, urineLevel * 1.6);
    urine.scale.y = uh;
    urine.position.y = 0.24 + uh / 2;

    // 수액
    ivDangle.visible = !s.ivBack;
    ivConn.visible = !!s.ivBack;
    drip.visible = s.ivRunning && !s.ivBack;
    if (drip.visible) drip.position.set(-0.66, 0.72 - ((t * 1.3) % 1) * 0.5, 0.0);

    // 환시
    bugs.visible = opts.showHallucination !== false && s.hallucinating;
    if (bugs.visible) {
      bugs.children.forEach((b) => {
        const p = b.userData.ph;
        b.position.set(Math.sin(t * 1.3 + p) * 0.2, Math.cos(t * 1.1 + p * 1.3) * 0.15, Math.sin(t * 0.9 + p * 2) * 0.1);
      });
    }
  }

  return { group: root, update, speak, parts: { rArm, lArm } };
}
