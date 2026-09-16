# 교사 생존 배터리 & 방학 D-Day

한국 선생님을 위한 데스크 친화형 생존 대시보드입니다. 한국 표준시(KST) 실시간 시계, 요일별 시간표 레이더, 교시·쉬는 시간·하교 전환 알림, 학기 생존 배터리와 방학 D-Day를 한 화면에서 제공합니다.

- 라이브 사이트: <https://thehuihuifam.github.io/school-survival-clock/>

## 주요 기능

### 시계 · 카운트다운
- 아시아/서울(KST) 기준 1초 단위 라이브 시계. 디바이스 시간대와 무관하게 동작
- **드래프트 프리 타이머**: 전용 Web Worker가 초 경계에 맞춰 틱을 생성하고, 탭이 숨겨져 있어도 시간이 밀리지 않음. Worker를 쓸 수 없는 브라우저에서는 동일 알고리즘의 메인 스레드 폴백 + `visibilitychange` 즉시 재동기화
- 현재 국면(등교 전 / 교시 진행 / 쉬는 시간 / 공백 / 하교 완료)에 맞는 메인 카운트다운과 하루 진행률 바
- 주말·공휴일·방학·개학 전 상태를 자동 감지해 "다음 등교까지" 카운트다운으로 전환
- **예비종(0교시 벨)**: 다음 교시가 1/3/5/10분 앞으로 들어오면 "GET READY · 예비종" 상태로 전환되고 차임·알림이 함께 울림 (설정에서 끄거나 간격 변경)

### 시간표 레이더
- **요일별 커스텀 시간표**: 교시 이름·구분(수업/점심/재량·동아리/방과후)·시작/종료 시각을 직접 편집
- 초등 6교시 / 중등 7교시 / 고등 7교시+자습 / 단축 4교시 프리셋, 요일 간 복사, 시간순 정렬
- 쉬는 시간은 교시 사이 5분 이상 간격에서 자동 생성, 마지막 교시~퇴근 시각은 방과후·업무 블록으로 표시
- 타임라인 위에 실시간 플레이헤드, 블록별 진행률, 완료/진행/예정 상태
- NEXT UP 레일: 지금 진행 중인 블록과 다음 일정 3건의 카운트다운 (하교 후에는 다음 등교일 자동 미리보기). 예비종 구간에 들어간 일정은 `곧 시작 · 예비종` 칩으로 강조
- **오늘 하루 예외**: 재량휴업·단축 하교처럼 그날만 다른 일정을 히어로 카드에서 한 번에 적용/해제 (날짜가 바뀌면 자동 만료)

### 알림 · 축하
- 교시 시작·쉬는 시간·점심·방과후·하교 전환 순간에 **Web Audio 차임벨** (파일 다운로드 없음)
- 옵션으로 **브라우저 알림** (기본 꺼짐, 권한 요청 후 활성화). 오래 전에 지나간 전환은 재생하지 않음
- 하교 시각 도달 시 캔버스 컨페티 + 축하 토스트 (컨페티는 코드 스플릿으로 분리, 하교 순간에만 로드)

### 학기 배터리 · 지표
- 학기 시작일 → 방학 시작일까지 **수업일 기준** 충전율 (주말·등록 휴일 제외)
- 방학 D-Day, 남은 수업일, 오늘 남은 교시/수업 시간, 하루 진행률, 주간 리듬(며칠차·쉼까지), 통계 스트립
- **학기 자동 갱신**: 기본값이 한국 학사일정(1학기 3/2~7/20, 2학기 8/18~다음 해 1/6)을 따라 오늘 기준으로 자동 계산되므로 해가 바뀌어도 방학 모드에 갇히지 않음. 직접 입력 모드로 전환하면 기존처럼 수동 지정
- 공휴일·재량휴업일 등록(고정 공휴일 일괄 추가 지원), 수업 요일 선택
- 오늘 하루 예외(휴업/단축)는 배터리·주간 리듬·다음 등교일 계산에 모두 반영

### 설정 · 데이터
- 설정은 localStorage에 자동 저장, **다른 탭과 실시간 동기화**, 스키마 검증·마이그레이션(v1 → v3) 내장: 예전 기본 학기(2026-08-25/2026-12-31)만 저장돼 있던 설정은 자동 모드로 승격되고, 직접 지정한 날짜는 그대로 보존됨
- 설정 JSON 내보내기/불러오기, 기본값 초기화
- 다크/라이트/시스템 테마(첫 페인트 전 부트스트랩으로 FOUC 없음), 전체 화면, 키보드 단축키(`S` 설정 · `T` 테마 · `F` 전체화면 · `M` 소리 · `N` 알림)

### 복원력 · PWA
- 서비스 워커: 앱 셸 프리캐시 + 해시 에셋 stale-while-revalidate + 내비게이션 network-first → **오프라인에서도 동작**
- Web App Manifest·아이콘 포함, 설치 가능(바탕화면 앱), `?open=settings` 딥링크
- 네트워크 끊김 시 헤더에 OFFLINE 칩 표시

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
```

품질 점검:

```bash
npm run icons      # src에서 참조된 Solar 아이콘을 인라인 SVG 맵으로 생성
npm run icons:app  # public/icon-*.png, apple-touch-icon.png 래스터라이즈 (의존성 없음)
npm run typecheck  # tsc -b (strict)
npm test           # vitest 단위 테스트 (스케줄 엔진·학기 수학·설정 정규화 등)
npm run build      # icons → typecheck → vite build
npm run preview    # 프로덕션 빌드 미리보기
```

앱 아이콘(`public/icon-*.png`)은 `scripts/generate-app-icons.mjs`가 의존성 없이 래스터라이즈합니다. 수정이 필요하면 `npm run icons:app`을 실행하세요.

## 배포 (GitHub Pages)

`main` 브랜치에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 **typecheck → 단위 테스트 → 빌드 → Pages 배포**를 순서대로 실행합니다.

- 배포 주소: `https://<github-사용자명>.github.io/school-survival-clock/`
- 프로덕션 빌드는 `base: './'`(상대 경로)를 사용하므로 하위 경로 어디에서도 동작합니다. 정적 리소스(CSS/JS/워커/매니페스트/아이콘)는 모두 문서 기준 상대 경로로 해결됩니다.
- 최초 1회는 저장소 **Settings > Pages > Build and deployment > Source**를 **GitHub Actions**로 지정해야 합니다.
- 수동 재배포는 Actions 탭에서 **Deploy to GitHub Pages** 워크플로를 `workflow_dispatch`로 실행하세요.

## 아키텍처

```
src/
  lib/
    time.ts        KST 변환·파싱·포맷 (순수 함수)
    semesterWindow.ts 한국 학사일정 기반 학기 창 계산(1학기/2학기 자동 전환, 방학 경계를 넘는 탐색)
    schedule.ts    요일별 시간표 → 블록/쉬는시간/상태, 휴일·방학 판정, 하루 예외(휴업/단축), 다음 일정 탐색
    semester.ts    수업일 기반 배터리 수학
    timeline.ts    타임라인 레이아웃(비율·플레이헤드)과 NEXT UP 프로젝션
    settings.ts    localStorage 저장·검증·마이그레이션·내보내기/불러오기·탭 동기화
    useNow.ts      Worker 기반 드래프트 프리 1Hz 틱 (+ 폴백)
    tick.worker.ts 배경 탭에서도 살아 있는 하트비트 워커
    alerts.ts      전환 감지(오래된 이벤트 억제) + 예비종 감지 → 차임/알림 디스패치
    sound.ts       Web Audio 차임 합성
    notify.ts      Notification API 래퍼
    theme.ts       테마 해석·시스템 선호 추적
    pwa.ts         서비스 워커 등록·설치 프롬프트
  components/      화면 컴포넌트 + settings/ (탭형 설정 에디터, 포커스 트랩)
  lib/__tests__/   vitest 단위 테스트
scripts/           아이콘 생성기 (SVG 인라인 맵, PNG 앱 아이콘)
public/            manifest, sw.js, 앱 아이콘
```

## 변경 이력

### v2.1.0 — 학기 자동 갱신 · 예비종 · 오늘 하루 예외
- **학기 창 자동 갱신**: 기본 학기(2026-08-25~12-31)가 지나도 영구 방학 모드에 갇히지 않도록, 한국 학사일정 기준으로 오늘을 지배하는 학기 창을 계산합니다. 방학 경계를 넘어 다음 등교일·다음 휴일을 미리 보여주고, 학기 배터리도 그 창 기준으로 계산합니다. 설정에서 자동/수동을 전환할 수 있습니다.
- **예비종**: 다음 교시 1/3/5/10분 전에 `GET READY · 예비종` 상태 + 차임/알림. NEXT UP 레일에서 곧 시작하는 일정을 강조합니다.
- **오늘 하루 예외**: 재량휴업·단축 하교를 히어로 카드에서 한 번에 적용. 휴업일은 수업 부하를 0으로, 단축 하교는 시간표를 실제로 잘라내며 배터리·주간 리듬·다음 등교일 계산에 반영됩니다. 날짜가 바뀌면 자동 만료.
- **수정**: 주말·공휴일·휴업일에 요일 시간표의 교시 카운터가 새어 나오던 문제, 인사말 중복(`좋은 아침입니다, 선생님, 김선생님.`), 히어로 날짜 줄의 요일 중복 표기.
- **설정 스키마 v3**(v1~v2 자동 마이그레이션), 서비스 워커 캐시 v5.
- 테스트 56 → 100개.

## 디자인 시스템

[Supanova Design Engine](./supanova-design-engine.md) 스펙을 React/Vite 구조에 맞춰 적용했습니다.

- **타이포그래피**: 본문 `Pretendard`, 영문 디스플레이 `Geist`, 숫자/시간 `Geist Mono`. 한글 제목은 `font-weight 700 · letter-spacing -0.035em · line-height 1.25`, 본문 `word-break: keep-all`.
- **컬러 토큰**: Zinc-950 계열 베이스 + Emerald 단일 액센트. 상태색은 warn/rose/red 세 가지로 제한하고, 모든 토큰은 `:root[data-theme]`에 정의되어 라이트 모드를 지원합니다.
- **아이콘**: Iconify Solar 세트를 **빌드 타임에 인라인 SVG로 생성**(`npm run icons`)합니다. 런타임 CDN 스크립트와 아이콘별 네트워크 요청이 없고, 오프라인에서도 아이콘이 보입니다.
- **재질**: 카드별 `inset 0 1px 0` 하이라이트와 틴티드 섀도, 고정 `feTurbulence` 그레인 오버레이, 에메랄드 메시 배경. 네온 외부 글로우는 사용하지 않습니다.
- **모션**: `transform`/`opacity`만 사용. 진입은 `fade-in-up` + `--index` 캐스케이드, 스크롤 게이트는 IntersectionObserver 훅(`scroll` 리스너 없음), 게이지는 `width` 대신 `transform: scaleX()`. 모든 모션은 `prefers-reduced-motion`에서 해제됩니다.
- **뷰포트**: 높이 기준 `100dvh`, 상단 바 `position: sticky` + `backdrop-filter`, 콘텐츠 `max-width: 80rem`.

## 기술 스택

- Vite + React + TypeScript (strict)
- Vitest 단위 테스트
- Canvas Confetti (하교 축하, 지연 로드)
- Iconify Solar (빌드 타임 인라인) + Pretendard / Geist / Geist Mono
- 서비스 워커 + Web App Manifest (PWA)
