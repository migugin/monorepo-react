import { buildComponent, buildRootFromLayers } from "./layout/buildHtml.js";

// HTML과 CSS를 하나의 코드 스니펫으로 합쳐서 Zeplin 코드 패널에 보여준다
function toSnippet(html, css) {
  return `${html}\n\n<style>\n${css}\n</style>`;
}

// 레이어를 선택했을 때 호출된다 (버튼, 카드 등 특정 레이어 단위 변환)
function layer(context, selectedLayer) {
  const { html, css } = buildComponent(selectedLayer);
  return { code: toSnippet(html, css), language: "html" };
}

// 화면 전체를 변환할 때 호출된다
function screen(context, selectedScreen) {
  const rootLayer = buildRootFromLayers(selectedScreen.layers ?? [], selectedScreen.name);
  const { html, css } = buildComponent(rootLayer);
  return { code: toSnippet(html, css), language: "html" };
}

export default { layer, screen };
