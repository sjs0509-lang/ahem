/* =========================================================
   data.js — 내용은 이 파일만 고치면 됩니다.
   ---------------------------------------------------------
   · 따옴표(" ")와 쉼표(,)가 지워지지 않게만 주의하세요.
   · { value: 10, estimated: true } 처럼 estimated: true 인 값은
     화면에 작게 "추정"으로 표시됩니다 (화면당 한 번). 확인되면 false로.

   [지점 항목]
     id      "01" 같은 번호
     name    지점 이름 (지도·비교 화면용 짧은 이름)
     title   지점 화면 위에 쓰는 이름 (없으면 name)
     at      지도 위 위치. 경로 한 바퀴를 0~1로 본 위치 (0 = 대여점)
     scene   지도에 더 그릴 공간: "fork" 갈림길 / "forest" 숲 / "road" 차로 가득한 도로
     space   눈앞의 공간 한 줄 (지도 화면 위 작은 글씨)
     note    그때의 기록 한 줄 (있으면 space 아래 작은 글씨)

     guide   길을 잃었을 때의 안내 → 지도 위 화살표
               source: "phone"(분홍) / "person"(노랑) / null(없음 = 화살표 없음)
               label:  화살표 끝의 짧은 말
               to:     [x, y] 화살표가 가리키는 곳 (지도 좌표, 길이 없는 곳이면 어긋남)
               along:  0.06 처럼 쓰면 실제 길을 따라 그만큼 겹쳐 그림
               dashed: true면 점선
     fix     다시 이어준 것 → 지도 위 노랑 화살표 + 체감 화면 끝 주석 카드
               who:   지도에 나타나는 사람 "woman" / "couple" / "cyclist"
               label: 화살표 끝의 짧은 말 ("" 이면 라벨 없음)
               along: 실제 길을 따라 겹치는 길이
               text:  카드의 "무엇이" / line: 카드의 한 줄 문장
               action: 해결 화면의 펜툴 동작 "add" 점 추가 / "move" 점 옮기기 / "align" 정렬
               tool:   그 동작 중 커서 옆에 뜨는 툴 이름

     table   비교 화면 표: guide 안내 / problem 무엇이 문제였나 / human 사람이 한 일 (+ humanSub 작은 글씨)
     actual  실제 시간(분) → 빨간 직선 길이
     felt    체감 시간(분) → 곡선 길이
   ========================================================= */

const TEXT = {
  intro: [
    "밴쿠버 스탠리파크, 자전거를 타다 세 번 길을 잃었다.",
    "그때마다 시간은 다르게 흘렀다."
  ],
  place: "STANLEY PARK, VANCOUVER",
  start: "자전거 대여점",

  // 읽는 법 (위에서부터 하나씩)
  legend: {
    real: "빨간 직선 = 실제 시간",
    felt: "곡선과 핸들 = 느낀 시간",
    guide: ["노랑 = 사람의 안내", "분홍 = 휴대폰의 안내"],
    match: "화살표가 실제 길과 겹치면 맞고, 벗어나면 어긋남",
    pull: "핸들을 당겨 그날 느낀 만큼 맞춰보세요"
  },

  matched: "그날 느낀 시간",
  // 해결 화면
  resolve: { skip: "건너뛰기", aligned: "정렬됨" },
  // 동작 안내 (처음 보는 사람용): [마우스, 휴대폰]
  hints: {
    felt: ["핸들을 끌어 점선까지 당겨보세요", "핸들을 손가락으로 끌어 점선까지 당겨보세요"],
    add: ["깜빡이는 곳을 눌러 점을 추가하세요", "깜빡이는 곳을 눌러 점을 추가하세요"],
    move: ["분홍 점을 끌어 노란 원에 놓으세요", "분홍 점을 손가락으로 끌어 노란 원에 놓으세요"],
    align: ["노란 선을 끌어 분홍 선 위에 겹치세요", "노란 선을 손가락으로 끌어 분홍 선 위에 겹치세요"]
  },
  scrollDown: "아래로",
  est: "추정",

  // 비교 화면 표의 줄 이름
  table: {
    guide: "안내",
    problem: "무엇이 문제였나",
    time: "실제 → 체감",
    human: "사람이 한 일",
    photos: "사진",
    photosAll: "길을 잃기 전 8장 / 길을 잃은 뒤 0장"
  },

  // 마지막 화면의 사진 시간 막대
  timeline: {
    title: "사진을 찍은 시각",
    start: "3:54 PM",
    end: "4:57 PM",
    lost: "4:33 PM",
    lostLabel: "돌아갈 길을 잃음",
    after: "이후 사진 0장"
  },

  // 사진 보기 (사진 프레임을 눌렀을 때)
  viewer: {
    noPhoto: "이 구간에서는 사진을 찍지 못했다",
    more: "위로 밀어 정보 보기",
    close: "닫기",
    empty: "사진 없음"
  },

  definition: ["익숙함", "사람이나 지도의 안내가 눈앞의 공간과 맞아떨어지는 상태"],
  thesis: [
    "길찾기는 정보를 얻는 과정이 아니라,",
    "정보와 실제 공간을 계속 맞춰보는 과정이었다.",
    "그 연결이 끊긴 순간 나는 길을 잃었다고 느꼈다."
  ]
};

const POINTS = [
  {
    id: "01", name: "입구", at: 0.08, scene: "fork",
    space: "갈림길, 입구 표지가 보이지 않음",
    guide: { source: null },
    fix: {
      source: "person", who: "woman", label: "저쪽이 입구예요", along: 0.06,
      action: "add", tool: "펜 툴: 점 추가",
      text: "폴란드 여성이 입구까지 같이 가줌",
      line: "안내가 없었다. 여성이 입구까지 같이 가며 새 길을 그려줬다."
    },
    table: { guide: "없음", problem: "맞춰볼 안내가 없었다", human: "그렸다", humanSub: "새 길을 알려줌" },
    actual: { value: 8, estimated: false }, // 3:54 렌탈 → 4:02 입구 도착
    felt: { value: 15, estimated: true }
  },
  {
    id: "02", name: "돌아갈 길", title: "돌아갈 길을 찾지 못함", at: 0.52, scene: "forest",
    space: "숲",
    note: "4:33 Lumberman's Arch에서 ChatGPT에게 질문 · 반납까지 1시간, 배터리 10%",
    guide: { source: "phone", label: "이 길로 가세요", to: [578, 400], dashed: true },
    fix: {
      source: "person", who: "couple", label: "이쪽이에요", along: 0.08,
      action: "move", tool: "직접 선택 툴: 점 옮기기",
      text: "커플의 설명",
      line: "휴대폰이 말한 길은 눈앞에 없었다. 커플이 길을 고쳐줬다."
    },
    table: { guide: "휴대폰(GPT)", problem: "안내한 길이 공간에 없었다", human: "고쳤다", humanSub: "다른 길로 바로잡음" },
    actual: { value: 10, estimated: true },
    felt: { value: 15, estimated: true }
  },
  {
    id: "03", name: "차도", at: 0.9, scene: "road",
    space: "차로 가득한 도로",
    guide: { source: "phone", label: "직진하세요", along: 0.06 },
    fix: {
      source: "person", who: "cyclist", label: "", along: 0.06,
      action: "align", tool: "스마트 가이드: 정렬",
      text: "자전거 탄 아저씨",
      line: "길은 그대로였다. 같은 길을 가는 자전거 한 대가, 지도가 맞다고 보여줬다."
    },
    table: { guide: "휴대폰(지도)", problem: "안내는 맞았지만 공간에서 확인할 수 없었다", human: "맞췄다", humanSub: "같은 길이 맞다고 보여줌" },
    actual: { value: 7, estimated: false },
    felt: { value: 30, estimated: false }
  }
];

/* =========================================================
   돌아오는 길 전체 (보드 기록): 4:33 Lumberman's Arch → 4:57 반납, 약 24분
   그중 고속도로(NODE 03) 실제 7분, 체감 30분
   ========================================================= */
const TRIP = { back: { from: "4:33 PM", to: "4:57 PM", minutes: 24 } };

/* =========================================================
   지도 위 사진 프레임 — 찍은 곳에 프레임이 붙는다
   ---------------------------------------------------------
     time   찍은 시각 ("" 이면 "시각 ?")   timeEst: true면 "추정"
     place  장소 이름
     file   photos 폴더의 파일 이름 (없으면 회색 자리표시 + 파일 이름)
     at     지도 위 위치 (경로 한 바퀴를 0~1로 본 값, 0 = 대여점)
     size   "large" 여유로운 구간 / "small" 돌아오는 숲길
     kind   "photo" 사진 / "phone" 휴대폰 화면(분홍 테두리) / "none" 사진 없음(빈 점선 프레임)
     hidden true면 화면에서만 숨김
   ========================================================= */
const PHOTOS = [
  { no: 1, time: "3:54 PM", place: "자전거 렌탈샵", file: "p01.jpg", at: 0.0, size: "large", kind: "photo" },
  { no: 2, time: "4:02 PM", place: "스탠리파크 입구", file: "p02.jpg", at: 0.09, size: "large", kind: "photo" },
  { no: 3, time: "4:07 PM", place: "Vancouver Seawall", file: "p03.jpg", at: 0.14, size: "large", kind: "photo" },
  { no: 4, time: "4:18 PM", place: "Seawall", file: "p04.jpg", at: 0.2, size: "large", kind: "photo" },
  { no: 5, time: "4:20 PM", place: "Hallelujah Point", file: "p05.jpg", at: 0.25, size: "large", kind: "photo" },
  { no: 6, time: "4:24 PM", place: "Port of Vancouver Lookout", file: "p06.jpg", at: 0.29, size: "large", kind: "photo" },
  { no: 7, time: "4:27 PM", place: "Brockton Point Lighthouse", file: "p07.jpg", at: 0.33, size: "large", kind: "photo" },
  { no: 8, time: "4:29 PM", timeEst: true, place: "Brockton Point 북쪽", file: "p08.jpg", at: 0.38, size: "large", kind: "photo" },
  { no: 9, time: "4:33 PM", place: "Lumberman's Arch · ChatGPT 대화 스크린샷", file: "p09.jpg", at: 0.51, size: "large", kind: "phone", hidden: true },
  { no: 13, time: "", place: "고속도로", file: "", at: 0.9, size: "large", kind: "none" }
];
