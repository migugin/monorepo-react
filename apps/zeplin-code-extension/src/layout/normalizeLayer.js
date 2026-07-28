// Zeplin이 실제로 내려주는 원본 레이어 데이터를, buildHtml.js/buildCss.js/inferLayout.js가
// 기대하는 내부 표준 형태로 변환하는 어댑터.
//
// 원본과 내부 표준이 다른 이유 (Zeplin REST API 응답과 https://docs.zeplin.dev/reference/layer,
// 그리고 실제로 fetch-screen.js로 받아본 화면 데이터로 직접 검증함):
//
// 1) rect.x/rect.y는 화면 절대좌표가 아니라 "바로 위 부모 레이어 기준" 상대좌표다.
//    반면 inferLayout.js/buildHtml.js는 형제 레이어끼리 좌표를 비교하기 위해 화면 기준
//    절대좌표가 필요하므로(부모 rect를 빼서 상대화하는 전제), 여기서 부모의 누적 좌표를
//    미리 더해 절대좌표로 변환해둔다. (rect.absolute 필드가 있으면 그 값을 그대로 신뢰한다.)
// 2) REST API 원본 필드는 snake_case(border_radius, text_styles...)이고 구조도 한 단계
//    더 감싸져 있다(border.fill.color, text_styles[].style.font_family...).
//    Extension SDK(@zeplin/extension-model)는 camelCase(borderRadius, textStyles)를 쓰지만
//    textStyles 항목은 { range, textStyle: {...} } 형태로 여전히 한 단계 감싸져 있다.
//    두 경우를 모두 지원하도록 폴백 체인으로 필드를 읽는다.
// 3) 이미지 레이어는 자기 자신에게 URL을 담고 있지 않다. screen 버전 응답 최상위의
//    assets 배열에 layer_source_id로 연결되어 별도로 내려온다.

/**
 * screen 버전 응답 최상위의 assets 배열로 "레이어 source_id → 이미지 URL" 조회 테이블을 만든다.
 * @param {Array<object>} [assets] - screen 버전 응답의 최상위 assets 배열
 * @returns {Map<string, string>} source_id를 키로 하는 이미지 URL 맵
 */
export function buildAssetIndexBySourceId(assets = []) {
  const index = new Map();

  for (const asset of assets) {
    const sourceId = asset.layer_source_id ?? asset.layerId;
    const url = asset.contents?.[0]?.url;
    if (sourceId && url) index.set(sourceId, url);
  }

  return index;
}

function resolveAssets(rawLayer, assetIndexBySourceId) {
  const sourceId = rawLayer.source_id ?? rawLayer.sourceId;
  const url = sourceId ? assetIndexBySourceId.get(sourceId) : undefined;
  if (url) return [{ url }];

  // 레이어 자체에 이미 assets가 붙어오는 경우(Extension SDK 등)를 위한 폴백
  return rawLayer.assets ?? [];
}

// text_styles[].style(REST API, snake_case) 또는 textStyles[].textStyle(SDK, camelCase) 중
// 실제로 존재하는 쪽에서 대표 스타일 하나를 꺼낸다.
function normalizeTextStyle(rawLayer) {
  const rawTextStyles = rawLayer.text_styles ?? rawLayer.textStyles;
  const entry = rawTextStyles?.[0];
  if (!entry) return undefined;

  const style = entry.style ?? entry.textStyle ?? entry;

  return {
    fontFamily: style.fontFamily ?? style.font_family,
    fontSize: style.fontSize ?? style.font_size,
    fontWeight: style.fontWeight ?? style.font_weight,
    lineHeight: style.lineHeight ?? style.line_height,
    textAlign: style.textAlign ?? style.text_align,
    color: style.color
  };
}

function normalizeBorders(rawLayer) {
  const rawBorders = rawLayer.borders ?? [];

  return rawBorders.map((border) => ({
    thickness: border.thickness,
    // 원본은 border.fill.color에 색이 감싸져 있다. 이미 평탄화된 입력(border.color)도 지원한다.
    color: border.fill?.color ?? border.color
  }));
}

function resolveAbsolutePosition(rawRect, parentAbsolute) {
  if (rawRect.absolute) return rawRect.absolute;
  return {
    x: parentAbsolute.x + (rawRect.x ?? 0),
    y: parentAbsolute.y + (rawRect.y ?? 0)
  };
}

/**
 * 원본 Zeplin 레이어 트리를 내부 표준 형태로 재귀 변환한다.
 * 결과 레이어의 rect.x/y는 (normalizeLayer를 호출한) 최상위 레이어를 기준으로 한
 * 절대좌표이며, borderRadius/textStyles/borders/assets는 buildCss.js·buildHtml.js가
 * 바로 사용할 수 있는 평탄한 camelCase 형태로 변환되어 있다.
 * @param {object} rawLayer - Zeplin REST API 또는 Extension SDK가 제공하는 원본 레이어
 * @param {{assetIndexBySourceId?: Map<string,string>, parentAbsolute?: {x:number,y:number}}} [options]
 * @returns {object} 정규화된 레이어
 */
export function normalizeLayer(rawLayer, options = {}) {
  const assetIndexBySourceId = options.assetIndexBySourceId ?? new Map();
  const parentAbsolute = options.parentAbsolute ?? { x: 0, y: 0 };

  const absolute = resolveAbsolutePosition(rawLayer.rect, parentAbsolute);
  const rawChildLayers = rawLayer.layers ?? [];
  const textStyle = normalizeTextStyle(rawLayer);

  return {
    id: rawLayer.id,
    name: rawLayer.name,
    type: rawLayer.type,
    content: rawLayer.content,
    rect: { x: absolute.x, y: absolute.y, width: rawLayer.rect.width, height: rawLayer.rect.height },
    fills: rawLayer.fills ?? [],
    borders: normalizeBorders(rawLayer),
    borderRadius: rawLayer.borderRadius ?? rawLayer.border_radius,
    textStyles: textStyle ? [textStyle] : [],
    assets: resolveAssets(rawLayer, assetIndexBySourceId),
    layers: rawChildLayers.map((child) => normalizeLayer(child, { assetIndexBySourceId, parentAbsolute: absolute }))
  };
}
