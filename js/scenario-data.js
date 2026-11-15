// 시나리오 정적 데이터 (대본·학습목표·메뉴·SBAR 문항 등)
// 출처: 「섬망 환자 조기발견 및 Nu-DESC기반 간호중재·SBAR 보고 SP 시나리오」 최종 SP 대본
// ※ [가정] 표시가 있는 값은 원 대본에 없어서 임시로 넣은 것이므로 교수자 확인 후 수정하세요.

export const META = {
  title: '섬망 환자 조기발견 및 Nu-DESC 기반 간호중재·SBAR 보고',
  subtitle: 'WebXR SP 시뮬레이션',
  durationSec: 600, // 러닝 10분
  alertAtSec: 420, // 종료 3분 전 알림
  idleLineAtSec: 540, // 대본: "10분 시점 1회" → 9분 경과 시 1회 (가정)
  clockStart: { h: 2, m: 0 },
  situation:
    '80세 남성 김두두 님은 발열·요로감염으로 전일 15시 응급실을 거쳐 감염내과에 입원했습니다. ' +
    '입원 첫날 밤 02시, 병실에서 환자가 소리를 지르고 있습니다. 보호자는 귀가하여 부재입니다.',
  role: '당신은 입사 1년 이내 신규간호사이며, 야간에 단독으로 환자를 담당하고 있습니다.',
  background: [
    '10년 전 뇌경색 → 좌측 경도 편마비(좌측 상지 Grade 4/5), 고혈압',
    '입원 시 지남력 정상',
    '우측 전완 말초정맥: ceftriaxone 2 g IV, NS 40 mL/hr 투여 중, Foley 유지',
  ],
  objectives: [
    '안전을 먼저 확보하고 Nu-DESC로 섬망 선별 양성(총점 2점 이상)을 판단한다.',
    '섬망의 원인을 사정하고 신체보호대 없이 비약물적 중재를 3가지 이상 수행한다.',
    'Nu-DESC 결과를 포함해 SBAR로 보고하고 구두 처방을 read-back으로 확인·기록한다.',
  ],
  phases: [
    { id: 'find', label: '발견·안전 확보', from: 0, to: 180 },
    { id: 'assess', label: '사정·섬망 선별', from: 180, to: 420 },
    { id: 'intervene', label: '비약물적 중재', from: 420, to: 540 },
    { id: 'report', label: '보고·재평가·기록', from: 540, to: 600 },
  ],
};

export const SHOUT = '아!.. 아!! 뭐야!!';
export const OPENING = '이봐요! 이리 좀 와 봐! 팔에서 피가 나. 뭐가 꽂혀 있길래 내가 빼 버렸어.';

export const TABS = [
  { id: 'safety', label: '안전' },
  { id: 'assess', label: '사정' },
  { id: 'intervene', label: '중재' },
  { id: 'report', label: '보고' },
];

// 메뉴에 표시되는 간호 수행 목록 (동작은 scenario.js)
export const ACTION_META = [
  { id: 'handwash', tab: 0, label: '손 위생', hint: '손을 씻는다' },
  { id: 'identify', tab: 0, label: '환자 확인', hint: '이름·등록번호 확인' },
  { id: 'intro', tab: 0, label: '조명 켜기·자기소개', hint: '눈높이를 맞추고 소개' },
  { id: 'stopIV', tab: 0, label: '수액 중지·압박 지혈', hint: '장갑 → 멸균 거즈 압박 → 카테터 끝 확인' },
  { id: 'organizeFoley', tab: 0, label: '소변줄 정리', hint: '잡아당기지 않게 정리' },
  { id: 'bedLow', tab: 0, label: '침대 낮춤·난간 올림', hint: '낙상 예방' },

  { id: 'orientation', tab: 1, label: '지남력 질문', hint: '시간·장소·사람' },
  { id: 'compareRecord', tab: 1, label: '입원 기록 비교', hint: '급성 변화 확인' },
  { id: 'vitals', tab: 1, label: '활력징후·SpO₂ 측정', hint: '' },
  { id: 'assessBladder', tab: 1, label: '통증·배뇨 사정', hint: '하복부·소변량·Foley 확인' },
  { id: 'fixKink', tab: 1, label: 'Foley 꺾임 해소', hint: '' },
  { id: 'neuro', tab: 1, label: '동공·사지 근력 확인', hint: '새로운 신경학적 변화' },
  { id: 'nudesc', tab: 1, label: 'Nu-DESC 채점', hint: '총점 2점 이상 = 양성' },

  { id: 'reorient', tab: 2, label: '지남력 재안내', hint: '이름을 부르며 짧은 문장으로' },
  { id: 'validate', tab: 2, label: '감정 인정', hint: '놀란 마음을 인정' },
  { id: 'explainUrine', tab: 2, label: '소변 배출 확인·설명', hint: '' },
  { id: 'reinsertIV', tab: 2, label: '정맥 주사 재삽입', hint: '' },
  { id: 'callWife', tab: 2, label: '보호자(아내) 연락 제안', hint: '' },
  { id: 'restraint', tab: 2, label: '신체보호대 적용', hint: '' },
  { id: 'deny', tab: 2, label: '“벌레는 없다”고 바로잡기', hint: '' },

  { id: 'sbar', tab: 3, label: '당직의에게 SBAR 보고', hint: '전화 보고' },
  { id: 'readback', tab: 3, label: '구두 처방 read-back', hint: '' },
  { id: 'antipyretic', tab: 3, label: '해열제 투여', hint: '' },
  { id: 'chart', tab: 3, label: '처방 내용 기록', hint: '' },
  { id: 'reassess', tab: 3, label: '재평가', hint: '지남력·정서 지지·낙상 예방 재확인' },
  { id: 'finish', tab: 3, label: '시뮬레이션 종료', hint: '결과 보기' },
];

export const NUDESC_ITEMS = [
  { id: 'orientation', label: '지남력 장애', hint: '시간·장소·사람을 혼동' },
  { id: 'behavior', label: '부적절한 행동', hint: '안절부절, 줄·난간을 만짐' },
  { id: 'communication', label: '부적절한 의사소통', hint: '횡설수설, 맥락에 맞지 않는 말' },
  { id: 'hallucination', label: '착각/환각', hint: '없는 것을 봄' },
  { id: 'psychomotor', label: '정신운동 지연', hint: '반응 저하·무반응' },
];

// ---- SBAR 문항 (ok: 정답, needs: 사실이 되려면 먼저 수행해야 하는 항목) ----
export const SBAR = {
  S: {
    label: 'S  상황 (Situation)',
    options: [
      { id: 's1', ok: true, text: '02시 김두두 님이 소리 지르며 혼란 상태입니다.' },
      { id: 's3', ok: false, text: '잠을 못 잔다며 수면제를 요구합니다.' },
      { id: 's2', ok: true, text: '정맥 카테터를 스스로 제거해 출혈, 압박 지혈함.' },
    ],
  },
  B: {
    label: 'B  배경 (Background)',
    options: [
      { id: 'b1', ok: true, text: '80세 남, 요로감염 입원 1일째, 입원 시 지남력 정상.' },
      { id: 'b3', ok: false, text: '치매로 진단받은 병력이 있습니다.' },
      { id: 'b2', ok: true, text: '뇌경색 후 좌측 경도 편마비, 고혈압, Foley 유지.' },
    ],
  },
  A: {
    label: 'A  사정 (Assessment)',
    options: [
      { id: 'a4', ok: false, text: '뇌출혈이 강하게 의심됩니다.' },
      { id: 'a1', ok: true, nudesc: true, text: null }, // 문구는 채점 결과로 동적 생성
      { id: 'a2', ok: true, needs: ['vitals', 'neuro'], text: 'BT 38.4 BP 148/86 HR 106 RR 22 SpO₂ 95%, 신경학적 변화 없음.' },
      { id: 'a3', ok: true, needs: ['fixKink'], text: 'Foley 꺾임 해소 후 소변 배출, 하복부 팽만 있었음.' },
    ],
  },
  R: {
    label: 'R  요청 (Recommendation)',
    options: [
      { id: 'r3', ok: false, text: '진정제 투여를 요청드립니다.' },
      { id: 'r1', ok: true, text: '해열제 처방을 요청드립니다.' },
      { id: 'r4', ok: false, text: '신체보호대 적용 허락을 요청드립니다.' },
      { id: 'r2', ok: true, text: '섬망 원인(감염·요폐) 평가를 위한 방문을 요청드립니다.' },
    ],
  },
};
export const SBAR_NEED_CORRECT = 2; // 요소마다 정답 2개 이상 + 오답 0개 → 해당 요소 충족

// ---- 구두 처방 [가정: 원 대본에 처방 내용이 없어 임시 설정] ----
export const ORDER = {
  drug: '아세트아미노펜',
  dose: '650mg',
  route: '경구',
  freq: '1회',
  followup: '1시간 뒤 체온 재측정 후 보고',
  say: '네, 알겠습니다. 아세트아미노펜 650밀리그램 한 번 경구로 투여하시고, 한 시간 뒤에 체온 다시 재서 알려 주세요.',
};

export const READBACK = [
  { id: 'rb2', ok: false, text: '아세트아미노펜 1000mg 경구 1회 투여하고, 1시간 뒤 체온 재서 보고드리겠습니다. 맞습니까?', reply: '아니요, 용량이 다릅니다. 650mg 한 번이에요. 다시 확인해 주세요.' },
  { id: 'rb3', ok: false, text: '네, 해열제 투여하겠습니다.', reply: '약 이름과 용량을 복창해서 확인해 주세요.' },
  { id: 'rb1', ok: true, text: '아세트아미노펜 650mg 경구 1회 투여하고, 1시간 뒤 체온 재서 보고드리겠습니다. 맞습니까?', reply: '네, 맞습니다. 수고하세요.' },
];

// ---- 정서 강도 (SP 연기 지침) ----
export const EMOTION = { start: 7, floor: 3 };
