// 시나리오 엔진 — three.js·DOM에 의존하지 않는 순수 로직 (node로 테스트 가능)
import {
  META, SHOUT, OPENING, ACTION_META, NUDESC_ITEMS, SBAR, SBAR_NEED_CORRECT, ORDER, READBACK, EMOTION,
} from './scenario-data.js';

const P = (text, tag) => ({ who: 'patient', text, tag });
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const NONPHARM = ['reorient', 'validate', 'explainUrine', 'callWife'];
const LABEL = Object.fromEntries(ACTION_META.map((a) => [a.id, a.label]));

// 각 수행의 동작 정의
//  gate(s): 문자열을 돌려주면 수행 불가(사유), run(s): 결과, opens: 패널을 여는 수행, repeat: 반복 가능
const ACTIONS = {
  handwash: { run: () => ({ nurse: '손 위생을 시행한다.', patient: [] }) },
  identify: {
    run: () => ({
      nurse: '“성함과 등록번호를 말씀해 주시겠어요?” 하며 환자를 확인한다.',
      patient: [P('내 이름은 왜 물어?! 김두두! 빨리 이거나 해결해 줘!')],
    }),
  },
  intro: {
    run: (s) => {
      s.lightOn = true;
      return {
        nurse: '조명을 켜고 눈높이를 맞춰 자기소개를 한다. “김두두 님, 담당 간호사입니다.”',
        patient: [P('(말없이 쳐다만 본다.)')],
      };
    },
  },
  stopIV: {
    run: (s) => {
      s.bleeding = false; s.gauze = true; s.ivRunning = false;
      return {
        nurse: '수액 주입을 멈추고 장갑을 낀 뒤 멸균 거즈로 압박 지혈하며 카테터 끝이 온전한지 확인한다.',
        patient: [P('(피 묻은 오른팔을 보며, 흥분한 어조로) 아니 이게 뭐냐니까? 이거 단단히 잘못됐어. 당신들이 날 이렇게 만들었어! 죽게 만들었어!')],
        info: { title: '출혈 처치', rows: [['삽입 부위', '출혈 → 압박 지혈'], ['카테터 끝', '온전함']] },
      };
    },
  },
  organizeFoley: {
    run: (s) => {
      s.foleyOrganized = true;
      return {
        nurse: '소변줄을 잡아당기지 않도록 정리한다.',
        patient: [P('(안절부절 못하며, 소변줄을 만지작거리며) 이건 또 뭐야? 배가 너무 아파. 불편하다고! 빨리 빼줘!', '부적절한 행동')],
      };
    },
  },
  bedLow: {
    run: (s) => {
      s.bedLow = true; s.railUp = true;
      return { nurse: '낙상 예방을 위해 침대를 가장 낮추고 난간을 올린다.', patient: [] };
    },
  },

  orientation: {
    run: () => ({
      nurse: '“성함이 어떻게 되세요? 여기가 어디인지, 지금이 언제인지 아시나요?”',
      patient: [
        P('(천장 구석을 손으로 휘저으며) 저기 벌레가 기어 다니잖아. 안보여? 빨리 잡아!', '착각/환각'),
        P('김두두.'),
        P('여기? 우리 집 아니야?', '지남력'),
        P('지금이 밤인지 아침인지 모르겠어. (소변줄을 가리키며) 이거나 빨리 빼줘!!', '지남력'),
        P('당신 누군지 모르지. 나 힘들게 하는 사람이야.', '지남력'),
      ],
    }),
  },
  compareRecord: {
    gate: (s) => (s.done.has('orientation') ? null : '먼저 현재 지남력을 확인하세요.'),
    run: () => ({
      nurse: '입원 기록과 비교해 급성 변화를 확인한다.',
      patient: [],
      info: { title: '입원 기록 비교', rows: [['입원 시', '지남력 정상'], ['현재', '지남력 저하 → 급성 변화']] },
    }),
  },
  vitals: {
    run: () => ({
      nurse: '활력징후와 산소포화도를 측정한다.',
      patient: [P('(화난 목소리로) 혈압은 왜 자꾸 재는거에요?!! (횡설수설하며) 버스에 돈을 아니 저기 소가 있어서 그렇지', '부적절한 의사소통')],
      info: {
        title: '활력징후',
        rows: [['체온', '38.4 ℃'], ['혈압', '148/86 mmHg'], ['맥박', '106 회/분'], ['호흡', '22 회/분'], ['SpO₂', '95 % (room air)']],
      },
    }),
  },
  assessBladder: {
    run: () => ({
      nurse: '통증과 배뇨 상태를 사정한다. 하복부를 확인하고 Foley 연결 상태를 살핀다.',
      patient: [P('(소변줄을 만지작거리며) 이거나 빨리 빼줘요! 소변이 마려운데 안나와. 배 아프다고!')],
      info: {
        title: '배뇨 사정',
        rows: [['하복부', '팽만, 통증 호소'], ['소변량', '22시 이후 50 mL'], ['Foley', '둔부 아래에서 꺾여 있음']],
      },
    }),
  },
  fixKink: {
    gate: (s) => (s.done.has('assessBladder') ? null : '먼저 통증과 배뇨 상태를 사정하세요.'),
    run: (s) => {
      s.kinked = false; s.urineFlowing = true;
      s.emotion = clamp(s.emotion - 2, EMOTION.floor, 10);
      return {
        nurse: 'Foley가 꺾인 부분을 펴 준다.',
        patient: [P('(소변이 나오기 시작하자 고함을 멈추고 난간을 놓는다.)')],
        info: { title: 'Foley', rows: [['상태', '꺾임 해소, 소변 배출 시작']] },
      };
    },
  },
  neuro: {
    run: () => ({
      nurse: '동공과 사지 근력을 확인해 새로운 신경학적 변화를 사정한다.',
      patient: [],
      info: { title: '신경학적 사정', rows: [['동공', '동일, 대광반사 정상'], ['좌측 상지', 'Grade 4 (기존과 동일)'], ['새 편측 위약', '없음']] },
    }),
  },
  nudesc: { opens: 'nudesc' },

  reorient: {
    repeat: true,
    run: (s) => {
      const first = !s.done.has('reorient');
      if (first) s.emotion = clamp(s.emotion - 1, EMOTION.floor, 10);
      return {
        nurse: '“김두두 님, 여기는 병원이에요. 지금은 새벽 2시예요.” 이름을 부르며 짧은 문장으로 알려 준다.',
        patient: [P('병원? 내가 왜 병원에 있어? 나 아픈데 없어')],
      };
    },
  },
  validate: {
    run: (s) => {
      s.emotion = clamp(s.emotion - 1, EMOTION.floor, 10);
      return {
        nurse: '“많이 놀라셨죠. 벌레가 보여서 무서우셨겠어요.” 환시를 반박하지 않고 감정을 인정한다.',
        patient: [P('응? 아까 벌레 보인다고 했어? 벌레는 없나?')],
      };
    },
  },
  explainUrine: {
    gate: (s) => (s.urineFlowing ? null : '아직 소변이 나오지 않습니다. 원인을 먼저 해결하세요.'),
    run: (s) => {
      s.emotion = clamp(s.emotion - 1, EMOTION.floor, 10);
      return {
        nurse: '소변이 나오는 것을 함께 확인하며 “소변줄이 꺾여 있어서 배가 아프셨어요” 하고 설명한다.',
        patient: [P('아이고, 배가 좀 낫다.')],
        info: { title: '배뇨', rows: [['소변', '배출 시작'], ['하복부 팽만', '완화']] },
      };
    },
  },
  reinsertIV: {
    gate: (s) => (s.done.has('stopIV') ? null : '먼저 출혈을 처치하세요.'),
    run: (s) => {
      s.ivBack = true; s.ivRunning = true;
      return { nurse: '제거된 정맥 주사를 다시 놓는다.', patient: [P('주사 맞아야해? 지금 열이 나?')] };
    },
  },
  callWife: {
    run: (s) => {
      s.emotion = clamp(s.emotion - 0.5, EMOTION.floor, 10);
      return {
        nurse: '“아내분께 연락드려 볼까요?” 보호자 연락을 제안한다.',
        patient: [P('우리 마누라한테 전화 좀 해줘.')],
      };
    },
  },
  restraint: {
    run: (s) => {
      s.restraint = true; s.emotion = clamp(s.emotion + 2, EMOTION.floor, 10);
      return {
        nurse: '환자의 손목에 신체보호대를 적용한다.',
        // [가정] 오답 경로 대사는 원 대본에 없음
        patient: [P('이거 풀어! 묶지 마! 사람 죽이네!')],
      };
    },
  },
  deny: {
    run: (s) => {
      s.denied = true; s.emotion = clamp(s.emotion + 1.5, EMOTION.floor, 10);
      return {
        nurse: '“벌레는 없어요. 잘못 보신 거예요.” 하고 바로잡는다.',
        // [가정] 오답 경로 대사는 원 대본에 없음
        patient: [P('있잖아! 저기! 당신도 한패지?!')],
      };
    },
  },

  sbar: { opens: 'sbar' },
  readback: {
    gate: (s) => (s.order ? null : '아직 받은 구두 처방이 없습니다. 먼저 SBAR로 보고하세요.'),
    opens: 'readback',
  },
  antipyretic: {
    gate: (s) => {
      if (!s.order) return '투여할 처방이 없습니다.';
      if (!s.readbackOk) return '구두 처방은 read-back으로 확인한 뒤 투여합니다.';
      return null;
    },
    run: (s) => {
      s.antipyreticGiven = true;
      return {
        nurse: `처방난 해열제를 투여한다. (${ORDER.drug} ${ORDER.dose} ${ORDER.route} ${ORDER.freq})`,
        patient: [],
        info: { title: '투약', rows: [[ORDER.drug, `${ORDER.dose} ${ORDER.route}`], ['추적', ORDER.followup]] },
      };
    },
  },
  chart: {
    gate: (s) => (s.readbackOk ? null : '구두 처방은 read-back 확인 후 기록합니다.'),
    run: (s) => {
      s.charted = true;
      return { nurse: '구두 처방 내용(약명·용량·경로·횟수·처방자·시간)을 기록한다.', patient: [] };
    },
  },
  reassess: {
    run: (s) => {
      s.reassessed = true;
      const ok = s.sufficient();
      s.emotion = ok ? EMOTION.floor : Math.max(s.emotion, 6);
      return {
        nurse: '지남력, 정서적 지지, 낙상 예방 조치를 다시 확인한다.',
        patient: [ok ? P('그래.. 좀 누워있을 게.') : P('집에 갈 거야! 아!!! 아!!', '지남력')],
      };
    },
  },
  finish: { finish: true },
};

export class Scenario {
  constructor({ practice = false } = {}) {
    this.practice = practice;
    this.reset();
  }

  reset() {
    this.t = 0;
    this.started = false;
    this.ended = false;
    this.alerted = false;
    this.idleFired = false;
    this.done = new Set();
    this.firstAt = {};
    this.log = [];
    this.emotion = EMOTION.start;
    // 환경·환자 상태 (3D 장면이 읽는다)
    this.lightOn = false; this.bleeding = true; this.gauze = false; this.ivRunning = true; this.ivBack = false;
    this.kinked = true; this.urineFlowing = false; this.foleyOrganized = false;
    this.bedLow = false; this.railUp = false; this.restraint = false; this.denied = false;
    this.reassessed = false;
    // 보고
    this.nudesc = null; this.sbar = null; this.sbarAttempts = 0;
    this.order = null; this.readbackOk = false; this.readbackFirstWrong = false; this.charted = false;
    this.antipyreticGiven = false;
  }

  start() {
    this.started = true;
    return [
      { who: 'patient', text: SHOUT },
      { who: 'patient', text: `(피 묻은 오른팔을 내밀며) ${OPENING}` },
    ];
  }

  sufficient() {
    return NONPHARM.filter((id) => this.done.has(id)).length >= 3 && !this.restraint;
  }

  get posture() {
    if (this.reassessed) return this.sufficient() ? 'lying' : 'edge';
    return 'half';
  }

  get hallucinating() {
    return this.done.has('orientation') && !this.done.has('validate') && this.emotion > 4.5;
  }

  get phase() {
    return META.phases.find((p) => this.t >= p.from && this.t < p.to) || META.phases[META.phases.length - 1];
  }

  get remaining() { return Math.max(0, META.durationSec - this.t); }

  // 시간 경과: 이벤트 배열 반환
  tick(dt) {
    const events = [];
    if (!this.started || this.ended) return events;
    this.t += dt;
    if (!this.alerted && this.t >= META.alertAtSec) {
      this.alerted = true;
      events.push({ type: 'alert', text: '종료 3분 전입니다.' });
    }
    if (!this.idleFired && this.t >= META.idleLineAtSec && this.done.has('reorient')) {
      this.idleFired = true;
      events.push({ type: 'line', line: P('근데 여기가 어디라고 했지?', '지남력') });
    }
    if (!this.practice && this.t >= META.durationSec) {
      events.push({ type: 'timeup' });
    }
    return events;
  }

  perform(id) {
    const def = ACTIONS[id];
    if (!def) return { ok: false, reason: '알 수 없는 수행입니다.' };
    if (!this.started || this.ended) return { ok: false, reason: '시뮬레이션이 진행 중이 아닙니다.' };
    const why = def.gate && def.gate(this);
    if (why) return { ok: false, reason: why };
    if (def.finish) return { ok: true, finish: true };
    if (def.opens) return { ok: true, panel: def.opens };
    if (this.done.has(id) && !def.repeat) return { ok: false, reason: '이미 수행했습니다.' };
    const first = !this.done.has(id);
    const r = def.run(this);
    this.done.add(id);
    if (first) this.firstAt[id] = this.t;
    this.log.push({ id, t: Math.round(this.t) });
    return { ok: true, nurse: r.nurse, patient: r.patient || [], info: r.info || null };
  }

  // ---- Nu-DESC ----
  nudescTotal(scores) {
    return NUDESC_ITEMS.reduce((sum, it) => sum + (scores[it.id] || 0), 0);
  }

  submitNuDesc(scores) {
    const total = this.nudescTotal(scores);
    this.nudesc = { scores: { ...scores }, total, positive: total >= 2 };
    this.done.add('nudesc');
    this.firstAt.nudesc ??= this.t;
    this.log.push({ id: 'nudesc', t: Math.round(this.t), total });
    return {
      nurse: `Nu-DESC를 채점한다. 총점 ${total}점 → ${total >= 2 ? '섬망 선별 양성' : '음성'}`,
      info: { title: 'Nu-DESC', rows: [...NUDESC_ITEMS.map((it) => [it.label, `${scores[it.id] || 0}점`]), ['총점', `${total}점 (${total >= 2 ? '양성' : '음성'})`]] },
    };
  }

  // ---- SBAR ----
  sbarText(opt) {
    if (opt.nudesc) {
      if (!this.nudesc) return 'Nu-DESC 결과를 보고합니다. (아직 채점하지 않음)';
      return `Nu-DESC 총점 ${this.nudesc.total}점, 섬망 선별 ${this.nudesc.positive ? '양성' : '음성'}입니다.`;
    }
    return opt.text;
  }

  // 선택한 문항이 사실에 부합하는가 (필요한 사정을 하지 않았으면 오답 취급)
  sbarCorrect(opt) {
    if (!opt.ok) return false;
    if (opt.needs && !opt.needs.every((id) => this.done.has(id))) return false;
    if (opt.nudesc && !(this.nudesc && this.nudesc.positive)) return false;
    return true;
  }

  submitSBAR(selectedIds) {
    const sel = new Set(selectedIds);
    const complete = {};
    for (const [k, sec] of Object.entries(SBAR)) {
      let good = 0, bad = 0;
      for (const opt of sec.options) {
        if (!sel.has(opt.id)) continue;
        if (this.sbarCorrect(opt)) good++; else bad++;
      }
      complete[k] = good >= SBAR_NEED_CORRECT && bad === 0;
    }
    this.sbarAttempts++;
    this.sbar = { selected: [...sel], complete, nudescIncluded: sel.has('a1') };
    this.done.add('sbar');
    this.firstAt.sbar ??= this.t;
    this.log.push({ id: 'sbar', t: Math.round(this.t) });

    const lines = [];
    if (sel.has('r1')) {
      this.order = { ...ORDER };
      lines.push({ who: 'doctor', text: ORDER.say });
    } else {
      lines.push({ who: 'doctor', text: '요청하실 내용이 뭐죠? 다시 정리해서 보고해 주세요.' });
    }
    return { nurse: '당직의에게 SBAR로 전화 보고한다.', lines, orderGiven: sel.has('r1') };
  }

  // ---- read-back ----
  submitReadback(choiceId) {
    const opt = READBACK.find((o) => o.id === choiceId);
    if (!opt) return { ok: false };
    if (opt.ok) this.readbackOk = true; else this.readbackFirstWrong = true;
    this.done.add('readback');
    this.firstAt.readback ??= this.t;
    this.log.push({ id: 'readback', t: Math.round(this.t), ok: opt.ok });
    return { nurse: `read-back: “${opt.text}”`, lines: [{ who: 'doctor', text: opt.reply }], ok: opt.ok };
  }

  finish() {
    this.ended = true;
    return this.report();
  }

  // ---- 채점 (교수자 체크리스트 14항목 / 28점의 자동 판정 초안) ----
  report() {
    const has = (id) => this.done.has(id);
    const cnt = (ids) => ids.filter(has).length;
    const miss = (ids) => ids.filter((id) => !has(id)).map((id) => LABEL[id]).join(', ');
    const items = [];
    const add = (n, obj, label, score, note = '') => items.push({ n, obj, label, score, max: 2, note: score >= 2 ? '' : note });

    add(1, 1, '출혈 처치', has('stopIV') ? 2 : 0, '수액 중지·압박 지혈 미수행');
    add(2, 1, '낙상·튜브 안전', cnt(['organizeFoley', 'bedLow']), `미수행: ${miss(['organizeFoley', 'bedLow'])}`);
    add(3, 1, '지남력 질문·입원 기록 비교', cnt(['orientation', 'compareRecord']), `미수행: ${miss(['orientation', 'compareRecord'])}`);

    let s4 = 0, n4 = 'Nu-DESC 채점 없음';
    if (this.nudesc) {
      const sc = this.nudesc.scores;
      const core = (sc.orientation || 0) >= 1 && (sc.communication || 0) >= 1 && (sc.hallucination || 0) >= 1;
      if (this.nudesc.positive) { s4 = core ? 2 : 1; n4 = core ? '' : '지남력·의사소통·착각/환각 중 놓친 항목이 있음'; }
      else { s4 = 0; n4 = `총점 ${this.nudesc.total}점 → 양성(2점 이상)을 놓침`; }
    }
    add(4, 1, 'Nu-DESC 채점·양성 판단', s4, n4);

    const k5 = cnt(['vitals', 'assessBladder', 'neuro']);
    add(5, 2, '원인 사정 3영역(활력·배뇨·신경)', k5 === 3 ? 2 : k5 === 2 ? 1 : 0, `미수행: ${miss(['vitals', 'assessBladder', 'neuro'])}`);
    add(6, 2, '지남력 재안내', has('reorient') ? 2 : 0, '미수행');
    add(7, 2, '환시 반박 없이 감정 인정', has('validate') ? (this.denied ? 1 : 2) : 0, this.denied ? '환시를 반박함' : '미수행');
    add(8, 2, '소변 배출 확인·설명', cnt(['fixKink', 'explainUrine']), `미수행: ${miss(['fixKink', 'explainUrine'])}`);
    add(9, 2, '보호자(아내) 연락 제안', has('callWife') ? 2 : 0, '미수행');
    add(10, 2, '재평가·낙상 예방 재확인', has('reassess') ? 2 : 0, '미수행');
    add(11, 2, '신체보호대 미사용', this.restraint ? 0 : 2, '신체보호대를 적용함');

    const comp = this.sbar ? Object.values(this.sbar.complete).filter(Boolean).length : 0;
    const missingEl = this.sbar ? Object.entries(this.sbar.complete).filter(([, v]) => !v).map(([k]) => k).join('·') : 'S·B·A·R';
    add(12, 3, 'SBAR 4요소', comp === 4 ? 2 : comp >= 2 ? 1 : 0, `미충족 요소: ${missingEl || '-'}`);
    let s13 = 0, n13 = 'Nu-DESC 결과를 보고하지 않음';
    if (this.sbar && this.sbar.nudescIncluded) {
      s13 = this.nudesc && this.nudesc.positive ? 2 : 1;
      n13 = s13 === 2 ? '' : '보고한 Nu-DESC 결과가 부정확함';
    }
    add(13, 3, 'Nu-DESC 결과 포함', s13, n13);
    const s14 = (this.readbackOk ? 1 : 0) + (this.charted ? 1 : 0);
    add(14, 3, '구두 처방 read-back·기록', s14, `${this.readbackOk ? '' : 'read-back 미완료 '}${this.charted ? '' : '기록 미수행'}`.trim());

    const total = items.reduce((a, b) => a + b.score, 0);
    const objectives = [1, 2, 3].map((o) => {
      const its = items.filter((i) => i.obj === o);
      const score = its.reduce((a, b) => a + b.score, 0);
      const max = its.reduce((a, b) => a + b.max, 0);
      return { obj: o, score, max, pct: Math.round((score / max) * 100) };
    });
    return {
      items, total, max: 28, objectives,
      timeSec: Math.round(this.t),
      emotion: this.emotion,
      nonpharmCount: NONPHARM.filter(has).length,
      firstReadbackWrong: this.readbackFirstWrong,
      sbarAttempts: this.sbarAttempts,
    };
  }
}
