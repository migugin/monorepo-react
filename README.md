# 📁 Monorepo 신규 프로젝트 추가 가이드

이 문서는 `react-apps` 모노레포에 새로운 React 프로젝트를 추가할 때 반드시 수행해야 하는 설정 절차를 정리합니다.
새 프로젝트는 기본적으로 `apps/<project-name>` 경로에 위치합니다.

## 1. 프로젝트 디렉터리 생성
```bash
mkdir -p apps/<project-name>
cd apps/<project-name>
```

예시:
```bash
mkdir -p apps/admin
```

---

## 2. React(Vite) 프로젝트 초기화
```bash
pnpm create vite@latest
```

또는 필요한 템플릿을 선택.

---

## 3. package.json 설정
### 3-1. `"name"` 필드 설정

`apps/<project-name>/package.json` 안에 다음 항목을 반드시 설정합니다.
```json
{
  "name": "<project-name>",
  "version": "0.0.1"
}
```
### 3-2. scripts 기본 형태 확인
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

---

## 4. tsconfig 설정

루트 설정(`tsconfig.base.json`)을 확장하도록 구성합니다.

`apps/<project-name>/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": {
    "types": ["vite/client"]
  }
}
```

---

## 5. 루트 pnpm 설정 확인

새로운 프로젝트는 자동으로 워크스페이스에 포함됩니다.
다만 `pnpm-workspace.yaml` 내부에 다음 설정이 반드시 있어야 합니다.

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

## 6. 공통 의존성 설치

루트에서 실행:

```bash
pnpm install
```


pnpm은 워크스페이스 기반으로 공통 의존성은 루트, 개별 의존성은 각 앱에 설치합니다.

---

## 7. 루트 `package.json` 에 실행 스크립트 추가

새 프로젝트를 쉽게 실행할 수 있도록 루트에 스크립트를 추가합니다.

`package.json`:

```json
{
  "scripts": {
    "dev:<project-name>": "pnpm --filter <project-name> dev",
    "build": "pnpm -r build"
  }
}
```

예시:

```bash
"dev:admin": "pnpm --filter admin dev"
```

---

## 8. ESLint / Prettier 적용 (선택)

공통 설정을 쓰는 경우:

`apps/<project-name>/.eslintrc.cjs`:

```js
module.exports = {
  extends: ["../../eslint.config.js"]
};
```

또는 패키지 형태의 config를 사용하는 경우:

```js
module.exports = {
  extends: ["@react-apps/config/eslint"]
};
```

---

## 9. 실행 확인

```bash
pnpm dev:<project-name>
```

앱이 정상 동작하는지 확인합니다.

---

## 10. Git 커밋

```bash
git add .
git commit -m "[feat] add <project-name>"
```