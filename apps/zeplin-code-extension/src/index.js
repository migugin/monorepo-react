import { buildComponent, buildRootFromLayers } from "./layout/buildHtml.js";
import { buildVueSfc } from "./layout/buildVueSfc.js";

// 레이어를 선택했을 때 호출된다 (버튼, 카드 등 특정 레이어 단위 변환)
function layer(context, selectedLayer) {
  const { html, css } = buildComponent(selectedLayer);
  return { code: buildVueSfc(html, css), language: "vue" };
}

// 화면 전체를 변환할 때 호출된다
function screen(context, selectedScreen) {
  const rootLayer = buildRootFromLayers(selectedScreen.layers ?? [], selectedScreen.name);
  const { html, css } = buildComponent(rootLayer);
  return { code: buildVueSfc(html, css), language: "vue" };
}

export default { layer, screen };
