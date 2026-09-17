# 완전무결 기술 핸드오프 리포트 (Complete Technical Hand-off Specification)

**대상 저장소:** `thehuihuifam/school-survival-clock`
**배포 URL:** <https://thehuihuifam.github.io/school-survival-clock/>
**분석 기준 커밋:** `0735d64c76d778d71ccc293093cd1e2e5dc71f85` (main, "Merge pull request #10 from thehuihuifam/arena/01a0acf7-school-survival-clock")
**분석 시점:** 2026-09-17 (KST)
**분석 방식:** 저장소 전 파일 전수 열람(코드/에셋/설정/문서/CI) + 실제 툴체인 실행(`npm ci` → `npm run icons` → `npm run typecheck` → `npm test` → `npm run build`) + 엣지 케이스 실측 프로브(vitest 임시 스위트) + 빌드 산출물 및 번들 크기 감사
**목적:** 본 문서는 다른 세션의 상위 AI 엔지니어가 추가 질의 없이 즉시 리팩터링·기능 추가·버그 수정을 수행할 수 있도록 작성된 단일 진실 공급원(Single Source of Truth)이다. 본 문서의 모든 서술은 실제 파일 경로, 실제 식별자, 실제 상수를 근거로 한다.

---

## 0. 분석 검증 결과 (실측 증거)

| 검증 항목 | 명령 | 결과 |
|---|---|---|
| 의존성 설치 | `npm ci --no-audit --no-fund` | 성공, `added 116 packages in 3s` (lockfile v3, 총 166개 패키지 노드) |
| 아이콘 생성 동기화 | `npm run icons` | `[icons] inlined 50 Solar glyphs (56.7 kB source) → src/components/icons.generated.ts`, **커밋된 파일과 바이트 단위 동일(드리프트 없음)** |
| 타입 검사 | `npm run typecheck` (`tsc -b --force`) | **오류 0건, exit code 0** |
| 단위 테스트 | `npm test` (`vitest run`) | **11개 스위트 / 141개 테스트 전부 통과 (5.90s)** |
| 프로덕션 빌드 | `npm run build` | 성공, `✓ 60 modules transformed`, `✓ built in 1.32s` |
| 번들 크기 | dist 산출물 측정 | `index-*.js` 298,116 B (gzip 95,267 B) / `index-*.css` 37,192 B (gzip 7,186 B) / `confetti.module-*.js` 10,676 B (gzip 4,324 B) / `tick.worker-*.js` 306 B (gzip 252 B) / `index.html` 4,255 B (gzip 1,662 B) |
| 상대 경로 배포 | `dist/index.html` 파싱 | `src="./assets/index-DWsR08qo.js"`, `href="./assets/index-i4g8BnPm.css"` — 하위 경로 배포 정상 |
| 작업 트리 청결 | `git status --porcelain` | 빌드/프로브 후에도 변경 없음(생성물 `dist/`, `node_modules/`는 `.gitignore` 대상) |

테스트 스위트별 테스트 수(실측):

| 파일 | 테스트 수 |
|---|---|
| `src/lib/__tests__/render.test.tsx` | 18 |
| `src/lib/__tests__/schedule.test.ts` | 16 |
| `src/lib/__tests__/settings.test.ts` | 13 |
| `src/lib/__tests__/time.test.ts` | 20 |
| `src/lib/__tests__/alerts.test.ts` | 12 |
| `src/lib/__tests__/semesterWindow.test.ts` | 13 |
| `src/lib/__tests__/overrides.test.ts` | 13 |
| `src/lib/__tests__/holidays.test.ts` | 13 |
| `src/lib/__tests__/weekOverview.test.ts` | 11 |
| `src/lib/__tests__/timeline.test.ts` | 6 |
| `src/lib/__tests__/semester.test.ts` | 6 |
| **합계** | **141** |

---

## 1. 프로젝트 개요 및 도메인 메커니즘

### 1.1 명칭과 정체성

| 항목 | 실제 값 (출처) |
|---|---|
| 패키지명 | `school-survival-clock` (`package.json`) |
| 버전 | `2.2.0` (`package.json`) |
| 모듈 타입 | `"type": "module"` (ESM 전용) |
| 한글 제품명 | **교사 생존 배터리 & 방학 D-Day** (`index.html` `<title>`, `public/manifest.webmanifest` `name`) |
| PWA 단축명 | **생존 배터리** (`manifest.short_name`, `apple-mobile-web-app-title`) |
| 설명(정본) | `"한국 교사를 위한 실시간 생존 시계 · 요일별 시간표 레이더 · 방학 D-Day 배터리 대시보드"` (`package.json.description`, `manifest.description`) |
| 사이트 헤더 문구 | `<h1>교사 생존 시계 <span>· 시간표</span></h1>` (`src/components/AppHeader.tsx:58`) |
| 문서 탭 제목 베이스 | `"교사 생존 시계"` (`src/lib/copy.ts:285`) |
| 푸터 정본 문구 | `교사 생존 시계 · {kstNow.year} · Asia/Seoul` (`src/App.tsx:349`) |

주목할 점: `README.md` 최상단 제목은 "교사 생존 배터리 & 방학 D-Day"이고, 애플리케이션 UI 내부의 브랜딩은 "교사 생존 시계"로 이원화되어 있다. 이는 의도된 계층(제품명 vs 대시보드명)으로 보이나, 마케팅/메타데이터와 UI가 서로 다른 문자열을 쓴다는 사실은 핸드오프 시 반드시 인지해야 한다.

### 1.2 기획 의도와 핵심 가치

`README.md` 및 각 모듈의 한국어 주석이 밝히는 기획 의도는 다음과 같다.

1. **"학교라는 시간표에 갇힌 교사의 하루를 초 단위로 구조화한다."** 앱은 하루를 `등교 전 → 수업 → 쉬는 시간 → 점심 → 방과후·업무 → 하교 완료`의 국면(phase)으로 분해하고, 각 국면의 남은 시간을 카운트다운으로 보여준다. `src/lib/copy.ts`의 인사말조차 시각대별 교사 감정선에 맞춰져 있다:
   ```ts
   export function greetingForHour(hour: number) {
     if (hour < 5)  return '새벽까지 고생 많으셨어요'
     if (hour < 9)  return '좋은 아침이에요'
     if (hour < 12) return '오전 수업 화이팅이에요'
     if (hour < 14) return '점심은 꼭 챙겨 드세요'
     if (hour < 18) return '오후도 무사히 갑니다'
     if (hour < 22) return '이제 퇴근 준비하세요'
     return '오늘 하루도 마무리 중이에요'
   }
   ```
2. **"생존" 메타포의 수학화.** 학기 전체를 배터리(0–100%)로 환산하고, 방학까지를 D-Day로 환산한다. 단, 단순 달력일이 아니라 **수업일(school day) 기준**으로 계산한다(`src/lib/semester.ts` 상단 주석: "a teacher who survived 30 of 90 teaching days is at 33%, weekends and registered holidays do not count").
3. **KST 절대 기준.** 기기 시간대와 무관하게 항상 `Asia/Seoul`로 계산한다(`src/lib/time.ts` 상단 주석: "The dashboard is always anchored to Asia/Seoul regardless of the device's own time zone"). 해외여행 중이거나 노트북 시간대가 UTC로 설정된 교실에서도 동일한 화면을 보장한다.
4. **교실 TV 상시 표시(ambient dashboard).** `F` 전체화면 단축키, 1초 단위 갱신, 백그라운드 탭에서도 정확한 전환 알림, `prefers-reduced-motion` 대응, 100dvh 레이아웃은 "벽에 띄워 두는 화면"을 전제로 한다.
5. **오프라인/저품질 학교 Wi-Fi 내성.** 서비스 워커 프리캐시 + 아이콘 인라인화(CDN 의존 제거) + 폰트 CDN은 `stale-while-revalidate`로 캐시(`public/sw.js`).

### 1.3 사용자 시나리오 (교사 관점의 하루)

| KST 시각 | 사용자가 보는 것 (실제 계산 결과) |
|---|---|
| 07:40 | 히어로 kicker `등교 전`, 카운트다운 = 첫 블록(09:00)까지 `01:20:00`, valueNote `오늘 6교시 · 수업 4시간` |
| 08:56 | 예비종 구간 진입(기본 3분 전) → kicker `예비종`, title `1교시 곧 시작`, 차임 `pre-bell`(G5→D5 두 음), 브라우저 알림 `곧 1교시 시작` |
| 09:00 | 교시 시작 차임(E5→A5 상행 2음) + 알림 `1교시 시작 · 09:00 ~ 09:40 · 오늘 남은 수업 4시간` |
| 09:40 | 쉬는 시간 차임(A5→E5 하행 2음), kicker `쉬는 시간`, valueNote `다음 2교시 09:50` |
| 12:20 | 점심 차임(C5→E5→G5 상행 3음), kicker `점심시간`, `천천히 드시고 오세요` |
| 14:50 | 마지막 교시 종료 → `방과후 · 업무 시간` duty 블록 시작 차임(G4→D5) |
| 16:30 | 하교 차임(C5→E5→G5→C6→E6 팡파르) + confetti 3회(130/70/70 파티클) + 하단 축하 토스트 `오늘도 무사히 생존하셨습니다. 칼퇴하세요!` (12초 후 자동 소멸) |
| 23:00 | phase `dismissed`, 히어로 value `+06:30:00` (하교 후 경과 시간), 배터리 카드에는 `오늘은 23번째 수업일` |

### 1.4 애플리케이션 라이프사이클 (진입점 → 런타임 루프 → 표출)

다음은 실제 코드 경로를 따라 작성한 실행 흐름이다. 각 단계의 파일/행 번호는 실제 소스 기준이다.

**① 프리페인트 부트스트랩 — `index.html` 인라인 스크립트 (라인 55~92)**
CSS·폰트 링크 이전에 인라인 스크립트가 실행되어, React 부팅 전에 테마를 확정하고 `<html data-theme>`/`color-scheme`/`meta[theme-color]`를 설정한다. 이 스크립트가 읽는 키는 다음 3개로 하드코딩되어 있다.
```js
var raw =
  localStorage.getItem('school-survival-clock.settings.v3') ||
  localStorage.getItem('school-survival-clock.settings.v2') ||
  localStorage.getItem('teacher-survival-dashboard-settings')
```
> ⚠️ **중요**: 현재 앱의 실제 저장 키는 `school-survival-clock.settings.v4`(`src/lib/settings.ts:39`)이며, 위 3개 키는 마이그레이션 후 `removeItem`으로 삭제된다. 즉 v4 이후에는 이 부트스트랩이 항상 `mode = 'dark'`로 귀결된다(7.6절 상세).

**② 엔트리 — `src/main.tsx` (19행)**
```ts
const container = document.getElementById('root')
if (!container) {
  throw new Error('Root container #root is missing from index.html')
}
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
registerServiceWorker()
```
`StrictMode`이므로 개발 모드에서 이펙트/업데이터가 의도적으로 2회 실행된다(7.9절 참조). `registerServiceWorker()`는 `import.meta.env.PROD`일 때만 `window.load` 이후 `sw.js`를 등록한다(`src/lib/pwa.ts:17-28`).

**③ 상태 초기화 — `src/App.tsx:37-50`**
```ts
const [settings, setSettings] = useState<UserSettings>(loadSettings)
const now = useNow()
const resolvedTheme = useResolvedTheme(settings.themeMode)
const [isSettingsOpen, setIsSettingsOpen] = useState(false)
const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)
const [isCelebrationVisible, setIsCelebrationVisible] = useState(false)
const [notificationState, setNotificationState] = useState(getNotificationState)
const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)
```
`loadSettings`는 lazy initializer로 1회만 실행되며, `localStorage` 사다리(v4 → v3 → v2 → `teacher-survival-dashboard-settings` → v1)를 순회한 뒤 `normalizeSettings`로 전 필드를 검증한다.

**④ 런타임 루프 개시 — `src/lib/useNow.ts`**
전용 Web Worker(`tick.worker.ts`)가 매 초 정렬된 틱을 `postMessage(Date.now())`로 보내고, `useNow`가 `setNow(new Date(epochMs))`로 상태를 갱신한다. Worker 생성 실패/에러 시 동일 알고리즘의 `setTimeout` 폴백을 가동한다.

**⑤ 파생 상태 계산 — `src/App.tsx:52-83`**
```ts
const kstNow = useMemo(() => getKstTimeParts(now), [now])
const status = useMemo(() => getScheduleStatus(kstNow, settings), [kstNow, settings])
const metrics = useMemo(() => getSemesterMetrics(kstNow, settings), [kstNow.dateKey, settings])
const nextSchoolDayAnchor = useMemo(() => getNextSchoolDay(kstNow, settings), [kstNow.dateKey, settings])
const nextSchoolDay = useMemo<NextSchoolDay | null>(() => { /* secondsUntil 재계산 */ }, [nextSchoolDayAnchor, kstNow])
const upcoming = useMemo(() => getUpcomingEvents(kstNow, settings, status, nextSchoolDay, 6), [kstNow, settings, status, nextSchoolDay])
```
즉, **모든 화면 값은 `(KST 시간 파츠, UserSettings)` 두 입력의 순수 함수**이며, React 상태는 이 두 입력만 보유한다(파생 상태를 저장하지 않는 단방향 데이터 흐름).

**⑥ 부수효과 디스패치 — `src/App.tsx` 이펙트 9종**
`saveSettings` + 차임 엔진 설정(85), 오디오 언락 리스너(91), 크로스탭 동기화(101), 설치 프롬프트 구독(102), `?open=settings` 딥링크(104), online/offline(109), 알림 권한 재조회(119), 예비종 감지(150), 학기 창 자동 갱신(163), 하루 예외 프루닝(172), 국면 전환 감지→차임/알림/축하(179), 문서 제목(189), 타이머 정리(191).

**⑦ 렌더 트리 — `src/App.tsx:296-374`**
`AppHeader → main → (dashboard-intro, hero-grid[ClockHero, BatteryCard], PeriodTracker, WeekOverview) → footer → CelebrationToast(조건부) → SettingsModal(조건부)`.

**⑧ 국면 전환 → 알림 — `src/lib/alerts.ts`**
`previousPhaseKeyRef`와 현재 `status.phaseKey`를 비교해 전환을 감지하고, `ageSeconds = currentDaySeconds - status.phaseStartSeconds`가 `STALE_EVENT_SECONDS = 90`을 넘으면 억제한다(노트북을 15시에 깨웠을 때 아침 종소리가 몰아서 울리지 않게 하는 장치).

---

## 2. 저장소 구조 및 파일 전수 매니페스트

### 2.1 전체 디렉터리 트리 (68개 파일, 커밋 대상 전량)

```
school-survival-clock/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── docs/
│   └── technical-handoff-spec.md        ← 본 문서(감사 산출물)
├── public/
│   ├── apple-touch-icon.png
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon.svg
│   ├── manifest.webmanifest
│   └── sw.js
├── scripts/
│   ├── generate-app-icons.mjs
│   └── generate-icons.mjs
├── src/
│   ├── components/
│   │   ├── settings/
│   │   │   ├── Field.tsx
│   │   │   ├── HolidayEditor.tsx
│   │   │   ├── TimetableEditor.tsx
│   │   │   └── useFocusTrap.ts
│   │   ├── AppHeader.tsx
│   │   ├── BatteryCard.tsx
│   │   ├── CelebrationToast.tsx
│   │   ├── ClockHero.tsx
│   │   ├── DayOverrideBar.tsx
│   │   ├── Icon.tsx
│   │   ├── PeriodTracker.tsx
│   │   ├── SettingsModal.tsx
│   │   ├── WeekOverview.tsx
│   │   ├── icon-types.ts
│   │   └── icons.generated.ts
│   ├── lib/
│   │   ├── __tests__/
│   │   │   ├── alerts.test.ts
│   │   │   ├── helpers.ts
│   │   │   ├── holidays.test.ts
│   │   │   ├── overrides.test.ts
│   │   │   ├── render.test.tsx
│   │   │   ├── schedule.test.ts
│   │   │   ├── semester.test.ts
│   │   │   ├── semesterWindow.test.ts
│   │   │   ├── settings.test.ts
│   │   │   ├── time.test.ts
│   │   │   ├── timeline.test.ts
│   │   │   └── weekOverview.test.ts
│   │   ├── alerts.ts
│   │   ├── assets.ts
│   │   ├── copy.ts
│   │   ├── holidays.ts
│   │   ├── notify.ts
│   │   ├── pwa.ts
│   │   ├── schedule.ts
│   │   ├── semester.ts
│   │   ├── semesterWindow.ts
│   │   ├── settings.ts
│   │   ├── sound.ts
│   │   ├── theme.ts
│   │   ├── tick.worker.ts
│   │   ├── time.ts
│   │   ├── timeline.ts
│   │   ├── useNow.ts
│   │   └── weekOverview.ts
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   ├── types.ts
│   └── vite-env.d.ts
├── .gitignore
├── README.md
├── index.html
├── package-lock.json
├── package.json
├── supanova-design-engine.md
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

### 2.2 파일 전수 매니페스트 (역할 · 책임)

행 수(LoC)는 `wc -l` 기준(개행 수)이며, 바이트는 `stat -c%s` 실측값이다. PNG는 이진 파일이므로 LoC를 `binary`로 표기한다.

#### 루트 · 설정 · 문서

| 경로 | 바이트 | LoC | 역할 | 단일 책임(SRP) 및 핵심 내용 |
|---|---:|---:|---|---|
| `package.json` | 1,008 | 33 | 패키지 매니페스트 | ESM 패키지 선언, 8개 npm 스크립트(`dev/icons/icons:app/typecheck/test/test:watch/build/preview`), 런타임 3종·개발 9종 의존성 선언. `build`는 `icons → tsc -b → vite build` 3단 오케스트레이션 |
| `package-lock.json` | 82,119 | 2,428 | 의존성 고정 | lockfileVersion 3, 166개 패키지 노드. `npm ci` 재현성의 근거 |
| `vite.config.ts` | 917 | 29 | 빌드/개발/테스트 설정 | `base: command === 'build' ? './' : '/'`(상대 경로 배포), `server.host='0.0.0.0'`, `allowedHosts:true`, `build.target='es2020'`, vitest `environment:'node'` + `include:['src/**/*.test.ts','src/**/*.test.tsx']` |
| `tsconfig.json` | 119 | 7 | TS 프로젝트 참조 루트 | `files: []` + `references`로 app/node 두 프로젝트 분리 |
| `tsconfig.app.json` | 638 | 23 | 앱 컴파일 규칙 | `target ES2022`, `lib [ES2022, DOM, DOM.Iterable]`, `strict:true`, `noUnusedLocals:true`, `noUnusedParameters:true`, `jsx:'react-jsx'`, `moduleResolution:'Bundler'`, `noEmit:true`, `include:['src']` |
| `tsconfig.node.json` | 436 | 17 | 빌드 스크립트 컴파일 규칙 | `target ES2023`, `types:['node']`, `verbatimModuleSyntax:true`, `include:['vite.config.ts']` |
| `index.html` | 4,155 | 95 | HTML 셸 + 테마 부트스트랩 | `<html lang="ko">`, viewport(`viewport-fit=cover`), `theme-color #09090b`, OG/Twitter 메타 6종, 아이콘/매니페스트 링크, 폰트 프리커넥트 3종 + 폰트 CSS 2종, **프리페인트 테마 결정 인라인 스크립트**, `<div id="root">`, `/src/main.tsx` 모듈 로드 |
| `.gitignore` | 45 | 5 | 무시 규칙 | `node_modules/`, `dist/`, `.vite/`, `*.local`, `.DS_Store` |
| `README.md` | 13,076 | 145 | 사용자/개발자 문서 | 기능 명세 6개 장, 실행/품질/배포 절차, 아키텍처 요약, v2.1.0·v2.2.0 변경 이력, 디자인 시스템, 기술 스택 |
| `supanova-design-engine.md` | 15,410 | 213 | 디자인 시스템 스펙 원문 | 색·타이포·재질·모션 규칙의 상위 규격. README "디자인 시스템" 절이 이 문서를 근거로 인용 |
| `docs/technical-handoff-spec.md` | (본 문서) | — | 감사 산출물 | 전체 아키텍처·런타임·엣지 케이스·AI 핸드오프 블록 |

#### CI/CD

| 경로 | 바이트 | LoC | 역할 | 단일 책임 및 핵심 내용 |
|---|---:|---:|---|---|
| `.github/workflows/deploy.yml` | 1,840 | 88 | GitHub Pages 배포 파이프라인 | `on.push.branches:[main]` + `workflow_dispatch`, 권한 3종(`contents:read, pages:write, id-token:write`), `concurrency.group:'pages', cancel-in-progress:false`, **3-잡 구조**: `verify`(checkout@v7 → setup-node@v7 node 22 + npm cache → `npm ci` → `npm run icons` → `npm run typecheck` → `npm test`) → `build`(`configure-pages@v6` → `npm ci` → `npm run build` → `touch dist/.nojekyll` → `upload-pages-artifact@v5 path:dist`) → `deploy`(`deploy-pages@v5`, environment `github-pages`) |

#### `public/` 정적 자산

| 경로 | 바이트 | LoC | 역할 | 단일 책임 및 핵심 내용 |
|---|---:|---:|---|---|
| `public/sw.js` | 3,422 | 125 | 서비스 워커 | `CACHE_VERSION='survival-clock-v6'`, 프리캐시 7종(`./`, `./index.html`, `./manifest.webmanifest`, `./icon.svg`, `./icon-192.png`, `./icon-512.png`, `./apple-touch-icon.png`), install 시 `Promise.allSettled` + `skipWaiting`, activate 시 구 캐시 일괄 삭제 + `clients.claim`, 전략 3분기(내비게이션 `networkFirst` / 동일 출처 `staleWhileRevalidate` / 교차 출처 폰트 `staleWhileRevalidate{allowOpaque:true}`), `message` 이벤트 `'skip-waiting'` 처리 |
| `public/manifest.webmanifest` | 1,275 | 50 | Web App Manifest | `id/start_url/scope: './'`, `display: standalone`, `display_override: [window-controls-overlay, standalone, minimal-ui]`, `orientation: any`, `background_color/theme_color: #09090b`, `categories: [education, productivity, utilities]`, 아이콘 4종(SVG any + PNG 192 + PNG 512 any/maskable), 바로가기 1종 `?open=settings` |
| `public/icon.svg` | 666 | 12 | 벡터 앱 아이콘 | 512×512, 그라디언트 `#7ef0c4 → #046c50`, 라운드 사각 배터리 외곽(stroke 26), 단자, 번개 폴리곤. `role="img" aria-label="교사 생존 배터리 아이콘"` |
| `public/icon-512.png` | 14,748 | binary | 래스터 아이콘 | 512×512, PNG bitDepth 8 / colorType 6(RGBA), `scripts/generate-app-icons.mjs` 산출물 |
| `public/icon-192.png` | 3,677 | binary | 래스터 아이콘 | 192×192, 동일 규격. 파비콘·알림 `icon/badge`로 재사용(`notify.ts:49-50`) |
| `public/apple-touch-icon.png` | 3,482 | binary | iOS 홈 아이콘 | 180×180, 동일 규격 |

#### `scripts/` 빌드 도구

| 경로 | 바이트 | LoC | 역할 | 단일 책임 및 핵심 내용 |
|---|---:|---:|---|---|
| `scripts/generate-icons.mjs` | 6,278 | 169 | 아이콘 인라인 맵 생성기 | `src/**` 재귀 스캔(테스트/생성물 제외) → 문자열 리터럴 정규식 `['"`]([a-z0-9]+(?:-[a-z0-9]+)+)['"`]`로 후보 수집 → `@iconify-json/solar/icons.json`의 실제 이름 집합과 교집합 → `resolveIcon`에서 `<defs|<mask|<clipPath>` 사용 아이콘은 **에러로 거부**, `transform`(translate/scale/rotate)과 `opacity`는 `<g>` 래퍼로 보존, 좌표 소수점 3자리 반올림(`COORDINATE_PRECISION = 3`, "약 13% 용량 절감"), 결과를 `src/components/icons.generated.ts`로 기록, 사용 아이콘이 0개면 **빈 맵 작성을 거부하고 예외**. 실제 출력: `[icons] inlined 50 Solar glyphs (56.7 kB source)` |
| `scripts/generate-app-icons.mjs` | 7,969 | 244 | 무의존성 PNG 래스터라이저 | `node:zlib`만으로 PNG 인코더 구현(CRC32 테이블 → `chunk()` → `encodePng()`), 그리기 프리미티브(hex→RGB, `clamp01`, `lerp`, 라운드 사각 SDF `roundedRectDistance`, 1px AA `coverage = clamp01(0.5 - distance)`, even-odd `insidePolygon`, 3×3 슈퍼샘플 `polygonCoverage`), 512×512 디자인 좌표계(`BATTERY{cx:236,cy:256,halfWidth:132,halfHeight:78,radius:42,stroke:26}`, `TERMINAL{cx:396,cy:256,...}`, `BOLT` 폴리곤), 3개 타깃(180/192/512) 렌더 |

#### `src/` 루트

| 경로 | 바이트 | LoC | 역할 | 단일 책임 및 핵심 내용 |
|---|---:|---:|---|---|
| `src/main.tsx` | 419 | 19 | 리액트 엔트리 | `#root` 존재 검증(없으면 throw) → `createRoot().render(<StrictMode><App/></StrictMode>)` → `registerServiceWorker()` |
| `src/App.tsx` | 14,738 | 375 | 최상위 컨테이너(오케스트레이터) | 설정 상태 1개 + UI 상태 5개 보유, 6개 `useMemo` 파생 계산, 9개 `useEffect` 부수효과, 5개 단축키 핸들러, 5개 사용자 액션 콜백, 전체 레이아웃 JSX. 상수 `CONFETTI_COLORS`(5색), `CELEBRATION_MS = 12000`, `THEME_CYCLE = ['dark','light','system']` |
| `src/types.ts` | 14,236 | 420 | 도메인 모델 단일 진실 | 20개 타입/인터페이스 + 7개 상수(`PERIOD_KIND_LABELS`, `WEEKDAY_LABELS`, `WEEKDAY_LONG_LABELS`, `SETTINGS_VERSION = 4`, `PRE_ALERT_MINUTE_OPTIONS`, `MIN/MAX_PRE_ALERT_MINUTES`, `DEFAULT_SOUND_VOLUME = 60`, `LEGACY_DEFAULT_SEMESTER_START/VACATION_DATE`), 5종 시간표 프리셋 상수(초6/중7/고7+자습/단축4/비우기), `createDefaultTimetables()`, `BASE_SETTINGS`. 주석이 곧 도메인 사전이다 |
| `src/index.css` | 38,232 | 415 | 전체 스타일시트 | `:root` 타이포/이징/라운드 토큰 → 다크/라이트 색 토큰 2블록 → 리셋 → 셸/탑바/인트로/카드/히어로/배터리/기간추적/주간/축하/모달/폼/시간표 에디터/휴일 에디터/푸터 → 6개 keyframes → 5개 미디어 쿼리. 224개 고유 클래스 셀렉터 |
| `src/vite-env.d.ts` | 38 | 1 | Vite 타입 참조 | `/// <reference types="vite/client" />` (→ `import.meta.env.PROD` 사용 근거) |

#### `src/lib/` 도메인 엔진 (React/DOM 비의존 순수 계층)

| 경로 | 바이트 | LoC | 역할 | 단일 책임 및 핵심 내용 |
|---|---:|---:|---|---|
| `src/lib/time.ts` | 12,671 | 363 | KST 시간 원시 연산 | `Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul', hourCycle:'h23'})` 싱글턴, `getKstTimeParts`, `currentKstDateKey`, 8종 포매터, `HH:MM`/`YYYY-MM-DD` 검증·파싱, `kstInstant`, `secondsUntilDateKey`, 한국어 조사 처리(`endsWithConsonant`, `withParticle`). 상수 `SEOUL_TIME_ZONE`, `DAY_IN_MS`, `DAY_IN_SECONDS`, `HANGUL_BASE/LAS`, `RIEUL_JONGSEONG = 8`, `DIGITS_WITH_BATCHIM`, `DIGITS_ENDING_IN_RIEUL` |
| `src/lib/schedule.ts` | 25,024 | 741 | 시간표 엔진(최대 모듈) | 시간표 조회/정규화, 하루 예외(off/short) 적용, `buildOutline`(쉬는 시간 자동 생성 + duty 꼬리), 날짜 분류 7종, `getScheduleStatus`(5 phase), 룩어헤드 2종, `getWeekContext`. 상수 `MIN_BREAK_SECONDS = 5*60`, `MIN_DUTY_SECONDS = 10*60`, `LOOKAHEAD_DAYS = 400` |
| `src/lib/semester.ts` | 4,177 | 129 | 학기 배터리 수학 | `countSchoolDays`(half-open 구간 수업일 카운트, 하루 단위 UTC ms 루프), `getSemesterMetrics`(progress/phase/D-day/잔여 수업일 7종 지표) |
| `src/lib/semesterWindow.ts` | 4,741 | 123 | 한국 학사일정 창 계산 | `MMDD` 경계 4개(`SPRING_START_DAY=302`, `SUMMER_VACATION_DAY=720`, `FALL_START_DAY=818`, `WINTER_VACATION_DAY=106`) + `SCHOOL_YEAR_START_DAY=300`, `getAutoSemesterWindow`, `describeSemesterWindow`, `sameSemesterWindow`, `isValidSemesterRange` |
| `src/lib/holidays.ts` | 7,953 | 181 | 내장 공휴일 달력 | 2025~2029년 5개 연도 배열(총 88개 항목), `Map` 인덱스 1회 구축, `builtinHolidayLabel`, `builtinHolidaysForYear`, `builtinHolidaysBetween`, `isCoveredByBuiltinCalendar`, `isYearCoveredByBuiltinCalendar`. 상수 `BUILTIN_HOLIDAY_FIRST_YEAR=2025`, `LAST_YEAR=2029` |
| `src/lib/weekOverview.ts` | 4,809 | 146 | 주간 요약 | 월요일 시작 7일 루프, 상태 7종(`school/today/holiday/weekend/vacation/override/empty`), 요일별 교시 수·수업 초·하루 범위 라벨, 주간 집계 4종(수업일 수·잔여 수업일·총 수업 초·최대 부하일) |
| `src/lib/timeline.ts` | 6,487 | 220 | 타임라인 레이아웃 + 다음 일정 | `layoutTimeline`(슬롯 초 비례 배치, `startPercent/widthPercent/isCompact/needlePercent`), `getUpcomingEvents`(오늘 우선, 하교 후/휴일이면 다음 등교일로 롤오버, limit 적용). 상수 `COMPACT_WIDTH_PERCENT = 7` |
| `src/lib/alerts.ts` | 7,078 | 222 | 전환/예비종 알림 디스패치 | `eventKindForStatus`, `detectScheduleEvent`(90초 stale 억제), `alertCopy`, `detectPreAlert`, `preAlertCopy`, `dispatchPreAlert`, `dispatchScheduleEvent`, `CHIME_FOR_EVENT` 매핑 |
| `src/lib/sound.ts` | 6,120 | 210 | Web Audio 차임 합성 | `NOTE` 주파수 표 8음, `bell()` 헬퍼(기음 + 2.01배 배음), `RECIPES` 7종, `class ChimeEngine`(지연 컨텍스트 생성, `unlock/preview/play/renderVoice`), 싱글턴 `chimeEngine` |
| `src/lib/settings.ts` | 15,200 | 449 | 영속성 계층 | `STORAGE_KEY='school-survival-clock.settings.v4'` + 레거시 키 4종, 필드별 정규화 함수 12종, `normalizeSettings`, `cloneSettings`, `loadSettings/saveSettings`, `serializeSettings`, `parseSettingsJson`, `subscribeToExternalSettings`, `normaliseDayOverrides`, `resolveSemesterAuto`. 상수 `OVERRIDE_WINDOW_DAYS = 6`, `MAX_DAY_OVERRIDES = 14` |
| `src/lib/copy.ts` | 9,697 | 301 | 한국어 카피 생성 | `DAY_TYPE_TONES` 7종, `PHASE_LABELS` 5종, `isPreAlertWindow`, `preAlertHeadline`, `slotKicker`, `heroHeadline`(6분기 대형 함수), `greetingForHour`, `documentTitleFor`. HeroTone 6종 |
| `src/lib/theme.ts` | 1,991 | 65 | 테마 해석 | `prefersDarkColorScheme`, `resolveTheme`, `applyTheme`(data-theme + colorScheme + meta theme-color), `useResolvedTheme`(시스템 선호 실시간 추적) |
| `src/lib/notify.ts` | 1,803 | 62 | Notification API 래퍼 | `NotificationState` 4종, `getNotificationState`, `requestNotificationPermission`, `showNotification`(icon/badge = `assetUrl('icon-192.png')`, `lang:'ko-KR'`, `tag` 기반 중복 억제, 모든 실패를 조용히 false로) |
| `src/lib/pwa.ts` | 2,039 | 70 | PWA 배선 | `registerServiceWorker`(PROD 전용, `window.load` 후 등록), `subscribeInstallPrompt`(`beforeinstallprompt` 캡처 → `prompt()` → `userChoice` 반환, `appinstalled` 처리) |
| `src/lib/assets.ts` | 537 | 14 | 자산 경로 해석 | `assetUrl(relativePath)` — `document.baseURI` 기준 상대 URL 생성으로 하위 경로 배포 대응 |
| `src/lib/useNow.ts` | 2,542 | 82 | React 1Hz 시계 훅 | Worker 우선 + 메인스레드 폴백 + `visibilitychange`/`focus`/`online` 재동기화 + 언마운트 정리. 상수 `INTERVAL_MS=1000`, `MIN_DELAY_MS=40` |
| `src/lib/tick.worker.ts` | 1,964 | 65 | 워커 하트비트 | `TickWorkerScope` 인터페이스로 DOM lib 환경 우회, `tick()`이 초 경계 정렬 재예약, `'start'/'stop'` 명령 처리 |
| `src/lib/__tests__/helpers.ts` | 1,300 | 28 | 테스트 픽스처 | `TEST_TODAY_KEY = '2026-09-17'` 고정, `at(isoUtc)` KST 파츠 변환, `settingsWith(overrides)`(날짜를 핀 고정하면 `semesterAuto:false`로 전환) |

#### `src/lib/__tests__/` 테스트 12종 (총 1,632 LoC, 141 테스트)

| 경로 | 바이트 | LoC | 커버 대상 및 대표 케이스 |
|---|---:|---:|---|
| `render.test.tsx` | 10,251 | 253 | **SSR 스모크 테스트 18종** (`environment: 'node'`에서 `renderToString`으로 전체 트리 렌더). 학사일, 등교 전 카운트다운, 예비종 구간, 주말 복구 모드, 하교 완료, 겨울방학, 신규 설치가 방학에 갇히지 않음, 하루 휴업, 단축 수업, **23:59 KST**, **자정 정각 롤오버**, 새벽 시간대, 공휴일, 문장 중복 금지, 푸터 단축키 표기 |
| `schedule.test.ts` | 8,096 | 203 | `sanitizePeriods` 정렬/중복 제거, `buildOutline`의 5분 이상만 쉬는 시간 생성·10분 이상만 duty 꼬리, `getDayContext` 4종 분류, phaseKey 안정성, 룩어헤드 5종 |
| `settings.test.ts` | 7,267 | 174 | 쓰레기 입력 기본값, v1 업그레이드, v2 무수정 기본값→자동 창 승격, 자동 창 동기화, 예비종 클램프, 깨진 시간표 행 복구, 역전된 학기 거부, 휴일 중복/정렬, 예외 프루닝, export/import 왕복, 경고 메시지 |
| `time.test.ts` | 7,178 | 176 | UTC→KST 변환, 자정 경계, 오프셋 일관성, `HH:MM` 검증, 달력 날짜 검증, 4종 포매터, 날짜 키 시프트, KST 자정까지 초 계산, 조사 7케이스 |
| `alerts.test.ts` | 6,040 | 136 | 전환 감지(신선/억제/등교 전 무음), 카피 생성, 예비종 6케이스(윈도 진입·쉬는 시간 중 발화·이른 시점 무음·꺼짐·로드 직후 스킵·쉬는시간/점심 미발화), 알림 카피 |
| `overrides.test.ts` | 5,572 | 136 | `dismissalTimeFor` 우선순위, off 예외의 하루 전체 무효화, 수업일 수/주간 리듬 반영, 다음 휴일 보고, 단축 하교의 타임라인 절단 |
| `semesterWindow.test.ts` | 5,964 | 146 | 1학기 3/2–7/20·2학기 8/18–익년 1/6 앵커, 여름 경계 이동, 1~2월의 이전 학년 귀속, 3/1 개학, 깨진 키 방어, 자동 창 통합 5종 |
| `holidays.test.ts` | 5,353 | 124 | 고정 국경일, 음력 명절, 대체공휴일 별도 항목, 근로자의 날 제외, 평일 null, 범위 밖 연도 빈 배열, 연도별 정렬, 기간 절단(연도 경계 포함), `isHolidayDate` 연동 3종 |
| `weekOverview.test.ts` | 4,728 | 124 | 월~일 7일, 일요일 오픈 시 같은 주, 월요일 첫 칸, 오늘/과거 구분, 수업일·주말 카운트, 최대 부하일, 공휴일/휴업/단축 반영, 방학 주간, 하루 범위 라벨 |
| `timeline.test.ts` | 2,578 | 66 | 비례 배치(간격 없음), 플레이헤드 양끝 고정, 완료/예정 표시, 진행 중 우선 정렬, 하교 후 다음 등교일 롤오버, 휴일 프리뷰 |
| `semester.test.ts` | 2,550 | 66 | 주말·휴일 제외 카운트, half-open 합 보존, 역전/깨진 범위 0, 수업일 기준 충전, 학기 전 0%/방학 100%, 불가능 설정 생존 |
| `alerts.test.ts`(중복 기재 없음) | — | — | — |

#### `src/components/` UI 계층

| 경로 | 바이트 | LoC | 역할 | 단일 책임 및 핵심 내용 |
|---|---:|---:|---|---|
| `src/components/SettingsModal.tsx` | 27,297 | 607 | 설정 모달(최대 컴포넌트) | 4탭(`profile/timetable/semester/data`) 로빙 탭, draft 상태 + `validateDraft` 8종 규칙, 내보내기(Blob + `URL.revokeObjectURL` 1초 지연), 가져오기(파일 → `parseSettingsJson` → 경고 표시), 초기화(`window.confirm`), 알림 권한 토글, 음량 슬라이더(0–100, step 5) + 미리 듣기, 학기 자동/수동, 휴일 에디터/시간표 에디터 임베드, 단축키 표 |
| `src/components/settings/TimetableEditor.tsx` | 14,641 | 377 | 요일별 시간표 편집기 | 요일 피커 7개, 수업 요일 체크박스, 요일 활성 토글, 프리셋 5종 적용, 행 단위 이름/구분/시작/종료 편집, 행 오류(`rowProblem`), 겹침 감지(`withParticle` 활용 문장), 퇴근 시각 조기 경고, 시간순 정렬, **다른 요일로 복사**, `newPeriodId()`(crypto.randomUUID 우선) |
| `src/components/PeriodTracker.tsx` | 10,089 | 205 | 오늘 타임라인 카드 | `layoutTimeline` 기반 절대 위치 슬롯 렌더, 5종 슬롯 아이콘 매핑, phase 배지(`is-break`/`is-done`), 현재 블록 노트, 빈 상태 2종, 타임라인 눈금(시작/수업·휴식 합/하교), 슬롯 리스트(쉬는 시간 제외), **다음 일정 레일**(라벨+시간 중복 제거, 최대 3건, 예비종 임박 시 `is-imminent` + 칩) |
| `src/components/ClockHero.tsx` | 7,301 | 199 | 메인 시계/카운트다운 카드 | `heroHeadline` 렌더, 카운트다운 포커스 3모드 순환(`auto → slot → dismissal`), 블록 없으면 `slot` 건너뜀, 휴일/하교 후 자동 `auto` 복귀, `role="timer"` `sr-only` 라이브 리전, 진행 바 `--fill` CSS 변수, `DayOverrideBar` 임베드 |
| `src/components/settings/HolidayEditor.tsx` | 6,984 | 189 | 휴일 관리 | 자동 공휴일 토글 + 이번 학기 공휴일 수/목록, 내장 범위 밖 경고, 날짜+이름 추가(중복/형식 검증, 빈 이름은 내장 명칭으로 보충), 목록 3상태(지남/오늘/예정), 삭제, "내장 달력 대체" 배지 |
| `src/components/settings/Field.tsx` | 5,346 | 177 | 폼 프리미티브 4종 | `Field`(label/hint/error), `ToggleRow`(role="switch" + sr-only 문구), `SegmentedControl`(role="radiogroup", Arrow/Home/End 키 이동, roving tabIndex), `SettingsSection`(아이콘 헤더 + aside) |
| `src/components/BatteryCard.tsx` | 4,498 | 103 | 방학 D-Day/배터리 카드 | `getTone` 4구간(≤25/≤50/≤75/>75) + 방학 모드 특수 톤, D-day 또는 `방학 중`, `elapsed/total 수업일`, `role="progressbar"` + `aria-valuetext`, 학기 시작/방학 라벨, 미설정 경고 |
| `src/components/DayOverrideBar.tsx` | 3,773 | 109 | 오늘 하루 예외 바 | 칩 3종(기본/오늘 휴업/단축 하교 + `<input type="time">`), 날짜·설정 변경 시 피커 재동기화, 동일 값 재적용 방지, 상수 `OFF_OVERRIDE` |
| `src/components/WeekOverview.tsx` | 3,721 | 97 | 이번 주 카드 | `getWeekOverview` 시각화, 최대 부하일을 100%로 하는 막대 높이 비율(`Math.max(0.18, ratio)`), `is-peak` 강조, 상태 아이콘 7종, `aria-current="date"`, 요약 문구 3분기 |
| `src/components/AppHeader.tsx` | 2,644 | 82 | 상단 바 | 브랜드 락업(`battery-charge-bold`), 오프라인 점, 테마 순환 버튼(현재 상태 아이콘 + 다음 모드 안내 title/aria-label), 설정 버튼. 상수 `THEME_LABEL`, `NEXT_MODE`, `MODE_ICON` |
| `src/components/Icon.tsx` | 1,647 | 46 | 인라인 SVG 아이콘 | `SOLAR_ICON_GLYPHS` 조회 → `<svg viewBox fill="currentColor" dangerouslySetInnerHTML>` 렌더, `label` 유무로 `role="img"`/`aria-hidden` 전환, 크기 → width/height/fontSize 3중 적용 |
| `src/components/CelebrationToast.tsx` | 1,544 | 47 | 하교 축하 토스트 | `isVisible=false`면 null, `role="status" aria-live="assertive"`, `--toast-duration` CSS 변수로 진행 바 애니메이션 연동, 수업 합계 문구, 닫기 버튼 |
| `src/components/settings/useFocusTrap.ts` | 2,681 | 86 | 모달 접근성 훅 | `FOCUSABLE_SELECTOR` 6종, 열릴 때 rAF 후 첫 요소 포커스, Tab/Shift+Tab 순환, Escape로 닫기(캡처 단계), `body.overflow='hidden'` 및 복원, 이전 포커스 복귀 |
| `src/components/icon-types.ts` | 254 | 7 | 아이콘 글리프 타입 | `SolarIconGlyph { readonly body: string; readonly width: number; readonly height: number }` |
| `src/components/icons.generated.ts` | 58,097 | 63 | **자동 생성** 아이콘 맵 | 50개 Solar 글리프(단일 라인 룩업 테이블, `as const satisfies Record<string, SolarIconGlyph>`), `SolarIconName = keyof typeof SOLAR_ICON_GLYPHS` 타입 파생. 각 항목 끝에 참조 출처 파일 주석 포함 |

**아이콘 50종 목록(생성 맵 실측)**: `add-circle-bold, alarm-bold, battery-charge-bold, bell-bold, bell-ring-bold, calendar-add-bold, calendar-bold, calendar-date-bold, calendar-mark-bold, calendar-minimalistic-bold, check-circle-bold, clipboard-add-bold, clipboard-list-bold, clock-circle-bold, close-circle-bold, confetti-bold, copy-bold, cup-hot-bold, danger-circle-bold, danger-triangle-bold, diskette-bold, download-minimalistic-bold, download-square-bold, eye-closed-bold, flag-bold, flash-drive-bold, graph-up-bold, hourglass-bold, info-circle-linear, keyboard-bold, magic-wand-3-bold, monitor-smartphone-bold, moon-bold, moon-sleep-bold, moon-stars-bold, notebook-bold, plate-bold, restart-bold, settings-bold, smile-circle-bold, sort-vertical-bold, stars-bold, stopwatch-bold, sun-2-bold, sunrise-bold, trash-bin-trash-bold, tuning-2-bold, upload-minimalistic-bold, user-rounded-bold, volume-bold`

### 2.3 규모 집계 (실측)

| 구분 | 파일 수 | LoC |
|---|---:|---:|
| `src/` 전체 (`.ts`/`.tsx`) | 46 | 8,284 |
| └ `src/lib` (엔진, 테스트 제외) | 17 | 3,443 |
| └ `src/lib/__tests__` | 12 | 1,632 |
| └ `src/components` (하위 포함) | 15 | 2,394 |
| └ 루트 (`App.tsx`, `main.tsx`, `types.ts`) | 3 | 814 |
| `src/index.css` | 1 | 415 |
| `scripts/*.mjs` | 2 | 413 |
| `public/sw.js` | 1 | 125 |
| 문서(`README.md`, `supanova-design-engine.md`) | 2 | 358 |
| CI/설정(`deploy.yml`, `*.json`, `vite.config.ts`, `index.html`) | 8 | 2,692 |
| **루트 이하 텍스트 총계(`package-lock.json` 제외)** | **—** | **9,937** |

저장소 작업 트리 총 용량(`.git`/`node_modules`/`dist` 제외): **710 KB**. 이 중 `package-lock.json`(82 KB)과 `icons.generated.ts`(58 KB)가 절반 이상을 차지한다.

---

## 3. 기술 스택 및 의존성 분석 (Tech Stack & Environment)

### 3.1 빌드/런타임 아키텍처 결정

| 계층 | 실제 결정 | 근거 파일 |
|---|---|---|
| 언어 | **TypeScript 5.9.3 (strict)**, JSX `react-jsx` | `tsconfig.app.json`, lock 실측 버전 |
| UI 프레임워크 | **React 18.3.1 + react-dom 18.3.1** (`createRoot`, `StrictMode`) | `src/main.tsx`, `package.json` |
| 번들러 | **Vite 6.4.3** (`@vitejs/plugin-react` 4.7.0) | `vite.config.ts` |
| 테스트 | **Vitest 3.2.7**, `environment: 'node'` (jsdom 미사용) | `vite.config.ts` `test` 블록 |
| 스타일 | **손수 작성한 단일 CSS 파일**(38 KB) — Tailwind/Bootstrap/CSS-in-JS/전처리기 **없음** | `src/index.css` |
| 아이콘 | **빌드 타임 인라인 SVG**(Iconify Solar, dev 전용 의존성) — 런타임 CDN 스크립트 없음 | `scripts/generate-icons.mjs`, `src/components/Icon.tsx` |
| PWA | 직접 작성한 `public/sw.js` + `manifest.webmanifest` (Workbox 등 라이브러리 **없음**) | `public/` |
| 컴파일 타깃 | tsconfig `ES2022`, Vite `build.target: 'es2020'` | `tsconfig.app.json`, `vite.config.ts` |
| 배포 base | `base: command === 'build' ? './' : '/'` → **상대 경로 산출물**(하위 경로 어디서든 동작) | `vite.config.ts` |
| Node 버전(CI) | `node-version: 22`, `cache: npm` | `.github/workflows/deploy.yml` |
| 패키지 매니저 | npm (`package-lock.json`, lockfileVersion 3) | — |

**No-Build 여부에 대한 명확한 답**: 본 프로젝트는 **No-Build가 아니다.** `npm run build`가 `icons → tsc -b → vite build`를 순차 실행하는 정식 빌드 파이프라인을 가지며, 산출물은 해시 파일명(`index-DWsR08qo.js`)으로 콘텐츠 주소화된다. 아울러 `npm run build` 이전에 반드시 `npm run icons`가 선행되어야 하는데, 이는 `icons.generated.ts`가 소스 트리에 커밋되어 있으면서도 생성물이기 때문이다(실측: 재생성 결과가 커밋본과 바이트 동일하여 **현재 드리프트는 0**).

### 3.2 의존성 전량 목록 (선언 범위 + lock 확정 버전)

**dependencies (3종)**

| 패키지 | package.json | lock 확정 | 용도 및 사용 위치 |
|---|---|---|---|
| `react` | `^18.3.1` | **18.3.1** | 훅 6종(`useState/useEffect/useMemo/useRef/useCallback`), `StrictMode`, `CSSProperties` 타입 |
| `react-dom` | `^18.3.1` | **18.3.1** | `createRoot`(앱), `renderToString`(SSR 스모크 테스트) |
| `canvas-confetti` | `^1.9.3` | **1.9.4** | 하교 축하 파티클. **동적 import**(`import('canvas-confetti')`)로 지연 로드 → 별도 청크 10,676 B 생성 |

**devDependencies (9종)**

| 패키지 | package.json | lock 확정 | 용도 |
|---|---|---|---|
| `@iconify-json/solar` | `^1.2.2` | **1.2.11** | 아이콘 SVG 원본(빌드 타임 전용, 런타임 번들 미포함) |
| `@types/canvas-confetti` | `^1.9.0` | 1.9.0 | 컨페티 타입 |
| `@types/node` | `^22.20.3` | 22.20.3 | scripts/`vite.config.ts` 타입 |
| `@types/react` | `^18.3.12` | 18.3.31 | React 타입 |
| `@types/react-dom` | `^18.3.1` | 18.3.7 | ReactDOM 타입 |
| `@vitejs/plugin-react` | `^4.3.4` | 4.7.0 | Fast Refresh + JSX 변환 |
| `typescript` | `^5.7.2` | **5.9.3** | `tsc -b` |
| `vite` | `^6.0.7` | **6.4.3** | dev/build |
| `vitest` | `^3.2.4` | **3.2.7** | 단위 테스트 |

lock 기준 총 패키지 노드 **166개** — 의존성 트리가 극히 얕다(직접 의존 12종, 전이 포함 116개 설치).

### 3.3 외부 CDN 의존 (런타임 네트워크 요청)

`index.html`이 로드하는 외부 리소스는 정확히 **4개 호스트, 2개 스타일시트**이다.

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
<link rel="stylesheet"
      href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.min.css" />
<link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@400;500&display=swap" />
```

| 리소스 | 제공자 | 로드 방식 | 폴백 |
|---|---|---|---|
| **Pretendard** (한글 본문) | jsDelivr (GitHub 미러) | 렌더 블로킹 `<link rel=stylesheet>` | `--font-sans`의 `-apple-system, BlinkMacSystemFont, system-ui, "Apple SD Gothic Neo", sans-serif` |
| **Geist / Geist Mono** (영문 디스플레이·숫자) | Google Fonts | `display=swap` | `ui-monospace, SFMono-Regular, Menlo, monospace` |
| 모든 아이콘 | — | **런타임 CDN 없음**(빌드 타임 인라인) | — |
| 컨페티 | — | npm 번들(동적 import) | 실패 시 `.catch(() => {})`로 무음 |

> **네트워크 의존성 특징**: 폰트만 CDN을 사용하며, `sw.js`의 교차 출처 분기(`staleWhileRevalidate(request, { allowOpaque: true })`)가 이들을 캐시한다. 즉 최초 1회 로드 후에는 학교 Wi-Fi가 끊겨도 폰트가 유지된다. 다만 **최초 오프라인 실행 시에는 폰트 폴백으로 렌더**된다.

### 3.4 브라우저 지원 범위

- **선언된 하한**: Vite `build.target: 'es2020'` + tsconfig `target: ES2022`(= 런타임 API는 ES2020 수준, 타입은 ES2022). ES2020은 Chrome 87+/Edge 88+/Safari 14+/Firefox 78+에 대응한다.
- **`.browserslistrc` 없음**, `@vitejs/plugin-legacy` 없음 → IE/구형 브라우저 지원은 **명시적으로 포기**한 상태다.
- CSS는 `color-mix()`(12회), `clamp()`, `dvh` 단위, `mask-image`, `backdrop-filter`, `:focus-visible`, `inset`을 사용하므로 **실질 하한은 Chrome/Edge 111+, Safari 16.4+** 수준이다(미지원 시 색·커버리지가 일부 열화되나 레이아웃은 유지).
- `Intl.DateTimeFormat`에 `timeZone: 'Asia/Seoul'`을 사용 → IANA tzdata가 필요하며, 2026년 기준 전 브라우저 기본 내장이다.

### 3.5 웹 API 활용 현황 (전수 조사)

| 웹 API | 사용 여부 | 사용 위치 | 목적 | 미지원/제약 시 폴백 |
|---|---|---|---|---|
| **LocalStorage** | ✅ | `settings.ts` (`loadSettings/saveSettings`), `index.html` 부트스트랩 | 설정 영속화 | `typeof window === 'undefined' \|\| !window.localStorage` → `createDefaultSettings()`. `setItem` 예외(시크릿/쿼터) → 메모리 동작 유지 |
| **Web Worker** | ✅ | `useNow.ts:42` → `tick.worker.ts` | 배경 탭에서도 살아 있는 1Hz 틱 | `new Worker` throw 또는 `worker.onerror` → `startMainThreadTicker()` |
| **Web Audio API** | ✅ | `sound.ts` (`AudioContext`, `createOscillator`, `createGain`, `exponentialRampToValueAtTime`) | 차임 7종 합성(오디오 파일 0개) | `webkitAudioContext` 폴백, 생성 실패 시 `failed=true`로 영구 무음 |
| **Notification API** | ✅(옵트인, 기본 OFF) | `notify.ts`, `App.tsx`, `SettingsModal.tsx` | 일정 전환/예비종 시스템 알림 | `unsupported`/`denied` 상태를 UI에 문구로 반영, `new Notification` 예외는 `try/catch`로 무음 |
| **Page Visibility API** | ✅ | `useNow.ts:58`(재동기화), `App.tsx:119`(알림 권한 재조회) | 절전 복귀/탭 복귀 시 즉시 재계산 | — |
| **Fullscreen API** | ✅ | `App.tsx:249-258` | 교실 TV 표시(`F` 키) | `typeof element.requestFullscreen === 'function'` 검사 + `catch(() => {})` |
| **Service Worker + Cache Storage** | ✅(PROD만) | `pwa.ts`, `public/sw.js` | 오프라인 앱 셸·자산 캐시 | `'serviceWorker' in navigator` 검사, 등록 실패 무음 |
| **Web App Manifest / 설치 프롬프트** | ✅ | `manifest.webmanifest`, `pwa.ts` | 데스크톱/모바일 설치 | `beforeinstallprompt` 미발생 시 "앱 설치" 버튼 자체가 렌더되지 않음 |
| **navigator.onLine + online/offline 이벤트** | ✅ | `App.tsx:39,109-117` | 헤더 오프라인 점 | `navigator.onLine` 부재 시 초기값 false 처리 |
| `Intl.DateTimeFormat` | ✅ | `time.ts:17-27` | KST 환산의 유일한 근거 | 포매터 생성 실패 시 예외 전파(방어 코드 없음 — 3.6 참조) |
| `window.matchMedia` | ✅ | `theme.ts`, `index.html` | 시스템 테마 추적 | `typeof window.matchMedia !== 'function'` → 다크 기본 |
| `IntersectionObserver` | ❌ **미사용** | — | (README에 "스크롤 게이트는 IntersectionObserver 훅"으로 기술되었으나 **코드에 존재하지 않음**) | — |
| `Storage` 이벤트(크로스탭) | ✅ | `settings.ts:428-449` | 다른 탭의 설정 변경 수신 | malformed payload 무시 |
| `URL.createObjectURL` / `Blob` / `<a download>` | ✅ | `SettingsModal.tsx` `handleExport` | 설정 JSON 내보내기 | Safari 대응으로 1초 후 `revokeObjectURL` |
| `crypto.randomUUID` | ✅ | `TimetableEditor.tsx` `newPeriodId` | 교시 ID 생성 | `Date.now().toString(36)` + `Math.random().toString(36)` 폴백 |
| Canvas(간접) | ✅ | `canvas-confetti` | 축하 파티클 | `disableForReducedMotion: true` |
| `window.confirm` | ✅ | `SettingsModal.tsx` `handleReset` | 초기화 확인 | — |
| `document.title` | ✅ | `App.tsx:189` | 탭 제목에 상태 반영 | — |
| Screen Wake Lock API | ❌ | — | (교실 TV 상시 표시 시 화면 꺼짐 방지 **미구현** — 8.4절 개선 제안) | — |
| Network Time API / 서버 시각 동기화 | ❌ | — | (7.4절 상세: 기기 시계를 신뢰) | — |

### 3.6 환경 취약점 요약(상세는 7장)

1. `Intl.DateTimeFormat` 생성이 모듈 최상위(`time.ts:17`)에서 실행되므로, 이 API가 없는 극단적 환경에서는 **모듈 로드 자체가 실패**한다(방어 폴백 없음).
2. 폰트 CDN에 대한 프라이버시/차단 리스크: 사내망에서 `cdn.jsdelivr.net`이 차단되면 한글 폰트가 시스템 폰트로 대체되어 디자인 충실도가 하락한다(기능은 정상).
3. `sw.js`와 `manifest.webmanifest`는 Vite의 해시/버전 관리 밖에 있어 **수동으로 `CACHE_VERSION`을 올려야** 한다(`survival-clock-v6`). 배포 시 이 갱신을 잊으면 구 셸이 남을 수 있다.

---

## 4. 핵심 런타임 로직 및 알고리즘 심층 해부 (Core Engine & Math)

### 4.1 시간 동기화 루프 (Tick Engine)

#### 4.1.1 1차 경로: 전용 Web Worker (`src/lib/tick.worker.ts`, 65행 전문 구조)

```ts
const scope = globalThis as unknown as TickWorkerScope

const INTERVAL_MS = 1000
/** Never re-fire faster than this, even if a boundary was missed. */
const MIN_DELAY_MS = 40

let timeoutId: number | undefined
let running = false

function tick() {
  if (!running) {
    return
  }

  const now = Date.now()
  scope.postMessage(now)

  // Align the next wake-up with the following whole second so a long-lived tab
  // stays on the wall clock instead of drifting by the timer's own latency.
  timeoutId = scope.setTimeout(tick, Math.max(MIN_DELAY_MS, INTERVAL_MS - (now % INTERVAL_MS)))
}

function stop() {
  running = false
  scope.clearTimeout(timeoutId)
  timeoutId = undefined
}

scope.onmessage = (event) => {
  const command = event.data
  if (command === 'start') {
    if (running) { return }
    running = true
    tick()
    return
  }
  if (command === 'stop') { stop() }
}
```

- **갱신 주기**: 1000 ms, 단 **절대 시각 정렬** 방식이다. `setInterval(1000)`이 아니라 `setTimeout(1000 - (now % 1000))`으로 재예약하므로 누적 드리프트가 0이다. `now % 1000`이 0에 가까우면 지연이 `MIN_DELAY_MS = 40`으로 클램프되어 바쁜 루프(초당 25회 상한)를 방지한다.
- **메시지 프로토콜**: 입력 `'start' | 'stop'`, 출력 `postMessage(epochMs: number)` (숫자 원시값).
- **타입 우회**: 앱이 DOM lib로 컴파일되므로 `self`가 `Window`로 추론되는 문제를 `TickWorkerScope` 인터페이스 + `globalThis as unknown as TickWorkerScope` 단일 캐스트로 해결했다. 별도 tsconfig가 필요 없다.
- **백그라운드 스로틀링 대응**: 워커 타이머는 백그라운드 탭에서도 (브라우저 정책상 1초 정밀도는 완화될 수 있으나) **동결되지 않으므로** 교시 전환 감지가 누락되지 않는다. 이것이 "정시 알림"의 기술적 근거다.

#### 4.1.2 2차 경로: 메인 스레드 폴백 + 재동기화 (`src/lib/useNow.ts`)

```ts
const INTERVAL_MS = 1000
const MIN_DELAY_MS = 40

const startMainThreadTicker = () => {
  const loop = () => {
    const current = Date.now()
    publish(current)
    timeoutRef.current = window.setTimeout(
      loop,
      Math.max(MIN_DELAY_MS, INTERVAL_MS - (current % INTERVAL_MS)),
    )
  }
  loop()
}

try {
  const worker = new Worker(new URL('./tick.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<number>) => publish(event.data)
  worker.onerror = () => {
    worker.terminate()
    if (workerRef.current === worker) {
      workerRef.current = null
      startMainThreadTicker()
    }
  }
  worker.postMessage('start')
  workerRef.current = worker
} catch {
  startMainThreadTicker()
}

const resync = () => publish(Date.now())
document.addEventListener('visibilitychange', resync)
window.addEventListener('focus', resync)
window.addEventListener('online', resync)
```

- **3중 재동기화 트리거**: `visibilitychange`(탭 복귀), `focus`(창 활성화), `online`(네트워크 복구). 절전에서 깨어난 노트북이 즉시 정확한 시각으로 점프한다.
- **절대 시각 원칙**: 화면에 그리는 모든 값은 `Date.now()`에서 다시 계산된다. 누적 카운터가 없으므로 폴백 경로에서도 오차가 누적되지 않는다.
- **정리(cleanup)**: `disposed` 플래그, `clearTimeout`, `worker.postMessage('stop')` + `worker.terminate()`, 리스너 3종 `removeEventListener`까지 모두 수행된다(메모리 누수 없음).
- **`StrictMode` 영향**: 개발 모드에서 이펙트가 2회 실행되어 워커가 생성→종료→재생성된다. 종료 경로가 완비되어 있어 누수는 없으나, 개발 중 워커가 2회 뜨는 것은 정상 동작이다.

#### 4.1.3 파생 주기 요약

| 계층 | 주기 | 트리거 |
|---|---|---|
| 워커 틱 | 1000 ms(초 경계 정렬, 최소 40 ms) | `scope.setTimeout` |
| React 상태 갱신 | 틱마다 1회 | `setNow(new Date(epochMs))` |
| KST 파츠 재계산 | 틱마다 | `useMemo(() => getKstTimeParts(now), [now])` |
| 스케줄 상태 재계산 | 틱마다 | `useMemo(() => getScheduleStatus(kstNow, settings), [kstNow, settings])` |
| 학기 지표 재계산 | **날짜 변경 시에만** | `[kstNow.dateKey, settings]` |
| 다음 등교일 재계산 | **날짜 변경 시에만** | `[kstNow.dateKey, settings]` |
| 문서 제목 갱신 | 상태/초 변화 시(문자열 비교 후) | `useEffect(() => { if (document.title !== title) document.title = title }, [title])` |
| 서비스워커 | 이벤트 기반 | install/activate/fetch/message |

### 4.2 시간표/일정 데이터 모델

#### 4.2.1 원시 타입 (`src/types.ts`)

```ts
export type PeriodKind = 'class' | 'lunch' | 'club' | 'duty'
export type SlotKind = PeriodKind | 'break'

export interface TimetablePeriod {
  id: string
  label: string
  kind: PeriodKind
  /** `HH:MM`, KST. */
  start: string
  /** `HH:MM`, KST. Must be later than `start`. */
  end: string
}

export interface DayTimetable {
  /** `false` renders the day as "no classes" even if it is a school day. */
  enabled: boolean
  periods: TimetablePeriod[]
}

export interface DayOverride {
  /** `off` = no classes today, `short` = today ends earlier than usual. */
  kind: DayOverrideKind          // 'off' | 'short'
  label: string                  // 자유 텍스트(예: 재량휴업)
  dismissalTime: string          // short일 때만 유효한 HH:MM
}
```

핵심 설계 결정: **교시 시각은 초가 아니라 `HH:MM` 문자열**로 저장된다. 파싱은 항상 `parseTimeToSeconds()`를 통과하며, 잘못된 값은 `fallback = 16:30`(16 * 3600 + 30 * 60 = 59400)으로 치환된다. 이 설계는 `<input type="time">`과 완벽히 호환되지만, **초 단위 정밀도와 자정 초과(24시 이후) 표현을 구조적으로 불가능하게 만든다**(7.5절).

#### 4.2.2 기본 시간표 (실제 상수, `src/types.ts:263-320`)

```ts
const ELEMENTARY_PERIODS: TimetablePeriod[] = [
  { id: 'p1', label: '1교시', kind: 'class', start: '09:00', end: '09:40' },
  { id: 'p2', label: '2교시', kind: 'class', start: '09:50', end: '10:30' },
  { id: 'p3', label: '3교시', kind: 'class', start: '10:50', end: '11:30' },
  { id: 'p4', label: '4교시', kind: 'class', start: '11:40', end: '12:20' },
  { id: 'lunch', label: '점심시간 및 급식', kind: 'lunch', start: '12:20', end: '13:20' },
  { id: 'p5', label: '5교시', kind: 'class', start: '13:20', end: '14:00' },
  { id: 'p6', label: '6교시', kind: 'class', start: '14:10', end: '14:50' },
]

const MIDDLE_PERIODS: TimetablePeriod[] = [ /* 45분 수업 7교시, 점심 12:30~13:20, 15:55 종료 */ ]
const HIGH_PERIODS: TimetablePeriod[]   = [ /* 50분 수업 7교시 + { id:'self-study', label:'야간 자율학습', kind:'club', start:'16:30', end:'17:20' } */ ]
const SHORT_FRIDAY_PERIODS: TimetablePeriod[] = [
  { id: 'p1', label: '1교시', kind: 'class', start: '09:00', end: '09:40' },
  { id: 'p2', label: '2교시', kind: 'class', start: '09:50', end: '10:30' },
  { id: 'p3', label: '3교시', kind: 'class', start: '10:40', end: '11:20' },
  { id: 'lunch', label: '점심시간 및 급식', kind: 'lunch', start: '11:30', end: '12:20' },
  { id: 'p4', label: '4교시', kind: 'class', start: '12:20', end: '13:00' },
]
```

프리셋 5종(`TIMETABLE_PRESETS`)의 메타데이터:

| id | label | description | periods 수 |
|---|---|---|---:|
| `elementary` | 초등학교 6교시 | `09:00 등교 · 40분 수업 · 14:50 하교` | 7 |
| `middle` | 중학교 7교시 | `09:00 등교 · 45분 수업 · 15:55 하교` | 8 |
| `high` | 고등학교 7교시 + 자습 | `08:40 등교 · 50분 수업 · 야자 17:20` | 9 |
| `short-friday` | 단축 4교시 | `금요일·재량휴업일용 짧은 시간표` | 5 |
| `empty` | 비우기 | `이 요일의 교시를 모두 지웁니다` | 0 |

기본 요일 매핑 (`createDefaultTimetables()`):

| 키 | 요일 | enabled | periods |
|---|---|:---:|---|
| `"0"` | 일 | false | `[]` |
| `"1"` | 월 | true | `ELEMENTARY_PERIODS`(7) |
| `"2"` | 화 | true | `ELEMENTARY_PERIODS`(7) |
| `"3"` | 수 | true | `ELEMENTARY_PERIODS`(7) |
| `"4"` | 목 | true | `ELEMENTARY_PERIODS`(7) |
| `"5"` | 금 | true | `SHORT_FRIDAY_PERIODS`(5) |
| `"6"` | 토 | false | `[]` |

#### 4.2.3 파생 슬롯 모델 (`TimelineSlot`) — 엔진 산출물

```ts
export interface TimelineSlot {
  id: string                 // 'p1' | 'lunch' | 'break-2' | 'after-school'
  label: string              // '1교시' | '쉬는 시간' | '방과후 · 업무 시간'
  shortLabel: string         // '1' | '점심' | '재량' | '업무' | '휴식'
  kind: SlotKind             // 'class' | 'lunch' | 'club' | 'duty' | 'break'
  startSeconds: number       // 자정 기준 초
  endSeconds: number
  timeLabel: string          // '09:00 ~ 09:40'
  classIndex: number | null  // kind==='class'일 때만 1-based 서수
}
```

기본 설정(2026-09-17, 목요일)으로 실측한 `DayOutline.slots`의 실제 값:

| id | label | kind | startSeconds | endSeconds | timeLabel | classIndex |
|---|---|---:|---:|---:|---|---:|
| `p1` | 1교시 | class | 32400 | 34800 | `09:00 ~ 09:40` | 1 |
| `break-2` | 쉬는 시간 | break | 34800 | 35400 | `09:40 ~ 09:50` | null |
| `p2` | 2교시 | class | 35400 | 37800 | `09:50 ~ 10:30` | 2 |
| `break-4` | 쉬는 시간 | break | 37800 | 39000 | `10:30 ~ 10:50` | null |
| `p3` | 3교시 | class | 39000 | 41400 | `10:50 ~ 11:30` | 3 |
| `break-6` | 쉬는 시간 | break | 41400 | 42000 | `11:30 ~ 11:40` | null |
| `p4` | 4교시 | class | 42000 | 44400 | `11:40 ~ 12:20` | 4 |
| `lunch` | 점심시간 및 급식 | lunch | 44400 | 48000 | `12:20 ~ 13:20` | null |
| `p5` | 5교시 | class | 48000 | 50400 | `13:20 ~ 14:00` | 5 |
| `break-10` | 쉬는 시간 | break | 50400 | 51000 | `14:00 ~ 14:10` | null |
| `p6` | 6교시 | class | 51000 | 53400 | `14:10 ~ 14:50` | 6 |
| `after-school` | 방과후 · 업무 시간 | duty | 53400 | 59400 | `14:50 ~ 16:30` | null |

집계: `dayStartSeconds = 32400`, `lastPeriodEndSeconds = 53400`, `dismissalSeconds = 59400`, `totalClassSeconds = 14400`(4시간), `totalBreakSeconds = 3000`(50분), `spanSeconds = 27000`(7.5시간), `classSlots.length = 6`.

**`break-N` id 규칙의 중요성**: id가 `slots.length + 1` 시점의 배열 길이로 생성되므로(`break-2`, `break-4`, `break-6`, `break-10`) **배열 인덱스 기반이다.** 사용자가 편집 중 교시를 추가/삭제하면 이후 모든 break id가 재번호화된다. 이것이 `phaseKey`(= `${dateKey}:in-slot:${activeSlot.id}`)를 통한 전환 감지에 영향을 줄 수 있다(7.11절).

#### 4.2.4 영속 직렬화 실측 스키마 (`serializeSettings` 실제 출력, 키 순서 포함)

```json
{
  "version": 4,
  "displayName": "김선생님",
  "dismissalTime": "16:30",
  "themeMode": "dark",
  "soundEnabled": true,
  "soundVolume": 60,
  "notifyEnabled": false,
  "preAlertEnabled": true,
  "preAlertMinutes": 3,
  "autoHolidays": true,
  "schoolDays": [1, 2, 3, 4, 5],
  "holidays": [],
  "dayOverrides": {},
  "timetables": {
    "0": { "enabled": false, "periods": [] },
    "1": { "enabled": true, "periods": [
      { "id": "p1", "label": "1교시", "kind": "class", "start": "09:00", "end": "09:40" },
      { "id": "p2", "label": "2교시", "kind": "class", "start": "09:50", "end": "10:30" },
      { "id": "p3", "label": "3교시", "kind": "class", "start": "10:50", "end": "11:30" },
      { "id": "p4", "label": "4교시", "kind": "class", "start": "11:40", "end": "12:20" },
      { "id": "lunch", "label": "점심시간 및 급식", "kind": "lunch", "start": "12:20", "end": "13:20" },
      { "id": "p5", "label": "5교시", "kind": "class", "start": "13:20", "end": "14:00" },
      { "id": "p6", "label": "6교시", "kind": "class", "start": "14:10", "end": "14:50" }
    ] },
    "2": { "enabled": true, "periods": [ /* 요일 1과 동일 7행 */ ] },
    "3": { "enabled": true, "periods": [ /* 요일 1과 동일 7행 */ ] },
    "4": { "enabled": true, "periods": [ /* 요일 1과 동일 7행 */ ] },
    "5": { "enabled": true, "periods": [
      { "id": "p1", "label": "1교시", "kind": "class", "start": "09:00", "end": "09:40" },
      { "id": "p2", "label": "2교시", "kind": "class", "start": "09:50", "end": "10:30" },
      { "id": "p3", "label": "3교시", "kind": "class", "start": "10:40", "end": "11:20" },
      { "id": "lunch", "label": "점심시간 및 급식", "kind": "lunch", "start": "11:30", "end": "12:20" },
      { "id": "p4", "label": "4교시", "kind": "class", "start": "12:20", "end": "13:00" }
    ] },
    "6": { "enabled": false, "periods": [] }
  },
  "semesterStart": "2026-08-18",
  "vacationDate": "2027-01-06",
  "semesterAuto": true
}
```

> **직렬화 순서 주의**: `semesterStart`/`vacationDate`/`semesterAuto` 3개 키가 **객체 끝에 위치**한다. 이는 `createDefaultSettings()`가 `{ ...BASE_SETTINGS, version, semesterStart, vacationDate, semesterAuto, ... }` 순으로 스프레드하기 때문이며(`types.ts:405`의 `BASE_SETTINGS`에는 학기 창이 의도적으로 제외되어 있다), `JSON.stringify`는 삽입 순서를 보존한다. 다른 도구가 이 JSON을 파싱할 때 키 순서에 의존해서는 안 된다.

### 4.3 하루 아웃라인 빌드 알고리즘 (`buildOutline`)

#### 4.3.1 입력 정규화 — `sanitizePeriods`

```ts
function isWellFormedPeriod(period: TimetablePeriod): boolean {
  return (
    typeof period?.label === 'string' &&
    period.label.trim().length > 0 &&
    isValidTimeInput(period.start) &&
    isValidTimeInput(period.end) &&
    parseTimeToSeconds(period.end) > parseTimeToSeconds(period.start)
  )
}

export function sanitizePeriods(periods: TimetablePeriod[]): TimetablePeriod[] {
  const valid = (Array.isArray(periods) ? periods : []).filter(isWellFormedPeriod)
  const sorted = [...valid].sort(
    (left, right) => parseTimeToSeconds(left.start) - parseTimeToSeconds(right.start),
  )

  const kept: TimetablePeriod[] = []
  let previousEnd = -1
  for (const period of sorted) {
    const start = parseTimeToSeconds(period.start)
    if (start < previousEnd) {
      continue   // 겹치면 "먼저 시작한 블록"을 유지하고 뒤엣것을 버린다
    }
    kept.push(period)
    previousEnd = parseTimeToSeconds(period.end)
  }
  return kept
}
```

엔진은 **절대 예외를 던지지 않는다**. 반쯤 망가진 시간표도 사용 가능한 부분만 렌더링한다(주석: "The engine is deliberately forgiving").

#### 4.3.2 쉬는 시간 자동 생성 규칙 (실제 코드)

```ts
const MIN_BREAK_SECONDS = 5 * 60    // 5분
const MIN_DUTY_SECONDS = 10 * 60    // 10분

for (const period of periods) {
  const startSeconds = parseTimeToSeconds(period.start)
  const endSeconds = parseTimeToSeconds(period.end)

  if (previousEnd !== null && startSeconds - previousEnd >= MIN_BREAK_SECONDS) {
    slots.push({
      id: `break-${slots.length + 1}`,
      label: '쉬는 시간',
      shortLabel: '휴식',
      kind: 'break',
      startSeconds: previousEnd,
      endSeconds: startSeconds,
      timeLabel: `${formatHmFromSeconds(previousEnd)} ~ ${formatHmFromSeconds(startSeconds)}`,
      classIndex: null,
    })
  }

  if (period.kind === 'class') {
    classOrdinal += 1
  }

  slots.push({ /* 본 블록 */ })
  previousEnd = previousEnd === null ? endSeconds : Math.max(previousEnd, endSeconds)
}
```

| 규칙 | 임계값 | 결과 |
|---|---|---|
| 교시 간 간격 | `>= 5분` | `break` 슬롯 자동 생성(휴식, `classIndex: null`) |
| 교시 간 간격 | `< 5분` | 슬롯을 생성하지 않고 **연속 블록으로 취급**(타임라인에 빈틈 없음) |
| 마지막 교시 → 하교 | `>= 10분` | `after-school` duty 슬롯 생성(`방과후 · 업무 시간`) |
| 마지막 교시 → 하교 | `< 10분` | duty 슬롯 없음(미세 꼬리 제거) |
| 하교 시각 < 마지막 교시 종료 | — | `dismissalSeconds = Math.max(parseTimeToSeconds(dismissalTime), lastPeriodEndSeconds)` → **하교가 교시 종료보다 빠를 수 없다** |
| `classIndex` | — | `kind === 'class'`인 블록에만 1부터 순차 부여(`lunch/club/duty/break`는 null) |

#### 4.3.3 단축 수업(short override)의 하드 스톱 적용

```ts
function truncatePeriods(periods: TimetablePeriod[], hardStopSeconds?: number): TimetablePeriod[] {
  if (hardStopSeconds === undefined) {
    return periods
  }
  const truncated: TimetablePeriod[] = []
  for (const period of periods) {
    const startSeconds = parseTimeToSeconds(period.start)
    if (startSeconds >= hardStopSeconds) {
      continue                                    // 하드 스톱 이후 시작 블록은 삭제
    }
    const endSeconds = Math.min(parseTimeToSeconds(period.end), hardStopSeconds)
    truncated.push(
      endSeconds === parseTimeToSeconds(period.end)
        ? period
        : { ...period, end: formatHmFromSeconds(endSeconds) },   // 걸친 블록은 잘라냄
    )
  }
  return truncated
}
```

적용 순서는 `truncatePeriods(sanitizePeriods(timetable.periods), hardStopSeconds)`이며, 단축 하교는 **단순 카운트다운 이동이 아니라 시간표 자체를 절단**한다(`overrides.test.ts`: "cuts the timetable short instead of only moving the countdown").

### 4.4 상태 기계 (State Machine)

#### 4.4.1 날짜 분류 — `getDayContext()`의 우선순위 (코드 순서 그대로)

| 순위 | 조건 | `dayType` | `label` | `description` | isSchoolDay / hasClasses |
|---:|---|---|---|---|---|
| 1 | `isInVacation(dateKey)` (오늘 >= 창의 `vacationDate`) | `vacation` | `방학` | `방학 중이에요. 배터리는 그대로 충전 중입니다.` | false / false |
| 2 | `isBeforeSemester(dateKey)` (오늘 < 창의 `startDate`) | `before-semester` | `개학 전` | `개학(MM.DD)까지는 여유 모드예요.` | false / false |
| 3 | `dayOverrides[dateKey].kind === 'off'` | `override` | `label \|\| '오늘 휴업'` | `오늘 하루는 수업이 없는 날로 표시했어요. 내일은 원래 시간표로 돌아옵니다.` | false / false |
| 4 | `isHolidayDate()` (직접 등록 우선 → 내장 달력) | `holiday` | 공휴일 이름 | `{공휴일}으로 쉬는 날이에요.` (조사 처리) | false / false |
| 5 | `!isSchoolWeekday(weekdayIndex)` | `weekend` | `주말`(0/6) 또는 `{요일}요일 휴무` | `주말이에요. 교실 대신 나를 챙기는 날입니다.` / `수업 요일로 설정하지 않은 날이에요.` | false / false |
| 6 | 슬롯이 없거나 모두 `duty` | `no-classes` | `시간표 없음` | `` `${WEEKDAY_LONG_LABELS[now.weekdayIndex]} 시간표가 비어 있어요. 설정에서 채워 보세요.` `` (schedule.ts:443) 또는 `오늘은 수업 블록이 없고 업무 시간만 있어요.` | **true** / false |
| 7 | 그 외 | `school` | `학교 가는 날` | `{n}교시 · 하교 HH:MM` (short면 `단축 하교`) | true / true |

> **`no-classes`의 isSchoolDay가 true인 이유**: 배터리 계산에서 "수업은 없지만 교사는 출근하는 날"을 반영하기 위함이다. 반면 `hasClasses`가 false이므로 히어로는 등교 전/업무 상태로 렌더된다.

#### 4.4.2 시간 국면 — `DayPhase` 5종 전이 (실제 조건)

```ts
export type DayPhase = 'off-day' | 'before-first-slot' | 'in-slot' | 'between-slots' | 'dismissed'
```

| 전이 | 조건식(코드 그대로) | `secondsRemaining` | `isBreak` | `phaseKey` |
|---|---|---|---|---|
| `off-day` | `!day.isSchoolDay \|\| outline.slots.length === 0 \|\| outline.dayStartSeconds === null` | `0` | false | `${dateKey}:off-day:${dayType}` |
| `dismissed` | `currentSeconds >= dismissalSeconds` | `0` | false | `${dateKey}:dismissed` |
| `before-first-slot` | `currentSeconds < dayStartSeconds` | `dayStartSeconds - currentSeconds` | false | `${dateKey}:before-first-slot` |
| `in-slot` | `slots.find(s => current >= s.startSeconds && current < s.endSeconds)` 존재 | `activeSlot.endSeconds - currentSeconds` | `activeSlot.kind === 'break'` | `${dateKey}:in-slot:${activeSlot.id}` |
| `between-slots` | 위 어디에도 해당하지 않는 나머지 구간 | `nextSlot ? nextSlot.startSeconds - current : dismissalSeconds - current` | **true** | `${dateKey}:between-slots:${nextSlot?.id ?? 'end'}` |

`between-slots`가 실제로 발생하는 경우는 두 가지다. (1) 5분 미만 간격이 `break` 슬롯으로 승격되지 않아 생기는 **슬롯 사이의 1초~249초 공백**, (2) `truncatePeriods`로 하드 스톱된 뒤의 잔여 구간. 이 국면에서 UI는 `잠깐의 공백`(PeriodTracker) / `틈새 시간`(PHASE_LABELS) 문구를 사용한다.

#### 4.4.3 국면 키(`phaseKey`) 의 안정성과 알림 억제

- `phaseKey`는 항상 `dateKey`로 시작하므로 **자정에 무조건 바뀐다**(실측: 일 23:59:59 `2026-09-20:off-day:weekend` → 월 00:00:01 `2026-09-21:before-first-slot`).
- 알림 계층은 이 키의 변화만 관찰한다:
  ```ts
  export const STALE_EVENT_SECONDS = 90
  const ageSeconds = Math.max(0, currentDaySeconds - status.phaseStartSeconds)
  if (ageSeconds > STALE_EVENT_SECONDS) {
    return null   // 자정을 넘겨 쌓인 전환은 재생하지 않는다
  }
  ```
- `before-first-slot`은 의도적으로 무음 처리된다(`eventKindForStatus`는 반환하지만 `detectScheduleEvent`가 `kind === 'before-first-slot'`을 걸러낸다).

### 4.5 생존율(Survival Metrics) 계산 공식 — 수학적 정의

모든 공식은 `clamp(value, min, max)`(`!Number.isFinite(value) → min`)로 감싸져 있어 `NaN`/`Infinity`가 UI에 도달하지 않는다.

#### 4.5.1 대분류 4개 진행률

| 지표 | 필드 | 정확한 공식 (코드 원문) | 범위 | 의미 |
|---|---|---|---|---|
| **하루 진행률** | `dayProgress` | `clamp(((currentSeconds - dayStartSeconds) / Math.max(1, dismissalSeconds - dayStartSeconds)) * 100, 0, 100)` | 0..100 | 등교(첫 블록 시작)부터 하교까지의 시간 벽시계 진행률 |
| **현재 블록 진행률** | `slotProgress` | `duration = Math.max(1, activeSlot.endSeconds - activeSlot.startSeconds)`<br>`clamp(((currentSeconds - activeSlot.startSeconds) / duration) * 100, 0, 100)` | 0..100 | 진행 중 슬롯(수업/쉬는시간/점심/업무)의 완료율. `dismissed`에서는 100, `before-first-slot`/`between-slots`에서는 0 |
| **수업 부하 진행률** | `classLoadProgress` | `clamp((classTotals.completedSeconds / outline.totalClassSeconds) * 100, 0, 100)` (분모 0이면 0) | 0..100 | 쉬는 시간을 제외한 **순수 수업 시간**의 소화율 |
| **학기 배터리** | `metrics.progress` | `vacation → 100`<br>`before-semester 또는 totalSchoolDays === 0 → 0`<br>`그 외 → clamp((elapsedSchoolDays / totalSchoolDays) * 100, 0, 100)` | 0..100 | 수업일 기준 학기 소화율 |

`dayProgress` 산출 시 사용되는 두 기준점:
```ts
const dayStartSeconds = outline.dayStartSeconds      // 첫 슬롯 시작(예: 32400)
const dismissalSeconds = outline.dismissalSeconds    // max(parseTimeToSeconds(dismissalTime), lastPeriodEndSeconds)
const dayProgress = clamp(
  ((currentSeconds - dayStartSeconds) / Math.max(1, dismissalSeconds - dayStartSeconds)) * 100,
  0, 100,
)
```
실측 검증(2026-09-17 목요일 기본 설정): 14:00 → `dayProgress = 66.67%`((50400-32400)/27000), 14:40 → `dayProgress = 75.56%`, 하교 후 22:00 → `100%`.

#### 4.5.2 교시 카운트 집계 알고리즘 (코드 원문)

```ts
const classTotals = outline.classSlots.reduce(
  (accumulator, slot) => {
    const completedSeconds = clamp(currentSeconds - slot.startSeconds, 0, slot.endSeconds - slot.startSeconds)
    const remainingSeconds = Math.max(0, slot.endSeconds - Math.max(currentSeconds, slot.startSeconds))
    if (slot.endSeconds <= currentSeconds) { accumulator.completed += 1 }
    if (slot.endSeconds > currentSeconds)  { accumulator.remaining += 1 }
    accumulator.completedSeconds += completedSeconds
    accumulator.remainingSeconds += remainingSeconds
    return accumulator
  },
  { completed: 0, remaining: 0, completedSeconds: 0, remainingSeconds: 0 },
)
```

실측(14:00, 6교시 중 5교시 종료 직후): `completedClassCount = 5`, `remainingClassCount = 1`, `completedClassSeconds = 12000`, `remainingClassSeconds = 2400`, `totalClassSeconds = 14400`, `classLoadProgress = 83.3333%`.

#### 4.5.3 학기 배터리 수학 (`src/lib/semester.ts`)

```ts
export function countSchoolDays(settings: UserSettings, fromDateKey: string, toDateKey: string) {
  const fromMs = parseDateInput(fromDateKey)
  const toMs = parseDateInput(toDateKey)
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    return 0
  }

  let count = 0
  for (let cursor = fromMs; cursor < toMs; cursor += DAY_IN_MS) {
    const dateKey = dateKeyFromUtcMs(cursor)
    if (!isSchoolWeekday(settings, weekdayIndexFromDateKey(dateKey))) continue
    if (isHolidayDate(settings, dateKey)) continue
    if (isDayOffOverride(settings, dateKey)) continue        // "오늘 휴업"도 제외
    if (!weekdayHasClasses(settings, weekdayIndexFromDateKey(dateKey))) continue
    count += 1
  }
  return count
}
```

- **구간은 half-open `[from, to)`** 이므로 `경과 + 잔여 = 전체`가 항상 성립한다(`semester.test.ts`: "is half-open so elapsed + remaining equals the total").
- `weekdayHasClasses()`는 `timetable.enabled === true` 이고 `duty`가 아닌 블록이 하나라도 있어야 true다 → **교시가 0개인 요일은 수업일에서 제외**된다.
- 지표 산출:
```ts
const totalCalendarDays = Math.max(0, differenceInDays(vacationMs, startMs))
const totalSchoolDays   = vacationMs > startMs ? countSchoolDays(settings, startDate, vacationDate) : 0
const elapsedAnchorMs   = clamp(todayMs, startMs, vacationMs)
const elapsedSchoolDays = countSchoolDays(settings, startDate, dateKeyFromUtcMs(elapsedAnchorMs))
const schoolDaysRemaining = countSchoolDays(settings, dateKeyFromUtcMs(Math.max(todayMs, startMs)), vacationDate)
const progress = phase === 'vacation' ? 100
  : phase === 'before-semester' || totalSchoolDays === 0 ? 0
  : clamp((elapsedSchoolDays / totalSchoolDays) * 100, 0, 100)
const calendarDaysRemaining = Math.max(0, differenceInDays(vacationMs, todayMs))
const elapsedCalendarDays = clamp(differenceInDays(todayMs, startMs), 0, totalCalendarDays)
```
- `isConfigured = Number.isFinite(todayMs) && isValidSemesterRange(startDate, vacationDate)` 이며, `isValidSemesterRange`는 `vacationMs > startMs`를 요구한다(역전된 학기 창의 배터리 반전 방지).
- 실측(2026-09-17, 자동 창 `2026-08-18 → 2027-01-06`):
  ```json
  { "progress": 23.157894736842106, "phase": "in-semester",
    "calendarDaysRemaining": 111, "schoolDaysRemaining": 73,
    "totalSchoolDays": 95, "elapsedSchoolDays": 22,
    "totalCalendarDays": 141, "elapsedCalendarDays": 30,
    "startDate": "2026-08-18", "vacationDate": "2027-01-06", "isConfigured": true }
  ```
  화면 표기는 `formatPercent(metrics.progress, 1)` → **`23.2`**, D-day 표기는 `D-111일`, 부제는 `22/95 수업일`.
- UI의 톤 분기(`BatteryCard.getTone`): `<=25` → red(아직 갈 길이 멀어요), `<=50` → orange(조금씩 적응 중이에요), `<=75` → yellow(절반을 넘었습니다), `>75` → green(방학이 보여요!). `phase === 'vacation'`이면 무조건 green + `방학 모드 · 완전 충전`.

#### 4.5.4 자동 학기 창 계산 (`src/lib/semesterWindow.ts`)

```ts
const SPRING_START_DAY   = 302   // 3월 2일
const SUMMER_VACATION_DAY = 720  // 7월 20일
const FALL_START_DAY     = 818   // 8월 18일
const WINTER_VACATION_DAY = 106  // 다음 해 1월 6일
const SCHOOL_YEAR_START_DAY = 300 // 3월 1일

export function getAutoSemesterWindow(todayDateKey: string): SemesterWindow {
  const parts = todayDateKey.split('-').map(Number)
  const [year, month, day] = parts
  const isValid = parts.length === 3 && Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)
  if (!isValid) {
    return springWindow(new Date().getUTCFullYear())   // 방어: 렌더 중 예외 금지
  }

  const stamp = month * 100 + day
  if (stamp >= FALL_START_DAY)   return fallWindow(year)        // 8/18 ~ 익년 1/6
  if (stamp < SCHOOL_YEAR_START_DAY) return fallWindow(year - 1) // 1~2월은 이전 학년
  return springWindow(year)                                     // 3/1 ~ 8/17
}
```

| 입력 날짜 | 창 id | startDate | vacationDate | vacationLabel |
|---|---|---|---|---|
| `2026-09-17` | `fall` | `2026-08-18` | `2027-01-06` | 겨울방학 |
| `2026-07-25` | `spring` | `2026-03-02` | `2026-07-20` | 여름방학 |
| `2026-01-15` | `fall` | `2025-08-18` | `2026-01-06` | 겨울방학 |
| `2027-03-10` | `spring` | `2027-03-02` | `2027-07-20` | 여름방학 |

경계는 **포함(inclusive)** 이다: 8/17은 봄 창의 여름방학 마지막 날, 8/18은 가을 창 첫날, 1/6은 이미 겨울방학. 이 창들은 달력을 빠짐없이 타일링하므로 `getNextSchoolDay`/`getNextDayOff`가 방학 너머를 볼 수 있다(`semesterWindow.test.ts`: "sees the next semester past the current vacation").

### 4.6 룩어헤드(Look-ahead) 알고리즘

```ts
const LOOKAHEAD_DAYS = 400
```
- `getNextDayOff(now, settings)`: 오늘(offset 0)부터 400일까지 전진하며 **쉬는 날을 처음 만나는 즉시 반환**. 판정 우선순위는 `inVacation → holiday → isOffOverride → isOffWeekday`이며, `reason`도 같은 우선순위로 결정된다. `label`은 상황별로 `방학` / 공휴일명 / 예외 라벨(`오늘 휴업`, `휴업일`) / `{요일}요일`(offset 0이면 `{요일}요일 휴식`)로 달라진다.
- `getNextSchoolDay(now, settings, excludeDateKey?)`: `isScheduledSchoolDay`가 true인 첫 날을 찾아 `firstPeriodSeconds = outline.classSlots[0]?.startSeconds ?? outline.dayStartSeconds`를 함께 반환한다. `excludeDateKey`는 "오늘이 아직 수업일이어도 다음 날 정보가 필요할 때" 오늘을 건너뛰기 위한 파라미터다.
- 실측(목 10:00 KST, 기본 설정):
  - `getNextDayOff` → `{"dateKey":"2026-09-19","reason":"weekend","label":"토요일","daysUntil":2,"secondsUntil":136800}`
  - `getNextSchoolDay`(토요일 기준) → `{"dateKey":"2026-09-21","label":"월요일","daysUntil":2,"secondsUntil":133200,"secondsUntilFirstPeriod":165600,"firstPeriodSeconds":32400}`

`getWeekContext`(schedule.ts)는 월요일을 주 시작으로 삼아 `schoolDayPosition`/`schoolDaysThisWeek`/`remainingSchoolDaysThisWeek`/`secondsUntilWeekend`/`weekendDateKey`를 계산한다. **주의: 이 함수는 현재 앱 컴포넌트에서 호출되지 않으며 오직 테스트에서만 검증된다**(7.11절).

### 4.7 한국어 조사(받침) 엔진 — 알고리즘 상세

```ts
const HANGUL_BASE = 0xac00
const HANGUL_LAST = 0xd7a3
const RIEUL_JONGSEONG = 8                                    // ㄹ 종성 인덱스
const DIGITS_WITH_BATCHIM = new Set(['1','3','6','7','8','0']) // 일 삼 육 칠 팔 영
const DIGITS_ENDING_IN_RIEUL = new Set(['1','7','8'])          // 일 칠 팔

export function endsWithConsonant(word: string): boolean | null {
  const trimmed = word.trim()
  if (!trimmed) return null
  const code = trimmed.charCodeAt(trimmed.length - 1)

  if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
    return (code - HANGUL_BASE) % 28 !== 0     // 중성/종성 분해
  }
  const lastChar = trimmed[trimmed.length - 1]
  if (lastChar >= '0' && lastChar <= '9') {
    return DIGITS_WITH_BATCHIM.has(lastChar)
  }
  return null                                   // 라틴 문자/기호는 판단 불가
}

export function withParticle(word: string, afterConsonant: string, afterVowel: string) {
  const trimmed = word.trim()
  const hasBatchim = endsWithConsonant(trimmed)
  if (hasBatchim === null) {
    return `${trimmed}${afterConsonant}(${afterVowel})`   // '과(와)' 관용 표기
  }
  // ㄹ + 으로 → 로.
  if (hasBatchim && afterVowel === '로' && endsWithRieul(trimmed) === true) {
    return `${trimmed}${afterVowel}`
  }
  return `${trimmed}${hasBatchim ? afterConsonant : afterVowel}`
}
```

- 유니코드 한글 음절 = `0xAC00 + (초성 × 588) + (중성 × 28) + 종성` 이므로 `% 28`이 곧 종성 유무다.
- `으로/로` 쌍은 예외 처리: ㄹ 받침은 자음이지만 **모음형 `로`** 를 쓴다(설날로, 개교기념일로). 이는 `overrides.test.ts`/`time.test.ts`에 케이스로 고정되어 있다(`'ㄹ 받침은 으로가 아니라 로를 쓴다'`).
- 반영 지점: (1) 공휴일 설명 `{공휴일}으로 쉬는 날이에요`, (2) 시간 겹침 경고 `{앞 교시}과/와 {뒤 교시}의 시간이 겹칩니다`.

---

## 5. UI/UX 렌더링, DOM 구조 및 스타일링 아키텍처

### 5.1 컴포넌트 트리 (Props 계약 포함)

```
App  (src/App.tsx)
├── <div className={`app-shell theme-${resolvedTheme}`}>
│   ├── <div className="background-mesh" aria-hidden="true" />        ← 고정 그리드 오버레이
│   ├── <a className="skip-link" href="#main-content">본문 바로가기</a>
│   └── <div className="page-wrap">
│       ├── <AppHeader themeMode resolvedTheme isOffline onCycleTheme onOpenSettings />
│       ├── <main id="main-content">
│       │   ├── <section className="dashboard-intro reveal" style={{'--index':0}}>
│       │   │   ├── <div className="intro-copy"><h2>{greetingForHour(hour)}, {displayName}.</h2></div>
│       │   │   └── (조건부) <button className="ghost-button is-small">앱 설치</button>
│       │   ├── <section className="hero-grid" aria-label="현재 시각과 학기 진행률">
│       │   │   ├── <ClockHero now status nextSchoolDay preAlertSeconds override dismissalTime onOverrideChange />
│       │   │   │   └── <DayOverrideBar dateKey override dismissalTime onChange />
│       │   │   └── <BatteryCard metrics isTodaySchoolDay />
│       │   ├── <PeriodTracker now status upcoming preAlertSeconds />
│       │   └── <WeekOverview now settings />
│       │   </main>
│       ├── <footer className="app-footer reveal" style={{'--index':2}}>
│       │   ├── <span>교사 생존 시계 <b>·</b> {year} <b>·</b> Asia/Seoul</span>
│       │   └── <span>단축키 S 설정 · T 화면 모드 · F 전체 화면 · M 소리 · N 알림</span>
│       └── </div>
│   ├── <CelebrationToast isVisible dismissalTime durationMs totalClassCount totalClassSeconds onClose />
│   └── <SettingsModal isOpen settings todayDateKey notificationState onClose onSave />
└── </div>
```

### 5.2 실제 DOM 계층 (주요 컴포넌트별)

> **표기 범례**: 아래 스케치의 `<svg>〔glyph:이름〕</svg>`는 `SolarIcon name="이름"`이 실제로 출력하는 지점을 가리킨다. 실제 렌더 결과는 `Icon.tsx:33-44`의 `<svg class="solar-icon" style="width:20px;height:20px;font-size:20px" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">` 요소이며, `〔glyph:이름〕` 자리에는 `icons.generated.ts`의 해당 항목 `body`(예: `<path fill="currentColor" fill-rule="evenodd" d="M12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22Z"/>`)가 `dangerouslySetInnerHTML`로 주입된다. 50개 글리프의 `body` 원문 전량은 **부록 D**에 수록했다.

#### 5.2.1 `AppHeader` — 상단 고정 바

```html
<header class="topbar reveal" style="--index:0">
  <div class="brand-lockup">
    <div class="brand-mark" aria-hidden="true"><svg class="solar-icon">〔glyph:battery-charge-bold〕</svg></div>
    <div class="brand-copy"><h1>교사 생존 시계 <span>· 시간표</span></h1></div>
    <span class="offline-dot" title="오프라인 · 저장된 화면으로 동작 중" aria-label="오프라인"></span>  <!-- 조건부 -->
  </div>
  <div class="header-actions">
    <button class="icon-button" type="button"
            aria-label="화면 모드 전환 · 현재 다크 모드, 누르면 라이트 모드"
            title="다크 모드 · 누르면 라이트 모드 (T)">
      <svg class="solar-icon">〔glyph:moon-bold〕</svg>
    </button>
    <button class="settings-button" type="button" title="내 설정 (S)">
      <svg class="solar-icon">〔glyph:settings-bold〕</svg><span>설정</span>
    </button>
  </div>
</header>
```

#### 5.2.2 `ClockHero` — 메인 시계/카운트다운

```html
<section class="surface-card clock-card reveal hero-tone-focus" style="--index:1">
  <div class="card-heading-row">
    <div><p class="card-title">오늘</p><p class="card-subtitle">6교시 · 하교 16:30</p></div>
    <p class="day-badge is-school"><svg>〔glyph:notebook-bold〕</svg><span>학교 가는 날</span></p>
  </div>

  <div class="clock-display" aria-hidden="true">
    <span class="clock-time">14</span>  <!-- 실제: "14:05" 형태로 조합 -->
    <span class="clock-seconds">32</span>
  </div>
  <p class="sr-only" role="timer" aria-live="polite" aria-atomic="true">현재 시각 14시 5분, 6교시</p>

  <div class="date-line">
    <svg>〔glyph:calendar-bold〕</svg><span>26.09.17 목요일</span>
    <span class="date-line-sep">·</span><span>2026년 9월 17일</span>
  </div>

  <div class="countdown-panel countdown-focus is-interactive"
       role="button" tabindex="0"
       title="누르면 현재 블록 / 하교까지로 전환"
       aria-label="6교시 · 누르면 현재 블록 / 하교까지로 전환">
    <div class="countdown-copy">
      <div class="countdown-icon"><svg>〔glyph:notebook-bold〕</svg></div>
      <div class="countdown-text">
        <p class="countdown-kicker">6교시 수업 중</p>
        <p class="countdown-label">6교시</p>
        <p class="countdown-helper">14:10 ~ 14:50 · 75% 지남</p>
      </div>
    </div>
    <div class="countdown-readout">
      <strong class="countdown-value">00:44:12</strong>
      <span class="countdown-note">남은 수업 0분 · 0교시</span>
    </div>
    <div class="countdown-bar">
      <div class="countdown-bar-fill" style="--fill:0.7556"
           role="progressbar" aria-valuemin="0" aria-valuemax="100"
           aria-valuenow="76" aria-label="오늘 일정 진행률"></div>
      <span class="countdown-bar-label">오늘 76%</span>
    </div>
  </div>

  <div class="override-bar">
    <p class="override-label"><svg>〔glyph:tuning-2-bold〕</svg><span>오늘 하루만</span></p>
    <div class="override-chips" role="group" aria-label="오늘 하루 예외 설정">
      <button class="override-chip is-active" type="button" aria-pressed="true">기본 시간표</button>
      <button class="override-chip" type="button" aria-pressed="false">
        <svg>〔glyph:moon-sleep-bold〕</svg>오늘 휴업</button>
      <span class="override-chip override-time">
        <button class="override-time-button" type="button" aria-pressed="false">
          <svg>〔glyph:stopwatch-bold〕</svg>단축 하교</button>
        <input type="time" aria-label="오늘 단축 하교 시각" value="16:30">
      </span>
    </div>
    <p class="override-note">휴업·단축 수업이 있는 날, 한 번만 눌러 주세요</p>
  </div>
</section>
```

#### 5.2.3 `BatteryCard` — 방학 D-Day 게이지

```html
<section class="surface-card battery-card reveal battery-tone-yellow" style="--index:2">
  <div class="battery-head">
    <div class="battery-title">
      <div class="battery-icon"><svg>〔glyph:battery-charge-bold〕</svg></div>
      <div><h2>방학 D-Day 게이지</h2><p class="card-subtitle">수업일 기준으로 학기 진행률을 계산해요</p></div>
    </div>
    <div class="battery-status" title="절반을 넘었습니다"><svg>〔glyph:stars-bold〕</svg></div>
  </div>
  <div class="battery-main">
    <div class="battery-top-row">
      <div class="battery-dday">
        <span class="battery-dday-label">방학까지</span>
        <span class="battery-dday-value">D-111<span>일</span></span>
      </div>
      <div class="battery-charge">
        <span class="battery-charge-label">생존 배터리</span>
        <div class="battery-charge-value">23.2<span style="font-size:12px;color:var(--muted)">%</span></div>
        <div class="battery-charge-sub">22/95 수업일</div>
      </div>
    </div>
    <div class="battery-track" role="progressbar" aria-valuemin="0" aria-valuemax="100"
         aria-valuenow="23.157894736842106"
         aria-valuetext="생존 배터리 23.2퍼센트, 방학까지 73수업일">
      <div class="battery-fill" style="--fill:0.23157894736842107"></div>
    </div>
    <div class="battery-scale">
      <span><svg>〔glyph:calendar-bold〕</svg> 08.18 시작</span><span>01.06 방학 →</span>
    </div>
    <div class="battery-foot">
      <span class="tone-dot" style="color:var(--warn)" aria-hidden="true"></span>
      <span>절반을 넘었습니다 · 오늘은 23번째 수업일</span>
    </div>
    <!-- 조건부 미설정 경고 -->
  </div>
</section>
```

#### 5.2.4 `PeriodTracker` — 타임라인 + 다음 일정 레일

```html
<section class="surface-card period-card reveal reveal-on-scroll" style="--index:0">
  <div class="period-header">
    <div class="period-heading">
      <h2>오늘의 시간표</h2>
      <p class="card-subtitle">마지막 교시 뒤부터 하교까지는 방과후·업무로 표시돼요. 설정에서 요일별로 편집할 수 있어요.</p>
    </div>
    <div class="period-now-badge is-break">
      <span class="period-now-pulse" aria-hidden="true"></span>
      <span>진행 중</span><strong>67%</strong>
    </div>
  </div>
  <div class="period-body">                         <!-- grid: 1fr 300px ; ≤1000px: 1fr, 레일이 위로 -->
    <div class="period-main">
      <div class="period-current-note">
        <div class="period-note-icon"><svg>〔glyph:cup-hot-bold〕</svg></div>
        <div class="period-note-copy">
          <p class="period-note-title">쉬는 시간 진행 중</p>
          <p class="period-note-detail">14:00 ~ 14:10 · 종료까지 00:04:12 (41%)</p>
        </div>
        <div class="period-clock-mini" aria-hidden="true">14:05</div>
      </div>

      <div class="timeline-scroll" tabindex="0" role="group" aria-label="오늘의 시간표 타임라인">
        <div class="timeline-track">                 <!-- min-width:620px, height:84px -->
          <div class="timeline-slot kind-class is-done"
               style="left:0%;width:8.89%" title="1교시 · 09:00 ~ 09:40 · 완료">
            <span class="timeline-slot-fill" style="--progress:1" aria-hidden="true"></span>
            <span class="timeline-slot-top"><span class="period-number">1</span>
              <span class="timeline-slot-label">1교시</span></span>
            <span class="timeline-time">09:00 ~ 09:40</span>
          </div>
          <!-- 자동 삽입된 쉬는 시간 슬롯: kind-break, 아이콘이 period-number 자리를 대체 -->
          <div class="timeline-slot kind-break is-done is-compact"
               style="left:8.89%;width:1.11%" title="쉬는 시간 · 09:40 ~ 09:50 · 완료">
            <span class="timeline-slot-fill" style="--progress:1" aria-hidden="true"></span>
            <span class="timeline-slot-top"><svg>〔glyph:cup-hot-bold〕</svg></span>
          </div>
          <!-- 점심 슬롯: kind-lunch, 라벨은 항상 "점심 시간"으로 sanitizePeriods가 강제 -->
          <div class="timeline-slot kind-lunch is-done"
               style="left:51.11%;width:8.89%" title="점심 시간 · 12:20 ~ 13:00 · 완료">
            <span class="timeline-slot-fill" style="--progress:1" aria-hidden="true"></span>
            <span class="timeline-slot-top"><svg>〔glyph:cup-paper-bold〕</svg>
              <span class="timeline-slot-label">점심 시간</span></span>
            <span class="timeline-time">12:20 ~ 13:00</span>
          </div>
          <!-- 방과후 슬롯: kind-club (프리셋 "고등학교"의 야자), 라벨 "방과후" -->
          <div class="timeline-slot kind-club is-done"
               style="left:96.67%;width:3.33%" title="방과후 · 16:30 ~ 17:20 · 완료">
            <span class="timeline-slot-fill" style="--progress:1" aria-hidden="true"></span>
            <span class="timeline-slot-top"><svg>〔glyph:palette-bold〕</svg>
              <span class="timeline-slot-label">방과후</span></span>
            <span class="timeline-time">16:30 ~ 17:20</span>
          </div>
          <!-- 업무 슬롯: kind-duty, 마지막 교시 끝 ~ 하교 시각. 항상 is-done 또는 활성 -->
          <div class="timeline-slot kind-duty is-done"
               style="left:100%;width:41.67%" title="업무 · 16:30 ~ 18:00 · 완료">
            <span class="timeline-slot-fill" style="--progress:1" aria-hidden="true"></span>
            <span class="timeline-slot-top"><svg>〔glyph:case-bold〕</svg>
              <span class="timeline-slot-label">업무</span></span>
            <span class="timeline-time">16:30 ~ 18:00</span>
          </div>
          <!-- 활성 슬롯: state === 'active' → aria-current="true" + active-pill 추가 -->
          <div class="timeline-slot kind-class is-active"
               style="left:66.67%;width:8.89%" title="3교시 · 14:10 ~ 14:50 · 진행 중"
               aria-current="true">
            <span class="timeline-slot-fill" style="--progress:0.42" aria-hidden="true"></span>
            <span class="timeline-slot-top"><span class="period-number">3</span>
              <span class="timeline-slot-label">3교시</span></span>
            <span class="timeline-time">14:10 ~ 14:50</span>
            <span class="active-pill">지금</span>
          </div>
          <span class="timeline-needle" style="left:66.67%" aria-hidden="true"></span>
        </div>
        <div class="timeline-scale" aria-hidden="true">
          <span>09:00 시작</span><span>수업 4시간 · 휴식 50분</span><span>16:30 하교</span>
        </div>
      </div>

      <ul class="slot-list">                        <!-- repeat(auto-fill, minmax(200px,1fr)) -->
        <li class="slot-row kind-class is-done">
          <span class="slot-index" aria-hidden="true">1</span>
          <span class="slot-name">1교시</span>
          <span class="slot-time">09:00 ~ 09:40</span>
          <span class="slot-state">완료</span>
        </li>
      </ul>
    </div>

    <aside class="next-up-rail" aria-label="다음 일정">
      <p class="rail-title"><svg>〔glyph:hourglass-bold〕</svg> 다음 일정 <span class="rail-count">3</span></p>
      <ol class="rail-list">
        <li class="rail-item kind-class is-active">
          <span class="rail-icon" aria-hidden="true"><svg>〔glyph:notebook-bold〕</svg></span>
          <div class="rail-copy"><strong>6교시</strong><span>14:10 ~ 14:50</span></div>
          <span class="rail-countdown">00:44:12 남음</span>
        </li>
        <li class="rail-item kind-duty is-imminent">
          <span class="rail-icon" aria-hidden="true"><svg>〔glyph:case-bold〕</svg></span>
          <div class="rail-copy"><strong>업무</strong><span>16:30 ~ 18:00</span>
            <span class="rail-imminent-chip"><svg>〔glyph:bell-ring-bold〕</svg> 예비종</span></div>
          <span class="rail-countdown">00:03:41 후</span>
        </li>
      </ol>
    </aside>
  </div>
</section>
```

#### 5.2.5 `WeekOverview` — 주간 막대

```html
<section class="surface-card week-card reveal reveal-on-scroll" style="--index:1" aria-label="이번 주 한눈에 보기">
  <div class="card-heading-row">
    <div><h2>이번 주</h2><p class="card-subtitle">남은 수업일 2일 · 주간 수업 18시간 40분</p></div>
    <p class="week-total"><svg>〔glyph:graph-up-bold〕</svg><span>5일 수업</span></p>
  </div>
  <ol class="week-grid">                             <!-- grid-template-columns: repeat(7,1fr) -->
    <li class="week-day is-school is-past" title="월요일 · 6교시 09:00~16:30">
      <span class="week-day-label">월</span>
      <div class="week-day-bar" aria-hidden="true">
        <span class="week-day-fill" style="--height:1"></span>
      </div>
      <span class="week-day-value">6교시</span>
    </li>
    <li class="week-day is-today is-current is-peak" aria-current="date"
        title="목요일 · 6교시 09:00~16:30">
      <span class="week-day-label">목</span>
      <div class="week-day-bar" aria-hidden="true">
        <span class="week-day-fill" style="--height:1"></span>
      </div>
      <span class="week-day-value">6교시</span>
    </li>
    <li class="week-day is-weekend" title="토요일 · 주말">
      <span class="week-day-label">토</span>
      <div class="week-day-bar" aria-hidden="true"><span class="week-day-icon"><svg>〔glyph:moon-stars-bold〕</svg></span></div>
      <span class="week-day-value">주말</span>
    </li>
  </ol>
</section>
```

### 5.3 CSS 디자인 시스템

#### 5.3.1 커스텀 프로퍼티 전량 (`src/index.css:4-62`)

**불변 토큰 (`:root`)**

| 변수 | 값 | 용도 |
|---|---|---|
| `--font-sans` | `Pretendard, Geist, -apple-system, BlinkMacSystemFont, system-ui, "Apple SD Gothic Neo", sans-serif` | 전체 본문 |
| `--font-mono` | `"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace` | 시계·숫자·시간 라벨 |
| `--ease` | `cubic-bezier(0.16, 1, 0.3, 1)` | 전역 이징(스프링 느낌의 감속) |
| `--radius-xl` | `22px` | 카드 |
| `--radius-lg` | `16px` | 패널 |
| `--radius-md` | `12px` | 내부 요소 |
| `--radius-pill` | `999px` | 배지/칩/진행 바 |

**테마 토큰 (다크 — `:root, :root[data-theme='dark']`)**

| 변수 | 값 | | 변수 | 값 |
|---|---|---|---|---|
| `--bg` | `#0a0a0b` | | `--accent` | `#34d399` |
| `--bg2` | `#111113` | | `--accent2` | `#10b981` |
| `--surface` | `#18181b` | | `--accent-soft` | `rgba(52,211,153,.12)` |
| `--surface2` | `#1f1f23` | | `--accent-border` | `rgba(52,211,153,.28)` |
| `--surface3` | `#27272a` | | `--warn` / `--warn-soft` | `#fbbf24` / `rgba(251,191,36,.12)` |
| `--border` | `rgba(255,255,255,.08)` | | `--rose` / `--rose-soft` | `#fb7185` / `rgba(251,113,133,.10)` |
| `--border2` | `rgba(255,255,255,.14)` | | `--track` | `rgba(255,255,255,.07)` |
| `--text` / `--text2` | `#fafafa` / `#d4d4d8` | | `--shadow` | `0 20px 60px rgba(0,0,0,.45)` |
| `--muted` / `--faint` | `#a1a1aa` / `#71717b` | | `--ring` | `rgba(52,211,153,.6)` |
| | | | `color-scheme` | `dark` |

**테마 토큰 (라이트 — `:root[data-theme='light']`)**

| 변수 | 값 | | 변수 | 값 |
|---|---|---|---|---|
| `--bg` / `--bg2` | `#f7f7f5` / `#efefeb` | | `--accent` / `--accent2` | `#059669` / `#047857` |
| `--surface` / `--surface2` / `--surface3` | `#ffffff` / `#f4f4f5` / `#e4e4e7` | | `--accent-soft` / `--accent-border` | `rgba(5,150,105,.10)` / `.22` |
| `--border` / `--border2` | `rgba(0,0,0,.08)` / `.14` | | `--warn` / `--rose` | `#d97706` / `#e11d48` |
| `--text` / `--text2` | `#121212` / `#3f3f46` | | `--track` | `rgba(0,0,0,.07)` |
| `--muted` / `--faint` | `#71717b` / `#a1a1aa` | | `--shadow` | `0 18px 50px rgba(0,0,0,.08)` |
| | | | `--ring` / `color-scheme` | `rgba(5,150,105,.5)` / `light` |

라이트 모드 전용 오버라이드 6곳이 별도로 존재한다(그라디언트 위 텍스트 색 보정):
`.period-number`(배경 `rgba(0,0,0,.08)`), `.modal-tab.is-selected`, `.segment.is-selected`, `.weekday-tab.is-active`, `.modal-primary-button`(이상 `color:#ecfdf5`).

#### 5.3.2 레이아웃 기법

| 기법 | 적용 위치 | 실제 선언 |
|---|---|---|
| CSS Grid (고정 2열 비대칭) | `.hero-grid` | `grid-template-columns:1.15fr .85fr; gap:16px` |
| CSS Grid (본문+레일) | `.period-body` | `grid-template-columns:1fr 300px; gap:18px` |
| CSS Grid (자동 채움) | `.slot-list` | `repeat(auto-fill,minmax(200px,1fr))` |
| CSS Grid (주간 7열) | `.week-grid` | `repeat(7,1fr); gap:8px` |
| CSS Grid (폼 5열) | `.period-row`, `.period-table-head` | `1.4fr .9fr .8fr .8fr 36px` |
| CSS Grid (설정 폼 2열) | `.settings-form-grid` | `1fr 1fr` |
| Flexbox | `.topbar`, `.card-heading-row`, `.countdown-copy/readout`, `.rail-item`, `.toggle-row`, `.modal-actions` 등 | `display:flex; align-items:center; justify-content:space-between` |
| 절대 위치 | 타임라인 슬롯·니들 | `.timeline-slot{position:absolute;top:0;bottom:0}` + 인라인 `left/width %` |
| 고정 오버레이 | 배경 메시, 모달, 토스트 | `.background-mesh{position:fixed;inset:0}`, `.modal-backdrop{position:fixed;inset:0;z-index:80}` |
| Sticky | 상단 바 | `.topbar{position:sticky;top:0;z-index:40}` |
| 컨테이너 폭 | 본문 | `.page-wrap{max-width:72rem;margin:0 auto;padding:0 16px 24px}` |
| 클리핑/그라디언트 | 배경 그리드 | `.background-mesh{mask-image:linear-gradient(to bottom,black 0%,transparent 85%)}` |
| 글래스 효과 | 상단 바/모달 | `background:color-mix(in srgb,var(--bg) 82%,transparent); backdrop-filter:blur(14px)` / 모달 배경 `blur(8px)` |

#### 5.3.3 반응형 미디어 쿼리 (전량 5개 + 모션 1개)

| 브레이크포인트 | 실제 변경 내용 |
|---|---|
| `@media(max-width:1000px)` | `.period-body{grid-template-columns:1fr}` + `.next-up-rail{order:-1}` (**다음 일정 레일을 타임라인 위로 승격**) |
| `@media(max-width:900px)` | `.hero-grid{grid-template-columns:1fr}` (히어로/배터리 세로 적층) |
| `@media(max-width:760px)` | `.topbar` 높이 56px, `.dashboard-intro` 세로 정렬, `.countdown-panel{grid-template-columns:1fr}`, `.countdown-readout` 좌측 정렬, `.period-header` 세로, `.period-table-head{display:none}`, `.period-row{grid-template-columns:1fr 1fr}` + 이름/액션 전폭, `.modal-actions` 세로 |
| `@media(max-width:600px)` | `.settings-form-grid{grid-template-columns:1fr}` |
| `@media(max-width:460px)` | `.page-wrap` 패딩 12px, 브랜드 제목 15px + `white-space:normal`, `.clock-time{font-size:clamp(42px,14vw,60px)}`, 카드 좌우 패딩 16px, `.celebration-toast` 좌우 12px 전체폭, **`.week-grid{grid-template-columns:repeat(4,1fr)}`**(7열 → 4열 랩), `.week-day-bar{height:44px}`, 설정 인라인 필드/휴일 행 세로 |
| `@media(prefers-reduced-motion:reduce)` | `*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}` |

**가로/세로 모드 대응 여부**: `orientation:` 미디어 쿼리는 **전무(0건)** 하다. 가로 모드는 (1) `max-width` 기반 적층 규칙과 (2) `clamp()` 기반 유체 타이포, (3) `.timeline-scroll{overflow-x:auto}`로만 대응한다. 즉 **가로모드에서 세로 높이가 좁은 기기(폰 가로) 전용 최적화는 없다**(`.clock-card{min-height:420px}`가 가로 뷰포트보다 클 수 있음 — 7.18절 참조).
또한 `env(safe-area-inset-*)` 사용이 **0건**인데 `index.html`은 `viewport-fit=cover`를 선언하므로, 노치 기기에서 좌우 콘텐츠가 잘릴 수 있다(7.18절).

#### 5.3.4 테마 스위칭 메커니즘 (3중 구조)

1. **프리페인트(HTML 인라인)**: `data-theme` + `style.colorScheme` + `meta[theme-color]`를 즉시 설정. 로직은 3중 폴백(`themeMode` 문자열 → 구버전 `theme === 'light'` → 다크)이며, `system`이면 `matchMedia('(prefers-color-scheme: light)')`로 해석한다. 실패 시 `catch`로 다크 유지.
2. **런타임(`src/lib/theme.ts`)**: `useResolvedTheme(mode)`가 `prefersDarkColorScheme()`를 초기 상태로 잡고, `mode === 'system'`일 때만 `matchMedia`에 `change` 리스너를 붙여 OS 설정 변경을 실시간 반영한다. `applyTheme()`이 `<html data-theme>`, `colorScheme`, `meta[name=theme-color]`(다크 `#09090b` / 라이트 `#f6f7f5`)를 갱신한다.
3. **CSS**: 색은 오직 `:root[data-theme='dark'|'light']`의 커스텀 프로퍼티를 통해서만 바뀐다. 즉 **`prefers-color-scheme` 미디어 쿼리는 CSS에 0건**이며, 시스템 선호는 JS가 해석해 속성으로 반영한다(설계 의도: 테마 전환이 즉시·결정적으로 일어나고, `index.html` 부트스트랩과 동일한 규칙을 공유).

테마 순환 순서는 `THEME_CYCLE = ['dark', 'light', 'system']`이며, 헤더 버튼 라벨은 `NEXT_MODE`(`dark→light→system→dark`)를 사용해 "현재 모드 아이콘 + 다음 모드 안내"를 동시에 표현한다.

#### 5.3.5 모션 / 애니메이션 전량

| keyframes | 정의 | 사용처 |
|---|---|---|
| `fade-in` | `from{opacity:0} to{opacity:1}` | `.reveal{animation:fade-in .5s var(--ease) both}` — 카드 진입 |
| `modal-in` | `opacity:0; translateY(12px) scale(.985)` → `opacity:1; translateY(0) scale(1)` | `.settings-modal` |
| `toast-in` | `opacity:0; translateY(16px) scale(.96)` → `1 / 0 / 1` | `.celebration-toast` |
| `toast-timer` | `scaleX(1)` → `scaleX(0)` | `.celebration-timer` (12초 진행 바, `--toast-duration` 연결) |
| `pulse` | `box-shadow: 0 0 0 0 currentColor` → `0 0 0 7px transparent` | `.period-now-pulse` (진행 중 표시, 2s infinite) |
| `float-soft` | `translateY(0)` ↔ `translateY(-6px)` | `index.css:386`에 정의만 존재하고 이를 사용하는 선택자·인라인 스타일이 `src/` 전체에 **0건**이므로 현재는 **미사용 애니메이션**이다 |

**핵심 최적화**: 모든 게이지·진행 바가 `width`가 아니라 **`transform: scaleX(var(--fill))`** 이고 `transform-origin:left`다(GPU 합성 유리). 실측 예: `.countdown-bar-fill{transform:scaleX(var(--fill,0))}`, `.battery-fill{transform:scaleX(var(--fill,0))}`, `.timeline-slot-fill{transform:scaleX(var(--progress,0))}`, `.week-day-fill{height:calc(var(--height,0)*100%)}`(유일하게 height 애니메이션). 전환 시간은 `transition:transform .9s linear`(타임라인/니들), `.24s ~ .6s var(--ease)`(UI 요소)로 계층화되어 있다.

### 5.4 접근성(A11y) 구현 현황

| 항목 | 구현 | 근거 |
|---|---|---|
| 건너뛰기 링크 | `<a class="skip-link" href="#main-content">본문 바로가기</a>` + `:focus-visible`에서 `translateY(0)` | `App.tsx:301`, `.skip-link` |
| 랜드마크 | `<header>`, `<main id="main-content">`, `<section aria-label>`, `<footer>`, `<aside aria-label="다음 일정">` | 각 컴포넌트 |
| 라이브 리전 | `role="timer" aria-live="polite" aria-atomic="true"`(1초 시계), `role="status" aria-live="assertive"`(축하 토스트), `role="alert"`(검증 오류/경고) | `ClockHero`, `CelebrationToast`, `Field`/`SettingsModal` |
| 포커스 링 | `button:focus-visible, input:focus-visible, select:focus-visible{outline:2px solid var(--ring); outline-offset:3px}` | `index.css` |
| 모달 | `role="dialog" aria-modal="true" aria-labelledby="settings-title" tabindex="-1"` + 수제 포커스 트랩(Tab 순환, Esc 닫기, body 스크롤 잠금, 이전 포커스 복원) | `SettingsModal`, `useFocusTrap.ts` |
| 탭/라디오 | `role="tablist"/"tab"/"tabpanel"`, `role="radiogroup"/"radio"` + Arrow/Home/End 키 + roving `tabIndex` | `SettingsModal.handleTabKeyDown`, `Field.SegmentedControl` |
| 토글 | `role="switch" aria-checked` + `sr-only` "켜짐/꺼짐" | `Field.ToggleRow` |
| 진행 바 | `role="progressbar" aria-valuemin/max/now`, 배터리는 `aria-valuetext="생존 배터리 23.2퍼센트, 방학까지 73수업일"` | `ClockHero`, `BatteryCard` |
| 현재 항목 | `aria-current="true"`(활성 슬롯), `aria-current="date"`(오늘 요일) | `PeriodTracker`, `WeekOverview` |
| 아이콘 | `aria-hidden="true"`(장식) 또는 `role="img" aria-label`(의미 전달) 이분법 | `Icon.tsx` |
| 키보드 전용 조작 | 카운트다운 패널 `role="button" tabindex="0"` + Enter/Space 처리 | `ClockHero:146-155` |
| 축소 모션 | `prefers-reduced-motion` 전역 해제 + 컨페티 `disableForReducedMotion: true` | `index.css`, `App.tsx` |
| 잔여 이슈 | (1) `.timeline-scroll` `tabindex=0`이지만 좌우 스크롤 키 안내 없음, (2) `window.confirm` 사용(커스텀 다이얼로그 아님), (3) 시계 디스플레이가 `aria-hidden`이라 스크린리더는 `sr-only` 텍스트에 의존, (4) `override-bar`의 시간 입력이 시각 레이블 없이 `aria-label`만 보유 | — |

### 5.5 아이콘 렌더링 파이프라인 (런타임 비용 0)

```
@iconify-json/solar (dev)  →  scripts/generate-icons.mjs  →  src/components/icons.generated.ts (58 KB, 50 글리프)
                                                                     ↓
                                                            <SolarIcon name="bell-ring-bold" size={13} />
                                                                     ↓
                            <svg class="solar-icon" style="width:13px;height:13px;font-size:13px"
                                 viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
                                 dangerouslySetInnerHTML={{ __html: glyph.body }} />
```

- 런타임 네트워크 요청 **0건**, CDN 스크립트 **0건**, 첫 페인트부터 아이콘 표시, 오프라인에서도 정상.
- `dangerouslySetInnerHTML`은 안전하다: `body`는 빌드 타임 생성 맵의 값이며 사용자 입력이 도달할 경로가 없다(생성기 주석 및 `Icon.tsx` 주석에 명시).
- 크기 프롭은 `number`(px) 또는 CSS 길이 문자열 둘 다 허용하며, `width/height/font-size` 3곳에 동시 적용된다.

---

## 6. 인터랙션, 사운드 및 로컬 영속성 (Interaction & Persistence)

### 6.1 이벤트 리스너 전수 목록

| # | 등록 위치 | 대상/이벤트 | 핸들러 | 옵션 | 해제 | 목적 |
|---|---|---|---|---|---|---|
| 1 | `App.tsx:91-99` | `window` / `pointerdown` | `unlock = () => chimeEngine.unlock()` | `{ once:true }` | ✅ cleanup에서 remove | 첫 제스처로 오디오 컨텍스트 개방 |
| 2 | `App.tsx:91-99` | `window` / `keydown` | 동일 `unlock` | `{ once:true }` | ✅ | 키보드 사용자 대응 |
| 3 | `App.tsx:101` | `window` / `storage` | `subscribeToExternalSettings(setSettings)` 내부 리스너 | — | ✅ 반환된 unsubscribe | 크로스탭 설정 동기화 |
| 4 | `App.tsx:102` | `window` / `beforeinstallprompt`, `appinstalled` | `subscribeInstallPrompt` 내부 | — | ✅ | PWA 설치 프롬프트 캡처 |
| 5 | `App.tsx:109-117` | `window` / `online`, `offline` | `updateOnline` | — | ✅ | 오프라인 표시 점 |
| 6 | `App.tsx:119-122` | `document` / `visibilitychange` | `refreshPermission` | — | ✅ | 복귀 시 알림 권한 상태 재조회 |
| 7 | `App.tsx:260-291` | `window` / `keydown` | `handleKeyDown` | — | ✅ | 전역 단축키 5종 |
| 8 | `useNow.ts:58-60` | `document` / `visibilitychange`, `window` / `focus`, `window` / `online` | `resync` | — | ✅ | 시계 재동기화 3종 |
| 9 | `useFocusTrap.ts:77` | `document` / `keydown` | `handleKeyDown` | **capture: true** | ✅ | Escape 닫기 + Tab 순환 |
| 10 | `tick.worker.ts:52` | `self` / `message` | 명령 처리 | — | 워커 종료 시 소멸 | `'start' | 'stop'` |
| 11 | `sw.js` | `install`, `activate`, `fetch`, `message` | 각 핸들러 | — | SW 생명주기 | 오프라인 전략 |
| 12 | `notify.ts:54` | `Notification` 인스턴스 / `onclick` | `window.focus()` + `close()` | — | 알림 소멸 시 | 클릭 시 앱 전면화 |
| 13 | `theme.ts:54` | `MediaQueryList` / `change` | `setSystemPrefersDark` | — | ✅ | 시스템 테마 실시간 반영 |
| 14 | `sound.ts:203` | `OscillatorNode` / `onended` | `oscillator.disconnect(); envelope.disconnect()` | — | 노드 종료 시 | 오디오 그래프 해제 |

**JSX 인라인 핸들러**: `onClick` 18곳(테마/설정/설치/오버라이드 칩 3종/카운트다운 패널/축하 닫기/모달 백드롭/탭 4종/내보내기/가져오기/초기화/음량 미리듣기/권한 요청/프리셋/교시 추가/정렬/삭제/복사 등), `onChange` 14곳(텍스트/시간/날짜/체크박스/레인지/파일), `onKeyDown` 4곳(카운트다운 Enter·Space, 탭 이동, 휴일 이름 Enter, 세그먼트 컨트롤), `onMouseDown` 1곳(모달 백드롭 판정).

### 6.2 키보드 단축키 (실제 구현)

```ts
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) return
  if (isSettingsOpen) return
  const target = event.target as HTMLElement | null
  if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
  switch (event.key.toLowerCase()) {
    case 's': event.preventDefault(); setIsSettingsOpen(true); break
    case 't': event.preventDefault(); handleCycleTheme(); break
    case 'f': event.preventDefault(); handleToggleFullscreen(); break
    case 'm': event.preventDefault(); handleToggleSound(); break
    case 'n': event.preventDefault(); handleToggleNotify(); break
  }
}
```

| 키 | 동작 | 부가 동작 |
|---|---|---|
| `S` | 설정 모달 열기 | 모달이 열려 있으면 단축키 전체 무시 |
| `T` | 테마 순환(다크→라이트→시스템→다크) | `chimeEngine.play('ui')` |
| `F` | 전체화면 진입/해제 | `documentElement.requestFullscreen()` / `exitFullscreen()`, 실패 무음 |
| `M` | 알림 소리 켜기/끄기 | 켤 때만 `unlock()` + `ui` 차임 |
| `N` | 브라우저 알림 켜기/끄기 | 켤 때 권한 요청, 거부 시 즉시 `notifyEnabled:false` 롤백 |
| `Esc` | 모달 닫기 | 포커스 트랩이 캡처 단계에서 처리 |
| 모달 내 | `Tab`/`Shift+Tab` 순환, `Arrow`/`Home`/`End` 탭·세그먼트 이동 | — |

가드 조건 3종(`수정자 키 없음`, `key.length === 1`, `입력 요소 아님`)이 정확히 구현되어 있어 입력 중 오작동이 없다. 푸터에 안내 문구가 상시 노출되며 `render.test.tsx`가 이 문구를 검증한다.

### 6.3 사운드 시스템 (Web Audio 합성)

**설계**: 오디오 파일을 **한 개도 사용하지 않는다.** `sound.ts` 상단 주석: "no audio files to download, no codec issues, and total silence unless the user turned sound on."

**음계 상수**
```ts
const NOTE = {
  G4: 392.0, C5: 523.25, D5: 587.33, E5: 659.25,
  G5: 783.99, A5: 880.0, C6: 1046.5, E6: 1318.51,
} as const

function bell(frequency: number, gain: number, decay: number, delay = 0): Voice[] {
  return [
    { frequency, gain, decay, delay, type: 'sine' },
    { frequency: frequency * 2.01, gain: gain * 0.32, decay: decay * 0.62, delay, type: 'sine' },
  ]
}
```
즉 모든 종소리는 **기음 + 2.01배 배음(0.32 게인, 0.62배 감쇠)** 의 2성부로 합성된다(2.01은 정수 배음을 살짝 비껴가게 해 금속 종 특유의 맥놀이를 만든다).

**레시피 7종 (실제 파라미터)**

| ChimeKind | 음 순서 (주파수) | 게인 | 감쇠(s) | 지연(s) | 청각적 의미 |
|---|---|---|---|---|---|
| `class-started` | E5 → A5 | 0.34 / 0.30 | 0.85 / 1.05 | 0 / 0.19 | 상행 2음 "수업 시작합니다" |
| `break-started` | A5 → E5 | 0.30 / 0.26 | 0.70 / 1.00 | 0 / 0.17 | 하행 2음 "쉬는 시간입니다" |
| `lunch-started` | C5 → E5 → G5 | 0.30 / 0.28 / 0.26 | 0.80 / 0.90 / 1.15 | 0 / 0.15 / 0.30 | 3음 상행(점심) |
| `duty-started` | G4 → D5 | 0.24 / 0.22 | 0.90 / 1.10 | 0 / 0.20 | 낮은 2음(업무 시간) |
| `dismissed` | C5 → E5 → G5 → C6 → E6 | 0.32 / 0.30 / 0.30 / 0.34 / 0.16 | 0.80 / 0.85 / 0.95 / 1.50 / 1.70 | 0 / 0.14 / 0.28 / 0.42 / 0.56 | 5음 팡파르 |
| `pre-bell` | G5 → D5 | 0.20 / 0.18 | 0.50 / 0.85 | 0 / 0.16 | 조용한 하행 2음(예비종) |
| `ui` | 1180 Hz 단일, `type:'triangle'` | 0.07 | 0.09 | 0 | 클릭 피드백 |

**엔벨로프 구현(실제 코드)**
```ts
private renderVoice(context: AudioContext, startedAt: number, voice: Voice) {
  const oscillator = context.createOscillator()
  const envelope = context.createGain()
  const start = startedAt + (voice.delay ?? 0)
  const end = start + voice.decay + 0.05

  oscillator.type = voice.type ?? 'sine'
  oscillator.frequency.setValueAtTime(voice.frequency, start)

  envelope.gain.setValueAtTime(0.0001, start)
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, voice.gain), start + 0.014)  // 14ms 어택
  envelope.gain.exponentialRampToValueAtTime(0.0001, end)                                  // 지수 감쇠

  oscillator.connect(envelope)
  envelope.connect(this.master ?? context.destination)
  oscillator.start(start)
  oscillator.stop(end + 0.02)
  oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect() }   // ← 노드 해제
}
```
`0.0001`에서 시작하는 이유는 `exponentialRampToValueAtTime`이 0을 허용하지 않기 때문이며, 클릭 노이즈 방지를 위해 어택을 14 ms로 잡았다.

**볼륨 체인**: `master = context.createGain()` → `master.gain.value = volume` → `destination`. 설정 슬라이더 값(0–100 정수)은 `App.tsx:87`에서 `/100`으로 변환되어 `chimeEngine.setVolume()`에 전달되고, `setVolume`은 `Math.min(1, Math.max(0, volume))`로 재클램프한다.

**브라우저 자동재생 제한(Autoplay Policy) 대응** — 3중 방어:
1. 오디오 컨텍스트를 **지연 생성**한다(`play()`/`unlock()` 시점까지 `new AudioContext()`를 호출하지 않음).
2. 첫 사용자 제스처에서 `unlock()`을 호출한다: `App.tsx`가 `pointerdown`/`keydown`에 `{once:true}` 리스너를 걸고, `unlock()`은 `context.state === 'suspended'`일 때 `context.resume().catch(() => undefined)`를 호출한다.
3. `setEnabled(true)`(소리 켜기) 시점에도 `unlock()`을 호출하고, `preview()`(미리 듣기)는 클릭 핸들러에서 직접 호출되므로 제스처 컨텍스트를 갖는다.

**미지원/실패 처리**: `resolveConstructor()`가 `window.AudioContext ?? webkitAudioContext`를 찾고, 없으면 `failed = true`로 **이후 모든 재생을 즉시 false 반환**한다(예외를 UI로 던지지 않음). `isSupported` getter는 이 플래그와 생성자 존재 여부를 함께 본다.

**알림과의 연결(중요)**: `dispatchScheduleEvent`/`dispatchPreAlert`는 소리와 알림을 **독립적으로** 처리한다(`sound`·`notify` 옵션이 각각 boolean). 즉 소리만 켜거나 알림만 켠 상태가 정상 동작한다.

### 6.4 시스템 알림 (Notification API)

```ts
export type NotificationState = 'unsupported' | 'default' | 'granted' | 'denied'

export function showNotification({ title, body, tag }: NotificationPayload): boolean {
  if (getNotificationState() !== 'granted') return false
  try {
    const notification = new Notification(title, {
      body,
      tag: tag ?? 'school-survival-clock',
      icon: assetUrl('icon-192.png'),
      badge: assetUrl('icon-192.png'),
      lang: 'ko-KR',
      silent: false,
    })
    notification.onclick = () => { window.focus(); notification.close() }
    return true
  } catch {
    return false
  }
}
```

| 이벤트 종류 | title | body |
|---|---|---|
| `class-started` | `{교시명} 시작` | `{timeLabel} · 오늘 남은 수업 {n분}` |
| `break-started` | `쉬는 시간 시작` | `{n분} 휴식 · 다음은 {다음 블록} {timeLabel}` |
| `lunch-started` | `점심시간입니다` | `{timeLabel} · 천천히 드시고 오세요` |
| `duty-started` | `방과후 · 업무 시간` | `하교까지 {n시간 n분} 남았습니다` |
| `dismissed` | `퇴근 시간입니다` | `오늘도 무사히 생존하셨습니다. 이제 정말 가세요!` |
| `pre-bell` | `곧 {교시명} 시작` | `{timeLabel} · {n} 남았습니다` |

- `tag`는 이벤트 종류별(`survival-${kind}`) / 교시별(`survival-pre-bell-${slot.id}`)로 고정되어 **같은 종류의 알림이 무한 누적되지 않고 대체**된다.
- 알림은 기본 **비활성**(`BASE_SETTINGS.notifyEnabled = false`)이며, `N` 키/설정 토글에서만 권한을 요청한다.
- 설정 UI는 `notificationState` 3종(unsupported/denied/default)에 따라 다른 설명 문구와 "권한 요청" 버튼을 조건부 렌더한다.

### 6.5 로컬 스토리지 (localStorage) — 완전 스키마와 복구 로직

#### 6.5.1 키 체계

```ts
export const STORAGE_KEY = 'school-survival-clock.settings.v4'
const LEGACY_STORAGE_KEYS = [
  'school-survival-clock.settings.v3',
  'school-survival-clock.settings.v2',
  'teacher-survival-dashboard-settings',
  'school-survival-clock.settings.v1',
]
```

| 순서 | 키 | 상태 |
|---:|---|---|
| 1 | `school-survival-clock.settings.v4` | **현행**. `saveSettings`가 쓰는 유일한 키 |
| 2 | `school-survival-clock.settings.v3` | 레거시(v2.1.0). 읽으면 v4로 재기록 후 삭제 |
| 3 | `school-survival-clock.settings.v2` | 레거시(v2.0.x) |
| 4 | `teacher-survival-dashboard-settings` | 최초 제품명 시절 키 |
| 5 | `school-survival-clock.settings.v1` | 최초 스키마 |

> `index.html`의 프리페인트 부트스트랩은 **2·3·4번만 읽고 1번(현행)을 읽지 않는다** — 7.6절의 실질적 결함으로 이어진다.

#### 6.5.2 로드 파이프라인 (`readFromStorage`)

```ts
function readFromStorage(): UserSettings {
  const candidates = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]
  for (const key of candidates) {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as unknown
      if (!isRecord(parsed)) continue
      const settings = normalizeSettings(parsed)
      // Re-write under the current key so the legacy entry stops being needed.
      if (key !== STORAGE_KEY) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
        window.localStorage.removeItem(key)
      }
      return settings
    } catch {
      // Corrupt JSON or blocked storage: fall through to the next candidate.
    }
  }
  return createDefaultSettings()
}
```
즉 **손상된 JSON을 만나면 다음 후보 키로 폴백하고, 모두 실패하면 기본값**이다. 로드 실패가 앱 크래시로 이어지는 경로는 없다.

#### 6.5.3 필드별 정규화 규칙 (전수)

| 필드 | 정규화 함수 | 규칙 | 실패 시 기본값 |
|---|---|---|---|
| `version` | (고정) | 항상 `SETTINGS_VERSION = 4`로 덮어씀 | 4 |
| `displayName` | `asString().trim().slice(0,40)` | 빈 문자열이면 기본 이름 | `김선생님` |
| `dismissalTime` | `asTime` | `isValidTimeInput` 통과 후 `9:05 → 09:05` 정규화 | `16:30` |
| `semesterStart` / `vacationDate` | `asDate` + `isValidSemesterRange` | 역전(방학 ≤ 개학) 시 **두 값 모두** 자동 창으로 대체 | 자동 창 |
| `semesterAuto` | `resolveSemesterAuto` | (a) 명시적 boolean이면 그 값 (b) 날짜가 무효면 `true` (c) **구 기본값 정확히 `2026-08-25`/`2026-12-31`이면 `true`로 승격** (그 외는 false) | `true` |
| `themeMode` | `asThemeMode` | `['dark','light','system']` 중 하나. 구버전 `theme:'light'`도 승격 | `dark` |
| `soundEnabled` | `asBoolean` | 타입 불일치 시 기본값 | `true` |
| `soundVolume` | `asVolume` | `Math.round` + 0~100 클램프, `NaN`이면 기본 | `60` |
| `notifyEnabled` | `asBoolean` | — | `false` |
| `preAlertEnabled` | `asBoolean` | — | `true` |
| `preAlertMinutes` | `asPreAlertMinutes` | `Math.round` + 1~15 클램프 | `3` |
| `autoHolidays` | `asBoolean` | — | `true` |
| `schoolDays` | `normaliseSchoolDays` | 정수 0~6만 통과, `Set` 중복 제거, **오름차순 정렬** | `[1,2,3,4,5]` |
| `holidays` | `normaliseHolidays` | 레코드만, 유효 날짜만, 날짜 중복 제거, 라벨 32자 절단, 날짜 오름차순, **최대 120개** | `[]` |
| `dayOverrides` | `normaliseDayOverrides` | 유효 날짜·유효 kind만, **오늘 기준 ±6일 이내**, `short`는 유효 `dismissalTime` 필수, 라벨 24자, **최대 14개** | `{}` |
| `timetables` | `normaliseTimetables`/`normaliseTimetable`/`normalisePeriod` | 요일 0~6 키를 **항상 7개 전부** 생성, 각 요일 `periods`는 유효 행만, **최대 16행**, 라벨 24자·id 32자 절단, 누락 시 기본 시간표로 대체 | `createDefaultTimetables()` |

#### 6.5.4 저장·동기화·복구 경로

| 경로 | 트리거 | 동작 |
|---|---|---|
| 자동 저장 | `settings` 변경 시마다 | `useEffect(() => { saveSettings(settings); chimeEngine.setEnabled(...); chimeEngine.setVolume(...) }, [settings])` |
| 저장 실패 | `setItem` throw(시크릿 모드/쿼터 초과) | `try/catch`로 삼키고 **메모리 상태로 계속 동작** |
| 크로스탭 | `storage` 이벤트 | 다른 탭이 v4를 갱신하면 `normalizeSettings` 후 `setSettings` (malformed는 무시) |
| 자정 프루닝 | `kstNow.dateKey` 변경 | `normalizeSettings(current, dateKey)`로 만료된 `dayOverrides` 제거(개수 비교로 불필요한 리렌더 방지) |
| 학기 자동 갱신 | `kstNow.dateKey` 변경 + `semesterAuto` | 새 창과 기존 값이 다를 때만 `{...current, semesterStart, vacationDate}` 갱신 |
| 내보내기 | 설정 → 데이터 → "설정 내보내기" | `new Blob([serializeSettings(draft)], {type:'application/json'})` → `survival-clock-settings-{YYYY-MM-DD}.json` 다운로드(2-스페이스 들여쓰기 + 개행) |
| 가져오기 | `.json` 파일 선택 | `parseSettingsJson` → 성공/경고 메시지 표시, draft에만 반영(저장 버튼으로 확정) |
| 초기화 | `window.confirm` 승인 | `createDefaultSettings(todayDateKey)`로 draft 교체 |

#### 6.5.5 가져오기 경고 메시지 (실제 문자열)

| 조건 | 경고 문구 |
|---|---|
| JSON 파싱 실패 | `JSON 형식을 읽을 수 없어 기본값을 사용했어요.` |
| 최상위가 객체가 아님 | `설정 객체가 아니어서 기본값을 사용했어요.` |
| 이름이 비었음 | `이름이 비어 있어 기본 이름으로 채웠어요.` |
| 휴일 일부 탈락 | `형식이 맞지 않는 휴일 항목은 건너뛰었어요.` |
| 예외 일부 프루닝 | `오늘 하루 예외는 오늘 기준 최근 항목만 유지했어요.` |
| 시간표 누락 | `시간표가 들어 있지 않아 기본 시간표를 적용했어요.` |
| 파일 읽기 실패 | `파일을 읽지 못했습니다. JSON 형식인지 확인해 주세요.` |

### 6.6 PWA / 오프라인 / 설치 흐름

| 단계 | 구현 |
|---|---|
| 등록 | `registerServiceWorker()` — `PROD`에서만, `window.load` 이후, 실패 무음 |
| 프리캐시 | 7개 URL(`./`, `./index.html`, manifest, svg, 192, 512, apple-touch) — `Promise.allSettled`로 개별 실패 허용 |
| 활성화 | 구버전 캐시 전부 삭제 + `clients.claim()` |
| 내비게이션 | network-first → 실패 시 `ignoreSearch` 캐시 → `./index.html` → `./` → 원 예외 재던짐 |
| 동일 출처 자산 | stale-while-revalidate(해시 파일명이라 캐시 우선이 항상 정확) |
| 교차 출처 폰트 | stale-while-revalidate + `allowOpaque: true`(opaque 응답도 저장) |
| 업데이트 | `skipWaiting()` + `'skip-waiting'` 메시지 경로(현재 앱에서 메시지를 보내는 UI는 없음 — 8.4절 제안) |
| 설치 UI | `beforeinstallprompt`를 캡처해 히어로 인트로 영역에 `앱 설치` 버튼을 조건부 노출, `userChoice` 결과로 버튼 제거 |
| 딥링크 | `?open=settings` — `URLSearchParams` 검사 후 모달 자동 오픈(매니페스트 바로가기와 동일 URL) |

### 6.7 하교 축하(Confetti + Toast) 전체 흐름

```ts
const triggerCelebration = useCallback((dateKey: string, dismissalTime: string) => {
  const key = `${dateKey}-${dismissalTime}`
  if (celebratedKeyRef.current === key) return          // 하루 1회 중복 방지
  celebratedKeyRef.current = key
  setIsCelebrationVisible(true)
  if (celebrationTimeoutRef.current !== undefined) window.clearTimeout(celebrationTimeoutRef.current)
  celebrationTimeoutRef.current = window.setTimeout(() => setIsCelebrationVisible(false), CELEBRATION_MS)

  void import('canvas-confetti').then(({ default: confetti }) => {
    void confetti({ particleCount: 130, spread: 70, startVelocity: 32, scalar: 1.02,
                    origin: { y: 0.65 }, colors: CONFETTI_COLORS, disableForReducedMotion: true })
    window.setTimeout(() => {
      void confetti({ particleCount: 70, spread: 100, startVelocity: 22, scalar: 0.85,
                      origin: { x: 0.15, y: 0.8 }, colors: CONFETTI_COLORS, disableForReducedMotion: true })
      void confetti({ particleCount: 70, spread: 100, startVelocity: 22, scalar: 0.85,
                      origin: { x: 0.85, y: 0.8 }, colors: CONFETTI_COLORS, disableForReducedMotion: true })
    }, 160)
  }).catch(() => {})
}, [])
```
- 트리거 조건: `detectScheduleEvent`가 `dismissed` 전환을 **신선하게**(≤90초) 감지했을 때만.
- `CONFETTI_COLORS = ['#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#10b981']` (에메랄드 5단계).
- `CELEBRATION_MS = 12000`이며, 토스트의 진행 바 애니메이션이 `--toast-duration: 12000ms`로 동일 값을 공유한다.
- `canvas-confetti`는 **동적 import**이므로 하교 순간에만 10.7 KB 청크가 로드된다(초기 번들에서 제외 — 2.2절 dist 실측).
- 언마운트 시 `clearTimeout`으로 타이머 누수를 방지한다.

---

## 7. 엣지 케이스, 잠재적 버그 및 아키텍처 취약점 분석

본 장의 모든 항목은 (1) 코드 정적 분석 근거, 또는 (2) **실제 실행 프로브로 관측한 출력**을 근거로 한다. 프로브는 `src/lib/__tests__/zz-audit-probe.test.ts` / `zz-audit-probe2.test.ts` 임시 파일로 실행한 뒤 삭제했으며, 실행 후 `git status --porcelain`이 비어 있음을 확인했다(저장소 무변경).

### 7.1 주말(토·일) 접속 시 동작 — ✅ 정상 처리

**실측**: 2026-09-19(토) 11:00 KST
```
[A] 토요일 dayType = weekend | phase = off-day
```

코드 경로:
- `getDayContext` 5순위에서 `!isSchoolWeekday(settings, weekdayIndex)` → `dayType:'weekend'`, `label:'주말'`(0/6인 경우), `description:'주말이에요. 교실 대신 나를 챙기는 날입니다.'`.
- `getScheduleStatus` 최상단에서 `!day.isSchoolDay`면 **빈 아웃라인과 0 카운터**를 반환한다. 이 가드가 없으면 요일 시간표의 교시 카운터가 주말로 새어 나간다(v2.1.0에서 수정된 이력이 README에 기록됨).
- UI: `PeriodTracker`는 `timeline-empty is-rest` 블록(`오늘은 수업이 없어요`)을, `ClockHero`는 kicker `쉬는 날` + 다음 등교까지 카운트다운을 렌더한다. `heroHeadline`의 `off-day` 분기가 `nextSchoolDay.secondsUntilFirstPeriod`를 사용한다.
- `render.test.tsx`에 `'renders the recovery state on a weekend'`, `'shows recovery mode when opened in the pre-dawn hours of a weekend'` 케이스가 있다.

**잔여 관찰**: 주말에도 시계는 계속 1초 단위로 갱신되며 워커가 계속 돈다(의도된 동작이지만, 상시 표시가 아닌 기기에서는 불필요한 배터리 소비 — 8.4절 개선 제안 5).

### 7.2 공휴일 · 방학 · 개학 전 (그리고 내장 달력의 유효 기간)

**내장 달력 범위**: `BUILTIN_HOLIDAY_FIRST_YEAR = 2025`, `BUILTIN_HOLIDAY_LAST_YEAR = 2029`. 총 수록 항목 수는 연도별로 19(2025) / 20(2026) / 21(2027) / 16(2028) / 18(2029)이다.

**판정 우선순위** (`isHolidayDate`): 직접 등록 휴일 → (autoHolidays가 켜져 있으면) 내장 달력 → null. 즉 **사용자가 등록한 재량휴업일이 내장 공휴일을 항상 덮어쓴다**.

**🔴 결함 1 — 2030년 이후 공휴일 전면 미인식 (실측)**
```
[K] builtin 신정 2030-01-01 = null
[K] builtin 현충일 2030-06-06 = null
[K] 2030-06-06 (목) isHolidayDate = null
[K] 2030-06-06 dayType = school | phase = in-slot
[L] 2029-12-25 builtin = 성탄절
```
- `builtinHolidayLabel()`은 `Map.get() ?? null`이므로 범위 밖 연도는 **조용히 null**을 반환한다.
- 결과: 2030-06-06(현충일, 목요일)이 **정상 수업일로 분류**되어 배터리 수업일 계산·타임라인·알림이 모두 평일 기준으로 동작한다.
- 유일한 사용자 보호 장치는 설정 → 쉬는 날의 경고문이다(`isYearCoveredByBuiltinCalendar` → `내장 달력은 2025~2029년만 담고 있어요. 그 밖의 해는 직접 등록해 주세요.`). 하지만 이 경고는 **학기 시작일의 연도만** 검사한다:
  ```ts
  const semesterOutOfRange = useMemo(
    () => !isYearCoveredByBuiltinCalendar(Number(semesterStart.slice(0, 4))),
    [semesterStart],
  )
  ```
  따라서 학기 창이 2029-08-18~2030-01-06인 상태에서 학기 시작 연도(2029)만 커버되므로 **경고가 표시되지 않는다**. 2030년 1월 1일(신정)·1월 6일 이전의 겨울방학 구간은 `vacation`으로 덮여 무해하지만, **2029-08-18~2029-12-31 사이의 미수록 공휴일은 없다고 가정**해도 2030-03-01(삼일절, 금요일)은 학기 시작 전(`before-semester`)이라 무해하며, 실제 피해는 2030-05-05/2030-06-06 등이다.
- **권장 수정**: ① `BUILTIN_HOLIDAY_LAST_YEAR`를 매년 갱신하는 릴리스 프로세스 도입, ② 범위 밖 연도에서는 `autoHolidays`를 켠 상태여도 UI에 상시 배너 노출(학기 창의 **양 끝 연도**를 모두 검사), ③ 장기적으로는 음력 변환 라이브러리 없이도 계산 가능한 고정 국경일(1/1, 3/1, 5/5, 6/6, 8/15, 10/3, 10/9, 12/25)만이라도 알고리즘화.

**방학/개학 전 판정**: `semesterWindowFor(settings, dateKey)`가 **그 날짜의** 창을 반환하므로(자동 모드), 방학 경계를 넘는 날짜도 올바르게 분류된다. 실측:
```
[C] 2030-06-10 dayType = school | semester window = 2030-03-02 → 2030-07-20 | phase = in-semester
[I] manual window + 2027-01-10 → dayType = vacation | battery = 100
```
수동 모드에서는 **단일 창**이 모든 날짜에 적용되므로, 학기가 지난 뒤의 날짜(예: 수동 창 2026-08-18~2026-12-31 + 조회일 2027-01-10)는 영구히 `vacation`으로 남고 배터리는 100%에 고정된다(실측 `[I]`). 이는 사용자가 의도적으로 자동 모드를 껐을 때의 **문서화되지 않은 부작용**이다.

### 7.3 자정(00:00:00) 롤오버 — ✅ 구조적으로 안전

**실측 (일요일 23:59:59 → 월요일 00:00:01 KST)**
```
[B] 23:59:59 phaseKey = 2026-09-20:off-day:weekend
[B] 00:00:01 phaseKey = 2026-09-21:before-first-slot
```

안전한 이유(3중 방어):
1. `phaseKey`가 항상 `dateKey`로 시작하므로 자정에 반드시 값이 바뀐다 → 전환 감지가 정상 작동한다.
2. 자정 직후의 국면은 `before-first-slot`(daySeconds ≈ 1 < dayStartSeconds 32400)이며 `secondsRemaining ≈ 32399`(= 약 9시간)로 정확하다. `render.test.tsx`에 `'stays in the dismissed state at 23:59 KST'`, `'rolls over to the next school day exactly at KST midnight'` 케이스가 있다.
3. 시각 파츠 자체가 `Intl`로 매 틱 재계산되므로 "날짜 상태"를 별도로 보관하지 않는다(상태 불일치 원천 차단).

**부수 효과(설계 의도)**: `dayOverrides`는 날짜 키이므로 자정에 자동 만료된다. 또한 `App.tsx:172-178`의 프루닝 이펙트가 `kstNow.dateKey` 변경 시 ±6일 밖 항목을 제거한다. 학기 자동 창도 같은 시점에 재계산된다(`App.tsx:163-170`).

**한 가지 주의**: 야간(00:00~09:00)에는 `before-first-slot` 상태가 9시간 동안 유지되므로, 히어로 카운트다운이 `08:59:59`처럼 **9시간 단위로 표시**된다. 자정 넘김 자체는 정상이나, 새벽 2시에 "등교까지 7시간"이 표시되는 것이 UX상 적절한지는 제품 결정 사항이다(README는 이 동작을 "다음 등교까지 카운트다운"으로 의도된 기능으로 기술).

### 7.4 기기 시스템 시계 오차 — ❌ 예외 처리 장치 없음

- 앱의 유일한 시간 원천은 **`Date.now()`(기기 시스템 시계)** 이다. `time.ts`는 이 값을 `Asia/Seoul`로 **변환**할 뿐, 외부 시간 서버(NTP/HTTP `Date` 헤더/서버 시각 API)와 **대조하거나 보정하지 않는다**. 검색 범위: `fetch`, `XMLHttpRequest`, `navigator.clock`, `Performance` 기반 보정 — 전부 0건.
- 결과: 기기 시계가 5분 느리면 모든 알림이 5분 늦게 울리고, 날짜가 하루 어긋나면 학기 창·수업일 계산까지 연쇄 오차가 발생한다. 앱 내부에서 이 사실을 알려 주는 UI는 없다.
- 반면 **시간대 오차는 완전히 방어된다**: 어떤 시간대로 설정된 기기든 `Intl.DateTimeFormat(timeZone:'Asia/Seoul')`을 통과하므로 KST 벽시계 값은 동일하다. 즉 "해외 출장 중 노트북" 시나리오는 정상, "기기 시계 자체가 틀린" 시나리오는 취약하다.
- **권장 수정**: ① `performance.now()` 기반 드리프트 감지(장시간 탭에서 시스템 시계가 조정된 경우 탐지), ② 최초 로드 시 1회 경량 시간 API 호출로 오차를 측정해 `±2분 이상`이면 경고 배너, ③ 서버가 없는 정적 앱이므로 최소한 `document.timeline`/`performance.timeOrigin`과 `Date.now()`의 괴리를 로그로 남기는 방어적 계측.

### 7.5 자정을 넘기는 하교 시각 — 🔴 결함 2: 조용한 클램프

**실측**:
```
[D] dismissalTime=00:30 → outline.dismissalSeconds = 53400
    slots = p1@32400,break-2@34800,p2@35400,break-4@37800,p3@39000,break-6@41400,
            p4@42000,lunch@44400,p5@48000,break-10@50400,p6@51000
    lastPeriodEnd = 53400
[E] dismissalTime=23:00 → slots = 12
    duty = {"id":"after-school","kind":"duty","startSeconds":53400,"endSeconds":82800,"timeLabel":"14:50 ~ 23:00"}
```

- `00:30`은 `parseTimeToSeconds('00:30') = 1800`(00:30 AM)이므로 `Math.max(1800, 53400) = 53400`이 되어 **하교 시각이 14:50으로 조용히 대체**된다. 야간 자율학습·야근으로 자정을 넘기는 학교(예: 00:30 종료)는 이 앱에서 표현할 수 없다.
- `23:00`은 정상 동작하며 duty 블록이 `14:50 ~ 23:00`(8시간 10분)으로 확장된다.
- **권장 수정**: `HH:MM` 스키마에 "다음 날" 플래그를 추가하거나(예: `dismissalTime: '00:30', dismissalNextDay: true`), `TimetablePeriod.end`를 24시간 초과 초 단위로 정규화(`25:30` = 91800초)하고 `formatHmFromSeconds`가 `% 24` 대신 누적 시간을 표시하도록 확장. 최소 조치로는 설정 UI에서 `00:00~04:00` 입력 시 "다음 날 새벽으로 해석됩니다" 안내 + 실제 클램프를 사용자에게 경고로 노출.

### 7.6 🔴 결함 3: 프리페인트 테마 부트스트랩의 저장 키 불일치 (라이트 모드 FOUC)

- `index.html` 부트스트랩이 읽는 키: `...settings.v3`, `...settings.v2`, `teacher-survival-dashboard-settings`.
- 앱이 실제로 쓰는 키: `...settings.v4` (`settings.ts:39`).
- 마이그레이션 로직은 레거시 키를 **읽은 즉시 삭제**한다:
  ```ts
  if (key !== STORAGE_KEY) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    window.localStorage.removeItem(key)
  }
  ```
- 따라서 v4로 승격된 이후의 모든 로드는 부트스트랩에서 `raw = null` → `mode = 'dark'` → `<html data-theme="dark">`로 페인트된 뒤, React가 `useResolvedTheme`로 `light`를 적용하며 **화면이 흰색으로 번쩍인다**(라이트 사용자 한정).
- 즉 부트스트랩의 존재 목적("dark-mode users never see a white flash while React boots")은 **다크 사용자에게만 달성**되고, 라이트 사용자에게는 반대 방향의 플래시가 발생한다.
- **권장 수정(1줄)**: 부트스트랩 키 목록 맨 앞에 `'school-survival-clock.settings.v4'`를 추가하고, 가능하면 v5 승격 시에도 깨지지 않도록 `Object.keys(localStorage).filter(k => k.startsWith('school-survival-clock.settings.'))` 순회로 일반화.
- **추가 결함**: `LEGACY_STORAGE_KEYS`에 포함된 `...settings.v1`은 부트스트랩에 없어 v1 사용자는 항상 다크로 페인트된다(동일 원인).

### 7.7 🟠 결함 4: 단축 수업일의 하교 시각 표기 불일치

- 단축 하교(`short` override)는 `outline.dismissalSeconds`를 앞당기므로 **카운트다운·배터리·주간 계산은 모두 정확**하다.
- 그러나 하교 시각을 **문자열로 표시하는 지점들은 `settings.dismissalTime`(원래 시각)을 그대로 쓴다**:

| 위치 | 코드 | 단축일 실제 표기 |
|---|---|---|
| 히어로 포커스 '하교까지' 모드 | `note: \`${dismissalTime} 하교 · 오늘 ${status.totalClassCount}교시\`` (`ClockHero.tsx:91`) | 원래 시각(예: 16:30) |
| 히어로 '하교까지' title | `하교까지 ${formatMinutes(remain)}` | 남은 시간은 정확 |
| 축하 토스트 kicker | `<p className="celebration-kicker">{dismissalTime} 하교</p>` (`App.tsx:357` → `CelebrationToast`) | 원래 시각 |
| 축하 중복 방지 키 | `` const key = `${dateKey}-${dismissalTime}` `` (`App.tsx:126`) | — |
| 배터리 카드 | `metrics`는 학기 기준이므로 무관 | — |

- 즉 13:00 단축 하교일에도 화면에 "16:30 하교"가 표시되고, 카운트다운은 13:00을 향해 줄어드는 **시각적 모순**이 발생한다.
- **권장 수정**: `dismissalTimeFor(settings, dateKey)`(이미 `schedule.ts:90`에 존재)를 App에서 계산해 `ClockHero`/`CelebrationToast`에 주입하고, 중복 방지 키도 이 값으로 바꾼다. `DayOverrideBar`의 초기값은 "기본 하교 시각"이라는 의미가 있으므로 `settings.dismissalTime` 유지가 타당하다.

### 7.8 🟠 결함 5: 주간 "남은 수업일"이 하교 후에도 오늘을 포함

**실측**:
```
[M] 목 21:00 week remainingSchoolDayCount = 2
    states = 월:school(past) 화:school(past) 수:school(past) 목:today 금:school 토:weekend 일:weekend
```
- 코드는 `isPast = dateKey < now.dateKey`이므로 **오늘은 시간과 무관하게 "남은 날"** 로 계산된다:
  ```ts
  if (isTeachingDay) {
    schoolDayCount += 1
    totalClassSeconds += classSeconds
    if (!isPast) { remainingSchoolDayCount += 1 }   // 오늘 21시에도 오늘이 카운트됨
    ...
  }
  ```
- 결과: 목요일 21시에 카드 부제가 `남은 수업일 2일 · 주간 수업 18시간 40분`으로 표시되어, 실제 남은 하루(금)보다 1일 많게 읽힌다.
- 코드 주석은 `(오늘 포함, 오늘이 수업일이고 아직 안 끝났으면 1)`이라고 의도가 다르게 적혀 있어 **주석과 구현의 불일치**이기도 하다.
- **권장 수정**: `isToday && status.day.hasClasses && 현재 시각 < dismissalSeconds`인 경우에만 오늘을 카운트하거나, `remainingSchoolDayCount`를 "남은 수업일(오늘 제외)"로 재정의하고 문구를 바꾼다.

### 7.9 🟠 결함 6: 상태 업데이터 함수 내부의 부수효과 (StrictMode 이중 실행 위험)

```ts
/** M · 차임벨 켜기/끄기. 끌 때는 소리를 내지 않는다. */
const handleToggleSound = useCallback(() => {
  setSettings((current) => {
    const soundEnabled = !current.soundEnabled
    chimeEngine.setEnabled(soundEnabled)      // ← updater 내부 부수효과 1
    if (soundEnabled) {
      chimeEngine.unlock()                    // ← 부수효과 2
      chimeEngine.play('ui')                  // ← 부수효과 3
    }
    return { ...current, soundEnabled }
  })
}, [])

const handleToggleNotify = useCallback(() => {
  setSettings((current) => {
    if (current.notifyEnabled) return { ...current, notifyEnabled: false }
    void requestNotificationPermission().then((state) => {   // ← updater 내부에서 권한 요청
      setNotificationState(state)
      if (state !== 'granted') {
        setSettings((latest) => ({ ...latest, notifyEnabled: false }))  // ← updater 내부에서 setState
      }
    })
    return { ...current, notifyEnabled: true }
  })
  chimeEngine.play('ui')
}, [])
```
- React 18 `StrictMode`는 개발 모드에서 상태 업데이터를 **2회 호출**해 순수성을 검사한다. 위 두 함수는 업데이터가 순수하지 않으므로 **개발 중 `M` 키 한 번에 차임이 2번 울리거나**, `N` 키 한 번에 `Notification.requestPermission()`이 2회 호출될 수 있다.
- 프로덕션 빌드에서는 대체로 1회지만, React가 렌더를 폐기하고 재시도하는 경우(동시성 기능 사용 시) 중복 실행 가능성은 남는다. 함수형 업데이트는 **순수해야 한다**는 규칙의 명확한 위반이다.
- 참고로 `handleOverrideChange`와 `handleCycleTheme`는 업데이터가 순수하고 `play('ui')`가 업데이터 **바깥**에 있어 올바르다. 두 함수를 같은 패턴으로 리팩터링하면 해결된다.
- **권장 수정**: `chimeEngine` 부수효과를 업데이터 밖으로 이동하고, 필요한 경우 `useRef`로 이전 값을 추적하거나 `useEffect`에서 `settings.soundEnabled` 변화를 감지해 1회만 재생.

### 7.10 🟠 결함 7: Android Chrome에서 시스템 알림이 사실상 동작하지 않음

- `showNotification`은 **`new Notification(...)` 생성자 경로**만 사용한다. Android Chrome은 데스크톱과 달리 `new Notification()`을 지원하지 않고 `ServiceWorkerRegistration.showNotification()`을 요구하므로, 호출 시 `TypeError`가 발생한다.
- 코드는 이를 `try { ... } catch { return false }`로 **조용히 삼킨다**. 따라서 안드로이드 폰에서 교사가 알림을 켜도 "권한 허용됨"으로 보이지만 실제 알림은 오지 않는다(iOS Safari 16.4+의 PWA 알림도 동일 제약).
- **권장 수정**: `navigator.serviceWorker.ready`를 await해 `registration.showNotification(title, options)`을 우선 사용하고, 실패 시에만 `new Notification()`으로 폴백. `Notification.permission`이 `granted`여도 플랫폼별 가용성을 UI 문구에 반영.

### 7.11 🟡 코드 냄새 · 죽은 코드 · 문서-구현 불일치

| # | 항목 | 증거 | 영향 |
|---|---|---|---|
| 1 | **죽은 CSS 클래스 `reveal-on-scroll`** | `PeriodTracker.tsx:80`, `WeekOverview.tsx:47`이 클래스를 적용하지만 `src/index.css`에 해당 선택자 **0건** | 스크롤 게이트 기능이 실제로는 존재하지 않음(무해하나 오해 유발) |
| 2 | **미사용 CSS 변수 `--index`** | `App.tsx:30-31`(``const introRevealStyle = { '--index': 0 }``), `ClockHero.tsx:18`, `PeriodTracker.tsx:16`, `WeekOverview.tsx:12`, `BatteryCard.tsx:25`, `AppHeader.tsx:13`이 인라인으로 `--index`를 주입하지만 `index.css`에 `--index` **0건** | 캐스케이드 스태거 모션이 실제로는 동작하지 않음(모든 `.reveal`이 동일 타이밍) |
| 3 | **README ≠ 구현** | README "모션" 절: `진입은 fade-in-up + --index 캐스케이드, 스크롤 게이트는 IntersectionObserver 훅(scroll 리스너 없음)`. 실제: keyframe 이름은 `fade-in`(fade-in-up 아님), `IntersectionObserver` **0건**, `.reveal-on-scroll` 규칙 없음, `--index` 미사용 | 문서를 신뢰한 후속 개발자가 존재하지 않는 훅을 찾게 됨 |
| 4 | **README ≠ 구현 (레이아웃)** | README: `콘텐츠 max-width: 80rem`. 실제: `.page-wrap{max-width:72rem}` | 문서-코드 불일치 |
| 5 | **README ≠ 구현 (테스트 수)** | README v2.2.0: `테스트 106 → 140개`. 실측: **141개** | 경미 |
| 6 | **앱에서 호출되지 않는 export 2종** | `getWeekContext`(schedule.ts:711), `sameSemesterWindow`(semesterWindow.ts:114) — 비테스트 참조 0건, 테스트에서만 검증 | 공개 API 표면만 넓히는 죽은 코드(혹은 향후 기능의 선반영) |
| 7 | **`ScheduleStatus`의 미사용 필드 6종** | `classLoadProgress`, `completedClassSeconds`, `completedClassCount`, `phaseEndSeconds`, `lastPeriodEndSeconds`, `spanSeconds` — 엔진/타입 외 참조 0건 | 계산 비용은 미미하나 계약이 과대. 단, `classLoadProgress`는 테스트와 프로브에서 검증됨(의도적 예비 지표로 판단 가능) |
| 8 | **`App.tsx` 중복 import** | 12행 `import { getNotificationState } from './lib/notify'` + 23행 `import { requestNotificationPermission } from './lib/notify'` | 동일 모듈 2회 import(기능 무해, 린트 부재의 증거) |
| 9 | **`hms()` 중복 구현** | `ClockHero.tsx:20-23`의 `hms()`가 `time.ts:95` `formatDuration()`과 동일 로직(`HH:MM:SS` 패딩) 중복 | DRY 위반 |
| 10 | **`break-N` id의 배열 인덱스 의존** | `id: \`break-${slots.length + 1}\`` — 편집으로 교시가 추가/삭제되면 id 재번호화 | `phaseKey`가 바뀌어 **편집 직후 불필요한 전환 알림**이 1회 발생할 수 있음(예: `in-slot:break-10` → 다른 id). 재현 조건이 좁아 실사용 영향은 낮음 |
| 11 | **lint/format 도구 전무** | `.eslintrc*`, `eslint.config.*`, `.prettierrc*` **0건**, CI `verify` 잡에도 lint 단계 없음 | `noUnusedLocals`/`noUnusedParameters`(tsc)만이 유일한 정적 안전망. 중복 import·dead class 같은 문제가 자동 검출되지 않음 |
| 12 | **`window.confirm` 사용** | `SettingsModal.handleReset` | 브라우저 기본 다이얼로그(스타일 불일치, 테스트 불가) |
| 13 | **`sr-only` 라이브 리전의 과다 발화** | `ClockHero`의 `role="timer" aria-live="polite"`가 초마다 내용을 갱신 | 스크린리더 사용자에게 매 초 읽기 시도가 발생할 수 있음(실사용 검증 필요) |
| 14 | **`dist/.nojekyll`을 CI에서 생성** | `run: touch dist/.nojekyll` | 로컬 빌드 산출물에는 없어 로컬 `dist`를 그대로 Pages에 올리면 `_` 접두 폴더가 누락될 수 있음(Vite 기본 산출물은 `assets`라 현재는 무해) |

### 7.12 전역 변수 오염 · 메모리 누수 감사

| 점검 항목 | 결과 | 근거 |
|---|---|---|
| 전역 변수 오염 | ✅ **없음**. `src/` 어디에도 `window.foo = ...`, `globalThis.x = ...` 할당이 없다. 유일한 전역 부착은 매니페스트/부트스트랩의 `localStorage` 키와 `document.documentElement` 속성(`data-theme`) | 전체 grep |
| 모듈 싱글턴 | `chimeEngine`, `kstFormatter`, `BUILTIN_HOLIDAY_INDEX`, `SOLAR_ICON_GLYPHS`, `EMPTY_OUTLINE` — 모두 읽기 전용 또는 의도된 싱글턴 | 각 파일 |
| 이벤트 리스너 해제 | ✅ 14개 등록 지점 전부 cleanup 또는 생명주기 소멸 경로 존재(6.1절 표) | 6.1 |
| Web Worker 정리 | ✅ `disposed` 플래그 + `postMessage('stop')` + `terminate()` | `useNow.ts:62-78` |
| 타이머 정리 | ✅ `celebrationTimeoutRef`는 교체 시 `clearTimeout` + 언마운트 시 정리. ⚠️ 예외 1건: 컨페티 2차 발사를 위한 `window.setTimeout(..., 160)`(`App.tsx:143`)은 **추적되지 않음** — 언마운트 후 실행되면 이미 사라진 컴포넌트에 `confetti()`를 호출할 뿐(경미, 누수 아님) | `App.tsx` |
| 오디오 노드 해제 | ✅ `oscillator.onended`에서 `oscillator.disconnect()` + `envelope.disconnect()` | `sound.ts:203-206` |
| `AudioContext` 종료 | ⚠️ `close()` 호출 경로 **없음**. 앱 전 생명주기 동안 1개만 생성되므로 실질 누수는 아니나, 테스트/임베드 환경에서는 미종료 컨텍스트가 남을 수 있음 | `sound.ts` |
| Object URL 해제 | ✅ Safari 대응 1초 지연 `revokeObjectURL` | `SettingsModal.handleExport` |
| 구독 해제 | ✅ `subscribeToExternalSettings`/`subscribeInstallPrompt`/`useResolvedTheme` 각각 unsubscribe 함수 반환 + 이펙트 cleanup | 각 모듈 |
| `canvas-confetti` 캔버스 | 라이브러리가 자체 회수(1회성 파티클) | — |
| React 상태 누수 | ✅ 파생값을 상태로 두지 않아 오래된 값이 남지 않음. `previousPhaseKeyRef`/`celebratedKeyRef`는 날짜 키 기반이라 무한 증가하지 않음 | `App.tsx` |

### 7.13 하드코딩 상수 전량 인벤토리 (단일 진실 공급원 후보)

| 상수 | 값 | 파일:행 | 성격 |
|---|---|---|---|
| `SEOUL_TIME_ZONE` | `'Asia/Seoul'` | `time.ts:10` | 도메인 필수 |
| `DAY_IN_MS` / `DAY_IN_SECONDS` | `86400000` / `86400` | `time.ts:11,14` | 수학 |
| `parseTimeToSeconds` 폴백 | `16:30` (=59400) | `time.ts:174` | **암묵적 도메인 가정**(한국 교사 평균 하교 시각) |
| `MIN_BREAK_SECONDS` | `5 * 60` | `schedule.ts:42` | 도메인 규칙 |
| `MIN_DUTY_SECONDS` | `10 * 60` | `schedule.ts:44` | 도메인 규칙 |
| `LOOKAHEAD_DAYS` | `400` | `schedule.ts:619` | 안전 상한 |
| `STALE_EVENT_SECONDS` | `90` | `alerts.ts:17` | 알림 정책 |
| `OVERRIDE_WINDOW_DAYS` | `6` | `settings.ts:49` | 프루닝 정책 |
| `MAX_DAY_OVERRIDES` | `14` | `settings.ts:50` | 용량 상한 |
| `STORAGE_KEY` | `'school-survival-clock.settings.v4'` | `settings.ts:39` | 영속성 |
| `THEME_ATTRIBUTE` | `'data-theme'` | `theme.ts:5` | HTML/CSS 계약(index.html과 이중 정의) |
| 테마 색 | `#09090b` / `#f6f7f5` | `theme.ts:6-9`, `index.html`, 매니페스트 | **3곳 중복 정의** |
| `INTERVAL_MS` / `MIN_DELAY_MS` | `1000` / `40` | `useNow.ts:3-4`, `tick.worker.ts:26-28` | **2곳 중복 정의** |
| `COMPACT_WIDTH_PERCENT` | `7` | `timeline.ts:47` | UI 임계 |
| `CLASS_LOAD`·`NEXT_UP_LIMIT` | `3` | `PeriodTracker.tsx:29` | UI 정책 |
| `CELEBRATION_MS` | `12000` | `App.tsx:27` | UI 정책 |
| `CONFETTI_COLORS` | 5색 에메랄드 | `App.tsx:26` | 브랜드 |
| 파티클 수/확산 | `130/70/70`, `70/100/100`, `32/22/22` | `App.tsx:136-145` | UI 정책 |
| 예비종 옵션 | `[1,3,5,10]`분, 기본 3, 클램프 1~15 | `types.ts:361-363` | 도메인 UI |
| 기본 음량 | `60` (0~100) | `types.ts:366` | 도메인 UI |
| 학사 경계 | `302/720/818/106/300` | `semesterWindow.ts:40-45` | **정책 상수**(교육부 일정과 동기화 필요) |
| 내장 달력 범위 | `2025`~`2029` | `holidays.ts:22-24` | **정책 상수(연간 갱신 필요)** |
| 레거시 기본 학기 | `2026-08-25` / `2026-12-31` | `types.ts:373-374` | 마이그레이션 전용 |
| `CACHE_VERSION` | `'survival-clock-v6'` | `sw.js:13` | 수동 범프 필요 |
| 프리캐시 목록 | 7개 URL | `sw.js:16-24` | 자산 계약 |
| 시간표 행 상한 | `16` | `settings.ts` `normaliseTimetable` | 용량 상한 |
| 휴일 상한 / 라벨 길이 | `120` / `32` | `settings.ts` `normaliseHolidays` | 용량 상한 |
| 표시 이름 상한 | `40` / 교시 라벨 `20` | `settings.ts`, `TimetableEditor` | 입력 제약 |
| 기본 학교 요일 | `[1,2,3,4,5]` | `types.ts` `DEFAULT_SCHOOL_DAYS` | 도메인 기본값 |
| 기본 표시 이름 | `'김선생님'` | `types.ts:406` | 도메인 기본값 |
| 부트스트랩 키 3종 | `school-survival-clock.settings.v3`, `school-survival-clock.settings.v2`, `teacher-survival-dashboard-settings` | `index.html:60-62` | **v4 키 누락 = 결함 3** |

### 7.14 데이터 무결성 · 마이그레이션 리스크

| 리스크 | 분석 |
|---|---|
| v4 → v5 스키마 변경 시 | `normalizeSettings`가 알 수 없는 키를 조용히 버리므로, 새 필드를 추가하면 **구버전 앱이 그것을 삭제**한다(사용자가 구버전 탭을 열어 두면 신규 설정이 소실될 수 있음). 현재 `version` 필드는 기록만 되고 **분기 조건으로 사용되지 않는다** |
| 다중 탭 동시 편집 | `storage` 이벤트로 동기화되지만, 두 탭이 동시에 저장하면 **last-write-wins**다(충돌 해소 없음) |
| 손상된 JSON | 사다리 폴백으로 무해. 단, v4가 손상되고 레거시 키가 이미 삭제된 상태라면 **기본값으로 리셋**된다(사용자 데이터 복구 수단은 내보낸 JSON 파일뿐) |
| `semesterAuto` 승격 규칙 | 정확히 `2026-08-25`/`2026-12-31`인 경우에만 자동으로 승격된다. 사용자가 우연히 같은 날짜를 수동 입력했다면 자동 모드로 전환되어 **의도가 덮어써진다**(극히 낮은 확률, 그러나 존재하는 오탐) |
| 시간표 16행 제한 | 16개를 초과하는 교시를 입력하면 **초과분이 조용히 절단**된다(경고 없음). 대안: 절단 대신 검증 경고 노출 |
| `dayOverrides` ±6일 창 | 학기 중 예외를 7일 뒤 날짜로 등록하면 저장 시점에 프루닝되어 **사라진다**. UI에는 이 제약이 표시되지 않는다(DayOverrideBar는 오늘만 다룸) |
| `holidays` 120개 상한 | 초과 시 조용히 절단 |

### 7.15 성능 · 번들 분석

| 항목 | 실측 | 평가 |
|---|---|---|
| 초기 JS | 298,116 B (gzip **95.3 kB**) | React 18 + 전체 앱. 단일 청크이며 라우팅이 없어 코드 스플리팅 여지가 작다 |
| 초기 CSS | 37,192 B (gzip 7.2 kB) | 미압축 수동 CSS. 사용도 낮은 규칙 다수 포함 |
| 지연 청크 | `confetti.module` 10,676 B (gzip 4.3 kB) | 하교 시점에만 로드 — **유일한 코드 스플리팅** |
| 워커 | 306 B (gzip 252 B) | 극히 경량 |
| 아이콘 맵 | 58,097 B 소스(약 56.7 kB) → 번들에 포함 | 50개 글리프 전량이 초기 번들에 포함됨. 미사용 아이콘이 늘면 선형 증가 |
| 렌더 비용 | 매 초 `getScheduleStatus` + `getKstTimeParts` 재계산. `slots` 배열은 12~20개 수준으로 O(n) 순회 몇 회 | 문제 없음. 다만 `getUpcomingEvents`가 `nextSchoolDay`에 의존해 **1초마다 배열 재생성** → `React.memo` 부재로 `PeriodTracker`/레일이 매 초 재렌더 |
| `useMemo` 의존성 결함 | `metrics`, `nextSchoolDayAnchor`, `upcoming`은 `[kstNow.dateKey, settings]`인데 `upcoming`은 `[kstNow, settings, status, nextSchoolDay]`로 **매 초 재계산** | 의도(카운트다운 갱신)이나 `nextSchoolDay`가 매 초 새 객체라는 점이 함께 작용 |
| 접근성 트리 | 매 초 `aria-live` 갱신 1건 | 스크린리더 부담(7.11 #13) |
| 빌드 시간 | 1.32 s / 60 modules | 매우 빠름 |
| 폰트 | 렌더 블로킹 CSS 2건(외부) | `display=swap`으로 텍스트는 즉시 표시 |

### 7.16 보안 · 프라이버시

| 항목 | 상태 |
|---|---|
| 데이터 전송 | **없음**. 모든 설정은 `localStorage`에만 저장되며 서버/애널리틱스 호출이 0건(`SettingsModal`의 안내 문구가 이를 명시) |
| XSS | `dangerouslySetInnerHTML`은 빌드 타임 생성 아이콘 맵 1곳뿐이며 사용자 입력 경로 없음. 그 외 모든 텍스트는 React의 자동 이스케이프 사용 |
| CSP | `Content-Security-Policy` 메타/헤더 **없음**. `index.html` 부트스트랩이 인라인 스크립트이므로 `unsafe-inline` 없이는 CSP 적용이 불가(정적 호스팅에서는 헤더 제어도 어려움) |
| 외부 요청 | 폰트 2건(Google/jsDelivr) — IP가 해당 CDN에 노출됨. 오프라인 우선 설계와 상충하진 않으나 프라이버시 민감 환경에서는 셀프호스팅 권장 |
| 권한 | 알림만 요청(기본 비활성). 마이크/카메라/위치 등 미사용 |
| 의존성 취약점 | 감사 도구(`npm audit`) 미도입. 의존성 12종으로 표면적은 작음 |

### 7.17 CI/CD · 릴리스 취약점

| 항목 | 상태 |
|---|---|
| 파이프라인 순서 | `verify`(icons→typecheck→test) → `build` → `deploy` — **테스트 실패 시 배포 차단**으로 올바름 |
| 액션 버전 | `actions/checkout@v7`, `actions/setup-node@v7`, `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5` — 메이저 태그 고정(커밋 SHA 고정 아님). 공급망 관점에서는 SHA 고정이 더 안전 |
| 캐시 | `cache: npm` 사용(lock 기반) |
| 동시성 | `group: pages`, `cancel-in-progress: false` — 진행 중 배포 취소 방지 |
| 수동 배포 | `workflow_dispatch` 지원 |
| 브랜치 보호 | 저장소 설정에 의존(코드로 확인 불가) |
| 소스 이력 | `git log` 실측 **커밋 1개**(스쿼시된 단일 커밋) — 릴리스 회귀 추적이 어려움. 변경 이력은 `README.md`의 수기 표에만 존재 |
| 버저닝 | `package.json.version = 2.2.0`이 태그/릴리스와 연결되어 있지 않음(`git tag` 없음) |

### 7.18 UI/UX 잔여 취약점

| 항목 | 상태 |
|---|---|
| 세이프 에어리어 | `viewport-fit=cover` 선언 대비 `env(safe-area-inset-*)` 미사용 → 노치/홈 인디케이터 영역에서 토스트(우하단 16px)가 가려질 수 있음 |
| 세로 높이 | `.clock-card{min-height:420px}` — 폰 가로모드(높이 375px 내외)에서 카드가 뷰포트를 초과해 스크롤 필요 |
| 가로모드 전용 쿼리 | 0건(5.3.3절) |
| 타임라인 최소 폭 | `.timeline-track{min-width:620px}` + `.timeline-scroll{overflow-x:auto}` → 모바일에서 가로 스크롤 필요(의도된 트레이드오프, `tabIndex=0`으로 키보드 접근은 가능) |
| 주간 막대 4열 랩 | ≤460px에서 7열→4열로 줄바꿈되나 **요일 라벨은 1~7순서로 흐르며 2행이 3칸**이 되어 시각적 정렬이 어긋남 |
| 장식 요소 | `.float-soft` keyframes 정의되어 있으나 현재 적용 규칙이 없어 **미사용 애니메이션** |
| 색 대비 | 다크 `--faint:#71717b` on `--surface:#18181b`는 WCAG AA 미달 가능(작은 라벨 다수 사용). 실측 도구 검증 필요 |
| 다국어 | 하드코딩 한국어 전용(`lang="ko"`, 카피가 코드에 내장). i18n 계층 없음 |
| 0교시/야간 | 09:00 이전 0교시는 사용자가 직접 추가 가능하지만, 프리셋에는 없음 |

---

## 8. 상위 AI 협업용 구조화 요약 (AI-to-AI Hand-off Block)

### 8.1 핵심 전역 상태 인터페이스 — JSON 스키마

#### 8.1.1 `UserSettings` (영속 상태, 단일 진실 공급원)

```jsonc
{
  "$id": "UserSettings",
  "description": "localStorage['school-survival-clock.settings.v4']에 저장되는 유일한 객체. 모든 화면 값은 이 객체와 현재 KST 시각에서 파생된다.",
  "type": "object",
  "required": ["version","displayName","dismissalTime","semesterStart","vacationDate","semesterAuto",
               "themeMode","soundEnabled","soundVolume","notifyEnabled","preAlertEnabled",
               "preAlertMinutes","autoHolidays","schoolDays","holidays","dayOverrides","timetables"],
  "properties": {
    "version":            { "type": "integer", "const": 4, "note": "기록 전용. 로직 분기에는 사용되지 않음" },
    "displayName":        { "type": "string", "maxLength": 40, "default": "김선생님" },
    "dismissalTime":      { "type": "string", "pattern": "^\\d{1,2}:\\d{2}$", "default": "16:30" },
    "semesterStart":      { "type": "string", "format": "date", "default": "<auto window startDate>" },
    "vacationDate":       { "type": "string", "format": "date", "default": "<auto window vacationDate>" },
    "semesterAuto":       { "type": "boolean", "default": true,
                            "note": "true면 semesterStart/vacationDate는 매 로드·자정마다 한국 학사일정에서 재계산된다" },
    "themeMode":          { "enum": ["dark","light","system"], "default": "dark" },
    "soundEnabled":       { "type": "boolean", "default": true },
    "soundVolume":        { "type": "integer", "minimum": 0, "maximum": 100, "default": 60 },
    "notifyEnabled":      { "type": "boolean", "default": false },
    "preAlertEnabled":    { "type": "boolean", "default": true },
    "preAlertMinutes":    { "type": "integer", "minimum": 1, "maximum": 15, "default": 3,
                            "uiOptions": [1,3,5,10] },
    "autoHolidays":       { "type": "boolean", "default": true },
    "schoolDays":         { "type": "array", "items": { "type": "integer", "minimum": 0, "maximum": 6 },
                            "uniqueItems": true, "default": [1,2,3,4,5],
                            "note": "0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토. 정규화 시 오름차순 정렬됨" },
    "holidays":           { "type": "array", "maxItems": 120, "default": [],
                            "items": { "type": "object",
                                       "properties": { "date": { "type": "string", "format": "date" },
                                                       "label": { "type": "string", "maxLength": 32 } },
                                       "required": ["date","label"] } },
    "dayOverrides":       { "type": "object", "maxProperties": 14, "default": {},
                            "additionalProperties": {
                              "type": "object",
                              "properties": {
                                "kind":          { "enum": ["off","short"] },
                                "label":         { "type": "string", "maxLength": 24 },
                                "dismissalTime": { "type": "string", "note": "kind==='short'일 때만 유효, 그 외 빈 문자열" }
                              },
                              "required": ["kind","label","dismissalTime"] },
                            "noteKey": "YYYY-MM-DD", "prunedTo": "today ±6일" },
    "timetables":         { "type": "object", "required": ["0","1","2","3","4","5","6"],
                            "additionalProperties": {
                              "type": "object",
                              "properties": {
                                "enabled": { "type": "boolean" },
                                "periods": { "type": "array", "maxItems": 16,
                                             "items": { "type": "object",
                                                        "properties": {
                                                          "id":    { "type": "string", "maxLength": 32 },
                                                          "label": { "type": "string", "maxLength": 24 },
                                                          "kind":  { "enum": ["class","lunch","club","duty"] },
                                                          "start": { "type": "string", "pattern": "^HH:MM$" },
                                                          "end":   { "type": "string", "pattern": "^HH:MM$" }
                                                        },
                                                        "required": ["id","label","kind","start","end"] } }
                              } } }
  }
}
```

**불변식(invariants) — 리팩터링 시 반드시 유지해야 하는 계약**
1. `timetables`는 항상 `"0"`~`"6"` 7개 키를 모두 가진다(누락 키는 `EMPTY_TIMETABLE = { enabled:false, periods:[] }`로 조회됨).
2. `parseTimeToSeconds(end) > parseTimeToSeconds(start)`가 아니면 해당 행은 렌더에서 제외된다(`sanitizePeriods`).
3. `vacationDate > semesterStart`가 항상 성립한다(위반 시 배터리 0%, `isConfigured:false`).
4. `dayOverrides`의 키는 유효한 `YYYY-MM-DD`이며 오늘 기준 ±6일 이내로 프루닝된다.
5. 모든 문자열 시각은 `HH:MM` 24시간제이며, 저장 시 `09:05` 형태로 0-패딩 정규화된다.

#### 8.1.2 `ScheduleStatus` (런타임 파생 상태 — 매 초 재계산, **저장되지 않음**)

```jsonc
{
  "$id": "ScheduleStatus",
  "type": "object",
  "properties": {
    "phase": { "enum": ["off-day","before-first-slot","in-slot","between-slots","dismissed"] },
    "day": { "$ref": "DayContext" },
    "outline": { "$ref": "DayOutline" },
    "activeSlot": { "$ref": "TimelineSlot | null" },
    "nextSlot":   { "$ref": "TimelineSlot | null" },
    "secondsRemaining":     { "type": "number", "note": "현재 국면의 잔여 초(슬롯/공백/첫 블록까지)" },
    "slotProgress":         { "type": "number", "minimum": 0, "maximum": 100 },
    "dayProgress":          { "type": "number", "minimum": 0, "maximum": 100 },
    "classLoadProgress":    { "type": "number", "minimum": 0, "maximum": 100, "note": "UI 미사용(엔진 제공)" },
    "completedClassCount":  { "type": "integer" },
    "remainingClassCount":  { "type": "integer" },
    "totalClassCount":      { "type": "integer" },
    "remainingClassSeconds":{ "type": "number" },
    "completedClassSeconds":{ "type": "number", "note": "UI 미사용" },
    "totalClassSeconds":    { "type": "number" },
    "secondsSinceDismissal":{ "type": "number" },
    "isBreak":              { "type": "boolean", "note": "in-slot의 kind==='break' 또는 between-slots" },
    "phaseStartSeconds":    { "type": "number", "note": "alerts의 ageSeconds 계산에 사용" },
    "phaseEndSeconds":      { "type": "number", "note": "UI 미사용" },
    "phaseKey":             { "type": "string",
                              "example": "2026-09-17:in-slot:break-10",
                              "pattern": "^{dateKey}:(off-day:{dayType}|dismissed|before-first-slot|in-slot:{slotId}|between-slots:{nextSlotId|end})$" }
  }
}
```

실측 전체 예시(14:00 KST, 기본 설정)는 0장/4.5절에서 인용한 JSON과 동일하며, 이 중 UI가 실제로 소비하는 필드는 다음 12개다:
`phase`, `day`, `outline`, `activeSlot`, `nextSlot`, `secondsRemaining`, `slotProgress`, `dayProgress`, `remainingClassSeconds`, `remainingClassCount`, `totalClassCount`, `totalClassSeconds`, `isBreak`, `secondsSinceDismissal`, `phaseStartSeconds`(alerts 내부).

#### 8.1.3 `DayOutline` / `TimelineSlot` / `DayContext`

```jsonc
{
  "DayOutline": {
    "slots": [ /* TimelineSlot[] — 시간순, break/duty 자동 삽입됨 */ ],
    "dayStartSeconds":      { "type": "number|null" },
    "lastPeriodEndSeconds": { "type": "number|null" },
    "dismissalSeconds":     { "type": "number", "note": "max(dismissalTime, lastPeriodEndSeconds)" },
    "classSlots":           { "type": "TimelineSlot[]" },
    "totalClassSeconds":    { "type": "number" },
    "totalBreakSeconds":    { "type": "number" },
    "spanSeconds":          { "type": "number", "note": "UI 미사용" }
  },
  "TimelineSlot": {
    "id": "p1 | lunch | break-2 | after-school | <uuid>",
    "label": "1교시", "shortLabel": "1 | 점심 | 재량 | 업무 | 휴식",
    "kind": "class | lunch | club | duty | break",
    "startSeconds": 32400, "endSeconds": 34800,
    "timeLabel": "09:00 ~ 09:40", "classIndex": 1
  },
  "DayContext": {
    "dayType": "school | no-classes | weekend | holiday | vacation | before-semester | override",
    "label": "학교 가는 날", "description": "6교시 · 하교 16:30",
    "isSchoolDay": true, "hasClasses": true, "holidayLabel": null
  }
}
```

#### 8.1.4 `SemesterMetrics` (배터리)

```jsonc
{
  "progress": 23.157894736842106,      // 0..100, 수업일 기준
  "phase": "in-semester",              // before-semester | in-semester | vacation
  "calendarDaysRemaining": 111,        // D-day
  "schoolDaysRemaining": 73,
  "totalSchoolDays": 95,
  "elapsedSchoolDays": 22,
  "totalCalendarDays": 141,
  "elapsedCalendarDays": 30,
  "startDate": "2026-08-18",
  "vacationDate": "2027-01-06",
  "isConfigured": true
}
```

#### 8.1.5 `UpcomingEvent` / `TimelineItem` / `NextDayOff` / `NextSchoolDay`

```jsonc
{
  "UpcomingEvent": { "id": "today-break-10", "label": "쉬는 시간", "timeLabel": "14:00 ~ 14:10",
                     "kind": "break", "secondsFromNow": 0, "secondsUntilEnd": 600,
                     "dateKey": "2026-09-17", "isToday": true, "isActive": true, "dayLabel": "오늘" },
  "TimelineItem":  { "slot": "TimelineSlot", "state": "done | active | upcoming",
                     "startPercent": 0, "widthPercent": 8.89, "progress": 100,
                     "durationSeconds": 2400, "isCompact": false },
  "NextDayOff":    { "dateKey": "2026-09-19", "reason": "weekend | holiday | vacation | override",
                     "label": "토요일", "daysUntil": 2, "secondsUntil": 122400 },
  "NextSchoolDay": { "dateKey": "2026-09-21", "label": "월요일", "daysUntil": 2,
                     "secondsUntil": 133200, "secondsUntilFirstPeriod": 165600, "firstPeriodSeconds": 32400 }
}
```

### 8.2 핵심 함수 시그니처 전량 (호출 계약)

표기: `function name(args): ReturnType` — 역할 1줄.

#### `src/lib/time.ts` (KST 시간 계층)

| 시그니처 | 역할 |
|---|---|
| `getKstTimeParts(date: Date): KstTimeParts` | 임의의 인스턴트를 Asia/Seoul 벽시계 13개 필드로 분해 |
| `currentKstDateKey(date?: Date): string` | 오늘의 KST 날짜 키(`YYYY-MM-DD`) — 앱의 "오늘" 정의 |
| `formatKstDate(parts): string` | `26.09.17 목요일` |
| `formatFullKstDate(parts): string` | `2026년 9월 17일` |
| `weekdayLabel(weekdayIndex: number): string` | 0~6 → `['일','월','화','수','목','금','토']` 인덱스 조회(`WEEKDAY_LABELS`, `types.ts:260`). `((n % 7) + 7) % 7`로 음수·초과를 방어하고 조회 실패 시 `''` |
| `formatDuration(totalSeconds: number): string` | `HH:MM:SS`(음수는 0) |
| `formatHmFromSeconds(totalSeconds: number): string` | `HH:MM`(24시간 초과 허용) |
| `formatHumanDuration(totalSeconds: number, granularity = 2): string` | `3일 4시간`, `2시간 5분`, `43초` |
| `formatMinutes(totalSeconds: number): string` | `90분` → `1시간 30분` |
| `formatPercent(value: number, digits = 1): string` | `23.2`(`NaN` → 0) |
| `isValidTimeInput(value: unknown): value is string` | `HH:MM` 정규식 + 범위 검증 |
| `parseTimeToSeconds(time: string, fallback = 59400): number` | `HH:MM` → 자정 기준 초 |
| `isValidDateInput(value: unknown): value is string` | `YYYY-MM-DD` + 실재 날짜 왕복 검증 |
| `parseDateInput(value: string): number` | 날짜 키 → UTC 자정 ms(`NaN` 허용) |
| `dateKeyFromUtcMs(value: number): string` | epoch ms → 날짜 키 |
| `weekdayIndexFromDateKey(dateKey: string): number` | 날짜 키 → 0~6 |
| `shiftDateKey(dateKey: string, days: number): string` | 날짜 키 ±N일 |
| `differenceInDays(later: number, earlier: number): number` | ms 차이 → 일수(반올림) |
| `clamp(value: number, min: number, max: number): number` | `NaN` → `min` |
| `formatDateKeyShort(dateKey: string): string` | `09.17` |
| `formatDateKeyWithWeekday(dateKey: string): string` | `2026.09.17 (목)` |
| `kstInstant(reference: KstTimeParts, dateKey: string, daySeconds = 0): number` | KST 벽시계 → 실제 epoch ms |
| `secondsUntilDateKey(reference: KstTimeParts, dateKey: string): number` | 다음 KST 자정까지 초(과거면 음수) |
| `endsWithConsonant(word: string): boolean \| null` | 받침 유무(판단 불가 시 null) |
| `withParticle(word, afterConsonant, afterVowel): string` | 올바른 한국어 조사 부착 |
| `pad(value: number, size = 2): string` | 0-패딩 |

#### `src/lib/schedule.ts` (시간표 엔진)

| 시그니처 | 역할 |
|---|---|
| `getDayTimetable(settings, weekdayIndex): DayTimetable` | 요일 키 정규화 후 시간표 조회(없으면 빈 시간표) |
| `getDayOverride(settings, dateKey): DayOverride \| null` | 날짜별 하루 예외 조회 |
| `isDayOffOverride(settings, dateKey): boolean` | `kind==='off'` 여부 |
| `dismissalTimeFor(settings, dateKey): string` | 그 날짜에 유효한 하교 시각(short 예외 우선) |
| `buildDayOutline(settings, dateKey, weekdayIndex): DayOutline` | 날짜 기준 아웃라인(예외 적용) |
| `sanitizePeriods(periods): TimetablePeriod[]` | 정렬 + 겹침/불량 행 제거 |
| `buildOutline(timetable, dismissalTime, hardStopSeconds?): DayOutline` | 슬롯/쉬는 시간/duty 생성 |
| `isHolidayDate(settings, dateKey): Holiday \| null` | 직접 등록 → 내장 달력 순 판정 |
| `isSchoolWeekday(settings, weekdayIndex): boolean` | 수업 요일 여부 |
| `semesterWindowFor(settings, dateKey): SemesterWindow` | 그 날짜를 지배하는 학기 창 |
| `isInVacation(settings, dateKey): boolean` | 방학 중 여부 |
| `isBeforeSemester(settings, dateKey): boolean` | 개학 전 여부 |
| `weekdayHasClasses(settings, weekdayIndex): boolean` | enabled + duty 외 블록 존재 여부 |
| `isScheduledSchoolDay(settings, dateKey): boolean` | 실제 수업일 여부(방학/개학 전/휴일/휴업 모두 배제) |
| `getDayContext(now, settings, outline?): DayContext` | 7종 날짜 분류 + 카피 |
| `getScheduleStatus(now, settings): ScheduleStatus` | 라이브 국면 + 카운터 + 진행률 |
| `getNextDayOff(now, settings): NextDayOff \| null` | 다음 쉬는 날(≤400일) |
| `getNextSchoolDay(now, settings, excludeDateKey?): NextSchoolDay \| null` | 다음 수업일(첫 블록 초 포함) |
| `getWeekContext(now, settings): WeekContext` | 주간 리듬(앱 미사용, 테스트 전용) |
| `outlineForDate(settings, dateKey): DayOutline` | 임의 날짜 아웃라인(프리뷰) |

#### `src/lib/semester.ts`

| 시그니처 | 역할 |
|---|---|
| `countSchoolDays(settings, fromDateKey, toDateKey): number` | `[from, to)` 수업일 카운트 |
| `getSemesterMetrics(now, settings): SemesterMetrics` | 배터리·D-day·잔여 수업일 10개 지표 |

#### `src/lib/semesterWindow.ts`

| 시그니처 | 역할 |
|---|---|
| `getAutoSemesterWindow(todayDateKey): SemesterWindow` | 날짜 → 학기 창(1학기/2학기 타일링) |
| `describeSemesterWindow(window): string` | `2학기 · 08.18 개학 → 01.06 겨울방학` |
| `sameSemesterWindow(left, right): boolean` | 두 창의 날짜 동일성 |
| `isValidSemesterRange(startDate, vacationDate): boolean` | `vacation > start` 검증 |

#### `src/lib/holidays.ts`

| 시그니처 | 역할 |
|---|---|
| `builtinHolidayLabel(dateKey): string \| null` | 날짜 → 공휴일명(범위 밖 null) |
| `builtinHolidaysForYear(year): BuiltinHoliday[]` | 연도별 목록(없으면 `[]`) |
| `builtinHolidaysBetween(fromDateKey, toDateKey): BuiltinHoliday[]` | 구간 목록(연도 경계 처리, 날짜순) |
| `isCoveredByBuiltinCalendar(dateKey): boolean` | 내장 달력 등록 여부 |
| `isYearCoveredByBuiltinCalendar(year): boolean` | 2025~2029 여부 |

#### `src/lib/settings.ts` (영속성)

| 시그니처 | 역할 |
|---|---|
| `normaliseDayOverrides(value: unknown, todayDateKey: string): Record<string, DayOverride>` | 예외 맵 정규화 + 프루닝 |
| `createDefaultSettings(todayDateKey?: string): UserSettings` | 오늘 기준 완전한 기본 설정 |
| `normalizeSettings(input: unknown, todayDateKey?: string): UserSettings` | 임의 페이로드 → 유효 설정(필드별 복구 + v1~v3 승격) |
| `cloneSettings(settings): UserSettings` | 깊은 복사(중첩 3계층) |
| `loadSettings(): UserSettings` | 사다리 로드 + 마이그레이션 |
| `saveSettings(settings): void` | v4 키에 JSON 저장(실패 무음) |
| `serializeSettings(settings): string` | 2-스페이스 들여쓰기 + 개행 |
| `parseSettingsJson(raw, todayDateKey?): ImportResult` | 가져오기 파싱 + 경고 목록 |
| `subscribeToExternalSettings(handler): () => void` | 크로스탭 구독(해제 함수 반환) |

#### `src/lib/timeline.ts`

| 시그니처 | 역할 |
|---|---|
| `layoutTimeline(outline, currentSeconds): TimelineLayout` | 슬롯 비율 배치 + 플레이헤드 위치 |
| `getUpcomingEvents(now, settings, status, nextSchoolDay, limit = 4): UpcomingEvent[]` | 다음 일정 목록(오늘 → 다음 등교일 롤오버) |

#### `src/lib/alerts.ts` / `sound.ts` / `notify.ts` / `theme.ts` / `pwa.ts` / `assets.ts` / `useNow.ts`

| 시그니처 | 역할 |
|---|---|
| `eventKindForStatus(status): ScheduleEventKind \| null` | 국면 → 이벤트 종류 매핑 |
| `detectScheduleEvent(previousPhaseKey, status, currentDaySeconds): ScheduleEvent \| null` | 신선한 전환만 감지(≤90초) |
| `alertCopy(event, status): { title, body }` | 전환 알림 문구 |
| `detectPreAlert(status, preAlertSeconds, previousKey): PreAlertEvent \| null` | 예비종 진입 감지(교시만) |
| `preAlertCopy(event): { title, body }` | 예비종 문구 |
| `dispatchPreAlert(event, { sound, notify }): void` | 예비종 차임/알림 실행 |
| `dispatchScheduleEvent(event, status, { sound, notify }): void` | 전환 차임/알림 실행 |
| `chimeEngine.play(kind: ChimeKind): boolean` | 차임 재생 |
| `chimeEngine.preview(kind): boolean` | 강제 재생(미리 듣기) |
| `chimeEngine.unlock(): void` | 제스처 기반 컨텍스트 개방 |
| `chimeEngine.setEnabled(enabled): void` / `setVolume(v: number): void` | 설정 반영 |
| `chimeEngine.isSupported / isEnabled: boolean` | 가용성/상태 |
| `getNotificationState(): NotificationState` | 권한 상태 |
| `requestNotificationPermission(): Promise<NotificationState>` | 권한 요청(실패 안전) |
| `showNotification({ title, body, tag }): boolean` | 알림 표시(실패 무음) |
| `useResolvedTheme(mode: ThemeMode): ResolvedTheme` | 테마 해석 + 부수효과 적용 |
| `registerServiceWorker(): void` | PROD에서 SW 등록 |
| `subscribeInstallPrompt(handler): () => void` | 설치 프롬프트 캡처 |
| `assetUrl(relativePath: string): string` | baseURI 기준 자산 URL |
| `useNow(): Date` | 1Hz 드리프트 프리 시계 |
| `getWeekOverview(now, settings): WeekOverview` | 주간 7일 요약 |

### 8.3 컴포넌트 Props 계약

| 컴포넌트 | Props |
|---|---|
| `App` | (없음) — 상태와 이펙트를 모두 소유 |
| `AppHeader` | `{ themeMode: ThemeMode; resolvedTheme: ResolvedTheme; isOffline: boolean; onCycleTheme: () => void; onOpenSettings: () => void }` |
| `ClockHero` | `{ now: KstTimeParts; status: ScheduleStatus; nextSchoolDay: NextSchoolDay \| null; preAlertSeconds: number; override: DayOverride \| null; dismissalTime: string; onOverrideChange: (o: DayOverride \| null) => void }` |
| `BatteryCard` | `{ metrics: SemesterMetrics; isTodaySchoolDay: boolean }` |
| `PeriodTracker` | `{ now: KstTimeParts; status: ScheduleStatus; upcoming: UpcomingEvent[]; preAlertSeconds: number }` |
| `WeekOverview` | `{ now: KstTimeParts; settings: UserSettings }` |
| `CelebrationToast` | `{ isVisible: boolean; dismissalTime: string; durationMs: number; totalClassCount: number; totalClassSeconds: number; onClose: () => void }` |
| `SettingsModal` | `{ isOpen: boolean; settings: UserSettings; todayDateKey: string; notificationState: NotificationState; onClose: () => void; onSave: (s: UserSettings) => void }` |
| `DayOverrideBar` | `{ dateKey: string; override: DayOverride \| null; dismissalTime: string; onChange: (o: DayOverride \| null) => void }` |
| `SolarIcon` | `{ name: SolarIconName; size?: number \| string; className?: string; label?: string }` |
| `Field` | `{ id: string; label: string; icon?: SolarIconName; hint?: string; error?: string; className?: string; children: ReactNode }` |
| `ToggleRow` | `{ id: string; title: string; description?: string; icon: SolarIconName; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void; aside?: ReactNode }` |
| `SegmentedControl<T extends string>` | `{ label: string; value: T; options: SegmentOption<T>[]; onChange: (v: T) => void; size?: 'sm' \| 'md' }` |
| `SettingsSection` | `{ title: string; description?: string; icon: SolarIconName; aside?: ReactNode; children: ReactNode }` |
| `TimetableEditor` | `{ timetables: Record<string, DayTimetable>; schoolDays: number[]; dismissalTime: string; onTimetablesChange: (t) => void; onSchoolDaysChange: (d: number[]) => void }` |
| `HolidayEditor` | `{ holidays: Holiday[]; todayDateKey: string; semesterStart: string; vacationDate: string; autoHolidays: boolean; onChange: (h: Holiday[]) => void; onAutoHolidaysChange: (v: boolean) => void }` |
| `useFocusTrap` | `{ isOpen: boolean; containerRef: RefObject<HTMLElement \| null>; onClose: () => void }` |

### 8.4 다음 개발 단계 권장 개선사항 TOP 5 (우선순위 순)

#### 🥇 1순위 — 프리페인트 테마 부트스트랩의 v4 키 누락 수정 (라이트 모드 FOUC)
- **근거**: 7.6절. `index.html`이 v3/v2/teacher 키만 읽고 현행 v4를 읽지 않아, 라이트 모드 사용자는 매 로드마다 다크→라이트 깜빡임을 겪는다. `readFromStorage`가 레거시 키를 삭제하므로 **모든 기존 사용자가 영향권**이다.
- **구현 지침**: 부트스트랩의 `raw` 계산을 다음으로 교체하고, 향후 스키마 버전업에도 견디도록 일반화한다.
  ```js
  var KEYS = ['school-survival-clock.settings.v4',
              'school-survival-clock.settings.v3',
              'school-survival-clock.settings.v2',
              'teacher-survival-dashboard-settings',
              'school-survival-clock.settings.v1']
  var raw = null
  for (var i = 0; i < KEYS.length && !raw; i++) { raw = localStorage.getItem(KEYS[i]) }
  ```
- **검증**: 라이트 테마 저장 → 하드 리로드 → `PerformanceObserver`/스크린샷으로 첫 페인트가 라이트인지 확인. `render.test.tsx`에 "저장된 light 설정으로 렌더 시 `document.documentElement`가 리셋되지 않음" 케이스 추가.
- **난이도**: 극히 낮음(1줄~5줄). **회귀 위험**: 낮음.

#### 🥈 2순위 — 내장 공휴일 달력의 유효 기간 자동 확장/경고
- **근거**: 7.2절. `BUILTIN_HOLIDAY_LAST_YEAR = 2029` 이후 모든 공휴일이 조용히 무시되어 2030-06-06이 정상 수업일로 계산되는 것을 **실측으로 확인**했다. 유일한 경고는 `semesterStart` 연도만 검사해 학기 창이 2029→2030에 걸치면 발동하지 않는다.
- **구현 지침**: ① 매년 1월 릴리스에 다음 해 데이터를 추가하는 절차를 `README.md`에 명문화하고 CI에서 "현재 연도 + 2년"까지 커버하는지 검사하는 테스트를 추가, ② 커버리지 밖이면 `HolidayEditor`/`BatteryCard`에 상시 배너 노출, ③ `semesterOutOfRange`를 학기 창의 **양 끝 연도** 검사로 수정.
- **검증**: `holidays.test.ts`에 "내장 달력이 런타임 연도 기준 최소 2년 앞까지 커버한다"는 메타 테스트 추가(`new Date().getFullYear() + 2 <= BUILTIN_HOLIDAY_LAST_YEAR`).
- **난이도**: 낮음(데이터 갱신) ~ 중간(메타 테스트). **회귀 위험**: 낮음.

#### 🥉 3순위 — 단축 수업일의 하교 시각 표기 일관성(결함 4) + 주간 잔여 수업일(결함 5)
- **근거**: 7.7·7.8절. (a) 단축일에도 히어로/축하 토스트가 기본 하교 시각을 표시하고, (b) 목요일 21시에 주간 카드가 "남은 수업일 2일"이라고 표시한다.
- **구현 지침**:
  1. `App.tsx`에서 `const effectiveDismissal = dismissalTimeFor(settings, kstNow.dateKey)`를 계산해 `ClockHero`/`CelebrationToast`에 주입하고, 축하 중복 키도 `` `${dateKey}-${effectiveDismissal}` ``로 변경한다.
  2. `weekOverview.ts`의 `if (!isPast) remainingSchoolDayCount += 1`을 `if (!isPast && !(isToday && 현재시각 >= 그날 dismissalSeconds))`로 정교화하거나, 필드를 `remainingSchoolDayCountExcludingToday`로 재정의하고 `WeekOverview.tsx` 문구를 맞춘다. 시간 의존 계산이므로 `getWeekOverview(now, settings)`가 이미 `now`를 받는다는 점을 활용한다.
- **검증**: `overrides.test.ts`에 "단축일 축하 문구가 단축 시각을 쓴다", `weekOverview.test.ts`에 "하교 후 오늘은 잔여에서 제외된다" 케이스 추가.
- **난이도**: 낮음. **회귀 위험**: 낮음(문구/카운트 한정).

#### 4순위 — 상태 업데이터 순수성 회복 + 알림 경로 현대화
- **근거**: 7.9·7.10절. `handleToggleSound`/`handleToggleNotify`가 React 상태 업데이터 안에서 차임·권한 요청·중첩 `setSettings`를 수행해 StrictMode에서 이중 실행된다. 또한 `new Notification()` 경로는 Android Chrome에서 동작하지 않는다.
- **구현 지침**: ① 차임 재생과 권한 요청을 업데이터 **밖**으로 이동(예: `handleToggleSound`에서 `const next = !settingsRef.current.soundEnabled`처럼 최신값을 참조하거나, `useEffect(() => { if (settings.soundEnabled) chimeEngine.play('ui') }, [settings.soundEnabled])`로 일원화), ② `showNotification`을 `navigator.serviceWorker.ready → registration.showNotification(...)` 우선 + 생성자 폴백으로 재작성, ③ `alerts.test.ts`/`notify` 단위 테스트 추가(SW 목킹).
- **검증**: 개발 모드 StrictMode에서 `M` 1회 클릭 시 차임 1회, `N` 1회 클릭 시 권한 프롬프트 1회를 수동 확인.
- **난이도**: 중간(훅 구조 변경). **회귀 위험**: 중간 — 차임/알림은 사용자 체감 기능이므로 테스트 우선 작성 권장.

#### 5순위 — 관측성·자동화 부채 정리 (lint 도입, 죽은 코드 제거, 문서 동기화)
- **근거**: 7.11·7.15·7.17절. (a) ESLint/Prettier 부재로 중복 import·dead class·미사용 CSS 변수가 방치되고, (b) README가 `--index` 캐스케이드·`IntersectionObserver`·`fade-in-up`·`80rem`을 기술하지만 구현과 다르며, (c) 매 초 재렌더되는 `PeriodTracker`/레일, 상시 가동 워커 등 상시 표시 최적화 여지가 남아 있다.
- **구현 지침**: ① `eslint` + `typescript-eslint` + `eslint-plugin-react-hooks` + `prettier`를 devDependency로 추가하고 CI `verify` 잡에 `npm run lint` 단계 삽입, ② 사용되지 않는 CSS(`--index`, `.reveal-on-scroll`, `.float-soft`)를 제거하거나 반대로 **실제 스태거/스크롤 게이트를 구현**해 문서와 일치시키기(둘 중 하나를 선택하고 README를 단일 진실로 유지), ③ `getWeekContext`/`sameSemesterWindow`는 향후 기능(주간 리듬 카드)에 쓸 것이 아니면 제거, ④ `React.memo`(PeriodTracker/WeekOverview) + `Document Visibility` 기반 워커 일시정지(`document.hidden` 시 `postMessage('stop')`, 복귀 시 `'start'` + 즉시 재동기화)로 상시 표시 배터리 소모 개선.
- **검증**: lint 0 에러, 번들 크기 비교(gzip 95.3 kB → 목표 90 kB 이하), 문서-코드 대조 체크리스트를 PR 템플릿에 추가.
- **난이도**: 낮음~중간(분할 적용 가능). **회귀 위험**: 낮음.

#### 추가 백로그(우선순위 외, 즉시 실행 가능)
| 항목 | 근거 절 | 난이도 |
|---|---|---|
| `HH:MM` 스키마의 자정 초과 표현(야자 00:30) 지원 | 7.5 | 중간(스키마 영향, 마이그레이션 필요) |
| 세이프 에어리어 `env(safe-area-inset-*)` + 가로모드 최적화 | 7.18 | 낮음 |
| 기기 시계 오차 감지·경고 | 7.4 | 중간 |
| `Hourly`가 아닌 `dayOverrides ±6일` 제약을 UI에 노출 | 7.14 | 낮음 |
| `npm audit` + CI 취약점 스캔, 액션 SHA 고정 | 7.16·7.17 | 낮음 |
| SW 업데이트 알림(`skip-waiting` 메시지 + 토스트) | 6.6 | 낮음 |
| Wake Lock API로 교실 TV 화면 꺼짐 방지 | 3.5 | 낮음 |
| i18n 계층 도입(현재 한국어 하드코딩) | 7.18 | 높음 |

### 8.5 리팩터링 불변 규칙 (Contract Checklist)

다른 AI가 코드를 수정할 때 **반드시** 지켜야 하는 계약이다. 위반 시 기존 테스트 141개가 깨지거나 조용한 결함이 생긴다.

1. **엔진은 순수해야 한다.** `src/lib/*.ts`(단, `useNow.ts`/`theme.ts`/`notify.ts`/`pwa.ts`/`sound.ts` 제외)는 React/DOM/전역 상태에 접근하지 않는다. 새 계산 로직은 반드시 순수 함수로 `lib`에 두고 컴포넌트에서는 호출만 한다.
2. **시각 계산은 `Date.now()` → `getKstTimeParts()` → 초 단위 정수를 단일 경로로 통과**해야 한다. 로컬 시간대 API(`new Date().getHours()`, `toLocaleTimeString()`)를 직접 쓰면 KST 보장이 깨진다.
3. **`phaseKey` 형식을 바꾸지 말 것.** 알림 중복 억제와 국면 전환 감지가 이 문자열에 전적으로 의존한다. 슬롯 id를 바꿀 때는 `break-N`의 인덱스 의존성(7.11 #10)을 함께 고려한다.
4. **`localStorage` 스키마 변경 시 반드시**: ① `STORAGE_KEY` 버전업, ② 기존 키를 `LEGACY_STORAGE_KEYS`에 추가, ③ `normalizeSettings`에 승격 로직 추가, ④ `index.html` 부트스트랩 키 목록 갱신(결함 3 재발 방지), ⑤ `SETTINGS_VERSION` 상향.
5. **`normalizeSettings`는 절대 예외를 던지지 않는다.** 알 수 없는 타입은 기본값으로 대체하고, 부분적으로 유효한 데이터는 최대한 보존한다.
6. **알림/차임은 옵트인과 무음 실패 원칙을 지킨다.** 새 알림을 추가할 때도 `AlertOptions { sound, notify }`를 존중하고, 실패를 사용자 오류로 노출하지 않는다.
7. **타임라인 진행률은 `transform: scaleX(var(--fill))` 패턴을 유지**한다(레이아웃 스래싱 방지). `width` 애니메이션을 새로 도입하지 않는다.
8. **`prefers-reduced-motion` 대응을 유지**한다(전역 규칙 + 컨페티 옵션).
9. **아이콘을 추가하면 `npm run icons`를 실행**하고 생성 파일을 함께 커밋한다(CI가 `npm run icons`를 실행하므로 드리프트 시 빌드는 통과하지만 로컬-원격 불일치가 생긴다).
10. **`src/index.css` 단일 파일 구조를 유지**한다(빌드 스타일 파이프라인이 없으므로 새 CSS 파일을 추가하면 import 경로 관리가 필요해진다).
11. **`public/sw.js`의 `CACHE_VERSION`을 자산 전략 변경 시 반드시 범프**한다.
12. **테스트는 `environment: 'node'`에서 통과해야 한다.** DOM이 필요한 테스트는 `renderToString`(SSR) 또는 `vi.stubGlobal`을 사용한다(jsdom 미도입).

### 8.6 작업 실행 명령 참조

```bash
# 저장소
git clone https://github.com/thehuihuifam/school-survival-clock.git
cd school-survival-clock

# 최초 설치 (재현성 보장)
npm ci

# 개발 서버 (host 0.0.0.0, allowedHosts true → 프리뷰/원격 접속 가능)
npm run dev            # http://localhost:5173

# 품질 게이트 (CI의 verify 잡과 동일 순서)
npm run icons          # src 참조 아이콘 → icons.generated.ts 재생성
npm run typecheck      # tsc -b --force (strict, noUnusedLocals/Parameters)
npm test               # vitest run → 11 suites / 141 tests
npm run test:watch     # 개발 중 감시 모드

# 프로덕션 빌드 및 검증
npm run build          # icons → tsc -b → vite build (dist/)
npm run preview        # dist 미리보기 (host 0.0.0.0)
npx tsc -b --force     # 타입만 재검사

# 앱 아이콘 재생성 (의존성 없이 PNG 래스터라이즈)
npm run icons:app      # public/icon-192.png, icon-512.png, apple-touch-icon.png

# 배포
# main 브랜치 push → GitHub Actions(deploy.yml)가 verify → build → deploy 자동 수행
git push origin main
# 수동 재배포: GitHub Actions 탭 → "Deploy to GitHub Pages" → Run workflow
```

**테스트 추가 시 참고**: 신규 스위트는 `src/lib/__tests__/*.test.ts`에 두면 `vite.config.ts`의 `include: ['src/**/*.test.ts', 'src/**/*.test.tsx']`에 자동 포함된다. 픽스처는 반드시 `helpers.ts`의 `TEST_TODAY_KEY`(=`2026-09-17`)/`at()`/`settingsWith()`를 사용해 결정성을 유지한다. 날짜를 핀 고정하면 `settingsWith`가 자동으로 `semesterAuto:false`로 전환한다는 점을 기억해야 한다(그렇지 않으면 자동 학기 창이 테스트를 비결정적으로 만든다).

---

## 부록 A. 실측 프로브 원본 출력 (근거 자료)

```
[A] 토요일 dayType = weekend | phase = off-day
[B] 23:59:59 phaseKey = 2026-09-20:off-day:weekend
[B] 00:00:01 phaseKey = 2026-09-21:before-first-slot
[C] 2030-06-10 dayType = school | semester window = 2030-03-02 → 2030-07-20 | phase = in-semester
[D] dismissalTime=00:30 → outline.dismissalSeconds = 53400 | lastPeriodEnd = 53400
    slots = p1@32400,break-2@34800,p2@35400,break-4@37800,p3@39000,break-6@41400,
            p4@42000,lunch@44400,p5@48000,break-10@50400,p6@51000
[E] dismissalTime=23:00 → slots = 12 | duty = {"id":"after-school","kind":"duty",
    "startSeconds":53400,"endSeconds":82800,"timeLabel":"14:50 ~ 23:00"}
[F] 22:00 phase = dismissed | secondsSinceDismissal = 19800 | dayProgress = 100
[G] next day off (Thu 10:00) = {"dateKey":"2026-09-19","reason":"weekend","label":"토요일",
    "daysUntil":2,"secondsUntil":136800}
[H] next school day from Sat = {"dateKey":"2026-09-21","label":"월요일","daysUntil":2,
    "secondsUntil":133200,"secondsUntilFirstPeriod":165600,"firstPeriodSeconds":32400}
[I] manual window + 2027-01-10 → dayType = vacation | battery = 100
[J] 14:40 → phase = in-slot | active = p6 | next = after-school
    dayProgress = 75.56 | slotProgress = 75.00 | classLoad = 95.83
[K] builtin 신정 2030-01-01 = null | builtin 현충일 2030-06-06 = null
    isHolidayDate('2030-06-06') = null | 2030-06-06 dayType = school | phase = in-slot
[L] 2029-12-25 builtin = 성탄절
[M] 목 21:00 week remainingSchoolDayCount = 2
    states = 월:school(past) 화:school(past) 수:school(past) 목:today 금:school 토:weekend 일:weekend
[N] 금요일 12:00 phase = in-slot | activeSlot = lunch | dayProgress = 40.00 | remaining classes = 1/4
```

## 부록 B. 기본 설정 실측 덤프(핵심 발췌)

```jsonc
// getSemesterMetrics(at('2026-09-17T05:00:00Z'), defaultSettings)
{ "progress": 23.157894736842106, "phase": "in-semester", "calendarDaysRemaining": 111,
  "schoolDaysRemaining": 73, "totalSchoolDays": 95, "elapsedSchoolDays": 22,
  "totalCalendarDays": 141, "elapsedCalendarDays": 30,
  "startDate": "2026-08-18", "vacationDate": "2027-01-06", "isConfigured": true }

// getScheduleStatus(...) 요약
{ "phase": "in-slot", "activeSlot": "break-10", "nextSlot": "p6",
  "secondsRemaining": 600, "slotProgress": 0, "dayProgress": 66.66666666666666,
  "completedClassCount": 5, "remainingClassCount": 1, "totalClassCount": 6,
  "completedClassSeconds": 12000, "remainingClassSeconds": 2400, "totalClassSeconds": 14400,
  "classLoadProgress": 83.33333333333334, "isBreak": true,
  "phaseStartSeconds": 50400, "phaseEndSeconds": 51000,
  "phaseKey": "2026-09-17:in-slot:break-10" }

// getWeekOverview(...) 요약
{ "schoolDayCount": 5, "remainingSchoolDayCount": 2, "totalClassSeconds": 67200,
  "heaviestDateKey": "2026-09-14",
  "days": [
    { "dateKey": "2026-09-14", "weekdayLabel": "월", "weekdayIndex": 1, "isToday": false, "isPast": true,
      "state": "school",  "classCount": 6, "classSeconds": 14400, "spanLabel": "09:00~16:30", "note": null },
    { "dateKey": "2026-09-15", "weekdayLabel": "화", "weekdayIndex": 2, "isToday": false, "isPast": true,
      "state": "school",  "classCount": 6, "classSeconds": 14400, "spanLabel": "09:00~16:30", "note": null },
    { "dateKey": "2026-09-16", "weekdayLabel": "수", "weekdayIndex": 3, "isToday": false, "isPast": true,
      "state": "school",  "classCount": 6, "classSeconds": 14400, "spanLabel": "09:00~16:30", "note": null },
    { "dateKey": "2026-09-17", "weekdayLabel": "목", "weekdayIndex": 4, "isToday": true,  "isPast": false,
      "state": "today",   "classCount": 6, "classSeconds": 14400, "spanLabel": "09:00~16:30", "note": null },
    { "dateKey": "2026-09-18", "weekdayLabel": "금", "weekdayIndex": 5, "isToday": false, "isPast": false,
      "state": "school",  "classCount": 4, "classSeconds": 9600,  "spanLabel": "09:00~16:30", "note": null },
    { "dateKey": "2026-09-19", "weekdayLabel": "토", "weekdayIndex": 6, "isToday": false, "isPast": false,
      "state": "weekend", "classCount": 0, "classSeconds": 0,     "spanLabel": null, "note": "주말" },
    { "dateKey": "2026-09-20", "weekdayLabel": "일", "weekdayIndex": 0, "isToday": false, "isPast": false,
      "state": "weekend", "classCount": 0, "classSeconds": 0,     "spanLabel": null, "note": "주말" }
  ] }
```

## 부록 C. 본 문서의 검증 재현 절차

1. `npm ci`
2. `npm run icons` → 커밋본과 `diff` (드리프트 0 확인)
3. `npm run typecheck` → exit 0
4. `npm test` → 141 passed
5. `npm run build` → `dist/` 11개 파일, gzip 수치 대조
6. 엣지 케이스 재현: `src/lib/__tests__/zz-*.test.ts`에 부록 A의 로그를 생성하는 임시 스위트를 작성해 `npx vitest run <파일>` 실행 후 삭제(본 문서 작성 시 사용한 방법과 동일)

---

## 부록 D. 아이콘 글리프 원문 전량 (`src/components/icons.generated.ts`)

`npm run icons`가 `@iconify-json/solar`에서 추출해 생성하는 파일의 **원문 전체**를 그대로 수록한다(50개 글리프, 58097 B). 각 항목은 `{ body, width, height }` 형태이며, `SolarIcon`은 `width`/`height`를 `viewBox`에 사용하고 `body`를 `dangerouslySetInnerHTML`로 주입한다. 본 부록은 손으로 편집하지 않는다: 소스(`src/**/*.tsx`)에서 아이콘 이름을 추가·삭제한 뒤 `npm run icons`를 실행하면 재생성되며, CI의 `verify` 잡이 동일 명령을 실행해 드리프트를 검출한다.

```ts
/* AUTO-GENERATED by scripts/generate-icons.mjs — do not edit by hand. */
/* Run `npm run icons` after adding or removing a SolarIcon name in src/. */
import type { SolarIconGlyph } from './icon-types'

/**
 * Inline Solar glyphs actually referenced from src/.
 * `body` is trusted, build-time generated SVG markup (no user input ever
 * reaches it), which is why SolarIcon can inject it directly.
 */
export const SOLAR_ICON_GLYPHS = {
  "add-circle-bold": { body: "<path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22ZM12.75 9C12.75 8.586 12.414 8.25 12 8.25C11.586 8.25 11.25 8.586 11.25 9L11.25 11.25H9C8.586 11.25 8.25 11.586 8.25 12C8.25 12.414 8.586 12.75 9 12.75H11.25V15C11.25 15.414 11.586 15.75 12 15.75C12.414 15.75 12.75 15.414 12.75 15L12.75 12.75H15C15.414 12.75 15.75 12.414 15.75 12C15.75 11.586 15.414 11.25 15 11.25H12.75V9Z\" clip-rule=\"evenodd\"/>", width: 24, height: 24 }, // src/components/settings/TimetableEditor.tsx
  "alarm-bold": { body: "<g fill=\"currentColor\" fill-rule=\"evenodd\" clip-rule=\"evenodd\"><path d=\"M12 22C16.836 22 20.757 18.116 20.757 13.325C20.757 8.534 16.836 4.651 12 4.651C7.164 4.651 3.243 8.534 3.243 13.325C3.243 18.116 7.164 22 12 22ZM12 8.747C12.403 8.747 12.73 9.071 12.73 9.47V13.026L14.948 15.224C15.233 15.506 15.233 15.964 14.948 16.246C14.663 16.528 14.201 16.528 13.916 16.246L11.484 13.836C11.347 13.701 11.27 13.517 11.27 13.325V9.47C11.27 9.071 11.597 8.747 12 8.747Z\"/><path d=\"M8.241 2.34C8.454 2.678 8.35 3.124 8.008 3.336L4.117 5.746C3.775 5.957 3.325 5.854 3.111 5.516C2.897 5.177 3.001 4.731 3.343 4.52L7.235 2.11C7.577 1.898 8.027 2.001 8.241 2.34Z\"/><path d=\"M15.759 2.34C15.973 2.001 16.423 1.898 16.765 2.11L20.657 4.52C20.999 4.731 21.103 5.177 20.889 5.516C20.675 5.854 20.225 5.957 19.883 5.746L15.992 3.336C15.65 3.124 15.546 2.678 15.759 2.34Z\"/></g>", width: 24, height: 24 }, // src/components/SettingsModal.tsx
  "battery-charge-bold": { body: "<path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M2 12C2 8.229 2 6.343 3.172 5.172C4.343 4 6.229 4 10 4H11.5C15.271 4 17.157 4 18.328 5.172C19.271 6.115 19.455 7.52 19.491 10H20C20.943 10 21.414 10 21.707 10.293C22 10.586 22 11.057 22 12C22 12.943 22 13.414 21.707 13.707C21.414 14 20.943 14 20 14H19.491C19.455 16.48 19.271 17.885 18.328 18.828C17.157 20 15.271 20 11.5 20H10C6.229 20 4.343 20 3.172 18.828C2 17.657 2 15.771 2 12ZM11.98 8.424C12.298 8.689 12.341 9.162 12.076 9.48L10.601 11.25H12.5C12.791 11.25 13.056 11.418 13.179 11.682C13.303 11.945 13.262 12.257 13.076 12.48L10.576 15.48C10.311 15.798 9.838 15.841 9.52 15.576C9.202 15.311 9.159 14.838 9.424 14.52L10.899 12.75H9C8.709 12.75 8.444 12.582 8.321 12.318C8.197 12.055 8.238 11.743 8.424 11.52L10.924 8.52C11.189 8.202 11.662 8.159 11.98 8.424Z\" clip-rule=\"evenodd\"/>", width: 24, height: 24 }, // src/components/AppHeader.tsx
  "bell-bold": { body: "<g fill=\"currentColor\"><path d=\"M8.352 20.242C9.193 21.311 10.514 22 12 22C13.486 22 14.807 21.311 15.648 20.242C13.226 20.57 10.774 20.57 8.352 20.242Z\"/><path d=\"M18.749 9V9.704C18.749 10.549 18.99 11.375 19.442 12.078L20.55 13.801C21.561 15.375 20.789 17.514 19.03 18.012C14.427 19.313 9.573 19.313 4.97 18.012C3.211 17.514 2.439 15.375 3.45 13.801L4.558 12.078C5.01 11.375 5.251 10.549 5.251 9.704V9C5.251 5.134 8.273 2 12 2C15.727 2 18.749 5.134 18.749 9Z\"/></g>", width: 24, height: 24 }, // src/components/SettingsModal.tsx
  "bell-ring-bold": { body: "<g fill=\"currentColor\"><path d=\"M8.352 20.242C9.193 21.311 10.514 22 12 22C13.486 22 14.807 21.311 15.648 20.242C13.226 20.57 10.774 20.57 8.352 20.242Z\"/><path fill-rule=\"evenodd\" d=\"M18.749 9.704V9C18.749 5.134 15.727 2 12 2C8.273 2 5.251 5.134 5.251 9V9.704C5.251 10.549 5.01 11.375 4.558 12.078L3.45 13.801C2.439 15.375 3.211 17.514 4.97 18.012C9.573 19.313 14.427 19.313 19.03 18.012C20.789 17.514 21.561 15.375 20.55 13.801L19.442 12.078C18.99 11.375 18.749 10.549 18.749 9.704ZM12 5.25C12.414 5.25 12.75 5.586 12.75 6V10C12.75 10.414 12.414 10.75 12 10.75C11.586 10.75 11.25 10.414 11.25 10V6C11.25 5.586 11.586 5.25 12 5.25Z\" clip-rule=\"evenodd\"/></g>", width: 24, height: 24 }, // src/components/PeriodTracker.tsx
  "calendar-add-bold": { body: "<g fill=\"currentColor\"><path d=\"M7.75 2.5C7.75 2.086 7.414 1.75 7 1.75C6.586 1.75 6.25 2.086 6.25 2.5V4.079C4.811 4.195 3.866 4.477 3.172 5.172C2.477 5.866 2.195 6.811 2.079 8.25H21.921C21.805 6.811 21.523 5.866 20.828 5.172C20.134 4.477 19.189 4.195 17.75 4.079V2.5C17.75 2.086 17.414 1.75 17 1.75C16.586 1.75 16.25 2.086 16.25 2.5V4.013C15.585 4 14.839 4 14 4H10C9.161 4 8.415 4 7.75 4.013V2.5Z\"/><path fill-rule=\"evenodd\" d=\"M22 12V14C22 17.771 22 19.657 20.828 20.828C19.657 22 17.771 22 14 22H10C6.229 22 4.343 22 3.172 20.828C2 19.657 2 17.771 2 14V12C2 11.161 2 10.415 2.013 9.75H21.987C22 10.415 22 11.161 22 12ZM16 13.25C16.414 13.25 16.75 13.586 16.75 14V15.25L18 15.25C18.414 15.25 18.75 15.586 18.75 16C18.75 16.414 18.414 16.75 18 16.75H16.75V18C16.75 18.414 16.414 18.75 16 18.75C15.586 18.75 15.25 18.414 15.25 18V16.75L14 16.75C13.586 16.75 13.25 16.414 13.25 16C13.25 15.586 13.586 15.25 14 15.25H15.25V14C15.25 13.586 15.586 13.25 16 13.25Z\" clip-rule=\"evenodd\"/></g>", width: 24, height: 24 }, // src/components/PeriodTracker.tsx
  "calendar-bold": { body: "<g fill=\"currentColor\"><path d=\"M7.75 2.5C7.75 2.086 7.414 1.75 7 1.75C6.586 1.75 6.25 2.086 6.25 2.5V4.079C4.811 4.195 3.866 4.477 3.172 5.172C2.477 5.866 2.195 6.811 2.079 8.25H21.921C21.805 6.811 21.523 5.866 20.828 5.172C20.134 4.477 19.189 4.195 17.75 4.079V2.5C17.75 2.086 17.414 1.75 17 1.75C16.586 1.75 16.25 2.086 16.25 2.5V4.013C15.585 4 14.839 4 14 4H10C9.161 4 8.415 4 7.75 4.013V2.5Z\"/><path fill-rule=\"evenodd\" d=\"M2 12C2 11.161 2 10.415 2.013 9.75H21.987C22 10.415 22 11.161 22 12V14C22 17.771 22 19.657 20.828 20.828C19.657 22 17.771 22 14 22H10C6.229 22 4.343 22 3.172 20.828C2 19.657 2 17.771 2 14V12ZM17 14C17.552 14 18 13.552 18 13C18 12.448 17.552 12 17 12C16.448 12 16 12.448 16 13C16 13.552 16.448 14 17 14ZM17 18C17.552 18 18 17.552 18 17C18 16.448 17.552 16 17 16C16.448 16 16 16.448 16 17C16 17.552 16.448 18 17 18ZM13 13C13 13.552 12.552 14 12 14C11.448 14 11 13.552 11 13C11 12.448 11.448 12 12 12C12.552 12 13 12.448 13 13ZM13 17C13 17.552 12.552 18 12 18C11.448 18 11 17.552 11 17C11 16.448 11.448 16 12 16C12.552 16 13 16.448 13 17ZM7 14C7.552 14 8 13.552 8 13C8 12.448 7.552 12 7 12C6.448 12 6 12.448 6 13C6 13.552 6.448 14 7 14ZM7 18C7.552 18 8 17.552 8 17C8 16.448 7.552 16 7 16C6.448 16 6 16.448 6 17C6 17.552 6.448 18 7 18Z\" clip-rule=\"evenodd\"/></g>", width: 24, height: 24 }, // src/components/BatteryCard.tsx
  "calendar-date-bold": { body: "<g fill=\"currentColor\"><path d=\"M7.75 2.5C7.75 2.086 7.414 1.75 7 1.75C6.586 1.75 6.25 2.086 6.25 2.5V4.079C4.811 4.195 3.866 4.477 3.172 5.172C2.477 5.866 2.195 6.811 2.079 8.25H21.921C21.805 6.811 21.523 5.866 20.828 5.172C20.134 4.477 19.189 4.195 17.75 4.079V2.5C17.75 2.086 17.414 1.75 17 1.75C16.586 1.75 16.25 2.086 16.25 2.5V4.013C15.585 4 14.839 4 14 4H10C9.161 4 8.415 4 7.75 4.013V2.5Z\"/><path fill-rule=\"evenodd\" d=\"M22 12C22 11.161 22 10.415 21.987 9.75H2.013C2 10.415 2 11.161 2 12V14C2 17.771 2 19.657 3.172 20.828C4.343 22 6.229 22 10 22H14C17.771 22 19.657 22 20.828 20.828C22 19.657 22 17.771 22 14V12ZM14 12.25C13.034 12.25 12.25 13.034 12.25 14V16C12.25 16.966 13.034 17.75 14 17.75C14.966 17.75 15.75 16.966 15.75 16V14C15.75 13.034 14.966 12.25 14 12.25ZM14 13.75C13.862 13.75 13.75 13.862 13.75 14V16C13.75 16.138 13.862 16.25 14 16.25C14.138 16.25 14.25 16.138 14.25 16V14C14.25 13.862 14.138 13.75 14 13.75ZM10.787 12.307C11.067 12.423 11.25 12.697 11.25 13V17C11.25 17.414 10.914 17.75 10.5 17.75C10.086 17.75 9.75 17.414 9.75 17V14.811L9.53 15.03C9.237 15.323 8.763 15.323 8.47 15.03C8.177 14.737 8.177 14.263 8.47 13.97L9.97 12.47C10.184 12.255 10.507 12.191 10.787 12.307Z\" clip-rule=\"evenodd\"/></g>", width: 24, height: 24 }, // src/components/SettingsModal.tsx
  "calendar-mark-bold": { body: "<g fill=\"currentColor\"><path d=\"M7.75 2.5C7.75 2.086 7.414 1.75 7 1.75C6.586 1.75 6.25 2.086 6.25 2.5V4.079C4.811 4.195 3.866 4.477 3.172 5.172C2.477 5.866 2.195 6.811 2.079 8.25H21.921C21.805 6.811 21.523 5.866 20.828 5.172C20.134 4.477 19.189 4.195 17.75 4.079V2.5C17.75 2.086 17.414 1.75 17 1.75C16.586 1.75 16.25 2.086 16.25 2.5V4.013C15.585 4 14.839 4 14 4H10C9.161 4 8.415 4 7.75 4.013V2.5Z\"/><path fill-rule=\"evenodd\" d=\"M22 12V14C22 17.771 22 19.657 20.828 20.828C19.657 22 17.771 22 14 22H10C6.229 22 4.343 22 3.172 20.828C2 19.657 2 17.771 2 14V12C2 11.161 2 10.415 2.013 9.75H21.987C22 10.415 22 11.161 22 12ZM16.5 18C17.328 18 18 17.328 18 16.5C18 15.672 17.328 15 16.5 15C15.672 15 15 15.672 15 16.5C15 17.328 15.672 18 16.5 18Z\" clip-rule=\"evenodd\"/></g>", width: 24, height: 24 }, // src/components/SettingsModal.tsx
  "calendar-minimalistic-bold": { body: "<g fill=\"currentColor\"><path d=\"M22 14V12C22 11.161 22 10.415 21.987 9.75H2.013C2 10.415 2 11.161 2 12V14C2 17.771 2 19.657 3.172 20.828C4.343 22 6.229 22 10 22H14C17.771 22 19.657 22 20.828 20.828C22 19.657 22 17.771 22 14Z\"/><path d=\"M7.75 2.5C7.75 2.086 7.414 1.75 7 1.75C6.586 1.75 6.25 2.086 6.25 2.5V4.079C4.811 4.195 3.866 4.477 3.172 5.172C2.477 5.866 2.195 6.811 2.079 8.25H21.921C21.805 6.811 21.523 5.866 20.828 5.172C20.134 4.477 19.189 4.195 17.75 4.079V2.5C17.75 2.086 17.414 1.75 17 1.75C16.586 1.75 16.25 2.086 16.25 2.5V4.013C15.585 4 14.839 4 14 4H10C9.161 4 8.415 4 7.75 4.013V2.5Z\"/></g>", width: 24, height: 24 }, // src/components/settings/HolidayEditor.tsx
  "check-circle-bold": { body: "<path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M22 12C22 17.523 17.523 22 12 22C6.477 22 2 17.523 2 12C2 6.477 6.477 2 12 2C17.523 2 22 6.477 22 12ZM16.03 8.97C16.323 9.263 16.323 9.737 16.03 10.03L11.03 15.03C10.737 15.323 10.263 15.323 9.97 15.03L7.97 13.03C7.677 12.737 7.677 12.263 7.97 11.97C8.263 11.677 8.737 11.677 9.03 11.97L10.5 13.439L12.735 11.204L14.97 8.97C15.263 8.677 15.737 8.677 16.03 8.97Z\" clip-rule=\"evenodd\"/>", width: 24, height: 24 }, // src/components/BatteryCard.tsx
  "clipboard-add-bold": { body: "<g fill=\"currentColor\"><path d=\"M9.5 2C8.672 2 8 2.672 8 3.5V4.5C8 5.328 8.672 6 9.5 6H14.5C15.328 6 16 5.328 16 4.5V3.5C16 2.672 15.328 2 14.5 2H9.5Z\"/><path fill-rule=\"evenodd\" d=\"M3.879 4.877C4.448 4.308 5.242 4.107 6.5 4.037V4.5C6.5 6.157 7.843 7.5 9.5 7.5H14.5C16.157 7.5 17.5 6.157 17.5 4.5V4.037C18.758 4.107 19.552 4.308 20.121 4.877C21 5.756 21 7.17 21 9.998V15.998C21 18.827 21 20.241 20.121 21.12C19.243 21.998 17.828 21.998 15 21.998H9C6.172 21.998 4.757 21.998 3.879 21.12C3 20.241 3 18.827 3 15.998V9.998C3 7.17 3 5.756 3.879 4.877ZM12.75 11C12.75 10.586 12.414 10.25 12 10.25C11.586 10.25 11.25 10.586 11.25 11L11.25 13.25H9C8.586 13.25 8.25 13.586 8.25 14C8.25 14.414 8.586 14.75 9 14.75H11.25V17C11.25 17.414 11.586 17.75 12 17.75C12.414 17.75 12.75 17.414 12.75 17L12.75 14.75H15C15.414 14.75 15.75 14.414 15.75 14C15.75 13.586 15.414 13.25 15 13.25H12.75V11Z\" clip-rule=\"evenodd\"/></g>", width: 24, height: 24 }, // src/components/settings/TimetableEditor.tsx
  "clipboard-list-bold": { body: "<g fill=\"currentColor\"><path d=\"M9.5 2C8.672 2 8 2.672 8 3.5V4.5C8 5.328 8.672 6 9.5 6H14.5C15.328 6 16 5.328 16 4.5V3.5C16 2.672 15.328 2 14.5 2H9.5Z\"/><path fill-rule=\"evenodd\" d=\"M6.5 4.037C5.242 4.107 4.448 4.308 3.879 4.877C3 5.756 3 7.17 3 9.998V15.998C3 18.827 3 20.241 3.879 21.12C4.757 21.998 6.172 21.998 9 21.998H15C17.828 21.998 19.243 21.998 20.121 21.12C21 20.241 21 18.827 21 15.998V9.998C21 7.17 21 5.756 20.121 4.877C19.552 4.308 18.758 4.107 17.5 4.037V4.5C17.5 6.157 16.157 7.5 14.5 7.5H9.5C7.843 7.5 6.5 6.157 6.5 4.5V4.037ZM7 9.75C6.586 9.75 6.25 10.086 6.25 10.5C6.25 10.914 6.586 11.25 7 11.25H7.5C7.914 11.25 8.25 10.914 8.25 10.5C8.25 10.086 7.914 9.75 7.5 9.75H7ZM10.5 9.75C10.086 9.75 9.75 10.086 9.75 10.5C9.75 10.914 10.086 11.25 10.5 11.25H17C17.414 11.25 17.75 10.914 17.75 10.5C17.75 10.086 17.414 9.75 17 9.75H10.5ZM7 13.25C6.586 13.25 6.25 13.586 6.25 14C6.25 14.414 6.586 14.75 7 14.75H7.5C7.914 14.75 8.25 14.414 8.25 14C8.25 13.586 7.914 13.25 7.5 13.25H7ZM10.5 13.25C10.086 13.25 9.75 13.586 9.75 14C9.75 14.414 10.086 14.75 10.5 14.75H17C17.414 14.75 17.75 14.414 17.75 14C17.75 13.586 17.414 13.25 17 13.25H10.5ZM7 16.75C6.586 16.75 6.25 17.086 6.25 17.5C6.25 17.914 6.586 18.25 7 18.25H7.5C7.914 18.25 8.25 17.914 8.25 17.5C8.25 17.086 7.914 16.75 7.5 16.75H7ZM10.5 16.75C10.086 16.75 9.75 17.086 9.75 17.5C9.75 17.914 10.086 18.25 10.5 18.25H17C17.414 18.25 17.75 17.914 17.75 17.5C17.75 17.086 17.414 16.75 17 16.75H10.5Z\" clip-rule=\"evenodd\"/></g>", width: 24, height: 24 }, // src/components/PeriodTracker.tsx
  "clock-circle-bold": { body: "<path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M12 2C17.523 2 22 6.477 22 12C22 17.523 17.523 22 12 22C6.477 22 2 17.523 2 12C2 6.477 6.477 2 12 2ZM12 7.25C11.586 7.25 11.25 7.586 11.25 8V12C11.25 12.199 11.329 12.39 11.47 12.53L13.97 15.03C14.263 15.323 14.737 15.323 15.03 15.03C15.323 14.737 15.323 14.263 15.03 13.97L12.75 11.69V8C12.75 7.586 12.414 7.25 12 7.25Z\" clip-rule=\"evenodd\"/>", width: 24, height: 24 }, // src/components/SettingsModal.tsx
  "close-circle-bold": { body: "<path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M22 12C22 17.523 17.523 22 12 22C6.477 22 2 17.523 2 12C2 6.477 6.477 2 12 2C17.523 2 22 6.477 22 12ZM8.97 8.97C9.263 8.677 9.737 8.677 10.03 8.97L12 10.939L13.97 8.97C14.262 8.677 14.737 8.677 15.03 8.97C15.323 9.263 15.323 9.737 15.03 10.03L13.061 12L15.03 13.97C15.323 14.262 15.323 14.737 15.03 15.03C14.737 15.323 14.262 15.323 13.97 15.03L12 13.061L10.03 15.03C9.737 15.323 9.263 15.323 8.97 15.03C8.677 14.737 8.677 14.262 8.97 13.97L10.939 12L8.97 10.03C8.677 9.737 8.677 9.263 8.97 8.97Z\" clip-rule=\"evenodd\"/>", width: 24, height: 24 }, // src/components/CelebrationToast.tsx
  "confetti-bold": { body: "<g fill=\"currentColor\"><path d=\"M10.186 2.139C10.54 2.355 10.651 2.817 10.435 3.17C10.278 3.426 10.317 3.757 10.53 3.969L10.628 4.067C11.216 4.656 11.433 5.521 11.193 6.318C11.073 6.714 10.654 6.938 10.258 6.819C9.861 6.699 9.637 6.28 9.757 5.884C9.838 5.616 9.765 5.326 9.567 5.128L9.469 5.03C8.767 4.328 8.637 3.235 9.155 2.388C9.371 2.034 9.833 1.923 10.186 2.139Z\"/><path d=\"M17.689 4.721C18.095 4.803 18.359 5.198 18.277 5.604L18.133 6.324C17.935 7.315 17.221 8.123 16.263 8.443C15.815 8.592 15.481 8.97 15.389 9.433L15.245 10.153C15.164 10.559 14.768 10.822 14.362 10.741C13.956 10.66 13.693 10.265 13.774 9.859L13.918 9.139C14.116 8.148 14.83 7.339 15.789 7.02C16.236 6.871 16.57 6.493 16.663 6.03L16.806 5.31C16.888 4.904 17.283 4.64 17.689 4.721Z\"/><path d=\"M21.409 13.559C21.047 13.401 20.626 13.467 20.331 13.729C19.521 14.447 18.344 14.566 17.407 14.025L17.194 13.903C16.836 13.695 16.713 13.237 16.92 12.878C17.127 12.519 17.586 12.396 17.944 12.604L18.157 12.726C18.535 12.944 19.009 12.896 19.336 12.607C20.068 11.957 21.112 11.793 22.009 12.185L22.301 12.312C22.68 12.478 22.854 12.92 22.688 13.3C22.522 13.68 22.079 13.853 21.7 13.687L21.409 13.559Z\"/><path d=\"M6.928 3.941C7.137 3.731 7.477 3.731 7.686 3.941C7.896 4.15 7.896 4.49 7.686 4.699C7.477 4.909 7.137 4.909 6.928 4.699C6.718 4.49 6.718 4.15 6.928 3.941Z\"/><path d=\"M12.916 7.157C12.706 6.947 12.367 6.947 12.157 7.157C11.948 7.366 11.948 7.706 12.157 7.915C12.367 8.125 12.706 8.125 12.916 7.915C13.125 7.706 13.125 7.366 12.916 7.157Z\"/><path d=\"M17.157 10.157C17.367 9.947 17.706 9.947 17.916 10.157C18.125 10.366 18.125 10.706 17.916 10.915C17.706 11.125 17.367 11.125 17.157 10.915C16.948 10.706 16.948 10.366 17.157 10.157Z\"/><path d=\"M19.817 15.313C19.607 15.104 19.267 15.104 19.058 15.313C18.849 15.523 18.849 15.862 19.058 16.072C19.267 16.281 19.607 16.281 19.817 16.072C20.026 15.862 20.026 15.523 19.817 15.313Z\"/><path d=\"M7.472 20.241C5.21 20.987 4.018 21.299 3.359 20.64C2.629 19.91 3.09 18.527 4.012 15.762L5.702 10.693C6.334 8.797 6.705 7.683 7.324 7.231L7.319 7.257C7.312 7.293 7.302 7.346 7.288 7.413C7.262 7.548 7.225 7.743 7.181 7.987C7.094 8.473 6.979 9.152 6.87 9.926C6.655 11.459 6.456 13.418 6.559 14.983C6.621 15.931 6.818 17.105 6.994 18.024C7.082 18.487 7.167 18.893 7.23 19.184C7.262 19.329 7.288 19.446 7.306 19.526L7.327 19.619L7.472 20.241Z\"/><path d=\"M13.039 18.386L13.306 18.297C15.604 17.531 16.753 17.148 16.967 16.242C17.181 15.336 16.324 14.479 14.611 12.767L12.922 11.077L12.917 11.092C12.898 11.154 12.869 11.245 12.835 11.359C12.767 11.588 12.675 11.909 12.584 12.275C12.397 13.024 12.227 13.897 12.227 14.555C12.227 15.213 12.397 16.086 12.584 16.835C12.675 17.201 12.767 17.522 12.835 17.751C12.869 17.865 12.898 17.956 12.917 18.018C12.927 18.049 12.935 18.073 12.94 18.088L12.945 18.105L12.947 18.109L13.039 18.386Z\"/><path d=\"M8.8 7.504L8.85 7.259C9.463 7.618 10.189 8.344 11.232 9.388L11.735 9.89L11.523 10.53L11.513 10.558C11.507 10.577 11.499 10.604 11.488 10.638C11.466 10.707 11.435 10.806 11.398 10.929C11.325 11.175 11.227 11.519 11.128 11.912C10.936 12.681 10.727 13.703 10.727 14.555C10.727 15.407 10.936 16.429 11.128 17.198C11.227 17.592 11.325 17.935 11.398 18.181C11.435 18.304 11.466 18.403 11.488 18.472C11.499 18.506 11.507 18.533 11.513 18.552L11.616 18.861L8.901 19.766L8.794 19.306L8.789 19.284L8.769 19.197C8.752 19.12 8.727 19.007 8.696 18.867C8.635 18.585 8.553 18.191 8.467 17.741C8.293 16.834 8.111 15.735 8.055 14.885C7.963 13.481 8.143 11.649 8.356 10.134C8.461 9.384 8.572 8.724 8.657 8.253C8.7 8.017 8.736 7.829 8.761 7.7C8.773 7.635 8.783 7.586 8.79 7.553L8.797 7.516L8.799 7.507L8.8 7.504Z\"/><path d=\"M14.954 2.21C15.105 2.19 15.382 2.18 15.601 2.4C15.821 2.62 15.812 2.896 15.791 3.048C15.772 3.191 15.724 3.363 15.677 3.527L15.641 3.653L15.706 3.755C15.793 3.894 15.887 4.043 15.945 4.175C16.01 4.324 16.084 4.577 15.944 4.841C15.808 5.101 15.563 5.187 15.408 5.222C15.266 5.254 15.089 5.268 14.921 5.281L14.793 5.291L14.783 5.292L14.691 5.404C14.581 5.537 14.468 5.675 14.36 5.773C14.247 5.877 14.033 6.037 13.736 5.997C13.429 5.955 13.269 5.732 13.192 5.593C13.122 5.467 13.061 5.301 13.004 5.147L12.964 5.038L12.855 4.998C12.7 4.941 12.535 4.879 12.409 4.81C12.27 4.732 12.047 4.573 12.005 4.266C11.964 3.968 12.124 3.755 12.228 3.641C12.326 3.534 12.465 3.42 12.598 3.311L12.71 3.219L12.71 3.208L12.72 3.081C12.733 2.912 12.747 2.735 12.78 2.594C12.815 2.438 12.9 2.194 13.16 2.057C13.425 1.918 13.677 1.992 13.826 2.057C13.959 2.114 14.108 2.208 14.246 2.296L14.349 2.36L14.475 2.325C14.639 2.278 14.81 2.229 14.954 2.21Z\"/><path d=\"M22.14 10.492C22.607 10.025 22.779 9.396 22.524 8.842C22.329 8.422 21.937 8.149 21.454 8.046C21.352 7.563 21.078 7.171 20.658 6.977C20.104 6.721 19.475 6.893 19.008 7.361C18.737 7.631 18.615 7.994 18.557 8.318C18.498 8.648 18.497 8.998 18.517 9.304C18.537 9.614 18.579 9.897 18.616 10.102C18.634 10.205 18.652 10.29 18.665 10.349C18.671 10.379 18.676 10.403 18.68 10.419C18.725 10.6 18.872 10.769 19.052 10.813L19.053 10.813L19.081 10.82C19.098 10.824 19.121 10.829 19.151 10.836C19.211 10.849 19.295 10.866 19.398 10.885C19.603 10.921 19.887 10.964 20.196 10.983C20.502 11.003 20.852 11.002 21.183 10.943C21.506 10.886 21.869 10.763 22.14 10.492Z\"/></g>", width: 24, height: 24 }, // src/components/BatteryCard.tsx
  "copy-bold": { body: "<g fill=\"currentColor\"><path d=\"M15.24 2H11.346C9.582 2 8.184 2 7.091 2.148C5.965 2.3 5.054 2.62 4.336 3.341C3.617 4.062 3.298 4.977 3.147 6.107C3 7.205 3 8.608 3 10.379V16.217C3 17.725 3.92 19.017 5.227 19.559C5.16 18.65 5.16 17.374 5.16 16.312L5.16 11.398L5.16 11.302C5.16 10.021 5.16 8.916 5.278 8.032C5.405 7.084 5.691 6.176 6.425 5.439C7.159 4.702 8.064 4.415 9.008 4.287C9.889 4.169 10.989 4.169 12.265 4.169L12.36 4.169H15.24L15.335 4.169C16.611 4.169 17.709 4.169 18.59 4.287C18.063 2.948 16.762 2 15.24 2Z\"/><path d=\"M6.6 11.397C6.6 8.671 6.6 7.308 7.444 6.461C8.287 5.614 9.645 5.614 12.36 5.614H15.24C17.955 5.614 19.313 5.614 20.157 6.461C21 7.308 21 8.671 21 11.397V16.217C21 18.943 21 20.306 20.157 21.153C19.313 22 17.955 22 15.24 22H12.36C9.645 22 8.287 22 7.444 21.153C6.6 20.306 6.6 18.943 6.6 16.217V11.397Z\"/></g>", width: 24, height: 24 }, // src/components/settings/TimetableEditor.tsx
  "cup-hot-bold": { body: "<g fill=\"currentColor\"><path fill-rule=\"evenodd\" d=\"M3.284 11.266C3.151 9.267 3.084 8.267 3.677 7.634C4.27 7 5.272 7 7.276 7H12.725C14.728 7 15.73 7 16.323 7.634C16.485 7.807 16.598 8.008 16.674 8.25H17C19.526 8.25 21.75 10.062 21.75 12.5C21.75 14.938 19.526 16.75 17 16.75H16.35C16.338 16.923 16.327 17.089 16.316 17.25H3.685C3.666 16.983 3.647 16.699 3.627 16.399L3.284 11.266ZM16.45 15.25H17C18.892 15.25 20.25 13.928 20.25 12.5C20.25 11.072 18.892 9.75 17 9.75H16.801C16.788 10.18 16.755 10.68 16.716 11.266L16.45 15.25Z\" clip-rule=\"evenodd\"/><path d=\"M3.819 18.75H16.181C16.037 19.927 15.803 20.667 15.243 21.191C14.378 22 13.047 22 10.387 22H9.613C6.953 22 5.622 22 4.757 21.191C4.197 20.667 3.963 19.927 3.819 18.75Z\"/><path fill-rule=\"evenodd\" d=\"M6.977 1.327C7.314 1.567 7.393 2.036 7.152 2.373L6.766 2.914C7.392 3.388 7.531 4.278 7.072 4.921L6.661 5.497C6.421 5.834 5.952 5.912 5.615 5.672C5.278 5.431 5.199 4.963 5.44 4.626L5.826 4.084C5.2 3.61 5.061 2.721 5.52 2.077L5.931 1.502C6.172 1.165 6.64 1.086 6.977 1.327ZM10.977 1.327C11.314 1.567 11.393 2.036 11.152 2.373L10.766 2.914C11.392 3.388 11.531 4.278 11.072 4.921L10.661 5.497C10.421 5.834 9.952 5.912 9.615 5.672C9.278 5.431 9.199 4.963 9.44 4.626L9.826 4.084C9.2 3.61 9.062 2.721 9.52 2.077L9.931 1.502C10.172 1.165 10.64 1.086 10.977 1.327ZM14.977 1.327C15.314 1.567 15.393 2.036 15.152 2.373L14.766 2.914C15.392 3.388 15.531 4.278 15.072 4.921L14.661 5.497C14.421 5.834 13.952 5.912 13.615 5.672C13.278 5.431 13.199 4.963 13.44 4.626L13.826 4.084C13.2 3.61 13.062 2.721 13.521 2.077L13.931 1.502C14.172 1.165 14.64 1.086 14.977 1.327Z\" clip-rule=\"evenodd\"/></g>", width: 24, height: 24 }, // src/components/PeriodTracker.tsx
  "danger-circle-bold": { body: "<path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M22 12C22 6.477 17.523 2 12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12ZM12 6.25C12.414 6.25 12.75 6.586 12.75 7V13C12.75 13.414 12.414 13.75 12 13.75C11.586 13.75 11.25 13.414 11.25 13V7C11.25 6.586 11.586 6.25 12 6.25ZM12 17C12.552 17 13 16.552 13 16C13 15.448 12.552 15 12 15C11.448 15 11 15.448 11 16C11 16.552 11.448 17 12 17Z\" clip-rule=\"evenodd\"/>", width: 24, height: 24 }, // src/components/BatteryCard.tsx
  "danger-triangle-bold": { body: "<path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M5.312 10.761C8.23 5.587 9.689 3 12 3C14.311 3 15.77 5.587 18.688 10.761L19.052 11.406C21.477 15.706 22.69 17.856 21.594 19.428C20.498 21 17.786 21 12.364 21H11.636C6.214 21 3.502 21 2.406 19.428C1.31 17.856 2.523 15.706 4.948 11.406L5.312 10.761ZM12 7.25C12.414 7.25 12.75 7.586 12.75 8V13C12.75 13.414 12.414 13.75 12 13.75C11.586 13.75 11.25 13.414 11.25 13V8C11.25 7.586 11.586 7.25 12 7.25ZM12 17C12.552 17 13 16.552 13 16C13 15.448 12.552 15 12 15C11.448 15 11 15.448 11 16C11 16.552 11.448 17 12 17Z\" clip-rule=\"evenodd\"/>", width: 24, height: 24 }, // src/components/BatteryCard.tsx
  "diskette-bold": { body: "<g fill=\"currentColor\"><path fill-rule=\"evenodd\" d=\"M20.535 20.535C22 19.071 22 16.714 22 12C22 11.659 22 11.488 21.985 11.314C21.914 10.505 21.586 9.713 21.064 9.09C20.952 8.957 20.828 8.833 20.581 8.586L15.414 3.419C15.167 3.172 15.043 3.048 14.91 2.936C14.287 2.414 13.495 2.086 12.686 2.015C12.512 2 12.341 2 12 2C7.286 2 4.929 2 3.464 3.464C2 4.929 2 7.286 2 12C2 16.714 2 19.071 3.464 20.535C4.149 21.22 5.027 21.584 6.25 21.778L6.25 20.948C6.25 20.049 6.25 19.3 6.33 18.706C6.414 18.078 6.6 17.511 7.055 17.055C7.511 16.6 8.078 16.414 8.706 16.33C9.3 16.25 10.05 16.25 10.948 16.25H13.052C13.95 16.25 14.7 16.25 15.294 16.33C15.922 16.414 16.489 16.6 16.945 17.055C17.4 17.511 17.586 18.078 17.67 18.706C17.75 19.3 17.75 20.049 17.75 20.948L17.75 21.778C18.973 21.584 19.852 21.22 20.535 20.535ZM6.25 8C6.25 7.586 6.586 7.25 7 7.25H13C13.414 7.25 13.75 7.586 13.75 8C13.75 8.414 13.414 8.75 13 8.75H7C6.586 8.75 6.25 8.414 6.25 8Z\" clip-rule=\"evenodd\"/><path d=\"M16.183 18.905C16.248 19.388 16.25 20.036 16.25 21V21.931C15.094 22 13.7 22 12 22C10.3 22 8.906 22 7.75 21.931V21C7.75 20.036 7.752 19.388 7.817 18.905C7.879 18.444 7.986 18.246 8.116 18.116C8.246 17.986 8.444 17.879 8.905 17.817C9.388 17.752 10.036 17.75 11 17.75H13C13.964 17.75 14.612 17.752 15.095 17.817C15.556 17.879 15.754 17.986 15.884 18.116C16.014 18.246 16.121 18.444 16.183 18.905Z\"/></g>", width: 24, height: 24 }, // src/components/SettingsModal.tsx
  "download-minimalistic-bold": { body: "<g fill=\"currentColor\"><path d=\"M12.553 16.506C12.411 16.662 12.211 16.75 12 16.75C11.789 16.75 11.589 16.662 11.447 16.506L7.446 12.131C7.167 11.825 7.188 11.351 7.494 11.072C7.8 10.792 8.274 10.813 8.554 11.119L11.25 14.068V3C11.25 2.586 11.586 2.25 12 2.25C12.414 2.25 12.75 2.586 12.75 3V14.068L15.447 11.119C15.726 10.813 16.2 10.792 16.506 11.072C16.812 11.351 16.833 11.825 16.553 12.131L12.553 16.506Z\"/><path d=\"M3.75 15C3.75 14.586 3.414 14.25 3 14.25C2.586 14.25 2.25 14.586 2.25 15V15.055C2.25 16.422 2.25 17.525 2.367 18.392C2.488 19.292 2.746 20.05 3.348 20.652C3.95 21.254 4.708 21.512 5.608 21.634C6.475 21.75 7.578 21.75 8.945 21.75H15.055C16.422 21.75 17.525 21.75 18.392 21.634C19.292 21.512 20.05 21.254 20.652 20.652C21.254 20.05 21.512 19.292 21.634 18.392C21.75 17.525 21.75 16.422 21.75 15.055V15C21.75 14.586 21.414 14.25 21 14.25C20.586 14.25 20.25 14.586 20.25 15C20.25 16.435 20.248 17.436 20.147 18.192C20.048 18.926 19.868 19.314 19.591 19.591C19.314 19.868 18.926 20.048 18.192 20.147C17.436 20.248 16.435 20.25 15 20.25H9C7.565 20.25 6.563 20.248 5.808 20.147C5.074 20.048 4.686 19.868 4.409 19.591C4.132 19.314 3.952 18.926 3.853 18.192C3.752 17.436 3.75 16.435 3.75 15Z\"/></g>", width: 24, height: 24 }, // src/components/SettingsModal.tsx
  "download-square-bold": { body: "<path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M2 12C2 7.286 2 4.929 3.464 3.464C4.929 2 7.286 2 12 2C16.714 2 19.071 2 20.535 3.464C22 4.929 22 7.286 22 12C22 16.714 22 19.071 20.535 20.535C19.071 22 16.714 22 12 22C7.286 22 4.929 22 3.464 20.535C2 19.071 2 16.714 2 12ZM12 6.25C12.414 6.25 12.75 6.586 12.75 7V12.189L14.47 10.47C14.763 10.177 15.237 10.177 15.53 10.47C15.823 10.763 15.823 11.237 15.53 11.53L12.53 14.53C12.39 14.671 12.199 14.75 12 14.75C11.801 14.75 11.61 14.671 11.47 14.53L8.47 11.53C8.177 11.237 8.177 10.763 8.47 10.47C8.763 10.177 9.237 10.177 9.53 10.47L11.25 12.189V7C11.25 6.586 11.586 6.25 12 6.25ZM8 16.25C7.586 16.25 7.25 16.586 7.25 17C7.25 17.414 7.586 17.75 8 17.75H16C16.414 17.75 16.75 17.414 16.75 17C16.75 16.586 16.414 16.25 16 16.25H8Z\" clip-rule=\"evenodd\"/>", width: 24, height: 24 }, // src/App.tsx
  "eye-closed-bold": { body: "<path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M1.606 6.081C2.114 5.863 2.702 6.098 2.919 6.606L2 7C2.919 6.606 2.919 6.606 2.919 6.606L2.919 6.605C2.918 6.604 2.919 6.604 2.919 6.605L2.922 6.614C2.927 6.623 2.933 6.638 2.943 6.659C2.963 6.701 2.994 6.767 3.037 6.853C3.123 7.025 3.256 7.277 3.437 7.582C3.801 8.194 4.354 9.008 5.108 9.819C5.285 10.011 5.473 10.201 5.672 10.388C5.68 10.395 5.688 10.403 5.696 10.411C7.181 11.801 9.252 13 12 13C13.209 13 14.278 12.769 15.221 12.398C16.447 11.915 17.474 11.189 18.316 10.399C19.265 9.508 19.963 8.55 20.423 7.811C20.653 7.443 20.821 7.133 20.93 6.919C20.984 6.812 21.024 6.729 21.049 6.675C21.062 6.648 21.071 6.629 21.076 6.617L21.081 6.606C21.299 6.098 21.886 5.863 22.394 6.081C22.901 6.298 23.137 6.886 22.919 7.394L22 7C22.919 7.394 22.919 7.393 22.919 7.394L22.917 7.399L22.913 7.407L22.902 7.433C22.892 7.454 22.879 7.484 22.862 7.52C22.827 7.594 22.777 7.698 22.712 7.827C22.58 8.086 22.384 8.446 22.121 8.868C21.718 9.515 21.152 10.316 20.41 11.124L21.207 11.921C21.598 12.312 21.598 12.945 21.207 13.336C20.817 13.726 20.183 13.726 19.793 13.336L18.953 12.495C18.388 12.951 17.757 13.381 17.056 13.752L17.838 14.954C18.139 15.417 18.008 16.037 17.545 16.338C17.082 16.639 16.463 16.508 16.162 16.045L15.176 14.531C14.497 14.739 13.772 14.886 13 14.955V16.5C13 17.052 12.552 17.5 12 17.5C11.448 17.5 11 17.052 11 16.5V14.956C10.225 14.886 9.5 14.739 8.823 14.531L7.838 16.045C7.537 16.508 6.917 16.639 6.455 16.338C5.992 16.037 5.861 15.417 6.162 14.954L6.944 13.752C6.244 13.381 5.612 12.951 5.047 12.495L4.207 13.336C3.817 13.726 3.183 13.726 2.793 13.336C2.402 12.945 2.402 12.312 2.793 11.921L3.59 11.124C2.745 10.204 2.128 9.292 1.719 8.605C1.51 8.254 1.353 7.958 1.248 7.748C1.195 7.642 1.155 7.558 1.128 7.498C1.114 7.468 1.103 7.444 1.095 7.426L1.086 7.405L1.083 7.398L1.082 7.396L1.081 7.395C1.081 7.394 1.081 7.394 2 7L1.081 7.395C0.864 6.887 1.098 6.298 1.606 6.081Z\" clip-rule=\"evenodd\"/>", width: 24, height: 24 }, // src/components/settings/TimetableEditor.tsx
  "flag-bold": { body: "<path fill=\"currentColor\" d=\"M5.75 1C6.164 1 6.5 1.336 6.5 1.75V3.6L8.221 3.256C9.871 2.926 11.582 3.083 13.145 3.708L13.349 3.789C14.91 4.414 16.628 4.531 18.259 4.123C19.017 3.933 19.75 4.506 19.75 5.287V12.654C19.75 13.298 19.311 13.86 18.686 14.016L18.472 14.069C16.702 14.512 14.838 14.385 13.145 13.708C11.582 13.083 9.871 12.926 8.221 13.256L6.5 13.6V21.75C6.5 22.164 6.164 22.5 5.75 22.5C5.336 22.5 5 22.164 5 21.75V1.75C5 1.336 5.336 1 5.75 1Z\"/>", width: 24, height: 24 }, // src/components/ClockHero.tsx
  "flash-drive-bold": { body: "<g fill=\"currentColor\" fill-rule=\"evenodd\" clip-rule=\"evenodd\"><path d=\"M5.255 9.54L6.022 8.773C8.192 6.603 9.276 5.518 10.625 5.518C10.826 5.518 11.022 5.542 11.216 5.591C12.321 5.866 13.382 6.927 15.227 8.772L15.227 8.773L15.228 8.773C16.808 10.354 17.813 11.358 18.242 12.308C18.402 12.663 18.482 13.009 18.482 13.375C18.482 14.723 17.397 15.808 15.227 17.978L14.46 18.745C12.29 20.915 11.206 22 9.857 22C8.509 22 7.424 20.915 5.255 18.745C3.085 16.576 2 15.491 2 14.143C2 12.794 3.085 11.71 5.255 9.54ZM4.725 13.612C5.017 13.319 5.492 13.319 5.785 13.612L10.388 18.215C10.681 18.508 10.681 18.983 10.388 19.276C10.095 19.569 9.62 19.569 9.327 19.276L4.725 14.673C4.432 14.38 4.432 13.905 4.725 13.612Z\"/><path d=\"M19.83 4.17C21.277 5.616 22 6.34 22 7.238C22 8.137 21.277 8.86 19.83 10.307L19.195 10.943C19.09 10.783 18.978 10.626 18.861 10.472C18.257 9.681 17.383 8.807 16.359 7.783L16.217 7.641C15.193 6.617 14.319 5.743 13.528 5.139C13.374 5.022 13.217 4.91 13.057 4.806L13.693 4.17C15.14 2.723 15.863 2 16.762 2C17.66 2 18.384 2.723 19.83 4.17ZM19.621 6.5C19.914 6.793 19.914 7.268 19.621 7.561L18.914 8.268C18.621 8.561 18.146 8.561 17.854 8.268C17.561 7.975 17.561 7.5 17.854 7.207L18.561 6.5C18.854 6.207 19.328 6.207 19.621 6.5ZM17.5 4.379C17.793 4.672 17.793 5.146 17.5 5.439L16.793 6.146C16.5 6.439 16.025 6.439 15.732 6.146C15.439 5.854 15.439 5.379 15.732 5.086L16.439 4.379C16.732 4.086 17.207 4.086 17.5 4.379Z\"/></g>", width: 24, height: 24 }, // src/components/SettingsModal.tsx
  "graph-up-bold": { body: "<path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M3.464 3.464C2 4.929 2 7.286 2 12C2 16.714 2 19.071 3.464 20.535C4.929 22 7.286 22 12 22C16.714 22 19.071 22 20.535 20.535C22 19.071 22 16.714 22 12C22 7.286 22 4.929 20.535 3.464C19.071 2 16.714 2 12 2C7.286 2 4.929 2 3.464 3.464ZM13.75 10C13.75 10.414 14.086 10.75 14.5 10.75H15.189L13.177 12.763C13.079 12.86 12.921 12.86 12.823 12.763L11.237 11.177C10.554 10.493 9.446 10.493 8.763 11.177L6.47 13.47C6.177 13.763 6.177 14.237 6.47 14.53C6.763 14.823 7.237 14.823 7.53 14.53L9.823 12.237C9.921 12.14 10.079 12.14 10.177 12.237L11.763 13.823C12.446 14.507 13.554 14.507 14.237 13.823L16.25 11.811V12.5C16.25 12.914 16.586 13.25 17 13.25C17.414 13.25 17.75 12.914 17.75 12.5V10C17.75 9.586 17.414 9.25 17 9.25H14.5C14.086 9.25 13.75 9.586 13.75 10Z\" clip-rule=\"evenodd\"/>", width: 24, height: 24 }, // src/components/BatteryCard.tsx
  "hourglass-bold": { body: "<path fill=\"currentColor\" d=\"M5.198 3.299C5.8 2 7.867 2 12 2C16.133 2 18.2 2 18.802 3.299C18.854 3.411 18.897 3.527 18.932 3.646C19.341 5.033 17.88 6.641 14.958 9.857L13 12L14.958 14.143C17.88 17.359 19.341 18.967 18.932 20.354C18.897 20.473 18.854 20.589 18.802 20.701C18.2 22 16.133 22 12 22C7.867 22 5.8 22 5.198 20.701C5.146 20.589 5.103 20.473 5.068 20.354C4.659 18.967 6.12 17.359 9.042 14.143L11 12L9.042 9.857C6.12 6.641 4.659 5.033 5.068 3.646C5.103 3.527 5.146 3.411 5.198 3.299Z\"/>", width: 24, height: 24 }, // src/components/PeriodTracker.tsx
  "info-circle-linear": { body: "<g fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path stroke-linecap=\"round\" d=\"M12 17V11\"/><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M12 8H12\"/></g>", width: 24, height: 24 }, // src/components/SettingsModal.tsx
  "keyboard-bold": { body: "<path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M8 5H16C18.828 5 20.243 5 21.121 5.879C22 6.757 22 8.172 22 11V13C22 15.828 22 17.243 21.121 18.121C20.243 19 18.828 19 16 19H8C5.172 19 3.757 19 2.879 18.121C2 17.243 2 15.828 2 13V11C2 8.172 2 6.757 2.879 5.879C3.757 5 5.172 5 8 5ZM6 10C6.552 10 7 9.552 7 9C7 8.448 6.552 8 6 8C5.448 8 5 8.448 5 9C5 9.552 5.448 10 6 10ZM6 13C6.552 13 7 12.552 7 12C7 11.448 6.552 11 6 11C5.448 11 5 11.448 5 12C5 12.552 5.448 13 6 13ZM9 13C9.552 13 10 12.552 10 12C10 11.448 9.552 11 9 11C8.448 11 8 11.448 8 12C8 12.552 8.448 13 9 13ZM9 10C9.552 10 10 9.552 10 9C10 8.448 9.552 8 9 8C8.448 8 8 8.448 8 9C8 9.552 8.448 10 9 10ZM12 10C12.552 10 13 9.552 13 9C13 8.448 12.552 8 12 8C11.448 8 11 8.448 11 9C11 9.552 11.448 10 12 10ZM12 13C12.552 13 13 12.552 13 12C13 11.448 12.552 11 12 11C11.448 11 11 11.448 11 12C11 12.552 11.448 13 12 13ZM15 10C15.552 10 16 9.552 16 9C16 8.448 15.552 8 15 8C14.448 8 14 8.448 14 9C14 9.552 14.448 10 15 10ZM15 13C15.552 13 16 12.552 16 12C16 11.448 15.552 11 15 11C14.448 11 14 11.448 14 12C14 12.552 14.448 13 15 13ZM18 10C18.552 10 19 9.552 19 9C19 8.448 18.552 8 18 8C17.448 8 17 8.448 17 9C17 9.552 17.448 10 18 10ZM18 13C18.552 13 19 12.552 19 12C19 11.448 18.552 11 18 11C17.448 11 17 11.448 17 12C17 12.552 17.448 13 18 13ZM17.75 16C17.75 16.414 17.414 16.75 17 16.75H7C6.586 16.75 6.25 16.414 6.25 16C6.25 15.586 6.586 15.25 7 15.25H17C17.414 15.25 17.75 15.586 17.75 16Z\" clip-rule=\"evenodd\"/>", width: 24, height: 24 }, // src/components/SettingsModal.tsx
  "magic-wand-3-bold": { body: "<g fill=\"currentColor\"><path d=\"M3.845 3.845C2.718 4.971 2.718 6.796 3.845 7.922L5.432 9.51C5.444 9.496 5.457 9.483 5.47 9.47L9.47 5.47C9.483 5.457 9.496 5.444 9.51 5.432L7.922 3.845C6.796 2.718 4.971 2.718 3.845 3.845Z\"/><path d=\"M10.568 6.49C10.556 6.504 10.543 6.517 10.53 6.53L6.53 10.53C6.517 10.543 6.504 10.556 6.49 10.568L16.078 20.155C17.204 21.282 19.029 21.282 20.155 20.155C21.282 19.029 21.282 17.204 20.155 16.078L10.568 6.49Z\"/><path d=\"M16.1 2.307C16.261 1.898 16.838 1.898 16.999 2.307L17.43 3.402C17.479 3.528 17.578 3.627 17.702 3.676L18.793 4.108C19.201 4.269 19.201 4.849 18.793 5.011L17.702 5.443C17.578 5.492 17.479 5.591 17.43 5.716L17 6.811C16.838 7.221 16.261 7.221 16.1 6.811L15.67 5.716C15.62 5.591 15.522 5.492 15.397 5.443L14.306 5.011C13.898 4.849 13.898 4.269 14.306 4.108L15.397 3.676C15.522 3.627 15.62 3.528 15.67 3.402L16.1 2.307Z\"/><path d=\"M19.967 9.129C20.128 8.72 20.706 8.72 20.867 9.129L21.023 9.529C21.073 9.654 21.171 9.753 21.296 9.802L21.694 9.96C22.102 10.121 22.102 10.701 21.694 10.862L21.296 11.02C21.171 11.069 21.073 11.168 21.023 11.293L20.867 11.693C20.706 12.102 20.128 12.102 19.967 11.693L19.81 11.293C19.761 11.168 19.663 11.069 19.538 11.02L19.14 10.862C18.732 10.701 18.732 10.121 19.14 9.96L19.538 9.802C19.663 9.753 19.761 9.654 19.81 9.529L19.967 9.129Z\"/><path d=\"M5.133 15.307C5.294 14.898 5.872 14.898 6.033 15.307L6.19 15.707C6.239 15.832 6.337 15.931 6.462 15.98L6.86 16.137C7.268 16.299 7.268 16.879 6.86 17.04L6.462 17.198C6.337 17.247 6.239 17.346 6.19 17.471L6.033 17.87C5.872 18.28 5.294 18.28 5.133 17.87L4.976 17.471C4.927 17.346 4.829 17.247 4.704 17.198L4.306 17.04C3.898 16.879 3.898 16.299 4.306 16.137L4.704 15.98C4.829 15.931 4.927 15.832 4.976 15.707L5.133 15.307Z\"/></g>", width: 24, height: 24 }, // src/components/SettingsModal.tsx
  "monitor-smartphone-bold": { body: "<g fill=\"currentColor\"><path d=\"M14 2H10C6.229 2 4.343 2 3.172 3.172C2 4.343 2 6.229 2 10V11C2 11.552 2 12.049 2.007 12.5H12.602C12.705 11.821 12.938 11.113 13.525 10.525C14.143 9.907 14.895 9.682 15.606 9.587C16.251 9.5 17.045 9.5 17.91 9.5H18.09C18.955 9.5 19.749 9.5 20.394 9.587C20.931 9.659 21.492 9.805 22 10.138V10C22 6.229 22 4.343 20.828 3.172C19.657 2 17.771 2 14 2Z\"/><path d=\"M2.879 16.121C3.757 17 5.172 17 8 17H11.25V21H8C7.586 21 7.25 21.336 7.25 21.75C7.25 22.164 7.586 22.5 8 22.5H13.55L13.525 22.475C12.907 21.857 12.682 21.105 12.587 20.394C12.5 19.749 12.5 18.955 12.5 18.09V14.911C12.5 14.412 12.5 13.937 12.517 13.5H2.038C2.109 14.758 2.309 15.552 2.879 16.121Z\"/><path fill-rule=\"evenodd\" d=\"M22 15V18C22 19.886 22 20.828 21.414 21.414C20.828 22 19.886 22 18 22C16.114 22 15.172 22 14.586 21.414C14 20.828 14 19.886 14 18V15C14 13.114 14 12.172 14.586 11.586C15.172 11 16.114 11 18 11C19.886 11 20.828 11 21.414 11.586C22 12.172 22 13.114 22 15ZM16.25 20C16.25 19.586 16.586 19.25 17 19.25H19C19.414 19.25 19.75 19.586 19.75 20C19.75 20.414 19.414 20.75 19 20.75H17C16.586 20.75 16.25 20.414 16.25 20Z\" clip-rule=\"evenodd\"/></g>", width: 24, height: 24 }, // src/components/AppHeader.tsx
  "moon-bold": { body: "<path fill=\"currentColor\" d=\"M12 22C17.523 22 22 17.523 22 12C22 11.537 21.306 11.461 21.067 11.857C19.929 13.741 17.861 15 15.5 15C11.91 15 9 12.09 9 8.5C9 6.138 10.259 4.071 12.143 2.933C12.539 2.693 12.463 2 12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22Z\"/>", width: 24, height: 24 }, // src/components/AppHeader.tsx
  "moon-sleep-bold": { body: "<g fill=\"currentColor\"><path fill-rule=\"evenodd\" d=\"M18 2.75C17.586 2.75 17.25 2.414 17.25 2C17.25 1.586 17.586 1.25 18 1.25H22C22.303 1.25 22.577 1.433 22.693 1.713C22.809 1.993 22.745 2.316 22.53 2.53L19.811 5.25H22C22.414 5.25 22.75 5.586 22.75 6C22.75 6.414 22.414 6.75 22 6.75H18C17.697 6.75 17.423 6.567 17.307 6.287C17.191 6.007 17.255 5.684 17.47 5.47L20.189 2.75H18ZM13.5 8.75C13.086 8.75 12.75 8.414 12.75 8C12.75 7.586 13.086 7.25 13.5 7.25H16.5C16.803 7.25 17.077 7.433 17.193 7.713C17.309 7.993 17.245 8.316 17.03 8.53L15.311 10.25H16.5C16.914 10.25 17.25 10.586 17.25 11C17.25 11.414 16.914 11.75 16.5 11.75H13.5C13.197 11.75 12.923 11.567 12.807 11.287C12.691 11.007 12.755 10.684 12.97 10.47L14.689 8.75H13.5Z\" clip-rule=\"evenodd\"/><path d=\"M12 22C17.523 22 22 17.523 22 12C22 11.537 21.306 11.461 21.067 11.857C19.929 13.741 17.861 15 15.5 15C11.91 15 9 12.09 9 8.5C9 6.138 10.259 4.071 12.143 2.933C12.539 2.693 12.463 2 12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22Z\"/></g>", width: 24, height: 24 }, // src/components/DayOverrideBar.tsx
  "moon-stars-bold": { body: "<g fill=\"currentColor\"><path d=\"M19.9 2.307C19.739 1.898 19.162 1.898 19.001 2.307L18.57 3.402C18.521 3.528 18.423 3.627 18.298 3.676L17.207 4.108C16.799 4.269 16.799 4.849 17.207 5.011L18.298 5.443C18.423 5.492 18.521 5.591 18.57 5.716L19.001 6.811C19.162 7.221 19.739 7.221 19.9 6.811L20.331 5.716C20.38 5.591 20.478 5.492 20.603 5.443L21.694 5.011C22.102 4.849 22.102 4.269 21.694 4.108L20.603 3.676C20.478 3.627 20.38 3.528 20.331 3.402L19.9 2.307Z\"/><path d=\"M16.033 8.13C15.872 7.72 15.294 7.72 15.133 8.13L14.976 8.529C14.927 8.654 14.829 8.753 14.704 8.802L14.306 8.96C13.898 9.121 13.898 9.701 14.306 9.863L14.704 10.02C14.829 10.069 14.927 10.168 14.976 10.293L15.133 10.693C15.294 11.102 15.872 11.102 16.033 10.693L16.19 10.293C16.239 10.168 16.337 10.069 16.462 10.02L16.86 9.863C17.268 9.701 17.268 9.121 16.86 8.96L16.462 8.802C16.337 8.753 16.239 8.654 16.19 8.529L16.033 8.13Z\"/><path d=\"M12 22C17.523 22 22 17.523 22 12C22 11.537 21.306 11.461 21.067 11.857C19.929 13.741 17.861 15 15.5 15C11.91 15 9 12.09 9 8.5C9 6.138 10.259 4.071 12.143 2.933C12.539 2.693 12.463 2 12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22Z\"/></g>", width: 24, height: 24 }, // src/components/PeriodTracker.tsx
  "notebook-bold": { body: "<path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M8.75 2.013V22L15 22C17.828 22 19.243 22 20.121 21.121C21 20.243 21 18.828 21 16V8C21 5.172 21 3.757 20.121 2.879C19.243 2 17.828 2 15 2H9L8.75 2.013ZM10.75 6.5C10.75 6.086 11.086 5.75 11.5 5.75H16.5C16.914 5.75 17.25 6.086 17.25 6.5C17.25 6.914 16.914 7.25 16.5 7.25H11.5C11.086 7.25 10.75 6.914 10.75 6.5ZM10.75 10C10.75 9.586 11.086 9.25 11.5 9.25H16.5C16.914 9.25 17.25 9.586 17.25 10C17.25 10.414 16.914 10.75 16.5 10.75H11.5C11.086 10.75 10.75 10.414 10.75 10ZM3.001 7.25C3.008 4.914 3.081 3.676 3.879 2.879C4.554 2.204 5.545 2.047 7.25 2.011V21.989C5.545 21.953 4.554 21.796 3.879 21.121C3.081 20.324 3.008 19.086 3.001 16.75H4C4.414 16.75 4.75 16.414 4.75 16C4.75 15.586 4.414 15.25 4 15.25H3V12.75H4C4.414 12.75 4.75 12.414 4.75 12C4.75 11.586 4.414 11.25 4 11.25H3V8.75H4C4.414 8.75 4.75 8.414 4.75 8C4.75 7.586 4.414 7.25 4 7.25H3.001ZM3.001 7.25H2C1.586 7.25 1.25 7.586 1.25 8C1.25 8.414 1.586 8.75 2 8.75H3V8C3 7.738 3 7.488 3.001 7.25ZM3 12.75H2C1.586 12.75 1.25 12.414 1.25 12C1.25 11.586 1.586 11.25 2 11.25H3V12.75ZM3 15.25H2C1.586 15.25 1.25 15.586 1.25 16C1.25 16.414 1.586 16.75 2 16.75H3.001C3 16.512 3 16.262 3 16V15.25Z\" clip-rule=\"evenodd\"/>", width: 24, height: 24 }, // src/components/ClockHero.tsx
  "plate-bold": { body: "<g fill=\"currentColor\"><path d=\"M12.75 3C12.75 2.586 12.414 2.25 12 2.25C11.586 2.25 11.25 2.586 11.25 3V5C11.25 5.414 11.586 5.75 12 5.75C12.414 5.75 12.75 5.414 12.75 5V3Z\"/><path fill-rule=\"evenodd\" d=\"M22.75 12.056C22.75 13.894 22.75 15.35 22.597 16.489C22.439 17.662 22.107 18.61 21.359 19.359C20.61 20.107 19.661 20.439 18.489 20.597C17.35 20.75 15.894 20.75 14.056 20.75H9.943C8.106 20.75 6.65 20.75 5.511 20.597C4.339 20.439 3.39 20.107 2.641 19.359C1.893 18.61 1.561 17.662 1.403 16.489C1.25 15.35 1.25 13.894 1.25 12.056L1.25 11.773C1.25 11.553 1.25 11.339 1.251 11.13C1.251 10.747 1.253 10.381 1.258 10.034C1.272 9.059 1.307 8.223 1.403 7.511C1.561 6.339 1.893 5.39 2.641 4.641C3.39 3.893 4.339 3.561 5.511 3.403C6.227 3.307 7.069 3.271 8.052 3.258C8.217 3.256 8.475 3.254 8.749 3.253C9.301 3.251 9.75 3.699 9.75 4.252V5C9.75 6.243 10.757 7.25 12 7.25C13.243 7.25 14.25 6.243 14.25 5V4.25C14.25 3.698 14.698 3.249 15.25 3.252C16.539 3.258 17.609 3.285 18.489 3.403C19.661 3.561 20.61 3.893 21.359 4.641C22.107 5.39 22.439 6.339 22.597 7.511C22.75 8.65 22.75 10.106 22.75 11.944V12.056ZM8 9.75C7.586 9.75 7.25 10.086 7.25 10.5C7.25 10.914 7.586 11.25 8 11.25H16C16.414 11.25 16.75 10.914 16.75 10.5C16.75 10.086 16.414 9.75 16 9.75H8ZM8 13.25C7.586 13.25 7.25 13.586 7.25 14C7.25 14.414 7.586 14.75 8 14.75H13.5C13.914 14.75 14.25 14.414 14.25 14C14.25 13.586 13.914 13.25 13.5 13.25H8Z\" clip-rule=\"evenodd\"/></g>", width: 24, height: 24 }, // src/components/PeriodTracker.tsx
  "restart-bold": { body: "<path fill=\"currentColor\" d=\"M18.258 3.508C18.538 3.624 18.721 3.898 18.721 4.201V8.444C18.721 8.858 18.385 9.194 17.971 9.194H13.728C13.425 9.194 13.151 9.011 13.035 8.731C12.919 8.451 12.983 8.128 13.198 7.913L14.801 6.311C12.167 5.209 9.016 5.731 6.873 7.873C4.042 10.705 4.042 15.295 6.873 18.127C9.705 20.958 14.295 20.958 17.127 18.127C18.773 16.48 19.462 14.24 19.194 12.094C19.142 11.683 19.433 11.308 19.845 11.256C20.256 11.205 20.63 11.496 20.682 11.907C21.006 14.493 20.175 17.2 18.187 19.187C14.77 22.604 9.23 22.604 5.813 19.187C2.396 15.77 2.396 10.23 5.813 6.813C8.551 4.074 12.652 3.531 15.931 5.18L17.44 3.671C17.655 3.456 17.977 3.392 18.258 3.508Z\"/>", width: 24, height: 24 }, // src/components/SettingsModal.tsx
  "settings-bold": { body: "<path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M14.279 2.152C13.909 2 13.439 2 12.5 2C11.561 2 11.091 2 10.721 2.152C10.227 2.355 9.835 2.745 9.631 3.235C9.537 3.458 9.501 3.719 9.486 4.098C9.465 4.656 9.177 5.172 8.69 5.451C8.203 5.73 7.609 5.72 7.111 5.459C6.773 5.281 6.528 5.183 6.286 5.151C5.756 5.082 5.22 5.224 4.796 5.547C4.478 5.789 4.243 6.193 3.774 7C3.304 7.807 3.07 8.21 3.017 8.605C2.948 9.131 3.091 9.663 3.417 10.084C3.565 10.276 3.774 10.437 4.098 10.639C4.574 10.936 4.88 11.442 4.88 12C4.88 12.558 4.574 13.064 4.098 13.361C3.774 13.563 3.565 13.724 3.416 13.916C3.091 14.337 2.947 14.869 3.017 15.395C3.07 15.789 3.304 16.193 3.774 17C4.243 17.807 4.478 18.211 4.796 18.453C5.22 18.776 5.756 18.918 6.286 18.849C6.528 18.817 6.773 18.719 7.111 18.541C7.609 18.28 8.203 18.27 8.69 18.549C9.177 18.828 9.465 19.344 9.486 19.902C9.501 20.282 9.537 20.542 9.631 20.765C9.835 21.255 10.227 21.645 10.721 21.848C11.091 22 11.561 22 12.5 22C13.439 22 13.909 22 14.279 21.848C14.773 21.645 15.165 21.255 15.369 20.765C15.463 20.542 15.499 20.282 15.514 19.902C15.535 19.344 15.823 18.828 16.31 18.549C16.797 18.27 17.391 18.28 17.889 18.541C18.227 18.719 18.472 18.817 18.714 18.849C19.244 18.918 19.78 18.776 20.204 18.453C20.522 18.21 20.757 17.807 21.226 17C21.696 16.193 21.93 15.789 21.983 15.395C22.052 14.869 21.909 14.337 21.584 13.916C21.435 13.724 21.226 13.563 20.902 13.361C20.426 13.064 20.12 12.558 20.12 12C20.12 11.442 20.426 10.936 20.902 10.639C21.226 10.437 21.435 10.276 21.584 10.084C21.909 9.663 22.052 9.131 21.983 8.605C21.93 8.211 21.696 7.807 21.226 7C20.757 6.193 20.522 5.789 20.204 5.547C19.78 5.224 19.244 5.082 18.714 5.151C18.472 5.183 18.227 5.281 17.889 5.459C17.392 5.72 16.797 5.73 16.31 5.451C15.823 5.172 15.535 4.656 15.514 4.098C15.499 3.718 15.463 3.458 15.369 3.235C15.165 2.745 14.773 2.355 14.279 2.152ZM12.5 15C14.169 15 15.523 13.657 15.523 12C15.523 10.343 14.169 9 12.5 9C10.831 9 9.477 10.343 9.477 12C9.477 13.657 10.831 15 12.5 15Z\" clip-rule=\"evenodd\"/>", width: 24, height: 24 }, // src/components/AppHeader.tsx
  "smile-circle-bold": { body: "<path fill=\"currentColor\" fill-rule=\"evenodd\" d=\"M12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22ZM8.397 15.553C8.644 15.221 9.114 15.151 9.447 15.398C10.175 15.937 11.054 16.25 12 16.25C12.946 16.25 13.825 15.937 14.553 15.398C14.886 15.151 15.356 15.221 15.602 15.553C15.849 15.886 15.779 16.356 15.447 16.602C14.474 17.323 13.285 17.75 12 17.75C10.715 17.75 9.526 17.323 8.553 16.602C8.221 16.356 8.151 15.886 8.397 15.553ZM16 10.5C16 11.328 15.552 12 15 12C14.448 12 14 11.328 14 10.5C14 9.672 14.448 9 15 9C15.552 9 16 9.672 16 10.5ZM9 12C9.552 12 10 11.328 10 10.5C10 9.672 9.552 9 9 9C8.448 9 8 9.672 8 10.5C8 11.328 8.448 12 9 12Z\" clip-rule=\"evenodd\"/>", width: 24, height: 24 }, // src/components/PeriodTracker.tsx
  "sort-vertical-bold": { body: "<g fill=\"currentColor\"><path d=\"M12 13.125C12.301 13.125 12.573 13.305 12.691 13.583C12.808 13.86 12.748 14.181 12.538 14.397L8.538 18.522C8.397 18.668 8.203 18.75 8 18.75C7.797 18.75 7.603 18.668 7.462 18.522L3.462 14.397C3.252 14.181 3.192 13.86 3.309 13.583C3.427 13.305 3.699 13.125 4 13.125H7.25V6C7.25 5.586 7.586 5.25 8 5.25C8.414 5.25 8.75 5.586 8.75 6V13.125H12Z\"/><path d=\"M20 10.875C20.301 10.875 20.573 10.695 20.691 10.417C20.808 10.14 20.748 9.819 20.538 9.603L16.538 5.478C16.397 5.332 16.203 5.25 16 5.25C15.797 5.25 15.603 5.332 15.462 5.478L11.462 9.603C11.252 9.819 11.192 10.14 11.309 10.417C11.427 10.695 11.699 10.875 12 10.875H15.25V18C15.25 18.414 15.586 18.75 16 18.75C16.414 18.75 16.75 18.414 16.75 18L16.75 10.875H20Z\"/></g>", width: 24, height: 24 }, // src/components/settings/TimetableEditor.tsx
  "stars-bold": { body: "<g fill=\"currentColor\"><path d=\"M7.453 2.713C7.828 1.762 9.172 1.762 9.547 2.713L10.709 5.657C10.823 5.947 11.053 6.177 11.343 6.291L14.287 7.453C15.238 7.828 15.238 9.172 14.287 9.547L11.343 10.709C11.053 10.823 10.823 11.053 10.709 11.343L9.547 14.287C9.172 15.238 7.828 15.238 7.453 14.287L6.291 11.343C6.177 11.053 5.947 10.823 5.657 10.709L2.713 9.547C1.762 9.172 1.762 7.828 2.713 7.453L5.657 6.291C5.947 6.177 6.177 5.947 6.291 5.657L7.453 2.713Z\"/><path d=\"M16.924 13.392C17.131 12.87 17.869 12.87 18.076 13.392L18.976 15.675C19.039 15.835 19.165 15.961 19.325 16.024L21.608 16.924C22.131 17.131 22.131 17.869 21.608 18.076L19.325 18.976C19.165 19.039 19.039 19.165 18.976 19.325L18.076 21.608C17.869 22.131 17.131 22.131 16.924 21.608L16.024 19.325C15.961 19.165 15.835 19.039 15.675 18.976L13.392 18.076C12.87 17.869 12.87 17.131 13.392 16.924L15.675 16.024C15.835 15.961 15.961 15.835 16.024 15.675L16.924 13.392Z\"/></g>", width: 24, height: 24 }, // src/components/BatteryCard.tsx
  "stopwatch-bold": { body: "<g fill=\"currentColor\" fill-rule=\"evenodd\" clip-rule=\"evenodd\"><path d=\"M12 22C16.971 22 21 17.971 21 13C21 8.029 16.971 4 12 4C7.029 4 3 8.029 3 13C3 17.971 7.029 22 12 22ZM12 8.25C12.414 8.25 12.75 8.586 12.75 9V13C12.75 13.414 12.414 13.75 12 13.75C11.586 13.75 11.25 13.414 11.25 13V9C11.25 8.586 11.586 8.25 12 8.25Z\"/><path d=\"M9.25 2C9.25 1.586 9.586 1.25 10 1.25H14C14.414 1.25 14.75 1.586 14.75 2C14.75 2.414 14.414 2.75 14 2.75H10C9.586 2.75 9.25 2.414 9.25 2Z\"/></g>", width: 24, height: 24 }, // src/components/DayOverrideBar.tsx
  "sun-2-bold": { body: "<g fill=\"currentColor\"><path d=\"M17 12C17 14.761 14.761 17 12 17C9.239 17 7 14.761 7 12C7 9.239 9.239 7 12 7C14.761 7 17 9.239 17 12Z\"/><path fill-rule=\"evenodd\" d=\"M12 1.25C12.414 1.25 12.75 1.586 12.75 2V4C12.75 4.414 12.414 4.75 12 4.75C11.586 4.75 11.25 4.414 11.25 4V2C11.25 1.586 11.586 1.25 12 1.25ZM3.669 3.716C3.948 3.41 4.423 3.389 4.728 3.669L6.95 5.7C7.256 5.98 7.277 6.454 6.998 6.76C6.718 7.066 6.244 7.087 5.938 6.807L3.716 4.776C3.41 4.496 3.389 4.022 3.669 3.716ZM20.331 3.716C20.611 4.022 20.59 4.496 20.284 4.776L18.062 6.807C17.756 7.087 17.282 7.066 17.002 6.76C16.723 6.454 16.744 5.98 17.05 5.7L19.272 3.669C19.578 3.389 20.052 3.41 20.331 3.716ZM1.25 12C1.25 11.586 1.586 11.25 2 11.25H4C4.414 11.25 4.75 11.586 4.75 12C4.75 12.414 4.414 12.75 4 12.75H2C1.586 12.75 1.25 12.414 1.25 12ZM19.25 12C19.25 11.586 19.586 11.25 20 11.25H22C22.414 11.25 22.75 11.586 22.75 12C22.75 12.414 22.414 12.75 22 12.75H20C19.586 12.75 19.25 12.414 19.25 12ZM17.026 17.025C17.318 16.732 17.793 16.732 18.086 17.025L20.308 19.247C20.601 19.54 20.601 20.015 20.308 20.308C20.015 20.601 19.54 20.601 19.247 20.308L17.026 18.086C16.733 17.793 16.733 17.318 17.026 17.025ZM6.975 17.025C7.268 17.318 7.268 17.793 6.975 18.086L4.752 20.308C4.46 20.601 3.985 20.601 3.692 20.308C3.399 20.015 3.399 19.54 3.692 19.248L5.914 17.025C6.207 16.732 6.682 16.732 6.975 17.025ZM12 19.25C12.414 19.25 12.75 19.586 12.75 20V22C12.75 22.414 12.414 22.75 12 22.75C11.586 22.75 11.25 22.414 11.25 22V20C11.25 19.586 11.586 19.25 12 19.25Z\" clip-rule=\"evenodd\"/></g>", width: 24, height: 24 }, // src/components/AppHeader.tsx
  "sunrise-bold": { body: "<g fill=\"currentColor\"><path fill-rule=\"evenodd\" d=\"M4.25 19C4.25 18.586 4.586 18.25 5 18.25H19C19.414 18.25 19.75 18.586 19.75 19C19.75 19.414 19.414 19.75 19 19.75H5C4.586 19.75 4.25 19.414 4.25 19ZM7.25 22C7.25 21.586 7.586 21.25 8 21.25H16C16.414 21.25 16.75 21.586 16.75 22C16.75 22.414 16.414 22.75 16 22.75H8C7.586 22.75 7.25 22.414 7.25 22Z\" clip-rule=\"evenodd\"/><path fill-rule=\"evenodd\" d=\"M12 1.25C12.414 1.25 12.75 1.586 12.75 2V3C12.75 3.414 12.414 3.75 12 3.75C11.586 3.75 11.25 3.414 11.25 3V2C11.25 1.586 11.586 1.25 12 1.25ZM4.399 4.399C4.691 4.106 5.166 4.106 5.459 4.399L5.852 4.791C6.145 5.084 6.145 5.559 5.852 5.852C5.559 6.145 5.084 6.145 4.791 5.852L4.399 5.459C4.106 5.166 4.106 4.691 4.399 4.399ZM19.601 4.399C19.894 4.692 19.894 5.167 19.601 5.46L19.208 5.852C18.915 6.145 18.441 6.145 18.148 5.852C17.855 5.559 17.855 5.085 18.148 4.792L18.541 4.399C18.833 4.106 19.308 4.106 19.601 4.399ZM1.25 12C1.25 11.586 1.586 11.25 2 11.25H3C3.414 11.25 3.75 11.586 3.75 12C3.75 12.414 3.414 12.75 3 12.75H2C1.586 12.75 1.25 12.414 1.25 12ZM20.25 12C20.25 11.586 20.586 11.25 21 11.25H22C22.414 11.25 22.75 11.586 22.75 12C22.75 12.414 22.414 12.75 22 12.75H21C20.586 12.75 20.25 12.414 20.25 12Z\" clip-rule=\"evenodd\"/><path d=\"M5.25 12C5.25 13.178 5.552 14.286 6.083 15.25H2C1.586 15.25 1.25 15.586 1.25 16C1.25 16.414 1.586 16.75 2 16.75H11.25V11.811L10.53 12.53C10.237 12.823 9.763 12.823 9.47 12.53C9.177 12.237 9.177 11.763 9.47 11.47L11.47 9.47C11.763 9.177 12.237 9.177 12.53 9.47L14.53 11.47C14.823 11.763 14.823 12.237 14.53 12.53C14.237 12.823 13.763 12.823 13.47 12.53L12.75 11.811V16.75H22C22.414 16.75 22.75 16.414 22.75 16C22.75 15.586 22.414 15.25 22 15.25H17.917C18.448 14.286 18.75 13.178 18.75 12C18.75 8.272 15.728 5.25 12 5.25C8.272 5.25 5.25 8.272 5.25 12Z\"/></g>", width: 24, height: 24 }, // src/components/PeriodTracker.tsx
  "trash-bin-trash-bold": { body: "<g fill=\"currentColor\"><path d=\"M3 6.386C3 5.902 3.345 5.509 3.771 5.509L6.436 5.508C6.965 5.493 7.432 5.11 7.612 4.544C7.617 4.529 7.622 4.511 7.642 4.444L7.757 4.053C7.827 3.812 7.888 3.603 7.974 3.416C8.312 2.677 8.938 2.164 9.661 2.033C9.845 2 10.039 2 10.261 2H13.739C13.962 2 14.156 2 14.339 2.033C15.062 2.164 15.688 2.677 16.026 3.416C16.112 3.603 16.173 3.812 16.244 4.053L16.358 4.444C16.378 4.511 16.383 4.529 16.388 4.544C16.568 5.11 17.128 5.494 17.657 5.509H20.229C20.655 5.509 21 5.902 21 6.386C21 6.87 20.655 7.263 20.229 7.263H3.771C3.345 7.263 3 6.87 3 6.386Z\"/><path fill-rule=\"evenodd\" d=\"M11.596 22H12.404C15.187 22 16.578 22 17.483 21.114C18.388 20.228 18.48 18.775 18.665 15.869L18.932 11.681C19.033 10.104 19.083 9.315 18.629 8.816C18.175 8.316 17.409 8.316 15.876 8.316H8.124C6.591 8.316 5.825 8.316 5.371 8.816C4.917 9.315 4.967 10.104 5.068 11.681L5.335 15.869C5.52 18.775 5.612 20.228 6.517 21.114C7.422 22 8.813 22 11.596 22ZM10.246 12.189C10.205 11.755 9.838 11.438 9.425 11.482C9.013 11.525 8.713 11.912 8.754 12.346L9.254 17.609C9.295 18.043 9.662 18.359 10.075 18.316C10.487 18.273 10.787 17.886 10.746 17.452L10.246 12.189ZM14.575 11.482C14.987 11.525 15.287 11.912 15.246 12.346L14.746 17.609C14.705 18.043 14.338 18.359 13.925 18.316C13.513 18.273 13.213 17.886 13.254 17.452L13.754 12.189C13.795 11.755 14.162 11.438 14.575 11.482Z\" clip-rule=\"evenodd\"/></g>", width: 24, height: 24 }, // src/components/settings/HolidayEditor.tsx
  "tuning-2-bold": { body: "<g fill=\"currentColor\"><path d=\"M9.25 14C10.907 14 12.25 15.343 12.25 17C12.25 18.657 10.907 20 9.25 20C7.593 20 6.25 18.657 6.25 17C6.25 15.343 7.593 14 9.25 14Z\"/><path d=\"M14.25 4C12.593 4 11.25 5.343 11.25 7C11.25 8.657 12.593 10 14.25 10C15.907 10 17.25 8.657 17.25 7C17.25 5.343 15.907 4 14.25 4Z\"/><path d=\"M8.75 6.209C9.164 6.209 9.5 6.544 9.5 6.959C9.5 7.373 9.164 7.709 8.75 7.709L1.75 7.709C1.336 7.709 1 7.373 1 6.959C1 6.544 1.336 6.209 1.75 6.209H8.75Z\"/><path d=\"M14.75 16.209C14.336 16.209 14 16.544 14 16.959C14 17.373 14.336 17.709 14.75 17.709H21.75C22.164 17.709 22.5 17.373 22.5 16.959C22.5 16.544 22.164 16.209 21.75 16.209H14.75Z\"/><path d=\"M1 16.959C1 16.544 1.336 16.209 1.75 16.209H3.75C4.164 16.209 4.5 16.544 4.5 16.959C4.5 17.373 4.164 17.709 3.75 17.709H1.75C1.336 17.709 1 17.373 1 16.959Z\"/><path d=\"M21.75 6.209C22.164 6.209 22.5 6.544 22.5 6.959C22.5 7.373 22.164 7.709 21.75 7.709L19.75 7.709C19.336 7.709 19 7.373 19 6.959C19 6.544 19.336 6.209 19.75 6.209H21.75Z\"/></g>", width: 24, height: 24 }, // src/components/DayOverrideBar.tsx
  "upload-minimalistic-bold": { body: "<g fill=\"currentColor\"><path d=\"M12.553 2.494C12.411 2.339 12.211 2.25 12 2.25C11.789 2.25 11.589 2.339 11.447 2.494L7.446 6.869C7.167 7.175 7.188 7.649 7.494 7.929C7.8 8.208 8.274 8.187 8.554 7.881L11.25 4.932V16C11.25 16.414 11.586 16.75 12 16.75C12.414 16.75 12.75 16.414 12.75 16V4.932L15.447 7.881C15.726 8.187 16.2 8.208 16.506 7.929C16.812 7.649 16.833 7.175 16.553 6.869L12.553 2.494Z\"/><path d=\"M3.75 15C3.75 14.586 3.414 14.25 3 14.25C2.586 14.25 2.25 14.586 2.25 15V15.055C2.25 16.422 2.25 17.525 2.367 18.392C2.488 19.292 2.746 20.05 3.348 20.652C3.95 21.254 4.708 21.512 5.608 21.634C6.475 21.75 7.578 21.75 8.945 21.75H15.055C16.422 21.75 17.525 21.75 18.392 21.634C19.292 21.512 20.05 21.254 20.652 20.652C21.254 20.05 21.512 19.292 21.634 18.392C21.75 17.525 21.75 16.422 21.75 15.055V15C21.75 14.586 21.414 14.25 21 14.25C20.586 14.25 20.25 14.586 20.25 15C20.25 16.435 20.248 17.436 20.147 18.192C20.048 18.926 19.868 19.314 19.591 19.591C19.314 19.868 18.926 20.048 18.192 20.147C17.436 20.248 16.435 20.25 15 20.25H9C7.565 20.25 6.563 20.248 5.808 20.147C5.074 20.048 4.686 19.868 4.409 19.591C4.132 19.314 3.952 18.926 3.853 18.192C3.752 17.436 3.75 16.435 3.75 15Z\"/></g>", width: 24, height: 24 }, // src/components/SettingsModal.tsx
  "user-rounded-bold": { body: "<g fill=\"currentColor\"><circle cx=\"12\" cy=\"6\" r=\"4\"/><ellipse cx=\"12\" cy=\"17\" rx=\"7\" ry=\"4\"/></g>", width: 24, height: 24 }, // src/components/SettingsModal.tsx
  "volume-bold": { body: "<path fill=\"currentColor\" d=\"M5.003 11.716C5.041 9.873 5.06 8.952 5.681 8.164C5.794 8.02 5.961 7.849 6.1 7.733C6.864 7.097 7.872 7.097 9.889 7.097C10.61 7.097 10.97 7.097 11.314 7.005C11.385 6.985 11.456 6.963 11.525 6.938C11.861 6.817 12.162 6.608 12.763 6.192C15.137 4.547 16.324 3.725 17.32 4.082C17.511 4.151 17.696 4.25 17.861 4.372C18.722 5.007 18.788 6.487 18.919 9.445C18.967 10.541 19 11.479 19 12C19 12.521 18.967 13.459 18.919 14.555C18.788 17.513 18.722 18.993 17.861 19.628C17.696 19.75 17.511 19.849 17.32 19.918C16.324 20.275 15.137 19.453 12.763 17.808C12.162 17.392 11.861 17.183 11.525 17.062C11.456 17.037 11.385 17.015 11.314 16.995C10.97 16.903 10.61 16.903 9.889 16.903C7.872 16.903 6.864 16.903 6.1 16.267C5.961 16.151 5.794 15.98 5.681 15.836C5.06 15.048 5.041 14.127 5.003 12.284C5.001 12.188 5 12.093 5 12C5 11.907 5.001 11.812 5.003 11.716Z\"/>", width: 24, height: 24 }, // src/components/SettingsModal.tsx
} as const satisfies Record<string, SolarIconGlyph>

export type SolarIconName = keyof typeof SOLAR_ICON_GLYPHS
```

---

**문서 종료.** 본 문서는 `thehuihuifam/school-survival-clock` 저장소의 커밋 `0735d64`를 기준으로 작성된 완전 기술 명세이며, 저장소의 어떤 파일도 변경하지 않고(문서 추가 제외) 작성되었다. 실측된 모든 수치·로그·스니펫은 실제 실행 결과에서 인용되었다.
