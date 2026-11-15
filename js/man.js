// 남편 GLB(정적 T자 자세 메시)에 뼈대·스키닝을 코드로 입혀 환자 아바타로 쓴다.
// 모델 좌표(정규화됨): 키 y -0.944..0.944, 얼굴 +z, 환자의 오른쪽 = -x, T자 팔은 ±x.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 관절 위치 (모델 좌표, T자 자세)
const J = {
  pelvis: [0, 0.0, 0.0],
  spine1: [0, 0.15, 0.0],
  spine2: [0, 0.40, 0.0],
  neck: [0, 0.64, 0.0],
  head: [0, 0.70, 0.0],
  jaw: [0, 0.80, -0.01],
  rShoulder: [-0.2, 0.56, -0.03], rElbow: [-0.54, 0.47, -0.05],
  lShoulder: [0.2, 0.56, -0.03], lElbow: [0.54, 0.47, -0.05],
  rHip: [-0.115, 0.0, 0.0], rKnee: [-0.15, -0.46, 0.0],
  lHip: [0.115, 0.0, 0.0], lKnee: [0.15, -0.46, 0.0],
};
const ORDER = ['pelvis', 'spine1', 'spine2', 'neck', 'head', 'jaw', 'rShoulder', 'rElbow', 'lShoulder', 'lElbow', 'rHip', 'rKnee', 'lHip', 'lKnee'];
const PARENT = { pelvis: null, spine1: 'pelvis', spine2: 'spine1', neck: 'spine2', head: 'neck', jaw: 'head', rShoulder: 'spine2', rElbow: 'rShoulder', lShoulder: 'spine2', lElbow: 'lShoulder', rHip: 'pelvis', rKnee: 'rHip', lHip: 'pelvis', lKnee: 'lHip' };
const IDX = Object.fromEntries(ORDER.map((n, i) => [n, i]));

// 한 정점의 뼈 가중치 (최대 4개)
function weightsFor(x, y, z, skin = true) {
  const w = new Float32Array(ORDER.length);
  const side = x < 0 ? 'r' : 'l';
  const ax = Math.abs(x);

  // 몸통 중심선을 따라: pelvis → spine1 → spine2 → (어깨선까지) → neck → head
  const trunk = new Float32Array(ORDER.length);
  // 피부(목·턱)는 머리를 따라 움직이고, 칼라(옷)는 몸통에 남는다 — 턱이 칼라를 뚫지 않도록 구분
  const keys = skin
    ? [[0.02, 'pelvis'], [0.17, 'spine1'], [0.42, 'spine2'], [0.62, 'spine2'], [0.665, 'neck'], [0.705, 'head']]
    : [[0.02, 'pelvis'], [0.17, 'spine1'], [0.42, 'spine2'], [0.66, 'spine2'], [0.72, 'neck'], [0.80, 'head']];
  // 얼굴 앞쪽(턱·목 앞)은 머리 쪽으로 더 일찍 넘어가야 턱이 늘어지지 않는다
  if (skin && z > 0.0 && y > 0.6) { keys[4] = [0.665, 'head']; keys[3] = [0.63, 'neck']; }
  if (y <= keys[0][0]) trunk[IDX.pelvis] = 1;
  else if (y >= keys[keys.length - 1][0]) trunk[IDX.head] = 1;
  else {
    for (let i = 0; i < keys.length - 1; i++) {
      if (y < keys[i + 1][0]) { const t = sm(keys[i][0], keys[i + 1][0], y); trunk[IDX[keys[i][1]]] += 1 - t; trunk[IDX[keys[i + 1][1]]] += t; break; }
    }
  }
  // 턱: 입술선 아래·앞쪽 얼굴 (head에서 일부를 jaw로)
  if (y > 0.69 && y < 0.78 && z > -0.03 && ax < 0.09) {
    const jw = sm(0.69, 0.715, y) * (1 - sm(0.745, 0.768, y)) * sm(-0.03, 0.03, z);
    trunk[IDX.jaw] += trunk[IDX.head] * jw; trunk[IDX.head] *= 1 - jw;
  }

  // 팔: y > 0.34, |x|가 클수록 어깨→팔로
  const arm = y > 0.34 ? sm(0.2, 0.32, ax) * sm(0.34, 0.4, y) : 0;
  const sEl = sm(0.46, 0.62, ax);
  const armW = side === 'r' ? { s: IDX.rShoulder, e: IDX.rElbow } : { s: IDX.lShoulder, e: IDX.lElbow };

  // 다리: y < 0.04
  const leg = 1 - sm(-0.12, 0.04, y);
  const toRight = 1 - sm(-0.03, 0.03, x); // 중심선 부근은 양쪽 다리를 섞음
  const sKnee = sm(-0.38, -0.54, y);
  const legTrunk = leg > 0 ? leg : 0;

  const wTrunk = (1 - arm) * (1 - legTrunk);
  for (let i = 0; i < w.length; i++) w[i] += trunk[i] * wTrunk;
  w[armW.s] += arm * (1 - sEl);
  w[armW.e] += arm * sEl;
  if (legTrunk > 0) {
    // 몸통 쪽(pelvis)과 다리가 섞일 때 trunk 가중치는 이미 위에서 (1-leg) 비율로 들어갔다.
    const r = toRight, l = 1 - toRight;
    w[IDX.rHip] += legTrunk * r * (1 - sKnee); w[IDX.rKnee] += legTrunk * r * sKnee;
    w[IDX.lHip] += legTrunk * l * (1 - sKnee); w[IDX.lKnee] += legTrunk * l * sKnee;
  }
  return w;
}

// 베이스컬러 텍스처에서 정점 색을 읽어 피부색 여부를 판정 (목 주변 칼라 구분용)
function makeSkinSampler(material) {
  try {
    const img = material.map && material.map.image;
    if (!img) return null;
    const W = 1024, H = 1024;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    return (u, v) => {
      const px = Math.min(W - 1, Math.max(0, Math.floor((u - Math.floor(u)) * W)));
      const py = Math.min(H - 1, Math.max(0, Math.floor((v - Math.floor(v)) * H)));
      const o = (py * W + px) * 4; const r = d[o], gg = d[o + 1], b = d[o + 2];
      return r > 90 && r > gg + 8 && gg > b - 4 && r - b > 28;
    };
  } catch (e) { return null; }
}

export function buildSkinnedMan(gltfScene) {
  let src = null;
  gltfScene.traverse((o) => { if (o.isMesh && !src) src = o; });
  const geo = src.geometry.clone();
  geo.applyMatrix4(src.matrixWorld);
  const pos = geo.attributes.position;
  const n = pos.count;
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const cloth = new Float32Array(n); // 1 = 옷(환자복 색으로 바꿀 영역)
  const isSkin = makeSkinSampler(src.material);
  const uv = geo.attributes.uv;
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const skin = !(isSkin && uv && y > 0.6 && y < 0.8) || isSkin(uv.getX(i), uv.getY(i));
    const w = weightsFor(x, y, z, skin);
    // 상위 4개만 남기고 정규화
    const order = Array.from(w.keys()).sort((a, b) => w[b] - w[a]).slice(0, 4);
    let sum = 0; for (const k of order) sum += w[k];
    if (sum < 1e-6) { order[0] = IDX.pelvis; w[IDX.pelvis] = 1; sum = 1; }
    for (let k = 0; k < 4; k++) {
      const b = order[k];
      skinIndex[i * 4 + k] = b; skinWeight[i * 4 + k] = (w[b] || 0) / sum;
    }
    // 옷 영역: 머리·목·손·신발은 제외
    const ax = Math.abs(x);
    const isHand = ax > 0.8 && y > 0.3;
    const isHead = y > 0.72;
    const isShoe = y < -0.81;
    // 목 아래 V자(셔츠 칼라)는 옷으로 둔다
    // 목·가슴 노출부 피부는 옷으로 칠하지 않는다 (텍스처 색으로 판정)
    const bareSkin = isSkin && uv && y > 0.5 && isSkin(uv.getX(i), uv.getY(i));
    cloth[i] = isHand || isHead || isShoe || bareSkin ? 0 : 1;
  }
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  geo.setAttribute('cloth', new THREE.BufferAttribute(cloth, 1));

  // 뼈대
  const bones = {};
  for (const name of ORDER) {
    const b = new THREE.Bone(); b.name = name; bones[name] = b;
  }
  for (const name of ORDER) {
    const p = PARENT[name];
    const jp = J[name], pp = p ? J[p] : [0, 0, 0];
    bones[name].position.set(jp[0] - pp[0], jp[1] - pp[1], jp[2] - pp[2]);
    if (p) bones[p].add(bones[name]);
  }
  const list = ORDER.map((n) => bones[n]);
  const mat = src.material;
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.add(bones.pelvis);
  mesh.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  mesh.bind(skeleton, new THREE.Matrix4());
  return { mesh, bones, skeleton };
}

// 옷 영역을 환자복 느낌으로 칠하는 셰이더 보강 (원본 사복 텍스처의 주름·질감은 노멀맵으로 유지)
export function applyGownLook(material, { gown = true } = {}) {
  material.metalness = 0.0; material.roughness = 0.9;
  if (material.metalnessMap) { material.metalnessMap = null; }
  if (material.roughnessMap) { material.roughnessMap = null; }
  material.needsUpdate = true;
  if (!gown) return;
  material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float cloth; varying float vCloth; varying vec3 vObjPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCloth = cloth; vObjPos = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vCloth; varying vec3 vObjPos;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          // 연한 청록 환자복 + 작은 격자 무늬
          vec2 g = fract(vObjPos.xy * 38.0 + vObjPos.zz * 11.0) - 0.5;
          float dots = smoothstep(0.30, 0.22, length(g));
          vec3 gownC = mix(vec3(0.80, 0.90, 0.93), vec3(0.62, 0.78, 0.86), dots * 0.55);
          gownC *= 0.78 + 0.42 * lum; // 원본 명암(주름)을 약하게 남김
          diffuseColor.rgb = mix(diffuseColor.rgb, gownC, vCloth);
          // 턱·목 앞의 어두운 그림자/수염 자국 완화: 어두운 텍셀을 피부색 쪽으로 끌어올린다
          float chinM = smoothstep(0.60, 0.66, vObjPos.y) * (1.0 - smoothstep(0.745, 0.775, vObjPos.y)) * smoothstep(-0.03, 0.03, vObjPos.z) * (1.0 - vCloth);
          vec3 skinT = vec3(0.74, 0.55, 0.46) * (0.78 + 0.5 * lum);
          diffuseColor.rgb = mix(diffuseColor.rgb, skinT, chinM * smoothstep(0.42, 0.12, lum) * 0.85);
        }`);
  };
}

export async function loadMan(url, opts = {}) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const m = buildSkinnedMan(gltf.scene);
  applyGownLook(m.mesh.material, opts);
  return m;
}
