/* =========================================================
   data.js — 내용은 이 파일만 고치면 됩니다.
   ---------------------------------------------------------
   · 따옴표(" ")와 쉼표(,)가 지워지지 않게만 주의하세요.
   · { value: 10, estimated: true } 처럼 estimated: true 인 값은
     화면에 작게 "추정"으로 표시됩니다. 확인되면 false로 바꾸세요.

   [장면 항목]
     label    지도 위 짧은 대문자 라벨
     title    화면 왼쪽 아래에 나오는 한글 제목
     node     true면 바퀴 클로즈업 카드가 나옴
     guide    안내. source: "person"(노랑) / "phone"(분홍) / null(없음)
     space    공간. 눈앞의 길이 어땠는지 한 줄
     relation 관계. "맞음" / "없음" / "어긋남"
              → 지도에서 실선 / 끊긴 점선 / 두 갈래 선
     moving   true = 바퀴가 돎(이동), false = 바퀴 멈춤(멈춤)
     action   클로즈업 바퀴 아래에 나오는 행동
     actual   실제 시간(분) → 지도에서 앵커 사이 경로 길이
     felt     체감 시간(분) → 핸들 길이와 곡선의 부풂
              (실제와 같으면 부풀지 않음)
     memory   카드 아래 작은 글씨 "기억: ..."
     photo    photos 폴더의 파일 이름. 없으면 회색 자리표시
     photoNote 사진 자리에 대신 쓸 말 (사진이 없을 때)
   ========================================================= */

const TEXT = {
  corner: ["STANLEY", "PARK", "길을 잃었다고", "느낀 순간"],
  question: "그날 나는 언제 길을 잃었다고 느꼈을까?",
  scroll: "SCROLL",

  thesis: [
    "길찾기는 정보를 얻는 과정이 아니라,",
    "정보와 실제 공간을 계속 맞춰보는 과정이었다.",
    "그 연결이 끊긴 순간 나는 길을 잃었다고 느꼈다."
  ],
  coda: "세 번 모두, 다시 이어준 건 사람이었다.",

  // NODE 클로즈업의 펜툴 핸들
  pullHint: "핸들을 당겨보세요",
  pullMatch: "그날 나는 이만큼 길게 느꼈다",
  pullSame: "그날은 실제만큼 느꼈다",
  footer: "정보디자인 · Stanley Park, Vancouver"
};

const SCENES = [
  {
    label: "START", title: "대여점에서 출발",
    node: false,
    guide: { source: null, text: "" },
    space: { text: "대여점 앞 길" },
    relation: { value: "맞음", estimated: true },
    moving: true, action: "이동",
    actual: { value: 3, estimated: true },
    felt: { value: 3, estimated: true },
    memory: "", photo: ""
  },
  {
    label: "NODE 01", title: "입구를 찾지 못함",
    node: true,
    guide: { source: null, text: "안내 없음 (휴대폰 안 봄)" },
    space: { text: "입구가 보이지 않음" },
    relation: { value: "없음", estimated: false },
    moving: false, action: "멈춤 → 근처 여성에게 물음", actionEn: "STOPPED",
    actual: { value: 10, estimated: true },
    felt: { value: 10, estimated: true },
    memory: "당황했다", photo: "node01.jpg"
  },
  {
    label: "ASKED", title: "여성의 말로 다시 이어짐",
    node: false,
    guide: { source: "person", text: "폴란드 여성의 말 “이쪽으로 가면 입구예요”", estimated: true },
    space: { text: "안내대로 입구가 나옴" },
    relation: { value: "맞음", estimated: false },
    moving: true, action: "이동",
    actual: { value: 5, estimated: true },
    felt: { value: 5, estimated: true },
    memory: "", photo: ""
  },
  {
    label: "SEAWALL", title: "공원을 따라 달림",
    node: false,
    guide: { source: null, text: "안내 필요 없음" },
    space: { text: "길이 명확함" },
    relation: { value: "맞음", estimated: false },
    moving: true, action: "이동",
    actual: { value: 60, estimated: true },
    felt: { value: 60, estimated: true },
    memory: "", photo: ""
  },
  {
    label: "NODE 02", title: "출구를 찾지 못함",
    node: true,
    guide: { source: "phone", text: "휴대폰 GPT의 길 설명" },
    space: { text: "설명한 길이 보이지 않음" },
    relation: { value: "어긋남", estimated: false },
    moving: false, action: "멈춤 → 커플에게 물음", actionEn: "STOPPED",
    actual: { value: 10, estimated: true },
    felt: { value: 10, estimated: true },
    memory: "", photo: "node02.jpg"
  },
  {
    label: "ASKED", title: "커플의 설명으로 다시 이어짐",
    node: false,
    guide: { source: "person", text: "커플의 설명 후 휴대폰 지도 검색" },
    space: { text: "설명한 쪽으로 길이 이어짐" },
    relation: { value: "맞음", estimated: true },
    moving: true, action: "이동",
    actual: { value: 5, estimated: true },
    felt: { value: 5, estimated: true },
    memory: "", photo: ""
  },
  {
    label: "NODE 03", title: "차도에 들어섬",
    node: true,
    guide: { source: "phone", text: "휴대폰 지도 “이쪽”" },
    space: { text: "차가 많은 도로, 자전거 길 같지 않음" },
    relation: { value: "어긋남", estimated: false },
    moving: true, action: "계속 이동", actionEn: "KEPT MOVING",
    actual: { value: 7, estimated: false },
    felt: { value: 30, estimated: false },
    memory: "무엇이 맞는지 아무것도 판단할 수 없었다. 가장 불안했다.",
    photo: "", photoNote: "사진 거의 없음"
  },
  {
    label: "FOLLOWED", title: "앞사람을 따라감",
    node: false,
    guide: { source: "person", text: "앞에서 자전거 탄 아저씨의 움직임 (말 없음)" },
    space: { text: "그 길이 맞아 보임" },
    relation: { value: "맞음", estimated: false },
    moving: true, action: "따라감",
    actual: { value: 10, estimated: true },
    felt: { value: 10, estimated: true },
    memory: "", photo: ""
  },
  {
    label: "RETURN", title: "대여점 도착, 반납",
    node: false,
    guide: { source: null, text: "" },
    space: { text: "대여점" },
    relation: { value: "맞음", estimated: false },
    moving: false, action: "반납",
    actual: { value: 0, estimated: false },
    felt: { value: 0, estimated: false },
    memory: "", photo: ""
  }
];
