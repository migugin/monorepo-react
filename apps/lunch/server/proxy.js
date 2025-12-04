import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// .env 파일 로드 (apps/lunch/ 루트의 .env 파일)
dotenv.config({ path: resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// CORS 설정
app.use(cors());
app.use(express.json());

// 환경 변수에서 네이버 API 키 가져오기
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

// 네이버 로컬 검색 API 프록시
app.get('/api/naver/local', async (req, res) => {
  try {
    // API 키 확인
    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
      return res.status(500).json({
        error: 'Missing API credentials',
        message: 'NAVER_CLIENT_ID and NAVER_CLIENT_SECRET must be set in environment variables',
      });
    }

    const { query, display = 20, start = 1, sort = 'random' } = req.query;

    if (!query) {
      return res.status(400).json({
        error: 'Missing query parameter',
        message: 'query parameter is required',
      });
    }

    const params = new URLSearchParams({
      query,
      display: display.toString(),
      start: start.toString(),
      sort,
    });

    console.log(`[API Request] Query: ${query}, Display: ${display}`);

    const naverResponse = await fetch(
      `https://openapi.naver.com/v1/search/local.json?${params}`,
      {
        method: 'GET',
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
        },
      }
    );

    if (!naverResponse.ok) {
      const errorText = await naverResponse.text();
      console.error(`[API Error] Status: ${naverResponse.status}, Message: ${errorText}`);
      return res.status(naverResponse.status).json({
        error: 'Naver API request failed',
        status: naverResponse.status,
        message: errorText,
      });
    }

    const data = await naverResponse.json();
    console.log(`[API Success] Found ${data.items.length} items (total: ${data.total}, start: ${data.start}, display: ${data.display})`);
    
    // 응답 데이터 샘플 출력 (디버깅용)
    if (data.items.length > 0) {
      console.log(`[Sample] ${data.items[0].title} - ${data.items[0].category}`);
    }
    
    res.json(data);
  } catch (error) {
    console.error('[Proxy Error]', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// 헬스 체크 엔드포인트
app.get('/health', (req, res) => {
  const hasApiKeys = !!(NAVER_CLIENT_ID && NAVER_CLIENT_SECRET);
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    apiConfigured: hasApiKeys,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
  console.log(`📍 Naver API proxy: http://localhost:${PORT}/api/naver/local`);
  console.log(`🔑 API Keys configured: ${!!(NAVER_CLIENT_ID && NAVER_CLIENT_SECRET)}`);
  
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.warn('⚠️  Warning: NAVER_CLIENT_ID or NAVER_CLIENT_SECRET not set!');
    console.warn('   Please set them in .env file');
  }
});

