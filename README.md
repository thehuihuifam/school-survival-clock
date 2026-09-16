# 교사 생존 배터리 & 방학 D-Day

한국의 선생님을 위한 데스크 친화형 생존 대시보드입니다. 한국 표준시(KST) 실시간 시계, 퇴근 카운트다운, 학기 생존 배터리, 교시 레이더, 공감 메시지를 한 화면에서 확인할 수 있습니다.

## 주요 기능

- KST 기준 실시간 디지털 시계와 설정 가능한 퇴근 카운트다운
- 학기 시작일에서 방학 시작일까지 계산되는 생존 배터리 게이지
- 현재 교시, 쉬는 시간, 점심시간, 다음 전환까지 남은 시간 표시
- 30분 자동 갱신 및 수동 갱신이 가능한 선생님 공감 메시지
- 이름, 퇴근 시각, 학기 시작일, 방학 시작일 LocalStorage 저장
- 다크/라이트 모드, 전체 화면 보기, 퇴근 시각의 캔버스 컨페티 축하
- 반응형 레이아웃과 키보드 접근성을 고려한 설정 모달

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

`main` 브랜치에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 빌드 후 GitHub Pages에 자동 배포합니다.

- 배포 주소: `https://<github-사용자명>.github.io/school-survival-clock/`
- CI 빌드에서는 `vite.config.ts`의 `base`가 `/school-survival-clock/`로 설정되고, 로컬 개발/미리보기는 기존처럼 `/`를 사용합니다.
- 최초 1회는 저장소 **Settings > Pages > Build and deployment > Source**를 **GitHub Actions**로 지정해야 합니다.
- 수동 재배포가 필요하면 Actions 탭에서 **Deploy to GitHub Pages** 워크플로를 `workflow_dispatch`로 실행할 수 있습니다.

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
- Tailwind CSS
- Iconify (Solar 아이콘 세트) + Pretendard / Geist / Geist Mono
- Canvas Confetti
