# 2학년 2반 통합 홈페이지

메인 허브, 선생님 출결 등록, 학생 상점 조회를 하나의 저장소와 Cloudflare Workers 배포로 운영합니다.
기존 화면 디자인과 Notion 데이터를 유지합니다.

| 주소 | 기능 | 수정 위치 |
| --- | --- | --- |
| / | 메인 허브 | public/index.html, public/home/ |
| /attendance | 비밀 코드로 로그인하는 출결 관리 | src/app/attendance/ |
| /points | 학생 조회·랭킹·출결/역할 달력 | public/points/ |
| /api/attendance, /api/analytics | 교사 인증 필수 출결 API | src/app/api/ |
| /api/points/* | 개인정보를 제외한 상점 조회 API | src/lib/points/ |

허브의 다른 외부 서비스는 기존 링크를 유지합니다. 메뉴 주소는 public/home/script.js의 portals에서 바꿉니다.
HTML 화면은 일반 링크로 이동하므로 각 앱의 CSS와 이벤트가 서로 섞이지 않습니다.

## 로컬 실행

Node.js 22 이상을 사용합니다.

1. npm ci
2. .dev.vars.example을 .dev.vars로 복사하고 실제 값을 입력합니다.
3. npm run dev
4. http://localhost:3000 을 엽니다.

Cloudflare 런타임으로 확인하려면 npm run build:cloudflare 후 npm run preview -- --port 8790을 실행합니다.
Windows에서 어댑터 문제가 발생하면 WSL 또는 Cloudflare의 Linux 빌드 환경을 사용하세요.

## Cloudflare 배포 (직접 진행)

Cloudflare Workers & Pages → Create → Git 저장소 연결에서 이 저장소를 선택합니다.
통합 브랜치를 검토 후 배포할 브랜치로 선택하거나 main에 병합합니다.

- 설치: npm ci
- 빌드 명령: npm run build:cloudflare
- 배포 명령: npm run deploy
- 루트 디렉터리: 저장소 루트
- 배포 유형: Workers (Next.js 서버 API 포함)

배포 대상 Worker의 Settings → Variables and Secrets에 아래 세 값을 **Secret**으로 등록하세요.
빌드 변수에만 넣으면 런타임에서 읽지 못하므로 Worker 런타임 Secret에 설정해야 합니다.

| Secret 이름 | 내용 |
| --- | --- |
| NOTION_API_TOKEN | 출결·명단·역할 수행·제외일 DB 접근이 허용된 Notion 통합 토큰 |
| SESSION_SECRET | 최소 32자 무작위 문자열. 인증 쿠키 서명에 사용 |
| APP_PASSCODE | 교사용 4~6자리 숫자 비밀 코드 |

SESSION_SECRET 생성: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
기존 PASSCODE_HASH를 사용하려면 APP_PASSCODE 대신 Secret으로 등록할 수 있습니다. 두 값이 있으면 PASSCODE_HASH가 우선합니다.
NOTION_TOKEN은 사용하지 않으며, 출결과 상점 모두 NOTION_API_TOKEN을 읽습니다.
토큰에 NEXT_PUBLIC_ 접두어를 붙이지 마세요. .dev.vars와 .env 파일은 Git에서 제외합니다.

출결 DB ID와 학생 명단 DB ID, 한국 시간대는 wrangler.jsonc의 vars에 있습니다. 역할/제외일 데이터 소스는 src/lib/points/notion-data.mjs의 SOURCES에 있습니다.
같은 Notion 기록을 읽고, 상점은 2026-10-01부터 계산하며 화면에서 1분마다 갱신합니다. 서버 조회 캐시는 30초입니다.
출결 저장은 기존 날짜·학생 기록을 수정하거나 새로 작성합니다. 설정 누락 시 임시 저장 성공으로 표시하지 않습니다.
상점용 API는 연락처·사유 등 비공개 출결 세부 정보를 내려주지 않습니다.

## 검증

- npm test: 기존 출결 저장, 점수 계산, 조회 기간/달력/랭킹, 개인정보 제외, 인증 검증
- node tests/smoke.mjs: 로컬 미리보기에서 실제 데이터 읽기와 인증 확인 (Notion 쓰기 없음)
- npm run lint
- npm run build:cloudflare
- npx wrangler deploy --dry-run: 업로드 없이 배포 번들 확인

[Cloudflare용 OpenNext 설정](https://opennext.js.org/cloudflare/get-started) · [런타임 환경 변수](https://opennext.js.org/cloudflare/howtos/env-vars)

현재 npm audit에는 OpenNext/ESLint의 간접 빌드 도구(glob/minimatch) 경고가 남아 있습니다. 어댑터 구버전으로 강제 다운그레이드하지 않았습니다. 앱 서버 번들에는 이 빌드 도구가 포함되지 않습니다.
