// 로컬 JSON(테스트 fixture 또는 fetch-screen.js로 받아온 실제 데이터)을 읽어
// Vue 3 SFC(<template> + <style scoped lang="scss">) 파일로 변환해 저장한다.
// Zeplin 앱 없이도 변환 결과를 에디터에서 바로 열어 확인할 수 있다.
//
// 사용법:
//   node scripts/generate-from-fixture.js                              (기본 fixture 사용)
//   node scripts/generate-from-fixture.js test/fixtures/sample-grid.json
//   node scripts/generate-from-fixture.js data/screen-<id>.json
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { buildComponent, buildRootFromLayers } from "../src/layout/buildHtml.js";
import { buildVueSfc } from "../src/layout/buildVueSfc.js";

const DEFAULT_FIXTURE_PATH = resolve(import.meta.dirname, "../test/fixtures/sample-card.json");

// fixture 파일은 layer 객체(rect 있음)이거나, Zeplin API의 screen version 응답(최상위에 rect 없음)일 수 있다
function toRootLayer(rawData) {
  const isSingleLayer = Boolean(rawData.rect);
  if (isSingleLayer) return rawData;
  return buildRootFromLayers(rawData.layers ?? [], rawData.name ?? "screen");
}

function main() {
  const inputPath = resolve(process.cwd(), process.argv[2] ?? DEFAULT_FIXTURE_PATH);
  const rawData = JSON.parse(readFileSync(inputPath, "utf-8"));
  const rootLayer = toRootLayer(rawData);

  const { html, css } = buildComponent(rootLayer);

  const outputDir = resolve(import.meta.dirname, "../data");
  mkdirSync(outputDir, { recursive: true });

  const outputPath = resolve(outputDir, "generated.vue");
  writeFileSync(outputPath, `${buildVueSfc(html, css)}\n`, "utf-8");

  console.log(`입력: ${inputPath}`);
  console.log(`Vue SFC 생성 완료: ${outputPath}`);
}

main();
