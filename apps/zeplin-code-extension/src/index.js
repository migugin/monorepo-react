import { buildComponent, buildRootFromLayers } from "./layout/buildHtml.js";
import { buildVueSfc } from "./layout/buildVueSfc.js";
import { normalizeLayer, buildAssetIndexBySourceId } from "./layout/normalizeLayer.js";

function layer(context, selectedLayer) {
  const normalizedLayer = normalizeLayer(selectedLayer);
  const { html, css } = buildComponent(normalizedLayer);
  return { code: buildVueSfc(html, css), language: "vue" };
}

/**
 * 화면 전체를 변환할 때 호출된다. 화면 최상위 assets 배열로 이미지 URL 조회 테이블을 만든 뒤,
 * 최상위 레이어들을 정규화해 하나의 루트 레이어로 묶어 HTML/CSS를 생성한다.
 * @param {object} context - Zeplin이 전달하는 실행 컨텍스트
 * @param {object} selectedScreen - 선택된 Zeplin 화면(screen) 객체
 * @returns {{code: string, language: string}} Vue SFC 코드 스니펫
 */
function screen(context, selectedScreen) {
  const assetIndexBySourceId = buildAssetIndexBySourceId(selectedScreen.assets);
  const normalizedLayers = (selectedScreen.layers ?? []).map((child) =>
    normalizeLayer(child, { assetIndexBySourceId })
  );

  const rootLayer = buildRootFromLayers(normalizedLayers, selectedScreen.name);
  const { html, css } = buildComponent(rootLayer);
  return { code: buildVueSfc(html, css), language: "vue" };
}

export default { layer, screen };
