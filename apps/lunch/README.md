# 점심 뭐먹지? 🍱

주변 식당을 검색하고 랜덤으로 추천받는 점심 메뉴 추천 서비스입니다.

## 주요 기능

- 📍 위치 기반 주변 식당 검색 (네이버 로컬 API)
- 🎲 랜덤 식당 추천 (룰렛 애니메이션)
- 🏷️ 카테고리별 필터링
- 💾 주소 정보 로컬 저장
- 🔄 실시간 데이터 업데이트

## 기술 스택

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Framework**: Tailwind CSS + shadcn/ui
- **Package Manager**: pnpm
- **API**: 네이버 로컬 검색 API
- **Proxy Server**: Express.js

## 시작하기

### 필수 요구사항

- Node.js 18+ ([nvm으로 설치](https://github.com/nvm-sh/nvm#installing-and-updating))
- pnpm 8+ (`npm install -g pnpm`)

### 설치 및 실행

```sh
# Step 1: 저장소 클론
git clone <YOUR_GIT_URL>

# Step 2: 프로젝트 디렉토리로 이동
cd <YOUR_PROJECT_NAME>

# Step 3: 의존성 설치
pnpm install

# Step 4: 네이버 API 환경 변수 설정
cd apps/lunch
cp env.example.txt .env
# .env 파일을 열어 실제 API 키를 입력하세요

# Step 5: 개발 서버 실행
pnpm run dev:all
```

## 🔑 네이버 API 설정

이 앱은 네이버 로컬 검색 API를 사용하여 실제 주변 식당 정보를 제공합니다.

### 1. 네이버 API 키 발급

1. [네이버 개발자 센터](https://developers.naver.com/) 접속 및 로그인
2. **Application > 애플리케이션 등록** 클릭
3. 애플리케이션 정보 입력:
   - 애플리케이션 이름: `점심 뭐먹지`
   - 사용 API: **검색 > 지역** 선택 ✅
   - WEB 설정: `http://localhost:5173` 추가
4. **Client ID**와 **Client Secret** 발급받기

### 2. 환경 변수 설정

`apps/lunch/.env` 파일을 생성하고 발급받은 API 키를 입력합니다:

```env
NAVER_CLIENT_ID=여기에_Client_ID_입력
NAVER_CLIENT_SECRET=여기에_Client_Secret_입력
PORT=3001
VITE_PROXY_URL=http://localhost:3001
```

⚠️ **주의**: `.env` 파일은 절대 Git에 커밋하지 마세요!

### 3. 실행 방법

**방법 1: apps/lunch 디렉토리에서 실행**

```bash
cd apps/lunch

# 프론트엔드와 프록시 서버를 동시에 실행
pnpm run dev:all

# 또는 별도 터미널에서
pnpm run dev         # 터미널 1: 프론트엔드
pnpm run dev:proxy   # 터미널 2: 프록시 서버
```

**방법 2: 워크스페이스 루트에서 실행 (권장)**

```bash
# 프로젝트 루트에서 실행
pnpm run dev:lunch:all

# 또는 별도 터미널에서
pnpm run dev:lunch        # 터미널 1: 프론트엔드
pnpm run dev:lunch:proxy  # 터미널 2: 프록시 서버
```

브라우저에서 `http://localhost:5173`에 접속하세요!

더 자세한 내용은 [SETUP_GUIDE.md](./SETUP_GUIDE.md)를 참조하세요.

## 프로젝트 구조

```
apps/lunch/
├── src/
│   ├── components/        # UI 컴포넌트
│   ├── services/         # API 서비스
│   │   └── naverApi.ts   # 네이버 API 통신
│   ├── pages/            # 페이지 컴포넌트
│   ├── types/            # TypeScript 타입
│   └── data/             # 모킹 데이터
├── server/               # 프록시 서버
│   └── proxy.js          # Express 프록시
├── .env                  # 환경 변수 (Git 무시)
└── package.json
```

## 배포

### Vercel 배포

```bash
# Vercel CLI 설치
pnpm add -g vercel

# 배포
vercel

# 환경 변수 설정
vercel env add NAVER_CLIENT_ID
vercel env add NAVER_CLIENT_SECRET
```

### 다른 플랫폼

- Netlify, Cloudflare Pages 등에 배포 시 환경 변수를 플랫폼의 설정 페이지에서 추가하세요.
- 프록시 서버도 함께 배포되어야 합니다.

## 라이선스

MIT

## 기여

이슈 및 풀 리퀘스트를 환영합니다! 🙋‍♂️
