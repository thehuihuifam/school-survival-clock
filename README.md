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
- 최초 1회는 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 지정해야 합니다.
- 수동 재배포가 필요하면 Actions 탭에서 **Deploy to GitHub Pages** 워크플로를 `workflow_dispatch`로 실행할 수 있습니다.

## 기술 스택

- Vite + React + TypeScript
- Tailwind CSS
- Lucide React
- Canvas Confetti
