# 네이버 API 설정 가이드 🚀

이 프로젝트는 네이버 로컬 검색 API를 사용하여 실제 주변 식당 정보를 제공합니다.

## 📋 빠른 시작

### 1단계: 네이버 API 키 발급

#### 1-1. 네이버 개발자 센터 접속
[네이버 개발자 센터](https://developers.naver.com/)에 접속하여 네이버 계정으로 로그인합니다.

#### 1-2. 애플리케이션 등록
1. 상단 메뉴에서 **Application > 애플리케이션 등록** 클릭
2. 애플리케이션 정보 입력:
   - **애플리케이션 이름**: `점심 뭐먹지` (원하는 이름)
   - **사용 API**: **검색** 섹션에서 **지역** 체크 ✅
   - **비로그인 오픈 API 서비스 환경**:
     - **WEB 설정**: `http://localhost:5173` 추가
3. **등록하기** 클릭

#### 1-3. API 키 확인
등록 완료 후 다음 정보를 복사합니다:
- **Client ID**: 예) `abc123def456...`
- **Client Secret**: 예) `XYZ789...`

### 2단계: 환경 변수 설정

#### 2-1. .env 파일 생성
프로젝트 루트(`apps/lunch/`)에 `.env` 파일을 생성합니다:

```bash
cd apps/lunch
cp .env.example .env
```

#### 2-2. API 키 입력
`.env` 파일을 열어 발급받은 API 키를 입력합니다:

```env
# 네이버 Open API 키
NAVER_CLIENT_ID=여기에_Client_ID_입력
NAVER_CLIENT_SECRET=여기에_Client_Secret_입력

# 프록시 서버 포트 (기본값: 3001)
PORT=3001

# 프론트엔드에서 사용할 프록시 서버 URL
VITE_PROXY_URL=http://localhost:3001
```

⚠️ **중요**: `.env` 파일은 절대 Git에 커밋하지 마세요!

### 3단계: 의존성 설치

```bash
# 워크스페이스 루트에서 실행
pnpm install
```

### 4단계: 개발 서버 실행

#### 방법 1: 워크스페이스 루트에서 실행 (추천)
```bash
# 프로젝트 루트에서 실행
pnpm run dev:lunch:all
```

이 명령어는 다음을 동시에 실행합니다:
- 프론트엔드 개발 서버 (`http://localhost:5173`)
- 프록시 서버 (`http://localhost:3001`)

#### 방법 2: apps/lunch 디렉토리에서 실행
```bash
cd apps/lunch
pnpm run dev:all
```

#### 방법 3: 별도 터미널에서 실행
**터미널 1 - 프론트엔드:**
```bash
# 루트에서
pnpm run dev:lunch

# 또는 apps/lunch에서
cd apps/lunch
pnpm run dev
```

**터미널 2 - 프록시 서버:**
```bash
# 루트에서
pnpm run dev:lunch:proxy

# 또는 apps/lunch에서
cd apps/lunch
pnpm run dev:proxy
```

### 5단계: 브라우저에서 확인

`http://localhost:5173`에 접속하면 자동으로 주변 식당 검색이 시작됩니다! 🎉

---

## 🏗️ 아키텍처

```
┌─────────────┐        ┌──────────────┐        ┌─────────────┐
│  Browser    │───────▶│ Proxy Server │───────▶│ Naver API   │
│ (React App) │        │ (Express.js) │        │ (Local API) │
│ :5173       │◀───────│ :3001        │◀───────│             │
└─────────────┘        └──────────────┘        └─────────────┘
     ↑                        ↑
     │                        │
     │                  .env 파일의
     └─── API 호출      API 키 사용
```

### 왜 프록시 서버가 필요한가요?

네이버 API는 **CORS (Cross-Origin Resource Sharing)** 정책으로 인해 브라우저에서 직접 호출할 수 없습니다. 따라서:

1. 프론트엔드 → 프록시 서버로 요청
2. 프록시 서버 → 네이버 API 호출 (서버 간 통신은 CORS 제약 없음)
3. 네이버 API → 프록시 서버로 응답
4. 프록시 서버 → 프론트엔드로 응답

---

## 🔧 트러블슈팅

### 문제 1: "API 연결 오류" 메시지가 표시됩니다

**원인:**
- 프록시 서버가 실행되지 않았거나
- `.env` 파일의 API 키가 잘못되었습니다

**해결방법:**
1. 프록시 서버 실행 확인:
   ```bash
   # 터미널에 다음과 같은 메시지가 표시되어야 합니다:
   # 🚀 Proxy server running on http://localhost:3001
   # 🔑 API Keys configured: true
   ```

2. API 키 확인:
   - `.env` 파일이 `apps/lunch/` 디렉토리에 있는지 확인
   - Client ID와 Secret이 정확히 입력되었는지 확인
   - 따옴표 없이 값만 입력했는지 확인

3. 프록시 서버 재시작:
   ```bash
   # Ctrl+C로 중지 후 다시 실행
   pnpm run dev:proxy
   ```

### 문제 2: 포트 3001이 이미 사용 중입니다

**원인:**
다른 프로세스가 포트 3001을 사용하고 있습니다.

**해결방법:**
1. 포트를 사용하는 프로세스 찾기:
   ```bash
   # macOS/Linux
   lsof -i :3001
   
   # Windows
   netstat -ano | findstr :3001
   ```

2. 해당 프로세스 종료 또는 다른 포트 사용:
   ```env
   # .env 파일에서 포트 변경
   PORT=3002
   VITE_PROXY_URL=http://localhost:3002
   ```

### 문제 3: "검색 결과 없음" 메시지

**원인:**
- 입력한 주소 근처에 식당이 없거나
- 주소 형식이 정확하지 않을 수 있습니다

**해결방법:**
1. 주소를 더 일반적으로 입력:
   - ❌ "서울 서초구 강남대로27길 9"
   - ✅ "서울 강남구"
   
2. 카테고리를 "전체"로 변경하여 검색

### 문제 4: API 사용량 초과

네이버 지역 검색 API는 **일일 25,000회** 호출 제한이 있습니다.

**해결방법:**
- 여러 애플리케이션을 등록하여 사용
- 다음 날까지 대기
- 개발 중에는 모킹 데이터로 테스트

---

## 🔒 보안 주의사항

### ⚠️ 중요: API 키 보안

1. **절대 공개 저장소에 커밋하지 마세요!**
   ```bash
   # .gitignore에 다음이 포함되어 있는지 확인
   .env
   .env.local
   ```

2. **환경 변수로만 관리하세요**
   - 코드에 직접 하드코딩 ❌
   - .env 파일 사용 ✅

3. **프로덕션 배포 시**
   - 서버 측 환경 변수로 설정
   - Vercel, Netlify 등의 환경 변수 설정 기능 사용

---

## 📚 추가 자료

- [네이버 개발자 센터](https://developers.naver.com/)
- [지역 검색 API 명세](https://developers.naver.com/docs/serviceapi/search/local/local.md)
- [네이버 오픈 API 이용 정책](https://developers.naver.com/docs/common/openapiguide/apilist.md)

---

## 🎯 다음 단계

API 연동이 완료되면 다음 기능을 추가해보세요:

- 🗺️ **지도 연동**: 네이버 지도 API로 식당 위치 표시
- ⭐ **리뷰 통합**: 네이버 블로그 리뷰 API 활용
- 📞 **전화 연결**: 전화번호 클릭 시 전화 앱 실행
- 💾 **즐겨찾기**: 자주 가는 식당 저장 기능
- 📊 **통계**: 방문 기록 및 선호도 분석

---

궁금한 점이 있으시면 이슈를 등록해주세요! 🙋‍♂️

