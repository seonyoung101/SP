// 캔버스 → 3D 패널. VR 컨트롤러 레이와 마우스가 같은 방식으로 버튼을 누른다.
import * as THREE from 'three';

export const FONT = '"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo","Nanum Gothic",sans-serif';
export const C = {
  bg: 'rgba(12,22,38,0.94)', border: '#2f5d9a', text: '#eaf2ff', muted: '#9db3d1', accent: '#4fa3ff',
  btn: '#1b3354', btnHover: '#2c5a99', btnDone: '#16273f', ok: '#5fd68a', warn: '#ffb04a', bad: '#ff6b6b',
  nurse: '#8cc4ff', patient: '#ffb27a', doctor: '#7be0a0', system: '#9db3d1',
};

export function wrapText(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const ch of para) {
      const test = line + ch;
      if (line && ctx.measureText(test).width > maxW) { lines.push(line); line = ch === ' ' ? '' : ch; } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

export function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Panel {
  constructor({ name, width, height, px = 768, draw, solid = false }) {
    this.solid = solid;
    this.name = name;
    this.width = width;
    this.height = height;
    this.pxW = px;
    this.pxH = Math.round((px * height) / width);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.pxW;
    this.canvas.height = this.pxH;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, toneMapped: false }),
    );
    this.mesh.name = `panel:${name}`;
    this.mesh.userData.panel = this;
    this.drawFn = draw;
    this.buttons = [];
    this.hoverKey = null;
    this.dirty = true;
  }

  invalidate() { this.dirty = true; }

  update() {
    if (!this.dirty || !this.mesh.visible) return;
    this.dirty = false;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.pxW, this.pxH);
    this.buttons = [];
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    this.drawFn(ctx, this);
    this.texture.needsUpdate = true;
  }

  // 배경 + 테두리
  frame(ctx, title) {
    roundRect(ctx, 4, 4, this.pxW - 8, this.pxH - 8, 22);
    ctx.fillStyle = this.solid ? '#0c1626' : C.bg; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = C.border; ctx.stroke();
    if (title) {
      ctx.fillStyle = C.accent; ctx.font = `bold 30px ${FONT}`; ctx.textAlign = 'left';
      ctx.fillText(title, 32, 56);
    }
  }

  // 버튼을 그리고 등록한다
  button(ctx, key, x, y, w, h, label, o = {}) {
    const hover = this.hoverKey === key && !o.disabled;
    roundRect(ctx, x, y, w, h, 14);
    ctx.fillStyle = o.fill || (o.disabled ? C.btnDone : hover ? C.btnHover : o.done ? C.btnDone : C.btn);
    ctx.fill();
    ctx.lineWidth = hover ? 4 : 2;
    ctx.strokeStyle = hover ? '#bfe0ff' : o.selected ? C.accent : '#34527d';
    ctx.stroke();
    ctx.textAlign = o.align || 'left';
    const pad = 20;
    const tx = o.align === 'center' ? x + w / 2 : x + pad;
    const maxW = w - pad * 2 - (o.done ? 40 : 0);
    ctx.fillStyle = o.done || o.disabled ? C.muted : C.text;
    ctx.font = `${o.bold === false ? '' : 'bold '}${o.size || 28}px ${FONT}`;
    if (o.wrap) {
      const lines = wrapText(ctx, label, maxW).slice(0, o.wrap);
      const lh = (o.size || 28) + 8;
      const top = y + (h - lines.length * lh) / 2 + (o.size || 28);
      lines.forEach((ln, i) => ctx.fillText(ln, tx, top + i * lh - 4));
    } else if (o.hint) {
      ctx.fillText(fitText(ctx, label, maxW), tx, y + 40);
      ctx.fillStyle = C.muted; ctx.font = `20px ${FONT}`;
      ctx.fillText(fitText(ctx, o.hint, maxW), tx, y + 72);
    } else {
      ctx.fillText(fitText(ctx, label, maxW), tx, y + h / 2 + (o.size || 28) * 0.35);
    }
    if (o.done) {
      ctx.fillStyle = C.ok; ctx.font = `bold 34px ${FONT}`; ctx.textAlign = 'right';
      ctx.fillText('✓', x + w - 18, y + 46);
    }
    ctx.textAlign = 'left';
    if (!o.disabled) this.buttons.push({ key, x, y, w, h, onClick: o.onClick });
  }

  hitTest(uv) {
    const x = uv.x * this.pxW;
    const y = (1 - uv.y) * this.pxH;
    return this.buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;
  }

  setHover(btn) {
    const key = btn ? btn.key : null;
    if (key !== this.hoverKey) { this.hoverKey = key; this.dirty = true; }
  }
}
