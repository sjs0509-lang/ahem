# STANLEY PARK — 길을 잃었다고 느낀 순간

스탠리파크를 자전거로 한 바퀴 돌며 길을 잃었다고 느낀 세 순간을, 안내와 공간의 연결로 따라가는 정보디자인 작업.

## 파일

| 파일 | 내용 |
|---|---|
| `data.js` | ★ 모든 문장과 장면 데이터. 보통 이것만 고치면 됩니다 |
| `photos/` | NODE 사진 (`node01.jpg`, `node02.jpg`) |
| `style.css` | 색과 글꼴. 색은 맨 위 `:root` |
| `main.js` | 지도, 경로, 스크롤 연동 |
| `index.html` | 뼈대 |
| `reference/` | 시각 레퍼런스 (사이트에서는 쓰지 않음) |
| `_old/` | 이전 버전 보관 |

## data.js에서 고칠 것

- `actual` 실제 시간(분) → 지도 위 앵커 사이 경로 길이. 바꾸면 경로 비율이 자동으로 바뀝니다.
- `felt` 체감 시간(분) → 핸들 길이와 곡선의 부풂. 실제와 같으면 부풀지 않습니다.
- `estimated: true` → 화면에 작게 "추정" 표시. 확인되면 `false`로 바꾸세요.
- `guide.text`, `space.text`, `relation`(맞음 / 없음 / 어긋남), `memory`(기억)
- `photo` 사진 파일 이름. 파일이 없으면 회색 자리표시가 보입니다.
- `TEXT` 첫 화면 제목, 질문, 주제 문장, 마지막 한 줄

## 미리 보기

`index.html`을 더블클릭하면 열립니다.

## GitHub Pages 배포

1. 이 폴더를 GitHub 저장소에 올립니다.
2. **Settings → Pages**에서 Source를 `Deploy from a branch`, `main` / `(root)`로 저장합니다.
3. 1~2분 뒤 `https://<아이디>.github.io/<저장소이름>/`로 열립니다.

사진 파일 이름은 대소문자를 구분합니다 (`node01.JPG` ≠ `node01.jpg`).
