// Zeplin REST API에서 화면(screen)의 최신 버전 레이어 데이터를 가져와 로컬 JSON으로 저장한다.
// zem 기반 Extension은 Zeplin 앱 안에서만 실행되기 때문에, 앱 없이도 데이터를 확인/디버깅하기 위한 보조 스크립트다.
//
// 사용법:
//   node --env-file=.env scripts/fetch-screen.js
//
// 필요한 환경변수 (.env 참고):
//   ZEPLIN_ACCESS_TOKEN - https://app.zeplin.io/profile/developer 에서 발급한 Personal Access Token
//   ZEPLIN_PROJECT_ID   - Zeplin 프로젝트 ID (Zeplin 웹앱 URL에서 확인 가능)
//   ZEPLIN_SCREEN_ID    - Zeplin 화면 ID (Zeplin 웹앱 URL에서 확인 가능)
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const API_BASE_URL = "https://api.zeplin.dev/v1";

function readRequiredEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`환경변수 ${key}가 설정되지 않았습니다. .env.example을 참고해 .env를 채워주세요.`);
  }
  return value;
}

// 화면의 최신 버전(레이어 트리 포함)을 가져온다
async function fetchLatestScreenVersion(projectId, screenId, accessToken) {
  const url = `${API_BASE_URL}/projects/${projectId}/screens/${screenId}/versions/latest`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Zeplin API 요청 실패 (${response.status}): ${body}\n` +
        "엔드포인트가 바뀌었을 수 있으니 https://docs.zeplin.dev/reference 를 확인하세요."
    );
  }

  return response.json();
}

async function main() {
  const accessToken = readRequiredEnv("ZEPLIN_ACCESS_TOKEN");
  const projectId = readRequiredEnv("ZEPLIN_PROJECT_ID");
  const screenId = readRequiredEnv("ZEPLIN_SCREEN_ID");

  const screenVersion = await fetchLatestScreenVersion(projectId, screenId, accessToken);

  const outputDir = resolve(import.meta.dirname, "../data");
  mkdirSync(outputDir, { recursive: true });

  const outputPath = resolve(outputDir, `screen-${screenId}.json`);
  writeFileSync(outputPath, JSON.stringify(screenVersion, null, 2), "utf-8");

  console.log(`저장 완료: ${outputPath}`);
  console.log(`레이어 개수: ${screenVersion.layers?.length ?? 0}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
