# zeplin-code-extension

Zeplin 레이어를 **좌표(x, y, width, height) 분석만으로** Vue 3 싱글 파일 컴포넌트(`<template>` + `<style scoped lang="scss">`)로 변환하는 실험용 [Zeplin Extension](https://zeplin.github.io/extension-model/)입니다.
챌린지 쇼케이스 발표(뭘 했는지 / 왜 이렇게 했는지 / 막혔던 부분과 해결)를 위한 사이드 프로젝트입니다.

## 뭘 했는지

- Zeplin 레이어 트리(JSON)를 입력받아, 형제 레이어들의 좌표를 분석해 `flex-row` / `flex-column` / `grid` / (폴백) `absolute` 배치를 추론
- 레이어 이름 컨벤션(`btn-`, `img-`, `text-` 등)을 기반으로 `<div>` 대신 시맨틱 HTML 태그(`button`, `img`, `p`...)로 매핑
- 색상(`fills`), 폰트(`textStyles`), 테두리 반경 등을 CSS(SCSS와 호환되는 문법)로 추출
- 최종 결과물을 `<template>` + `<style scoped lang="scss">` 형태의 Vue 3 SFC 스니펫으로 감싸서 Zeplin 코드 패널에 표시
- Zeplin 앱 없이도 개발/데모할 수 있도록 fixture 기반 테스트 + REST API 연동 스크립트 분리

```
src/
  index.js                 # Zeplin Extension 진입점 (layer, screen 함수, Vue SFC 스니펫 조립)
  layout/
    normalizeLayer.js       # 원본 Zeplin 데이터(snake_case, 부모 기준 상대좌표 등) → 내부 표준 형태 변환
    inferLayout.js          # 좌표 기반 flex/grid 추론 알고리즘 (핵심 로직)
    mapSemanticTag.js       # 레이어 이름 → HTML 태그 매핑
    buildCss.js             # 색상/폰트/테두리 → CSS(SCSS 호환) 변환
    buildHtml.js            # 레이어 트리 순회 → 들여쓰기된 HTML/CSS 조립
    buildVueSfc.js          # HTML/CSS → <template> + <style scoped lang="scss"> 조립
scripts/
  fetch-screen.js           # Zeplin REST API로 실제 화면 데이터를 가져와 data/ 에 저장
  generate-from-fixture.js  # JSON(fixture 또는 실제 데이터) → 미리보기 .vue 파일 생성
test/
  inferLayout.test.js        # 레이아웃 추론/태그 매핑/HTML 빌드/Vue SFC 스니펫 테스트
  normalizeLayer.test.js     # 원본 Zeplin 데이터 정규화(좌표/필드명/이미지 asset) 테스트
  fixtures/                  # 샘플 레이어 트리 (카드, 그리드)
preview/                    # Vite + Vue 3 미리보기 앱 (이 패키지 안에서만 사용, zem 빌드와 무관)
  main.js
  App.vue                   # data/generated.vue를 동적으로 불러와 실제로 렌더링해서 보여줌
index.html                  # Vite 엔트리 HTML
vite.config.js              # Vite + @vitejs/plugin-vue 설정
```

## 왜 이렇게 했는지

- **Figma가 아닌 Zeplin을 선택한 이유**: Zeplin은 애초에 "디자이너 → 개발자 스펙 전달"이 목적인 툴이라 레이어 데이터가 이미 CSS에 가깝게 정제되어 있습니다(`color`, `fontFamily`, `fontSize` 등이 바로 제공). 반면 Auto Layout 메타데이터가 없어서 **레이아웃 구조(flex/grid) 자체는 직접 추론해야 하는 부분**이 남고, 이게 이 프로젝트의 핵심 도전 포인트가 됩니다.
- **공식 Extension 프레임워크(zem)를 사용한 이유**: Zeplin은 레이어 선택 → 코드 생성이라는 인프라(로컬 서빙, 코드 패널 표시)를 이미 제공합니다. 이 인프라를 직접 만드는 대신 `layer`/`screen` 함수 구현에만 집중했습니다.
- **REST API 연동을 별도 스크립트로 분리한 이유**: Extension은 Zeplin 앱 안에서만 실행되어 디버깅이 번거롭습니다. `fetch-screen.js` + `generate-from-fixture.js`로 Zeplin 앱 없이도 알고리즘을 반복 검증할 수 있게 했습니다 (발표 시연에도 네트워크 의존성을 줄여줍니다).
- **순수 좌표 기반 휴리스틱을 택한 이유**: 별도의 ML/휴리스틱 라이브러리 없이도 "왜 이 레이아웃으로 판단했는지"를 발표에서 코드로 명확히 설명할 수 있기 때문입니다.

## 막혔던 부분과 해결 (또는 실패)

1. **막힘: 패딩이 있는 컨테이너는 column으로 인식되지 않음**
   카드 안에서 이미지는 풀블리드(x=0)인데 텍스트는 안쪽 패딩(x=16)이 있는 경우, 현재 알고리즘은 "x좌표가 tolerance 이내로 같아야 같은 열"이라는 단순 규칙을 쓰기 때문에 column으로 인식하지 못하고 `absolute` 폴백으로 빠집니다. (`test/inferLayout.test.js`의 "[알려진 한계]" 테스트로 재현)
   → **해결 실패로 남겨둠.** 자식들의 최소 x값을 컨테이너의 `padding-left`로 분리해서 재귀적으로 비교하면 개선 가능할 것으로 보이나, 이번 챌린지 범위에서는 구현하지 않았습니다. (발표에서 "만약 시간이 더 있었다면" 파트로 다룰 예정)
2. **막힘: 그리드 판별 시 오탐 방지**
   행 개수만 보고 그리드로 판단하면, 우연히 행마다 아이템 개수가 같은 비-그리드 레이아웃도 그리드로 오판할 수 있었습니다.
   → **해결**: 각 행의 x좌표 패턴(컬럼 위치)까지 일치하는지 확인하는 조건을 추가해 오탐률을 낮췄습니다 (`detectGrid` 함수).
3. **막힘: Node 환경에서 pnpm 워크스페이스 스크립트 실행**
   `node --test test` 형태로 디렉터리를 직접 넘기면 Windows 환경에서 모듈을 찾지 못하는 문제가 있었습니다.
   → **해결**: 글롭 패턴(`node --test "test/**/*.test.js"`)으로 테스트 파일을 명시적으로 지정해 해결했습니다.
4. **막힘: `zem build`(webpack 기반)가 pnpm 환경에서 `babel-loader`/`core-js`를 못 찾음**
   zem은 내부적으로 webpack + babel-loader + core-js(폴리필)를 사용하는데, 이들은 어디까지나 **zem 자신의 의존성**입니다. npm/yarn의 flat `node_modules`라면 우연히 최상위로 hoist되어 문제가 없었겠지만, pnpm은 기본적으로 "선언하지 않은 패키지는 보이지 않는" strict `node_modules` 구조라 webpack이 프로젝트 루트 기준으로 이 모듈들을 resolve하지 못해 빌드가 실패했습니다.
   → **해결**: `babel-loader`, `core-js`를 우리 패키지의 `devDependencies`에 직접 선언해서 pnpm이 해당 패키지의 `node_modules`에도 설치하도록 했습니다. npm 기준으로 작성된 CLI 도구를 pnpm 모노레포에 붙일 때 흔히 겪는 "phantom dependency" 문제의 실제 사례입니다.
5. **막힘: `generate:fixture`로 실제 화면을 뽑아보면 제플린 디자인과 완전히 다르게(레이아웃이 밀리고, 폰트/테두리 반경이 안 먹고, 이미지가 빈 박스로) 나옴**
   `fetch-screen.js`로 받은 실제 Zeplin REST API 응답을 직접 까본 결과, 이 프로젝트가 처음부터 가정하고 있던 레이어 스키마가 [공식 문서](https://docs.zeplin.dev/reference/layer)와 달랐다는 걸 확인했습니다.
   - `rect.x`/`rect.y`는 화면 절대좌표가 아니라 **바로 위 부모 레이어 기준 상대좌표**다 (화면 절대좌표는 `rect.absolute`로 따로 내려옴). 194개 레이어 전체를 루트부터 좌표를 누적해 `rect.absolute`와 비교했더니 오차 0으로 일치해 확인했습니다. 기존 알고리즘은 모든 rect가 이미 절대좌표라고 가정하고 부모 rect를 한 번 더 빼는 "이중 상대화"를 하고 있었습니다.
   - 필드명이 `borderRadius`/`textStyles`가 아니라 `border_radius`/`text_styles`(snake_case)였고, `text_styles[].style.font_family`, `border.fill.color`처럼 한 단계 더 감싸져 있었습니다.
   - 이미지 레이어 자신은 이미지 정보를 전혀 담고 있지 않고(`fills: []`, `layers: []`), 화면 응답 최상위의 `assets` 배열에 `layer_source_id`로 연결되어 별도로 내려옵니다.
     → **해결**: 원본 데이터를 내부 알고리즘이 기대하는 형태로 변환하는 어댑터(`src/layout/normalizeLayer.js`)를 추가해, `index.js`(Extension 진입점)와 `generate-from-fixture.js` 양쪽 모두 원본 데이터를 받으면 먼저 정규화하도록 했습니다. `inferLayout.js`/`buildHtml.js`/`buildCss.js` 등 핵심 로직과 기존 fixture 기반 테스트는 전혀 건드리지 않고, 입력 단계에서만 흡수하도록 설계했습니다.

## 실행 방법

```bash
# 의존성 설치 (루트에서)
pnpm install

# 알고리즘 단위 테스트
pnpm --filter zeplin-code-extension test

# fixture를 Vue 3 SFC(.vue)로 변환해서 미리보기 생성 (Zeplin 앱/계정 불필요)
# Zeplin 코드 패널에 표시되는 것과 동일한 buildVueSfc()를 사용해 data/generated.vue를 만든다.
pnpm --filter zeplin-code-extension generate:fixture
pnpm --filter zeplin-code-extension generate:fixture test/fixtures/sample-grid.json

# 위에서 생성한 data/generated.vue를 브라우저에서 실제 Vue 컴포넌트로 렌더링해서 확인
# (이 프로젝트 안에서만 쓰는 Vite + Vue 3 환경. zem 빌드에는 영향 없음)
pnpm --filter zeplin-code-extension dev
# → http://localhost:5173 접속. generate:fixture를 다시 실행한 뒤에는 브라우저를 새로고침한다.

# (선택) 실제 Zeplin 화면 데이터 가져오기 - .env 설정 필요 (.env.example 참고)
pnpm --filter zeplin-code-extension fetch:screen

# Zeplin 앱에 로컬 Extension으로 등록해서 실제 레이어에 적용해보기
pnpm --filter zeplin-code-extension start
# → http://127.0.0.1:7070/manifest.json 을 Zeplin 앱의 "Add Local Extension"에 등록
```

## 배포 (팀에서 URL로 계속 사용하기)

`zem start`는 로컬(`127.0.0.1`)에서만 접속 가능해 발표 시연 이후에는 팀원들이 쓸 수 없습니다.
실제로 계속 쓰려면 `zem build`로 만들어지는 **완전히 정적인 파일들**(`manifest.json`, `main.<hash>.js`, `README.md`)을 아무 정적 호스팅에 올리면 됩니다. 이 레포는 GitHub Actions로 GitHub Pages에 자동 배포하도록 구성했습니다.

```bash
# 로컬에서 직접 빌드 결과 확인하고 싶을 때
pnpm --filter zeplin-code-extension build
# apps/zeplin-code-extension/build/ 에 정적 파일 생성됨
```

### GitHub Pages 자동 배포 설정 (최초 1회)

1. GitHub 저장소 → **Settings → Pages** → **Source**를 **"GitHub Actions"**로 변경
2. `main` 브랜치에 `apps/zeplin-code-extension/**` 변경 사항을 push하면 `.github/workflows/deploy-zeplin-extension.yml` 워크플로우가 자동으로 빌드 → Pages 배포까지 진행합니다. (Actions 탭에서 수동 실행도 가능: `workflow_dispatch`)
3. 배포가 끝나면 아래 URL에서 접근 가능합니다.
   ```
   https://<github-user-or-org>.github.io/<repo-name>/zeplin-code-extension/manifest.json
   ```
   (예: `https://migugin.github.io/monorepo-react/zeplin-code-extension/manifest.json`)

### 팀원들이 사용하는 방법

Zeplin 앱(Mac/Windows/Web)에서 `Option`(Mac) 또는 `Alt`(Windows) 키를 누른 채로 프로젝트를 열면 상단 바에 **"Add Local Extension"**이 나타납니다. 여기에 위 `manifest.json` URL을 입력하면 팀원 누구나 로컬 서버 없이 바로 이 Extension을 사용할 수 있습니다.

> 참고: 공식 마켓플레이스(extensions.zeplin.io) 공개 배포는 `pnpm --filter zeplin-code-extension publish:ext`(내부적으로 `zem publish`)로 가능하지만, Zeplin 팀의 리뷰 승인이 필요해 발표 일정에는 맞지 않을 수 있어 이번 배포 방식에서는 제외했습니다. 필요해지면 추가로 안내해드릴 수 있습니다.

## 알려진 한계 / 다음 단계

- 텍스트 레이어의 `ranges`(한 텍스트 안 여러 스타일 혼합)는 지원하지 않고 대표 스타일 하나만 사용
- 컴포넌트 재사용성(같은 레이어가 여러 화면에 반복되는 경우)을 인식해 컴포넌트 단위로 묶는 기능은 없음
- padding 추론(위 "막혔던 부분" 1번) 개선
- `img` 태그의 `src`는 레이어에 `assets[0].url`이 있을 때만 채워진다. Zeplin 레이어 JSON은 이미지 바이너리를 직접 담지 않고 별도 asset export 응답으로 제공하는 경우가 많아, 해당 필드가 없는 데이터(예: 테스트 fixture)에서는 `src=""`로 남는다.
- 레이어 하나만 선택해서 변환(`layer()`)할 때는 화면 전체의 `assets` 배열에 접근할 수 없다(Zeplin이 context로 넘겨주지 않음). 따라서 이미지 레이어의 `src`가 채워지지 않을 수 있으며, 이미지 URL까지 정확히 뽑으려면 화면 단위(`screen()`)로 변환해야 한다.
