import { inferLayout, toRelativeRect } from "./inferLayout.js";
import { mapSemanticTag, toClassName } from "./mapSemanticTag.js";
import { extractVisualStyles, extractTextStyles, stylesToCssRule } from "./buildCss.js";

const SELF_CLOSING_TAGS = new Set(["img", "input"]);
const INDENT_UNIT = "  ";

function isTextLayer(layer) {
  return layer.type === "text";
}

function indentLine(line, depth) {
  return `${INDENT_UNIT.repeat(depth)}${line}`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(text) {
  return escapeHtml(text)
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * self-closing 태그(img, input)에 필요한 속성 문자열을 만든다.
 * img는 Zeplin 레이어 JSON에 이미지 바이너리가 없고 별도 asset export 응답에서
 * URL을 받아와야 하므로, assets[0].url이 있으면 사용하고 없으면 빈 문자열로 남겨
 * 연동 시 채워 넣어야 함을 명확히 한다. input은 alt 대신 시맨틱에 맞는 placeholder/type을 채운다.
 * @param {string} tag - "img" 또는 "input"
 * @param {object} layer - Zeplin 레이어 객체
 * @returns {string} 태그에 삽입할 속성 문자열
 */
function buildSelfClosingAttributes(tag, layer) {
  if (tag === "img") {
    const src = layer.assets?.[0]?.url ?? "";
    return `src="${escapeAttribute(src)}" alt="${escapeAttribute(layer.name)}"`;
  }

  if (tag === "input") {
    return `type="text" placeholder="${escapeAttribute(layer.name)}"`;
  }

  return "";
}

function toUniqueClassName(layerName, usedClassNameCounts) {
  const baseClassName = toClassName(layerName);
  const usedCount = usedClassNameCounts.get(baseClassName) ?? 0;
  usedClassNameCounts.set(baseClassName, usedCount + 1);

  if (usedCount === 0) return baseClassName;
  return `${baseClassName}-${usedCount}`;
}

function toCssStyles(layoutResult) {
  const { fallback, ...cssStyles } = layoutResult;
  return cssStyles;
}

/**
 * 자식 레이어 목록을 순서대로, 부모보다 한 단계 깊은 들여쓰기가 적용된 HTML 문자열로 변환한다.
 * layoutResult.fallback이 "absolute-children"이면, 세 가지 레이아웃 패턴(flex-row/column/grid)에
 * 모두 해당하지 않아 부모가 이미 position:relative로 전환된 상태이므로, 각 자식에게 부모 기준
 * 상대좌표를 position:absolute + left/top으로 부여해 원본 좌표를 그대로 재현한다.
 * @param {object} parentLayer - 자식들의 부모 레이어 (상대좌표 계산 기준, rect 필요)
 * @param {Array<object>} childLayers - 부모 레이어의 layers 배열
 * @param {object} layoutResult - 부모에 대해 inferLayout()이 반환한 레이아웃 정보
 * @param {Map<string, number>} usedClassNameCounts - 클래스명 중복 방지용 카운터
 * @param {Array<string>} cssRules - CSS 규칙이 누적되는 배열
 * @param {number} depth - 자식들에게 적용할 들여쓰기 깊이
 * @returns {string} 자식 레이어들의 HTML을 이어붙인 문자열
 */
function buildChildrenHtml(parentLayer, childLayers, layoutResult, usedClassNameCounts, cssRules, depth) {
  const needsAbsolutePosition = layoutResult.fallback === "absolute-children";

  return childLayers
    .map((child) => {
      const absolutePosition = needsAbsolutePosition ? toRelativeRect(child.rect, parentLayer.rect) : undefined;
      return walkLayer(child, usedClassNameCounts, cssRules, absolutePosition, depth);
    })
    .join("\n");
}

/**
 * 레이어 하나를 들여쓰기가 적용된 HTML 엘리먼트 문자열로 변환하고, 해당 레이어의 CSS 규칙을 cssRules에 누적한다.
 * 자식이 2개 이상이면 좌표를 분석해 flex/grid 레이아웃을 함께 추론한다.
 * 결과물은 Vue의 <template> 블록에 그대로 들어가므로, 자식이 있으면 여는/닫는 태그를 별도 줄로 분리하고
 * 그 사이의 자식들을 한 단계 들여써서 가독성을 높인다.
 * @param {object} layer - Zeplin 레이어 객체 (rect, type, fills, layers 등 포함)
 * @param {Map<string, number>} usedClassNameCounts - 클래스명 중복 방지용 카운터
 * @param {Array<string>} cssRules - CSS 규칙이 누적되는 배열
 * @param {{x:number,y:number}} [absolutePosition] - 부모가 absolute 폴백일 때 부여할 상대좌표
 * @param {number} [depth=0] - 현재 레이어의 들여쓰기 깊이
 * @returns {string} 해당 레이어의 HTML 문자열
 */
function walkLayer(layer, usedClassNameCounts, cssRules, absolutePosition, depth = 0) {
  const tag = mapSemanticTag(layer);
  const className = toUniqueClassName(layer.name, usedClassNameCounts);
  const childLayers = layer.layers ?? [];

  const styles = {
    width: layer.rect?.width,
    height: layer.rect?.height,
    ...extractVisualStyles(layer)
  };

  if (absolutePosition) {
    styles.position = "absolute";
    styles.left = absolutePosition.x;
    styles.top = absolutePosition.y;
  }

  if (isTextLayer(layer)) Object.assign(styles, extractTextStyles(layer));

  const layoutResult = childLayers.length > 1 ? inferLayout(layer, childLayers) : { display: "block" };
  if (childLayers.length > 1) Object.assign(styles, toCssStyles(layoutResult));

  const cssRule = stylesToCssRule(`.${className}`, styles);
  if (cssRule) cssRules.push(cssRule);

  if (SELF_CLOSING_TAGS.has(tag)) {
    return indentLine(`<${tag} class="${className}" ${buildSelfClosingAttributes(tag, layer)} />`, depth);
  }

  if (isTextLayer(layer)) {
    const content = escapeHtml(layer.content ?? layer.name);
    return indentLine(`<${tag} class="${className}">${content}</${tag}>`, depth);
  }

  if (childLayers.length === 0) {
    return indentLine(`<${tag} class="${className}"></${tag}>`, depth);
  }

  const childrenHtml = buildChildrenHtml(layer, childLayers, layoutResult, usedClassNameCounts, cssRules, depth + 1);
  const openTag = indentLine(`<${tag} class="${className}">`, depth);
  const closeTag = indentLine(`</${tag}>`, depth);

  return [openTag, childrenHtml, closeTag].join("\n");
}

export function buildComponent(rootLayer) {
  const usedClassNameCounts = new Map();
  const cssRules = [];

  const html = walkLayer(rootLayer, usedClassNameCounts, cssRules);
  const css = cssRules.join("\n\n");

  return { html, css };
}

/**
 * 화면(screen)의 최상위 layers 배열은 그 자체로 rect를 갖지 않기 때문에,
 * 자식들의 바운딩 박스를 계산해 가상의 루트 레이어를 만들어준다.
 * @param {Array<object>} layers - 화면의 최상위 레이어 목록
 * @param {string} [name] - 가상 루트 레이어에 사용할 이름
 * @returns {object} rect와 layers를 가진 가상 루트 레이어
 */
export function buildRootFromLayers(layers, name = "screen") {
  if (layers.length === 0) {
    return { name, type: "group", rect: { x: 0, y: 0, width: 0, height: 0 }, layers: [] };
  }

  const minX = Math.min(...layers.map((child) => child.rect.x));
  const minY = Math.min(...layers.map((child) => child.rect.y));
  const maxX = Math.max(...layers.map((child) => child.rect.x + child.rect.width));
  const maxY = Math.max(...layers.map((child) => child.rect.y + child.rect.height));

  return {
    name,
    type: "group",
    rect: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    layers
  };
}
