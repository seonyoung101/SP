// 패널 4종: 간호 수행 메뉴 / 상황 정보 / 대화 자막 / 폼(시작·Nu-DESC·SBAR·read-back·결과)
import { Panel, C, FONT, wrapText, fitText, roundRect } from './ui.js';
import { META, TABS, ACTION_META, NUDESC_ITEMS, SBAR, ORDER, READBACK } from './scenario-data.js';

const pad2 = (n) => String(n).padStart(2, '0');
export const fmt = (sec) => `${pad2(Math.floor(sec / 60))}:${pad2(Math.floor(sec % 60))}`;

export function createPanels(app) {
  const { sc, ui } = app;

  // ---------------------------------------------------------------- 메뉴
  const menu = new Panel({
    name: 'menu', width: 0.75, height: 1.0, px: 768,
    draw(ctx, p) {
      p.frame(ctx, '간호 수행 선택');
      const tabW = (768 - 40) / 4;
      TABS.forEach((t, i) => {
        p.button(ctx, `tab${i}`, 20 + i * tabW, 76, tabW - 6, 64, t.label, {
          align: 'center', size: 28, selected: ui.tab === i, fill: ui.tab === i ? '#2c5a99' : undefined,
          onClick: () => { ui.tab = i; app.invalidate(); },
        });
      });
      let y = 158;
      for (const a of ACTION_META.filter((x) => x.tab === ui.tab)) {
        const done = sc.done.has(a.id) && a.id !== 'finish' && !['restraint', 'deny'].includes(a.id) ? true : (['restraint', 'deny'].includes(a.id) && sc.done.has(a.id));
        p.button(ctx, a.id, 20, y, 728, 92, a.label, {
          hint: a.hint, done, onClick: () => app.act(a.id),
        });
        y += 100;
      }
    },
  });

  // ---------------------------------------------------------------- 상황 정보
  const status = new Panel({
    name: 'status', width: 0.75, height: 1.0, px: 768,
    draw(ctx, p) {
      p.frame(ctx, '상황 정보');
      ctx.textAlign = 'right'; ctx.fillStyle = C.muted; ctx.font = `22px ${FONT}`;
      ctx.fillText(sc.practice ? '연습 모드(시간 제한 없음)' : '러닝 10분', 736, 54);
      ctx.textAlign = 'left';

      // 타이머
      const low = sc.started && sc.remaining <= 180;
      ctx.fillStyle = low ? C.warn : C.text; ctx.font = `bold 88px ${FONT}`;
      ctx.fillText(sc.started ? fmt(sc.practice ? sc.t : sc.remaining) : '--:--', 32, 160);
      ctx.fillStyle = C.muted; ctx.font = `22px ${FONT}`;
      ctx.fillText(sc.practice ? '경과 시간' : '남은 시간', 36, 192);

      // 단계
      const pw = (768 - 40) / 4;
      META.phases.forEach((ph, i) => {
        const cur = sc.started && !sc.ended && sc.phase.id === ph.id;
        roundRect(ctx, 20 + i * pw, 212, pw - 8, 56, 10);
        ctx.fillStyle = cur ? '#2c5a99' : '#14233a'; ctx.fill();
        ctx.strokeStyle = cur ? '#bfe0ff' : '#2a4468'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = cur ? C.text : C.muted; ctx.font = `bold 18px ${FONT}`; ctx.textAlign = 'center';
        const lines = wrapText(ctx, ph.label, pw - 24);
        lines.slice(0, 2).forEach((ln, j) => ctx.fillText(ln, 20 + i * pw + (pw - 8) / 2, 238 + j * 22 - (lines.length > 1 ? 8 : -4)));
        ctx.textAlign = 'left';
      });

      if (sc.alerted && !sc.ended) {
        roundRect(ctx, 20, 282, 728, 52, 10); ctx.fillStyle = '#6b4310'; ctx.fill();
        ctx.fillStyle = C.warn; ctx.font = `bold 28px ${FONT}`; ctx.textAlign = 'center';
        ctx.fillText('⏰ 종료 3분 전', 384, 318); ctx.textAlign = 'left';
      }

      // 정보 카드 (최근 것이 위)
      let y = 352;
      const bottom = 868;
      const cards = [...ui.cards].reverse();
      if (!cards.length) {
        ctx.fillStyle = C.muted; ctx.font = `22px ${FONT}`;
        ctx.fillText('수행 결과(활력징후·사정 등)가 여기에 쌓입니다.', 32, y + 30);
      }
      for (const card of cards) {
        const h = 44 + card.rows.length * 31 + 12;
        if (y + h > bottom) break;
        roundRect(ctx, 20, y, 728, h, 12); ctx.fillStyle = '#112340'; ctx.fill();
        ctx.strokeStyle = '#2a4468'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = C.accent; ctx.font = `bold 24px ${FONT}`; ctx.fillText(card.title, 36, y + 33);
        ctx.font = `22px ${FONT}`;
        card.rows.forEach(([k, v], i) => {
          ctx.fillStyle = C.muted; ctx.fillText(k, 40, y + 66 + i * 31);
          ctx.fillStyle = C.text; ctx.fillText(fitText(ctx, v, 480), 240, y + 66 + i * 31);
        });
        y += h + 10;
      }

      // 토스트
      if (ui.toast && ui.toast.until > performance.now()) {
        roundRect(ctx, 20, 878, 728, 54, 10); ctx.fillStyle = '#5a1f24'; ctx.fill();
        ctx.fillStyle = '#ffd0d0'; ctx.font = `bold 22px ${FONT}`;
        ctx.fillText(fitText(ctx, ui.toast.text, 690), 34, 913);
      } else if (ui.debug) {
        ctx.fillStyle = C.muted; ctx.font = `20px ${FONT}`;
        ctx.fillText(`[debug] 정서 강도 ${sc.emotion.toFixed(1)} · 환시 ${sc.hallucinating}`, 32, 912);
      }

      // 하단 버튼
      p.button(ctx, 'voice', 20, 944, 232, 62, ui.voice ? '🔊 음성 켜짐' : '🔇 음성 꺼짐', { size: 22, align: 'center', onClick: () => app.toggleVoice() });
      if (sc.ended) p.button(ctx, 'report', 262, 944, 232, 62, '결과 보기', { size: 22, align: 'center', onClick: () => app.openForm({ type: 'report' }) });
      p.button(ctx, 'restart', 516, 944, 232, 62, '처음부터', { size: 22, align: 'center', onClick: () => app.restart() });
    },
  });

  // ---------------------------------------------------------------- 자막
  const transcript = new Panel({
    name: 'transcript', width: 3.0, height: 0.95, px: 1600,
    draw(ctx, p) {
      p.frame(ctx);
      const font = `bold 40px ${FONT}`;
      ctx.font = font;
      const lines = [];
      for (const e of ui.transcript) {
        const who = { nurse: '간호사', patient: '김두두', doctor: '당직의', system: '' }[e.who];
        const col = C[e.who] || C.text;
        const wrapped = wrapText(ctx, who ? `${who}: ${e.text}` : `※ ${e.text}`, 1500);
        wrapped.forEach((ln, i) => lines.push({ text: i ? `   ${ln}` : ln, col }));
      }
      const lh = 54;
      const max = Math.floor((p.pxH - 56) / lh);
      const shown = lines.slice(-max);
      shown.forEach((l, i) => { ctx.fillStyle = l.col; ctx.fillText(l.text, 50, 66 + i * lh); });
      if (!shown.length) { ctx.fillStyle = C.muted; ctx.fillText('대화와 수행 기록이 여기에 표시됩니다.', 50, 66); }
    },
  });

  // ---------------------------------------------------------------- 폼
  const form = new Panel({
    name: 'form', width: 1.1, height: 1.1846, px: 1024, solid: true,
    draw(ctx, p) {
      const f = ui.form;
      if (!f) return;
      ({ intro: drawIntro, nudesc: drawNuDesc, sbar: drawSbar, readback: drawReadback, report: drawReport })[f.type](ctx, p, f);
    },
  });

  function para(ctx, text, x, y, maxW, size, color, lh = 1.45, bold = false) {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`; ctx.fillStyle = color;
    for (const ln of wrapText(ctx, text, maxW)) { ctx.fillText(ln, x, y); y += size * lh; }
    return y;
  }

  function drawIntro(ctx, p) {
    p.frame(ctx, META.subtitle);
    let y = 112;
    y = para(ctx, META.title, 40, y, 940, 38, C.text, 1.3, true) + 8;
    y = para(ctx, '상황 설정', 40, y + 8, 940, 26, C.accent, 1.4, true);
    y = para(ctx, META.situation, 40, y, 940, 25, C.text);
    y = para(ctx, META.role, 40, y + 4, 940, 25, C.warn);
    y = para(ctx, '환자 정보', 40, y + 14, 940, 26, C.accent, 1.4, true);
    for (const b of META.background) y = para(ctx, `· ${b}`, 40, y, 940, 23, C.text, 1.4);
    y = para(ctx, '학습 목표', 40, y + 14, 940, 26, C.accent, 1.4, true);
    META.objectives.forEach((o, i) => { y = para(ctx, `${i + 1}. ${o}`, 40, y, 940, 23, C.text, 1.4); });
    y = para(ctx, '조작', 40, y + 14, 940, 26, C.accent, 1.4, true);
    y = para(ctx, 'VR: 컨트롤러 레이로 가리키고 트리거(검지) · PC: 마우스 클릭, 드래그로 둘러보기\n좌측 메뉴에서 간호 수행을 고르고, 우측 패널에서 결과와 남은 시간을 확인합니다.', 40, y, 940, 22, C.muted, 1.4);
    p.button(ctx, 'start', 262, p.pxH - 130, 500, 90, '시뮬레이션 시작', { align: 'center', size: 36, fill: '#1f6f3f', onClick: () => app.startSim() });
  }

  function drawNuDesc(ctx, p, f) {
    p.frame(ctx, 'Nu-DESC 채점');
    para(ctx, '방금 관찰한 환자의 행동을 항목별로 0(없음) · 1(약함) · 2(뚜렷함)로 채점하세요.', 36, 100, 950, 22, C.muted, 1.35);
    let y = 170;
    NUDESC_ITEMS.forEach((it) => {
      roundRect(ctx, 28, y, 968, 110, 12); ctx.fillStyle = '#112340'; ctx.fill();
      ctx.fillStyle = C.text; ctx.font = `bold 30px ${FONT}`; ctx.fillText(it.label, 48, y + 46);
      ctx.fillStyle = C.muted; ctx.font = `21px ${FONT}`; ctx.fillText(it.hint, 48, y + 82);
      [0, 1, 2].forEach((v, i) => {
        const sel = f.scores[it.id] === v;
        p.button(ctx, `nd_${it.id}_${v}`, 620 + i * 124, y + 18, 112, 74, String(v), {
          align: 'center', size: 34, selected: sel, fill: sel ? '#2c8a57' : undefined,
          onClick: () => { f.scores[it.id] = v; app.invalidate(); },
        });
      });
      y += 122;
    });
    const all = NUDESC_ITEMS.every((it) => f.scores[it.id] !== undefined);
    const total = sc.nudescTotal(f.scores);
    ctx.fillStyle = C.text; ctx.font = `bold 38px ${FONT}`;
    ctx.fillText(`총점 ${total}점`, 48, y + 52);
    ctx.fillStyle = total >= 2 ? C.warn : C.ok;
    ctx.fillText(all ? (total >= 2 ? '→ 섬망 선별 양성 (2점 이상)' : '→ 음성') : '→ 5개 항목을 모두 채점하세요', 300, y + 52);
    p.button(ctx, 'nd_submit', 262, p.pxH - 110, 300, 76, '채점 제출', { align: 'center', size: 30, disabled: !all, fill: all ? '#1f6f3f' : undefined, onClick: () => app.submitNuDesc(f.scores) });
    p.button(ctx, 'nd_close', 586, p.pxH - 110, 176, 76, '닫기', { align: 'center', size: 28, onClick: () => app.closeForm() });
  }

  function drawSbar(ctx, p, f) {
    p.frame(ctx, '당직의에게 SBAR 보고');
    ctx.fillStyle = C.muted; ctx.font = `21px ${FONT}`;
    ctx.fillText('보고에 포함할 내용을 모두 고르세요. (사실과 다른 내용은 고르지 마세요)', 36, 92);
    let y = 112;
    for (const [k, sec] of Object.entries(SBAR)) {
      ctx.fillStyle = C.accent; ctx.font = `bold 26px ${FONT}`; ctx.fillText(sec.label, 40, y + 34);
      y += 46;
      for (const opt of sec.options) {
        const on = f.sel.has(opt.id);
        const text = sc.sbarText(opt);
        p.button(ctx, `sb_${opt.id}`, 28, y, 968, 42, `${on ? '☑' : '☐'}  ${text}`, {
          size: 21, bold: false, selected: on, fill: on ? '#1d4a7a' : undefined, onClick: () => { on ? f.sel.delete(opt.id) : f.sel.add(opt.id); app.invalidate(); },
        });
        y += 46;
      }
      y += 6;
      void k;
    }
    p.button(ctx, 'sb_submit', 212, p.pxH - 98, 340, 70, '전화 보고하기', { align: 'center', size: 30, disabled: !f.sel.size, fill: f.sel.size ? '#1f6f3f' : undefined, onClick: () => app.submitSBAR(f.sel) });
    p.button(ctx, 'sb_close', 576, p.pxH - 98, 200, 70, '닫기', { align: 'center', size: 28, onClick: () => app.closeForm() });
  }

  function drawReadback(ctx, p) {
    p.frame(ctx, '구두 처방 read-back');
    let y = para(ctx, '당직의가 전화로 처방을 불러 주었습니다. 들은 내용을 정확히 복창해 확인하세요.', 36, 100, 950, 24, C.muted, 1.4);
    roundRect(ctx, 28, y + 8, 968, 150, 12); ctx.fillStyle = '#112340'; ctx.fill();
    ctx.fillStyle = C.doctor; ctx.font = `bold 24px ${FONT}`; ctx.fillText('당직의', 48, y + 46);
    para(ctx, `“${ORDER.say}”`, 48, y + 84, 920, 25, C.text, 1.4);
    y += 190;
    for (const opt of READBACK) {
      p.button(ctx, `rb_${opt.id}`, 28, y, 968, 150, opt.text, { wrap: 3, size: 25, bold: false, onClick: () => app.submitReadback(opt.id) });
      y += 164;
    }
    p.button(ctx, 'rb_close', 412, p.pxH - 98, 200, 70, '닫기', { align: 'center', size: 28, onClick: () => app.closeForm() });
  }

  function drawReport(ctx, p, f) {
    const r = f.report;
    p.frame(ctx, '수행 결과 (자동 채점 초안)');
    ctx.fillStyle = C.text; ctx.font = `bold 54px ${FONT}`;
    ctx.fillText(`${r.total} / ${r.max}점`, 40, 130);
    ctx.fillStyle = C.muted; ctx.font = `22px ${FONT}`;
    ctx.fillText(`소요 ${fmt(r.timeSec)} · 비약물적 중재 ${r.nonpharmCount}가지`, 330, 100);
    ctx.fillText(r.objectives.map((o) => `목표${o.obj} ${o.score}/${o.max}`).join('   '), 330, 134);
    let y = 160;
    ctx.fillStyle = '#2a4468'; ctx.fillRect(28, y, 968, 2); y += 6;
    for (const it of r.items) {
      ctx.fillStyle = C.muted; ctx.font = `20px ${FONT}`; ctx.fillText(String(it.n).padStart(2, ' '), 40, y + 36);
      ctx.fillStyle = it.score >= 2 ? C.text : C.warn; ctx.font = `bold 23px ${FONT}`;
      ctx.fillText(fitText(ctx, it.label, 420), 84, y + 36);
      ctx.fillStyle = C.muted; ctx.font = `18px ${FONT}`;
      if (it.note) ctx.fillText(fitText(ctx, it.note, 370), 520, y + 36);
      ctx.textAlign = 'right'; ctx.fillStyle = it.score >= 2 ? C.ok : it.score === 1 ? C.warn : C.bad; ctx.font = `bold 26px ${FONT}`;
      ctx.fillText(`${it.score}/${it.max}`, 980, y + 36);
      ctx.textAlign = 'left';
      y += 52;
    }
    ctx.fillStyle = C.muted; ctx.font = `19px ${FONT}`;
    para(ctx, '※ 학습자 연습용 자동 판정입니다. 최종 평가는 교수자 체크리스트로 확인합니다.', 40, y + 24, 940, 19, C.muted, 1.4);
    p.button(ctx, 'rp_again', 212, p.pxH - 98, 340, 70, '다시 해 보기', { align: 'center', size: 30, fill: '#1f6f3f', onClick: () => app.restart() });
    p.button(ctx, 'rp_close', 576, p.pxH - 98, 200, 70, '닫기', { align: 'center', size: 28, onClick: () => app.closeForm() });
  }

  return { menu, status, transcript, form, all: [menu, status, transcript, form] };
}
