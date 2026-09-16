# 교사 생존 배터리 & 방학 D-Day

한국의 선생님을 위한 데스크 친화형 생존 대시보드입니다. 한국 표준시(KST) 실시간 시계, 퇴근 카운트다운, 학기 생존 배터리, 교시 레이더, 공감 메시지를 한 화면에서 확인할 수 있습니다.

## 주요 기능

- KST 기준 실시간 디지털 시계와 설정 가능한 퇴근 카운트다운
- 벽시계 초에 맞춰 갱신되고, 백그라운드 탭에서 돌아오면 즉시 현재 시각으로 복귀하는 타이머
- 학기 시작일에서 방학 시작일까지 계산되는 생존 배터리 게이지
- 주말과 사용자가 등록한 휴일을 자동으로 감지하는 회복 모드
- 현재 교시, 쉬는 시간, 점심시간, 다음 전환까지 남은 시간 표시
- 교시 1~6, 점심, 퇴근 시각을 직접 바꿀 수 있는 개인 시간표 편집기
- 수업일을 기준으로 계산하는 배터리 진행률과 방학 D-Day(달력 기준)
- 30분 자동 갱신 및 수동 갱신이 가능한 선생님 공감 메시지
- 이름, 퇴근 시각, 학기 시작일, 방학 시작일, 시간표, 휴일 LocalStorage 저장
- 다크/라이트 모드, 전체 화면 보기, 퇴근 시각의 캔버스 컨페티 축하
- 반응형 레이아웃과 키보드 접근성을 고려한 설정 모달
- 첫 방문 후 앱 셸과 정적 리소스를 캐시하는 오프라인 재방문 지원

## 실행

```bash
npm install
npm run dev
```

프로덕션 빌드는 다음 명령으로 확인합니다.

```bash
npm run build
npm run preview
```

## 배포 (GitHub Pages)

`main` 또는 Arena 작업 브랜치에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 빌드 후 GitHub Pages에 자동 배포합니다.

- 배포 주소: `https://thehuihuifam.github.io/school-survival-clock/`
- Vite는 모든 생성 리소스를 상대 경로로 빌드하므로 저장소 하위 경로에서도 새로고침이 안전합니다.
- 최초 1회는 저장소 **Settings > Pages > Build and deployment > Source**를 **GitHub Actions**로 지정해야 합니다.
- 수동 재배포가 필요하면 Actions 탭에서 **Deploy to GitHub Pages** 워크플로를 `workflow_dispatch`로 실행할 수 있습니다.

## 설정 팁

설정 모달에서 다음 값을 개인 환경에 맞게 입력할 수 있습니다.

- `오늘 퇴근 시각`: 카운트다운의 종료 시각이자 방과후/업무 시간의 끝
- `나의 시간표`: 1~6교시의 시작·종료 시각과 점심시간
- `학교가 쉬는 날`: 주말 외 휴일을 `YYYY-MM-DD`로 쉼표 또는 줄바꿈 구분
- 학기 시작일과 방학 시작일: 배터리 진행률의 기준 구간

입력 시간이 겹치거나 퇴근 시각이 마지막 일정보다 빠르면 저장할 수 없으며, 손상된 LocalStorage 값은 안전한 기본값으로 복구됩니다.

## 디자인 시스템

[Supanova Design Engine](./supanova-design-engine.md) 스펙을 React/Vite 구조에 맞춰 적용했습니다.

- **타이포그래피**: 본문 `Pretendard`, 영문 디스플레이 `Geist`, 숫자/시간 `Geist Mono` 세 가지만 씁니다. 범용 산세리프와 노토 산스 계열은 배제했고, 한글 제목은 `font-weight 700 · letter-spacing -0.035em · line-height 1.25`, 본문에는 `word-break: keep-all`을 적용합니다.
- **컬러 토큰**: Zinc-950(`#09090b`) 베이스에 Emerald 단일 액센트(`#34d399`)만 사용합니다. 보라/인디고는 쓰지 않고, 상태색은 `--status-warn`, `--status-rose` 두 가지로 제한합니다. 순수 블랙 대신 Zinc-950 계열의 `rgba(9, 9, 11, …)`만 사용합니다.
- **아이콘**: Iconify Solar 세트만 사용합니다. 화이트리스트는 `src/components/Icon.tsx`의 `SolarIcon` 유니언 타입으로 관리하며 `<iconify-icon>` 웹 컴포넌트를 `index.html`에서 로드합니다.
- **재질**: 카드마다 `inset 0 1px 0` 하이라이트와 배경 색조에 맞춘 틴티드 섀도를 넣고, 고정된 `feTurbulence` 그레인 오버레이(`.grain-overlay`)와 에메랄드 계열 메시 배경(`.background-mesh`)을 겹쳐 깊이감을 만듭니다. 네온 외부 글로우는 쓰지 않습니다.
- **모션**: 애니메이션은 `transform`과 `opacity`만 사용합니다. 진입은 `fade-in-up` + `--index` 캐스케이드, 스크롤 게이트는 `src/lib/reveal.ts`의 IntersectionObserver 훅(`scroll` 리스너 없음)이 담당하고, 배터리 게이지는 `width` 대신 `transform: scaleX()`로 전환됩니다. 모든 모션은 `prefers-reduced-motion`에서 해제됩니다.
- **뷰포트**: 전체 높이 기준은 `100dvh`를 사용하고, 상단 바는 `position: sticky` + `backdrop-filter`로 고정됩니다. 콘텐츠는 `max-width: 80rem` 컨테이너 안에 담깁니다.

## 기술 스택

- Vite + React + TypeScript
- Vite-processed CSS
- Iconify (Solar 아이콘 세트) + Pretendard / Geist / Geist Mono
- Canvas Confetti
- Service Worker 캐시 + LocalStorage
