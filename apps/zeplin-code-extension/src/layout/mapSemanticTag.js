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

// 텍스트 레이어인지 여부는 name이 아니라 Zeplin layer.type으로 판단하는 편이 정확하다
function isTextLayer(layer) {
  return layer.type === "text";
}

/**
 * 레이어 이름 컨벤션과 레이어 타입을 기반으로 적절한 HTML 시맨틱 태그를 결정한다.
 * 일치하는 네이밍 규칙이 없으면 div로 폴백한다.
 * @param {{name: string, type?: string}} layer - Zeplin 레이어 객체
 * @returns {string} 추론된 HTML 태그명
 */
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
