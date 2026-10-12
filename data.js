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
     at      지도 위 위치. 한 바퀴 경로를 0~1로 본 위치 (0 = 대여점)
     guide   그때의 안내. source: "person"(노랑) / "phone"(분홍) / null(없음)
     space   눈앞의 공간 한 줄
     status  안내 상태: "없음" / "어긋남" (비교 화면에 표시)
     fix     곡선을 다시 줄여준 것. 체감 화면 끝에 주석 카드로 나옴
             text = 무엇이 (source 색으로 표시) / line = 한 줄 문장
     actual  실제 시간(분) → 빨간 직선 길이
     felt    체감 시간(분) → 곡선 길이 (실제의 몇 배인지)
     photo   photos 폴더의 파일 이름. ""이면 photoNote를 씀
     illus   상황 일러스트: "fork" 숲길 / "phone" 휴대폰 설명 / "road" 차도
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
    pull: "핸들을 당겨 그날 느낀 만큼 맞춰보세요"
  },

  guideLabel: "안내",
  spaceLabel: "눈앞의 공간",
  matched: "그날 느낀 시간",
  scrollDown: "아래로",
  photoSlot: "사진 자리",
  est: "추정",

  definition: ["익숙함", "사람이나 지도의 안내가 눈앞의 공간과 맞아떨어지는 상태"],
  thesis: [
    "길찾기는 정보를 얻는 과정이 아니라,",
    "정보와 실제 공간을 계속 맞춰보는 과정이었다.",
    "그 연결이 끊긴 순간 나는 길을 잃었다고 느꼈다."
  ]
};

const POINTS = [
  {
    id: "01", name: "입구", at: 0.08,
    guide: { source: null, text: "안내 없음 (휴대폰 안 봄)" },
    space: "입구가 보이지 않음",
    status: "없음",
    fix: { source: "person", text: "지나가던 여성의 안내", line: "사람의 안내가 눈앞의 길과 맞아떨어지자, 다시 익숙해졌다." },
    actual: { value: 10, estimated: true },
    felt: { value: 15, estimated: true },
    photo: "node01.jpg", illus: "fork"
  },
  {
    id: "02", name: "돌아갈 길", title: "돌아갈 길을 찾지 못함", at: 0.52,
    guide: { source: "phone", text: "휴대폰 GPT가 설명한 대여점으로 돌아가는 길" },
    space: "설명한 길이 눈앞에 없음",
    status: "어긋남",
    fix: { source: "person", text: "커플의 설명", line: "휴대폰이 말한 길은 없었지만, 사람이 알려준 길은 눈앞에 있었다." },
    actual: { value: 10, estimated: true },
    felt: { value: 15, estimated: true },
    photo: "node02.jpg", illus: "phone"
  },
  {
    id: "03", name: "차도", at: 0.9,
    guide: { source: "phone", text: "휴대폰 지도 “직진”" },
    space: "차가 가득한 도로, 자전거 길 같지 않음",
    status: "어긋남",
    fix: { source: "person", text: "자전거 탄 아저씨의 움직임", line: "말 한마디 없었지만, 같은 자전거가 가는 길이 맞는 길이었다." },
    actual: { value: 7, estimated: false },
    felt: { value: 30, estimated: false },
    photo: "", photoNote: "이 구간 사진 없음", illus: "road"
  }
];
