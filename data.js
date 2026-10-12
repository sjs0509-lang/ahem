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

     table   비교 화면 표: guide 안내 / problem 무엇이 문제였나 / human 사람이 한 일
     actual  실제 시간(분) → 빨간 직선 길이
     felt    체감 시간(분) → 곡선 길이
     photo   photos 폴더의 파일 이름. ""이면 photoNote를 씀
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
  scrollDown: "아래로",
  photoSlot: "사진 자리",
  est: "추정",

  // 비교 화면 표의 줄 이름
  table: {
    guide: "안내",
    problem: "무엇이 문제였나",
    time: "실제 → 체감",
    human: "사람이 한 일"
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
      text: "지나가던 여성의 안내",
      line: "맞춰볼 안내가 없었다. 사람이 새 안내를 주자, 눈앞의 길과 맞아떨어졌다."
    },
    table: { guide: "없음", problem: "맞춰볼 안내가 없었다", human: "새 안내를 줬다" },
    actual: { value: 10, estimated: true },
    felt: { value: 15, estimated: true },
    photo: "node01.jpg"
  },
  {
    id: "02", name: "돌아갈 길", title: "돌아갈 길을 찾지 못함", at: 0.52, scene: "forest",
    space: "숲",
    guide: { source: "phone", label: "이 길로 가세요", to: [578, 400], dashed: true },
    fix: {
      source: "person", who: "couple", label: "이쪽이에요", along: 0.08,
      text: "커플의 설명",
      line: "휴대폰이 말한 길은 눈앞에 없었다. 사람이 다른 길을 알려줬다."
    },
    table: { guide: "휴대폰(GPT)", problem: "안내한 길이 공간에 없었다", human: "다른 길을 알려줬다" },
    actual: { value: 10, estimated: true },
    felt: { value: 15, estimated: true },
    photo: "node02.jpg"
  },
  {
    id: "03", name: "차도", at: 0.9, scene: "road",
    space: "차로 가득한 도로",
    guide: { source: "phone", label: "직진하세요", along: 0.06 },
    fix: {
      source: "person", who: "cyclist", label: "", along: 0.06,
      text: "자전거 탄 아저씨",
      line: "길은 그대로였다. 같은 길을 가는 자전거 한 대가 보이자, 지도를 믿을 수 있었다."
    },
    table: { guide: "휴대폰(지도)", problem: "안내는 맞았지만 공간에서 확인할 수 없었다", human: "같은 길이 맞다고 보여줬다" },
    actual: { value: 7, estimated: false },
    felt: { value: 30, estimated: false },
    photo: "", photoNote: "이 구간 사진 없음"
  }
];
