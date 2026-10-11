/* =========================================================
   data.js — 내용은 이 파일만 고치면 바뀝니다.
   ---------------------------------------------------------
   · 따옴표(" ")와 쉼표(,)가 지워지지 않게만 주의하세요.
   · 아직 확인하지 못한 값은 "확인 필요"라고 적어 두세요.
     화면에서 회색 점선 상자로 따로 표시됩니다.
   · 확인한 값은 숫자나 글자로 바꿔 넣으면 됩니다.
       예) clock: "확인 필요"  →  clock: "14:20"
           photos: "확인 필요" →  photos: 12

   [state: 안내와 공간의 관계]
     "match"     맞음       안내가 가리키는 쪽에 실제 길이 있음
     "none"      없음       안내가 없고, 공간에서도 길이 안 보임
     "spaceOnly" 공간만     안내는 없지만 눈앞의 길만으로 충분함
     "mismatch"  어긋남     안내와 실제 길이 서로 다른 쪽을 가리킴
     "risk"      끊길 위기  안내 자체가 사라지려 함

   [guide: 위 칸에 보이는 안내]
     who  : "person"(사람, 노랑) / "phone"(휴대폰, 분홍) / null(없음)
     kind : "speech"(말) / "map"(지도 화면) / "motion"(말 없이 움직임)
            / "battery"(휴대폰 배터리) / "handoff"(사람 → 휴대폰으로 넘김)
     from : 누가/무엇이
     says : 그 안내가 한 말 (화면에 따옴표로 표시)
            ※ "임시 문장"이라고 표시한 말은 실제 표현으로 바꿔 주세요.

   [space: 아래 칸, 그날 눈앞의 길]
     says : 공간이 보여 준 것 (사진 아래 설명)

   [record: 기록, 확인 가능한 사실]
     clock    실제 시각
     ※ 숫자는 "약 7분"처럼 글자로 적어도 됩니다. 화면은 그 안의 숫자를 읽습니다.
     minutes  이 장면에 걸린 실제 시간(분)
     photos   이 장면에서 찍은 사진 장수
     battery  휴대폰 배터리 %
     phoneLooked  (NODE 01·02) 휴대폰 지도를 봤는지

   [memory: 기억, 주관적인 것]
     felt     체감 시간(분). 없으면 null
     text     그때의 느낌

   [files] photos 폴더에 넣을 사진 파일 이름.
     파일이 아직 없으면 회색 자리표시로 보입니다.

   [length] 스크롤 길이 (1 = 화면 한 개 높이)
   [wheel]  바퀴 회전 정도. 1 = 굴러감, 0 = 멈춤,
            [1, 0] = 굴러가다 멈춤, [0, 1] = 멈췄다 다시 굴러감
   ========================================================= */

const TEXT = {
  title: "스탠리파크에서\n길을 잃은 날",
  question: "그날 나는 언제 길을 잃었다고 느꼈을까?",
  place: "캐나다 밴쿠버 · 스탠리파크 · 자전거",
  scrollHint: "스크롤하면 자전거가 앞으로 갑니다",

  howTitle: "화면을 읽는 법",
  howGuide: "위 칸 — 그때 들은 말, 그때 본 휴대폰 화면",
  howSpace: "아래 칸 — 그날 실제로 눈앞에 있던 길 (그날 찍은 사진)",
  howLine: "가운데 선 — 위의 말과 아래의 길이 이어지는지",
  howLayers: [
    { cls: "rec",   name: "기록", desc: "시각, 걸린 시간, 사진 장수, 배터리. 확인할 수 있는 사실" },
    { cls: "act",   name: "행동", desc: "그때 내가 한 것" },
    { cls: "state", name: "관계", desc: "안내와 길이 어떤 관계였는지" },
    { cls: "mem",   name: "기억", desc: "그때의 느낌. 지금 떠올린 것이라 정확하지 않을 수 있음" }
  ],
  howClick: "장면 카드를 누르면 그 장면의 기록을 자세히 볼 수 있어요.",

  routeTitle: "그날의 길을 한 번에 펼치면",
  routeLede: "파란 줄은 그날 지나간 길, 그 위의 칸은 그때 받은 안내, 둘 사이의 선은 둘이 이어졌는지를 뜻합니다.",

  thesis: "길찾기는 정보를 얻는 과정이 아니라, 정보와 실제 공간을 계속 맞춰보는 과정이었다. 그 연결이 끊긴 순간 나는 길을 잃었다고 느꼈다.",
  footer: "정보디자인 과제 · 스탠리파크에서 길을 잃은 날"
};

const STATES = {
  match:     { label: "맞음",      plain: "안내가 가리키는 쪽에 실제 길이 있었다" },
  none:      { label: "없음",      plain: "안내가 없었고, 눈앞에서도 길이 보이지 않았다" },
  spaceOnly: { label: "공간만",    plain: "안내 없이 눈앞의 길만으로 충분했다" },
  mismatch:  { label: "어긋남",    plain: "안내와 눈앞의 길이 서로 다른 쪽을 가리켰다" },
  risk:      { label: "끊길 위기", plain: "안내를 주던 휴대폰이 꺼지려 했다" }
};

const SCENES = [
  {
    id: 1, node: null,
    title: "자전거를 빌려 출발했다",
    text: "다운타운의 대여점에서 자전거를 빌렸다. 공원은 바로 근처라고 했다.",
    state: "match", recovered: false,
    actions: ["이동"],
    guide: { who: "person", kind: "speech", from: "대여점 직원", says: "저쪽으로 쭉 가면 공원이에요" },
    space: { says: "공원 쪽으로 난 큰길" },
    record: { clock: "확인 필요", minutes: "확인 필요", photos: "확인 필요", battery: "확인 필요" },
    memory: { felt: null, text: "" },
    files: ["01-1.jpg", "01-2.jpg", "01-3.jpg"],
    length: 1, wheel: 1
  },
  {
    id: 2, node: "01",
    title: "입구를 찾지 못했다",
    text: "공원은 분명 가까이 있는데, 자전거로 들어가는 입구가 보이지 않았다. 같은 길을 몇 번이나 오갔다.",
    state: "none", recovered: false,
    actions: ["멈춤", "물음"],
    guide: { who: null, kind: null, from: "", says: "" },
    space: { says: "비슷한 길만 이어지고 입구가 보이지 않음" },
    record: { clock: "확인 필요", minutes: "확인 필요", photos: "확인 필요", battery: "확인 필요", phoneLooked: "확인 필요" },
    memory: { felt: null, text: "" },
    files: ["02-1.jpg", "02-2.jpg"],
    length: 1.2, wheel: [1, 0]
  },
  {
    id: 3, node: null,
    title: "한 여성에게 길을 물었다",
    text: "길을 묻자 손으로 방향을 짚어 주었다. 그쪽으로 가자 정말 입구가 나왔다.",
    state: "match", recovered: true,
    actions: ["이동"],
    guide: { who: "person", kind: "speech", from: "지나가던 여성", says: "저쪽이에요" },  // says: 임시 문장
    space: { says: "알려준 쪽에 실제로 입구가 보임" },
    record: { clock: "확인 필요", minutes: "확인 필요", photos: "확인 필요", battery: "확인 필요" },
    memory: { felt: null, text: "" },
    files: ["03-1.jpg", "03-2.jpg"],
    length: 1, wheel: [0, 1]
  },
  {
    id: 4, node: null,
    title: "바닷가를 따라 달렸다",
    text: "해안을 따라 난 자전거 길은 한 방향으로만 이어졌다. 길만 따라가면 됐다.",
    state: "spaceOnly", recovered: false,
    actions: ["이동"],
    guide: { who: null, kind: null, from: "", says: "" },
    space: { says: "바다를 따라 한 방향으로 이어지는 자전거 길" },
    record: { clock: "확인 필요", minutes: "확인 필요", photos: "확인 필요", battery: "확인 필요" },
    memory: { felt: null, text: "" },
    files: ["04-1.jpg", "04-2.jpg", "04-3.jpg", "04-4.jpg", "04-5.jpg"],
    length: 1.6, wheel: 1
  },
  {
    id: 5, node: "02",
    title: "출구를 찾지 못했다",
    text: "한참을 달리고 나니 이번엔 나가는 길을 알 수 없었다. 길은 계속 이어지는데, 대여점 쪽으로 빠지는 곳이 보이지 않았다.",
    state: "none", recovered: false,
    actions: ["멈춤", "물음"],
    guide: { who: null, kind: null, from: "", says: "" },
    space: { says: "출구 표시 없이 길만 계속 이어짐" },
    record: { clock: "확인 필요", minutes: "확인 필요", photos: "확인 필요", battery: "확인 필요", phoneLooked: "확인 필요" },
    memory: { felt: null, text: "" },
    files: ["05-1.jpg", "05-2.jpg"],
    length: 1.2, wheel: [1, 0]
  },
  {
    id: 6, node: null,
    title: "커플에게 묻고, 지도를 켰다",
    text: "커플이 대략적인 방향을 알려 주었다. 확실히 하려고 휴대폰 지도로 대여점까지 가는 경로를 찾았다.",
    state: "match", recovered: true,
    actions: ["물음", "이동"],
    guide: { who: "phone", kind: "handoff", from: "커플 → 휴대폰 지도", says: "대여점까지 경로 안내",
             before: { from: "커플", says: "대략 저쪽이에요" } },  // before: 넘겨주기 전 사람의 말 (임시 문장)
    space: { says: "지도가 가리키는 쪽으로 길이 이어짐" },
    record: { clock: "확인 필요", minutes: "확인 필요", photos: "확인 필요", battery: "확인 필요" },
    memory: { felt: null, text: "" },
    files: ["06-1.jpg", "06-2.jpg"],
    length: 1, wheel: [0, 1]
  },
  {
    id: 7, node: "03",
    title: "지도를 따라가다 차도에 들어섰다",
    text: "지도는 계속 이 길이 맞다고 했다. 그런데 눈앞의 길은 차가 많이 다니는 도로였고, 자전거가 다닐 길처럼 보이지 않았다. 그래도 계속 달렸다.",
    state: "mismatch", recovered: false,
    actions: ["이동"],
    guide: { who: "phone", kind: "map", from: "휴대폰 지도", says: "이쪽으로 계속 가세요" },
    space: { says: "차가 많은 도로. 자전거 길이 아님" },
    // 사진은 "거의 없음". 정확한 장수는 확인 필요
    record: { clock: "확인 필요", minutes: "약 7분", photos: "확인 필요", photosNote: "거의 없음", battery: "확인 필요" },
    memory: { felt: 30, text: "가장 불안했다. 7분이 30분처럼 길었다." },
    files: [],
    // 체감 30분 ÷ 실제 7분 ≈ 4.3 → 다른 장면보다 4배 넘게 길게
    length: 4.3, wheel: 1, bumpy: true
  },
  {
    id: 8, node: null,
    title: "앞사람을 따라갔다",
    text: "앞에 자전거를 탄 사람이 보였다. 말을 걸지는 않았다. 그 사람이 빠지는 길로 따라가니, 그 길은 자전거 길이었다.",
    state: "match", recovered: true,
    actions: ["따라감"],
    guide: { who: "person", kind: "motion", from: "앞서 가던 사람 (대화 없음)", says: "" },
    space: { says: "따라간 길은 자전거 길" },
    record: { clock: "확인 필요", minutes: "확인 필요", photos: "확인 필요", battery: "확인 필요" },
    memory: { felt: null, text: "" },
    files: ["08-1.jpg", "08-2.jpg"],
    length: 1, wheel: 1
  },
  {
    id: 9, node: null,
    title: "대여점에 도착해 반납했다",
    text: "익숙한 거리가 나오고, 대여점 간판이 보였다. 자전거를 반납했다.",
    state: "spaceOnly", recovered: false,
    actions: ["이동", "멈춤"],
    guide: { who: null, kind: null, from: "", says: "" },
    space: { says: "대여점 간판이 보임" },
    record: { clock: "확인 필요", minutes: "확인 필요", photos: "확인 필요", battery: "확인 필요" },
    memory: { felt: null, text: "" },
    files: ["09-1.jpg"],
    length: 1, wheel: [1, 0]
  },
  {
    id: 10, node: "04",
    title: "휴대폰 배터리가 거의 없었다",
    text: "반납하고 나니 배터리가 몇 퍼센트 남지 않았다. 돌아갈 길도, 연락도 모두 휴대폰에 있었다.",
    state: "risk", recovered: false,
    actions: ["물음"],
    guide: { who: "phone", kind: "battery", from: "휴대폰", says: "배터리 부족" },
    space: { says: "충전할 곳이 보이지 않음" },
    record: { clock: "확인 필요", minutes: "확인 필요", photos: "확인 필요", battery: "약 7%" },
    // 화면에서 배터리 숫자가 이 값에서 7%까지 줄어듭니다. 연출용 시작값이며 기록이 아닙니다.
    batteryFrom: 15,
    memory: { felt: null, text: "휴대폰이 꺼지면 돌아갈 방법이 없다고 느꼈다." },
    files: ["10-1.jpg"],
    length: 1.4, wheel: 0
  },
  {
    id: 11, node: null,
    title: "충전할 수 있다는 걸 알았다",
    text: "직원이 충전할 수 있는 곳을 알려 주었다. 아직 충전하기 전이었는데도, 불안은 그 순간 크게 내려갔다. 그 뒤 배터리는 약 30%까지 찼다.",
    state: "match", recovered: true,
    actions: ["이동"],
    guide: { who: "person", kind: "speech", from: "대여점 직원", says: "여기서 충전할 수 있어요" },
    space: { says: "충전할 수 있는 자리" },
    record: { clock: "확인 필요", minutes: "확인 필요", photos: "확인 필요", battery: "약 7%", batteryAfter: "약 30%" },
    memory: { felt: null, text: "충전되기 전에, 불안이 먼저 크게 내려갔다." },
    files: ["11-1.jpg"],
    length: 1.4, wheel: 0
  }
];
