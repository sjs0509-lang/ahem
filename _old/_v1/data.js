/* =========================================================
   data.js — 이 파일만 고치면 내용이 바뀝니다.
   ---------------------------------------------------------
   · 문장, 불안 수치, 체감시간, 정보 방향을 자유롭게 수정하세요.
   · 따옴표(" ")와 쉼표(,)만 지워지지 않게 주의하세요.

   [정보 방향 dir 값]
     "forward"  앞으로 가라 (위쪽 화살표)
     "left"     왼쪽으로      "right"  오른쪽으로
     "back"     돌아가라 (아래쪽 화살표)
     "stop"     멈춰라 (짧은 막대)
     "fading"   흐려지는 중 (배터리 부족 등)
     null       아무것도 말해주지 않음 (화살표 없음)

   [관계 relation 값]
     "agree"    일치        "conflict" 충돌
     "none"     정보 없음    "enough"   하나로 충분
     "loss"     정보원을 잃을 위기

   [at] 지도 위 위치. map.js의 route 안에 있는 id 이름을 씁니다.
   ========================================================= */

const TEXT = {
  kicker: "밴쿠버 · 스탠리파크",
  title: "스탠리파크에서\n길을 잃은 날",
  question: "길을 잃은 동안, 나는 언제 가장 불안했을까?",
  scrollHint: "스크롤해서 그날의 길을 따라가 보세요",

  legendTitle: "그날 나는 세 가지에 기대어 길을 찾았다.",
  sources: {
    space:  { name: "공간",   desc: "눈앞의 길: 도로 모양, 입구와 출구, 차가 많은지, 자전거 길인지" },
    person: { name: "사람",   desc: "길 안내, 설명, 앞서 가는 사람의 움직임" },
    phone:  { name: "휴대폰", desc: "지도 경로, 현재 위치, 배터리" }
  },
  legendHow: "화살표는 각각이 나에게 ‘어느 쪽으로 가라’고 말했는지를 뜻한다. 화살표가 없으면 아무것도 말해주지 않았다는 뜻이다.",

  compareTitle: "네 번 길을 잃었고, 불안은 같지 않았다",
  compareLede: "길을 잃은 네 순간을 나란히 놓아 보았다. 정보가 아예 없을 때보다, 정보가 서로 다른 말을 할 때 불안이 가장 컸다.",

  insight: "나를 가장 불안하게 만든 건 정보가 없는 순간이 아니라, 믿던 정보들이 서로 어긋나는 순간이었다.",
  insightNotes: [
    "정보가 없을 때는 오히려 다음 행동이 분명했다. 사람에게 물으면 됐다.",
    "정보가 어긋났을 때는 무엇을 믿을지 정할 수 없었다. 7분이 30분처럼 느껴졌다.",
    "어긋남은 세 번째 정보, 앞사람의 움직임으로 풀렸다."
  ],
  footer: "정보디자인 과제 · 스탠리파크에서 길을 잃은 날"
};

const RELATIONS = {
  agree:    { label: "일치",      plain: "같은 쪽을 가리킴" },
  enough:   { label: "충분",      plain: "길만 보고도 충분함" },
  none:     { label: "정보 없음", plain: "아무것도 말해주지 않음" },
  conflict: { label: "충돌",      plain: "서로 다른 쪽을 가리킴" },
  loss:     { label: "상실 위기", plain: "길을 찾던 도구를 잃을 위기" }
};

/* ---------------------------------------------------------
   사건 목록 (순서대로)
   node      : NODE 번호 ("01"~"04"), 일반 사건은 null
   anxiety   : 불안 정도 0~10  ※ 현재 값은 임시값입니다. 직접 고쳐 주세요.
   time      : { actual: 실제 분, felt: 체감 분 } 없으면 null
   next      : (NODE만) 그다음 행동, 마지막 비교 화면에 표시
   nextClear : (NODE만) 다음 행동이 분명했는지 true / false
   summary   : (NODE만) 마지막 비교 화면의 한 줄 요약
   note      : 카드 아래 작은 메모 (없으면 "")
   --------------------------------------------------------- */
const EVENTS = [
  {
    id: 1, node: null, at: "shop",
    title: "자전거를 빌려 출발했다",
    text: "다운타운의 대여점에서 자전거를 빌렸다. 공원은 바로 근처라고 했다.",
    relation: "agree",
    sources: {
      space:  { dir: "forward", says: "공원 쪽으로 난 큰길" },
      person: { dir: "forward", says: "직원: “저쪽으로 쭉 가면 공원이에요”" },
      phone:  { dir: null,      says: "꺼낼 필요가 없었다" }
    },
    action: "들은 방향으로 출발했다",
    anxiety: 1, time: null, note: ""
  },
  {
    id: 2, node: "01", at: "node01",
    title: "입구를 찾지 못했다",
    text: "공원은 분명 가까이 있는데, 자전거로 들어가는 입구가 보이지 않았다. 같은 길을 몇 번이나 오갔다.",
    relation: "none",
    sources: {
      space:  { dir: null, says: "비슷한 갈림길만 이어지고 입구 표시가 없음" },
      person: { dir: null, says: "주변에 물어볼 사람이 아직 없음" },
      phone:  { dir: null, says: "지도를 켤 생각을 못 함" }
    },
    action: "지나가는 사람에게 물어보기로 했다",
    anxiety: 5, time: null,
    next: "사람에게 묻는다", nextClear: true,
    summary: "아무 정보도 없었지만, 다음에 할 일은 분명했다.",
    note: ""
  },
  {
    id: 3, node: null, at: "ask1",
    title: "한 여성에게 길을 물었다",
    text: "길을 묻자 손으로 방향을 짚어 주었다. 그쪽으로 가자 정말 입구가 나왔다.",
    relation: "agree",
    sources: {
      space:  { dir: "forward", says: "알려준 쪽에 실제로 입구가 보임" },
      person: { dir: "forward", says: "여성이 입구 방향을 알려줌" },
      phone:  { dir: null,      says: "사용하지 않음" }
    },
    action: "알려준 대로 공원에 들어갔다",
    anxiety: 2, time: null, note: ""
  },
  {
    id: 4, node: null, at: "ride",
    title: "바닷가를 따라 달렸다",
    text: "해안을 따라 난 자전거 길은 한 방향으로만 이어졌다. 길만 따라가면 됐다.",
    relation: "enough",
    sources: {
      space:  { dir: "forward", says: "바다를 따라 이어지는 자전거 길" },
      person: { dir: null,      says: "물을 필요가 없었다" },
      phone:  { dir: null,      says: "사용하지 않음" }
    },
    action: "길을 따라 계속 달렸다",
    anxiety: 1, time: null, note: ""
  },
  {
    id: 5, node: "02", at: "node02",
    title: "출구를 찾지 못했다",
    text: "한참을 달리고 나니 이번엔 나가는 길을 알 수 없었다. 길은 계속 이어지는데, 대여점 쪽으로 빠지는 곳이 보이지 않았다.",
    relation: "none",
    sources: {
      space:  { dir: null, says: "출구 표시가 없고 길만 계속 이어짐" },
      person: { dir: null, says: "주변 사람은 모두 지나가는 중" },
      phone:  { dir: null, says: "아직 꺼내지 않음" }
    },
    action: "근처에 있던 커플에게 묻기로 했다",
    anxiety: 5, time: null,
    next: "사람에게 묻는다", nextClear: true,
    summary: "이번에도 정보는 없었지만, 무엇을 해야 할지는 알았다.",
    note: ""
  },
  {
    id: 6, node: null, at: "ask2",
    title: "커플에게 묻고, 지도를 켰다",
    text: "커플이 대략적인 방향을 알려 주었다. 확실히 하려고 휴대폰 지도로 대여점까지 가는 경로를 찾았다.",
    relation: "agree",
    sources: {
      space:  { dir: null,      says: "아직 판단할 단서가 없음" },
      person: { dir: "forward", says: "커플이 대략적인 방향을 알려줌" },
      phone:  { dir: "forward", says: "대여점까지 경로 안내" }
    },
    action: "지도 경로를 따라가기 시작했다",
    anxiety: 3, time: null, note: ""
  },
  {
    id: 7, node: "03", at: "node03",
    title: "지도를 따라가다 차도에 들어섰다",
    text: "지도는 계속 이 길이 맞다고 했다. 그런데 눈앞의 길은 차가 쌩쌩 달리는 차도였고, 자전거가 다닐 길처럼 보이지 않았다. 물어볼 사람도 없었다.",
    relation: "conflict",
    sources: {
      space:  { dir: "back",    says: "차가 많고 자전거 길이 아님. 돌아가야 할 것 같음" },
      person: { dir: null,      says: "주변에 사람이 없음" },
      phone:  { dir: "forward", says: "“이 길로 계속 가세요”" }
    },
    action: "계속 갈지 돌아갈지 정하지 못한 채 페달을 밟았다",
    anxiety: 10, time: { actual: 7, felt: 30 },
    next: "무엇을 믿을지 정할 수 없다", nextClear: false,
    summary: "정보는 있었지만 서로 달랐다. 어느 쪽을 믿을지 정할 수 없었다.",
    note: "실제로는 7분. 체감은 30분쯤이었다."
  },
  {
    id: 8, node: null, at: "follow",
    title: "앞사람을 따라갔다",
    text: "앞에 자전거를 탄 사람이 보였다. 그 사람은 지도와 다른 길로 빠졌고, 그 길은 자전거 길이었다. 나도 따라갔다.",
    relation: "agree",
    sources: {
      space:  { dir: "forward", says: "따라간 길은 자전거 길" },
      person: { dir: "forward", says: "앞사람이 그쪽으로 감" },
      phone:  { dir: null,      says: "더 이상 보지 않음" }
    },
    action: "앞사람을 따라갔다",
    anxiety: 4, time: null,
    note: "어긋난 두 정보 사이에서, 세 번째 정보가 방향을 정해 주었다."
  },
  {
    id: 9, node: null, at: "return",
    title: "대여점에 도착했다",
    text: "익숙한 거리가 나오고, 대여점 간판이 보였다. 자전거를 반납했다.",
    relation: "agree",
    sources: {
      space:  { dir: "forward", says: "대여점 간판이 보임" },
      person: { dir: null,      says: "물을 필요가 없었다" },
      phone:  { dir: "forward", says: "지도상으로도 도착" }
    },
    action: "자전거를 반납했다",
    anxiety: 2, time: null, note: ""
  },
  {
    id: 10, node: "04", at: "node04",
    title: "휴대폰 배터리가 거의 없었다",
    text: "반납하고 나니 배터리가 몇 퍼센트 남지 않았다. 돌아갈 길도, 연락도 모두 휴대폰에 있었다. 어디서 충전할 수 있는지 몰랐다.",
    relation: "loss",
    sources: {
      space:  { dir: null,     says: "충전할 곳이 보이지 않음" },
      person: { dir: null,     says: "아직 묻지 않음" },
      phone:  { dir: "fading", says: "배터리 부족. 곧 꺼질 수 있음" }
    },
    action: "가게 직원에게 충전할 곳을 물었다",
    anxiety: 7, time: null,
    next: "사람에게 묻는다", nextClear: true,
    summary: "길을 찾게 해 주던 도구 자체를 잃을 뻔했다.",
    note: ""
  },
  {
    id: 11, node: null, at: "node04",
    title: "충전할 수 있다는 걸 알았다",
    text: "직원이 충전할 수 있는 곳을 알려 주었다. 아직 충전하기 전이었는데도, 불안은 그 순간 크게 내려갔다.",
    relation: "agree",
    sources: {
      space:  { dir: "forward", says: "콘센트 위치를 확인함" },
      person: { dir: "forward", says: "직원: “여기서 충전할 수 있어요”" },
      phone:  { dir: "fading",  says: "아직 충전 전" }
    },
    action: "충전할 곳으로 이동했다",
    anxiety: 2, time: null,
    note: "실제로 충전되기 전에, 불안이 먼저 내려갔다."
  }
];
