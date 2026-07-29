// 로컬 JSON을 읽어 Vue 3 SFC(<template> + <style scoped lang="scss">) 파일로 변환해 저장한다.
// Zeplin 앱 없이도 변환 결과를 에디터/브라우저(pnpm dev)에서 바로 확인할 수 있다.
//
// 인자를 주지 않으면 fetch-screen.js가 data/에 저장해둔 screen-<id>.json 중 가장 최근 것을
// 자동으로 찾아서 사용한다 (매번 파일 경로를 직접 넘길 필요가 없다).
//
// 사용법:
//   node scripts/generate-from-fixture.js                              (가장 최근에 fetch한 실제 데이터 사용)
//   node scripts/generate-from-fixture.js data/screen-<id>.json         (특정 실제 데이터 지정)
//   node scripts/generate-from-fixture.js test/fixtures/sample-grid.json (데모 fixture로 알고리즘만 확인하고 싶을 때)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { buildComponent, buildRootFromLayers } from "../src/layout/buildHtml.js";
import { buildVueSfc } from "../src/layout/buildVueSfc.js";
import { normalizeLayer, buildAssetIndexBySourceId } from "../src/layout/normalizeLayer.js";

const DATA_DIR = resolve(import.meta.dirname, "../data");
const FETCHED_SCREEN_FILE_PATTERN = /^screen-.+\.json$/;

/**
 * data/ 안에서 fetch-screen.js가 저장한 screen-<id>.json 중 가장 최근에 수정된 파일을 찾는다.
 * data/ 자체가 없거나(최초 클론 직후) 아직 fetch한 적이 없으면 undefined를 반환한다.
 * @returns {string|undefined} 가장 최근에 fetch한 화면 JSON의 절대 경로
 */
function findLatestFetchedScreenPath() {
  let fileNames;
  try {
    fileNames = readdirSync(DATA_DIR);
  } catch {
    return undefined;
  }

  const fetchedScreenPaths = fileNames
    .filter((fileName) => FETCHED_SCREEN_FILE_PATTERN.test(fileName))
    .map((fileName) => resolve(DATA_DIR, fileName));

  if (fetchedScreenPaths.length === 0) return undefined;

  return fetchedScreenPaths.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

/**
 * 변환할 입력 파일 경로를 결정한다.
 * 인자가 있으면 그대로 쓰고(특정 실제 데이터 또는 데모 fixture 지정 시), 없으면 가장 최근에
 * fetch한 실제 데이터를 자동으로 찾는다. 둘 다 없으면 데모로 조용히 폴백하지 않고 바로 안내한다.
 * @returns {string} 변환할 입력 JSON 파일의 절대 경로
 */
function resolveInputPath() {
  const explicitPath = process.argv[2];
  if (explicitPath) return resolve(process.cwd(), explicitPath);

  const latestFetchedScreenPath = findLatestFetchedScreenPath();
  if (!latestFetchedScreenPath) {
    throw new Error(
      "data/ 에 fetch한 실제 Zeplin 데이터(screen-*.json)가 없습니다. 먼저 `pnpm fetch:zeplin`을 실행해주세요.\n" +
        "(데모 fixture로 확인하려면: node scripts/generate-from-fixture.js test/fixtures/sample-card.json)"
    );
  }
  return latestFetchedScreenPath;
}

function toRootLayer(rawData) {
  const isSingleLayer = Boolean(rawData.rect);
  if (isSingleLayer) return normalizeLayer(rawData);

  const assetIndexBySourceId = buildAssetIndexBySourceId(rawData.assets);
  const normalizedLayers = (rawData.layers ?? []).map((child) => normalizeLayer(child, { assetIndexBySourceId }));
  return buildRootFromLayers(normalizedLayers, rawData.name ?? "screen");
}

/**
 * 입력 JSON을 읽어 Vue SFC로 변환한 뒤 data/generated.vue로 저장한다.
 * @returns {void}
 */
function main() {
  const inputPath = resolveInputPath();
  const rawData = JSON.parse(readFileSync(inputPath, "utf-8"));
  const rootLayer = toRootLayer(rawData);

  const { html, css } = buildComponent(rootLayer);

  mkdirSync(DATA_DIR, { recursive: true });
  const outputPath = resolve(DATA_DIR, "generated.vue");
  writeFileSync(outputPath, `${buildVueSfc(html, css)}\n`, "utf-8");

  console.log(`입력: ${inputPath}`);
  console.log(`Vue SFC 생성 완료: ${outputPath}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
