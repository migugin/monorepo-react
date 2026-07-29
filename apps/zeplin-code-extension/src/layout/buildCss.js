function toKebabCase(propertyName) {
  return propertyName.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

// px 단위가 필요한 숫자 값인지 판단한다 (opacity, flex 등은 단위 없이 사용)
// lineHeight는 여기 포함하지 않는다: Zeplin이 제공하는 lineHeight는 배수(unitless multiplier)가 아니라
// 절대 px 값이라, 단위 없이 출력하면 "font-size의 N배"로 잘못 해석되어 줄 높이가 크게 어긋난다.
const UNITLESS_PROPERTIES = new Set(["opacity", "flex", "fontWeight"]);

function withUnit(propertyName, value) {
  if (typeof value !== "number") return value;
  if (UNITLESS_PROPERTIES.has(propertyName)) return value;
  return `${value}px`;
}

export function colorToRgba(color) {
  if (!color) return "transparent";
  const alpha = color.a ?? 1;
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

/**
 * shape/group 레이어에서 배경색, 테두리, 둥근 모서리 등 시각 스타일을 추출한다.
 * @param {object} layer - Zeplin 레이어 객체
 * @returns {object} CSS-in-JS 형태의 스타일 선언
 */
export function extractVisualStyles(layer) {
  const styles = {};

  const fill = layer.fills?.[0];
  if (fill?.color) styles.backgroundColor = colorToRgba(fill.color);

  const border = layer.borders?.[0];
  if (border?.color) {
    const thickness = border.thickness ?? 1;
    styles.border = `${thickness}px solid ${colorToRgba(border.color)}`;
  }

  if (layer.borderRadius) styles.borderRadius = layer.borderRadius;
  if (typeof layer.opacity === "number" && layer.opacity < 1) styles.opacity = layer.opacity;

  return styles;
}

/**
 * text 레이어의 첫 번째 textStyle을 기반으로 폰트 관련 CSS를 추출한다.
 * 여러 스타일이 섞인(ranges) 텍스트는 발표 범위를 벗어나므로 대표 스타일 하나만 사용한다.
 * @param {object} layer - Zeplin text 레이어 객체
 * @returns {object} CSS-in-JS 형태의 폰트 스타일 선언
 */
export function extractTextStyles(layer) {
  const textStyle = layer.textStyles?.[0];
  if (!textStyle) return {};

  return {
    fontFamily: textStyle.fontFamily,
    fontSize: textStyle.fontSize,
    fontWeight: textStyle.fontWeight,
    lineHeight: textStyle.lineHeight,
    color: textStyle.color ? colorToRgba(textStyle.color) : undefined,
    textAlign: textStyle.textAlign
  };
}

/**
 * 스타일 객체 하나를 `.className { ... }` 형태의 CSS 규칙 문자열로 변환한다.
 * undefined 값은 자동으로 제외된다.
 * @param {string} selector - CSS 선택자 (예: ".card-title")
 * @param {object} styles - CSS-in-JS 형태의 스타일 선언
 * @returns {string} CSS 규칙 문자열
 */
export function stylesToCssRule(selector, styles) {
  const declarations = Object.entries(styles)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([property, value]) => `  ${toKebabCase(property)}: ${withUnit(property, value)};`)
    .join("\n");

  if (!declarations) return "";

  return `${selector} {\n${declarations}\n}`;
}
