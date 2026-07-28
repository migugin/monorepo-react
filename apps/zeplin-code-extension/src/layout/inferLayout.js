const DEFAULT_TOLERANCE = 2;

// 좌표를 부모 레이어 기준 상대좌표로 변환한다
function toRelativeRect(rect, parentRect) {
  return {
    x: rect.x - parentRect.x,
    y: rect.y - parentRect.y,
    width: rect.width,
    height: rect.height
  };
}

// 값들을 tolerance 범위 안에서 같은 그룹으로 묶는다 (정렬된 배열 기준).
// 직전 값이 아니라 그룹의 첫 값(anchor)과 비교한다: 직전 값과만 비교하면 0→2→4→6처럼
// 인접한 두 값끼리는 tolerance(2) 이내여도 그룹 전체 범위가 계속 누적되어 결국 tolerance를
// 훨씬 벗어난 값들까지 같은 그룹으로 묶이는 "체이닝" 오류가 생긴다.
function groupByProximity(sortedValues, tolerance) {
  const groups = [];
  let currentGroup = [sortedValues[0]];

  for (let i = 1; i < sortedValues.length; i += 1) {
    const anchor = currentGroup[0];
    const current = sortedValues[i];
    const isSameGroup = current - anchor <= tolerance;

    if (isSameGroup) {
      currentGroup.push(current);
      continue;
    }

    groups.push(currentGroup);
    currentGroup = [current];
  }

  groups.push(currentGroup);
  return groups;
}

// 간격 배열의 평균값을 구한다 (gap 추론용).
// 자식 레이어들이 서로 겹치면 개별 gap이 음수가 될 수 있는데, CSS의 gap 속성은 음수를
// 허용하지 않아(선언 자체가 무시됨) 0으로 방어한다.
function calculateAverageGap(gaps) {
  if (gaps.length === 0) return 0;
  const sum = gaps.reduce((acc, gap) => acc + gap, 0);
  return Math.max(0, Math.round(sum / gaps.length));
}

/**
 * 자식 레이어들이 한 줄(행)로 배치되어 있는지 판단하고, flex-row 정보를 반환한다.
 * y 좌표(top)가 tolerance 이내로 동일하면 같은 행으로 간주한다.
 * @param {Array<{x:number,y:number,width:number,height:number}>} rects - 부모 기준 상대좌표 배열
 * @param {number} tolerance - 좌표 오차 허용 범위(px)
 * @returns {{isRow:boolean, gap:number}} 행 배치 여부와 추론된 gap
 */
function detectRow(rects, tolerance) {
  const sortedByY = [...rects].sort((a, b) => a.y - b.y);
  const yGroups = groupByProximity(sortedByY.map((rect) => rect.y), tolerance);
  const isSingleRow = yGroups.length === 1;

  if (!isSingleRow) return { isRow: false, gap: 0 };

  const sortedByX = [...rects].sort((a, b) => a.x - b.x);
  const gaps = [];
  for (let i = 1; i < sortedByX.length; i += 1) {
    const prevRight = sortedByX[i - 1].x + sortedByX[i - 1].width;
    gaps.push(sortedByX[i].x - prevRight);
  }

  return { isRow: true, gap: calculateAverageGap(gaps) };
}

/**
 * 자식 레이어들이 한 열(컬럼)로 배치되어 있는지 판단하고, flex-column 정보를 반환한다.
 * x 좌표(left)가 tolerance 이내로 동일하면 같은 열로 간주한다.
 * @param {Array<{x:number,y:number,width:number,height:number}>} rects - 부모 기준 상대좌표 배열
 * @param {number} tolerance - 좌표 오차 허용 범위(px)
 * @returns {{isColumn:boolean, gap:number}} 열 배치 여부와 추론된 gap
 */
function detectColumn(rects, tolerance) {
  const sortedByX = [...rects].sort((a, b) => a.x - b.x);
  const xGroups = groupByProximity(sortedByX.map((rect) => rect.x), tolerance);
  const isSingleColumn = xGroups.length === 1;

  if (!isSingleColumn) return { isColumn: false, gap: 0 };

  const sortedByY = [...rects].sort((a, b) => a.y - b.y);
  const gaps = [];
  for (let i = 1; i < sortedByY.length; i += 1) {
    const prevBottom = sortedByY[i - 1].y + sortedByY[i - 1].height;
    gaps.push(sortedByY[i].y - prevBottom);
  }

  return { isColumn: true, gap: calculateAverageGap(gaps) };
}

// 모든 행에서 같은 순번(컬럼 인덱스)의 아이템끼리 x좌표가 tolerance 이내로 일치하는지 확인한다.
// 행마다 아이템 개수만 같고 실제 컬럼 위치는 어긋난 비-그리드 레이아웃을 그리드로 오판하지 않기 위한 검증이다.
function isColumnXAligned(rows, tolerance) {
  const [firstRow, ...restRows] = rows;
  return restRows.every((row) =>
    row.every((rect, columnIndex) => Math.abs(rect.x - firstRow[columnIndex].x) <= tolerance)
  );
}

/**
 * 자식 레이어들이 격자(그리드) 형태인지 판단한다.
 * y 좌표로 행을 묶은 뒤, 모든 행의 아이템 개수와 x 좌표 패턴이 동일하면 그리드로 간주한다.
 * Auto Layout 메타데이터가 없는 Zeplin 레이어 특성상, 이 휴리스틱이 없으면
 * 카드 리스트 같은 레이아웃이 전부 absolute 포지션으로 깨져버린다.
 * @param {Array<{x:number,y:number,width:number,height:number}>} rects - 부모 기준 상대좌표 배열
 * @param {number} tolerance - 좌표 오차 허용 범위(px)
 * @returns {{isGrid:boolean, columns:number, rowGap:number, columnGap:number}}
 */
function detectGrid(rects, tolerance) {
  const sortedByY = [...rects].sort((a, b) => a.y - b.y);
  const yValues = sortedByY.map((rect) => rect.y);
  const rowGroups = groupByProximity(yValues, tolerance);
  const isMultiRow = rowGroups.length > 1;

  if (!isMultiRow) return { isGrid: false, columns: 0, rowGap: 0, columnGap: 0 };

  const rows = rowGroups.map((groupYValues) => {
    const groupYSet = new Set(groupYValues);
    return sortedByY
      .filter((rect) => groupYSet.has(rect.y))
      .sort((a, b) => a.x - b.x);
  });

  const columnCount = rows[0].length;
  const hasSameColumnCount = rows.every((row) => row.length === columnCount);

  if (!hasSameColumnCount || columnCount <= 1) {
    return { isGrid: false, columns: 0, rowGap: 0, columnGap: 0 };
  }

  if (!isColumnXAligned(rows, tolerance)) {
    return { isGrid: false, columns: 0, rowGap: 0, columnGap: 0 };
  }

  const columnGaps = [];
  for (let i = 1; i < rows[0].length; i += 1) {
    const prevRight = rows[0][i - 1].x + rows[0][i - 1].width;
    columnGaps.push(rows[0][i].x - prevRight);
  }

  const rowGaps = [];
  for (let i = 1; i < rows.length; i += 1) {
    const prevRowBottom = rows[i - 1][0].y + rows[i - 1][0].height;
    rowGaps.push(rows[i][0].y - prevRowBottom);
  }

  return {
    isGrid: true,
    columns: columnCount,
    rowGap: calculateAverageGap(rowGaps),
    columnGap: calculateAverageGap(columnGaps)
  };
}

/**
 * 부모 레이어와 자식 레이어 목록을 받아 flex-row, flex-column, grid, absolute 중
 * 가장 적합한 CSS 레이아웃 방식을 추론한다.
 * @param {{rect: {x:number,y:number,width:number,height:number}}} parentLayer - 부모 레이어
 * @param {Array<{rect: {x:number,y:number,width:number,height:number}}>} childLayers - 자식 레이어 목록
 * @param {{tolerance?: number}} [options] - 좌표 오차 허용 범위 옵션
 * @returns {object} 추론된 레이아웃 정보 (css 선언 형태로 바로 사용 가능)
 */
export function inferLayout(parentLayer, childLayers, options = {}) {
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;

  if (childLayers.length <= 1) {
    return { display: "block" };
  }

  const relativeRects = childLayers.map((child) => toRelativeRect(child.rect, parentLayer.rect));

  const rowResult = detectRow(relativeRects, tolerance);
  if (rowResult.isRow) {
    return { display: "flex", flexDirection: "row", gap: rowResult.gap };
  }

  const columnResult = detectColumn(relativeRects, tolerance);
  if (columnResult.isColumn) {
    return { display: "flex", flexDirection: "column", gap: columnResult.gap };
  }

  const gridResult = detectGrid(relativeRects, tolerance);
  if (gridResult.isGrid) {
    return {
      display: "grid",
      gridTemplateColumns: `repeat(${gridResult.columns}, 1fr)`,
      rowGap: gridResult.rowGap,
      columnGap: gridResult.columnGap
    };
  }

  // 세 가지 패턴에 모두 해당하지 않으면 좌표를 그대로 살리는 absolute 배치로 폴백한다
  return { display: "block", position: "relative", fallback: "absolute-children" };
}

export { toRelativeRect, groupByProximity };
