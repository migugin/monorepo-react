import { buildComponent, buildRootFromLayers } from "./layout/buildHtml.js";
import { buildVueSfc } from "./layout/buildVueSfc.js";
import { normalizeLayer, buildAssetIndexBySourceId } from "./layout/normalizeLayer.js";

// 레이어를 선택했을 때 호출된다 (버튼, 카드 등 특정 레이어 단위 변환)
// 단일 레이어 선택 시에는 화면 전체의 assets 목록에 접근할 수 없어(Zeplin이 context에 넘겨주지 않음),
// 이미지 레이어의 src는 채워지지 않을 수 있다 (README "알려진 한계" 참고).
function layer(context, selectedLayer) {
  const normalizedLayer = normalizeLayer(selectedLayer);
  const { html, css } = buildComponent(normalizedLayer);
  return { code: buildVueSfc(html, css), language: "vue" };
}

// 화면 전체를 변환할 때 호출된다
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
