// 레이어 이름 접두사와 시맨틱 태그 매핑 규칙
// Zeplin 레이어에는 Figma의 Auto Layout/Component 메타데이터가 없는 경우가 많아,
// 디자이너와 미리 합의된 네이밍 컨벤션에 의존해 태그를 추론한다.
const NAME_PATTERN_RULES = [
  { pattern: /^(btn|button)[-_]/i, tag: "button" },
  { pattern: /^(img|image)[-_]/i, tag: "img" },
  { pattern: /^icon[-_]/i, tag: "i" },
  { pattern: /^input[-_]/i, tag: "input" },
  { pattern: /^list[-_]/i, tag: "ul" },
  { pattern: /^item[-_]/i, tag: "li" },
  { pattern: /^link[-_]/i, tag: "a" },
  { pattern: /^title[-_]/i, tag: "h2" },
  { pattern: /^text[-_]/i, tag: "p" }
];

function isTextLayer(layer) {
  return layer.type === "text";
}

export function mapSemanticTag(layer) {
  const matchedRule = NAME_PATTERN_RULES.find((rule) => rule.pattern.test(layer.name));
  if (matchedRule) return matchedRule.tag;

  if (isTextLayer(layer)) return "span";

  return "div";
}

/**
 * 레이어 이름을 CSS 클래스명으로 안전하게 변환한다 (공백/특수문자 제거, kebab-case화).
 * @param {string} layerName - Zeplin 레이어 이름
 * @returns {string} CSS 클래스에 사용 가능한 문자열
 */
export function toClassName(layerName) {
  const sanitized = layerName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (sanitized === "") return "layer";
  // CSS 클래스 셀렉터는 숫자로 시작할 수 없으므로("1-title" 등) 접두사를 붙여 방어한다
  if (/^[0-9]/.test(sanitized)) return `layer-${sanitized}`;
  return sanitized;
}
