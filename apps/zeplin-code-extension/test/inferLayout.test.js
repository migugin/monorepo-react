import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inferLayout, groupByProximity } from "../src/layout/inferLayout.js";
import { mapSemanticTag, toClassName } from "../src/layout/mapSemanticTag.js";
import { buildComponent } from "../src/layout/buildHtml.js";

function loadFixture(fileName) {
  const filePath = new URL(`./fixtures/${fileName}`, import.meta.url);
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

test("가로로 나란히 배치된 버튼 두 개는 flex-row로 추론된다", () => {
  const card = loadFixture("sample-card.json");
  const rowActions = card.layers.find((child) => child.name === "row-actions");

  const layout = inferLayout(rowActions, rowActions.layers);

  assert.equal(layout.display, "flex");
  assert.equal(layout.flexDirection, "row");
  assert.equal(layout.gap, 16);
});

test("6개 아이템이 2행 3열로 배치되면 grid로 추론된다", () => {
  const list = loadFixture("sample-grid.json");

  const layout = inferLayout(list, list.layers);

  assert.equal(layout.display, "grid");
  assert.equal(layout.gridTemplateColumns, "repeat(3, 1fr)");
  assert.equal(layout.rowGap, 12);
  assert.equal(layout.columnGap, 12);
});

test("[알려진 한계] 이미지가 풀블리드이고 텍스트만 안쪽 패딩이 있으면 column으로 인식하지 못한다", () => {
  // img-thumbnail은 x:0, text-title/row-actions는 x:16 (16px 패딩)이라
  // 현재 알고리즘의 tolerance(2px)로는 같은 컬럼으로 묶이지 않는다.
  // 실제 디자인에서 흔한 패턴이라 발표에서 다룰 "막힌 부분" 중 하나다.
  const card = loadFixture("sample-card.json");

  const layout = inferLayout(card, card.layers);

  assert.equal(layout.display, "block");
  assert.equal(layout.fallback, "absolute-children");
});

test("레이어 이름 컨벤션에 따라 시맨틱 태그가 매핑된다", () => {
  assert.equal(mapSemanticTag({ name: "btn-buy", type: "component" }), "button");
  assert.equal(mapSemanticTag({ name: "img-thumbnail", type: "shape" }), "img");
  assert.equal(mapSemanticTag({ name: "text-title", type: "text" }), "p");
  assert.equal(mapSemanticTag({ name: "unnamed-layer", type: "shape" }), "div");
});

test("buildComponent는 카드 레이어 트리를 시맨틱 HTML과 CSS로 변환한다", () => {
  const card = loadFixture("sample-card.json");

  const { html, css } = buildComponent(card);

  assert.match(html, /<img class="img-thumbnail"/);
  assert.match(html, /<p class="text-title">무선 이어폰 Pro<\/p>/);
  assert.match(html, /<button class="btn-buy">/);
  assert.match(css, /\.btn-buy \{/);
  assert.match(css, /background-color: rgba\(29, 99, 255, 1\);/);
});

test("absolute 폴백 시 fallback 메타데이터가 실제 CSS 선언으로 새어나가지 않는다", () => {
  const card = loadFixture("sample-card.json");

  const { css } = buildComponent(card);

  assert.doesNotMatch(css, /fallback/);
});

test("absolute 폴백 시 자식 레이어는 부모 기준 상대좌표로 position:absolute가 적용된다", () => {
  // card-product는 flex-row/column/grid 중 어디에도 해당하지 않아 absolute 폴백으로 빠진다.
  // 이때 자식(img-thumbnail, text-title, row-actions)은 원본 좌표를 그대로 재현해야 한다.
  const card = loadFixture("sample-card.json");

  const { css } = buildComponent(card);

  assert.match(css, /\.img-thumbnail \{[^}]*position: absolute;[^}]*left: 0px;[^}]*top: 0px;[^}]*\}/s);
  assert.match(css, /\.text-title \{[^}]*position: absolute;[^}]*left: 16px;[^}]*top: 196px;[^}]*\}/s);
  assert.match(css, /\.row-actions \{[^}]*position: absolute;[^}]*left: 16px;[^}]*top: 240px;[^}]*\}/s);
});

test("absolute 폴백이 아닌 flex-row 자식(btn-buy, btn-wishlist)에는 position:absolute가 붙지 않는다", () => {
  // row-actions 자신은 flex-row로 추론되므로, 그 자식들은 좌표 기반 절대배치가 필요 없다.
  const card = loadFixture("sample-card.json");

  const { css } = buildComponent(card);

  const btnBuyRule = css.match(/\.btn-buy \{[^}]*\}/s)?.[0] ?? "";
  assert.doesNotMatch(btnBuyRule, /position: absolute/);
});

test("img 태그는 src 속성을 포함하고, 레이어 이름에 큰따옴표가 있어도 속성이 깨지지 않는다", () => {
  const layer = {
    name: 'img-"onerror=alert(1)',
    type: "shape",
    rect: { x: 0, y: 0, width: 10, height: 10 }
  };

  const { html } = buildComponent(layer);

  assert.match(html, /<img class="[^"]+" src="[^"]*" alt="[^"]*" \/>/);
  assert.match(html, /alt="img-&quot;onerror=alert\(1\)"/);
  assert.doesNotMatch(html, /img-"onerror=alert\(1\)"/);
});

test("텍스트 레이어의 lineHeight는 배수가 아닌 px 단위로 출력된다", () => {
  const card = loadFixture("sample-card.json");

  const { css } = buildComponent(card);

  assert.match(css, /line-height: 24px;/);
});

test("행마다 아이템 개수는 같지만 컬럼 x좌표가 어긋나면 grid로 오판하지 않는다", () => {
  const parent = { rect: { x: 0, y: 0, width: 400, height: 200 } };
  const misalignedGridLikeChildren = [
    { rect: { x: 0, y: 0, width: 50, height: 50 } },
    { rect: { x: 100, y: 0, width: 50, height: 50 } },
    { rect: { x: 200, y: 0, width: 50, height: 50 } },
    { rect: { x: 30, y: 100, width: 50, height: 50 } },
    { rect: { x: 160, y: 100, width: 50, height: 50 } },
    { rect: { x: 300, y: 100, width: 50, height: 50 } }
  ];

  const layout = inferLayout(parent, misalignedGridLikeChildren);

  assert.notEqual(layout.display, "grid");
});

test("toClassName은 숫자로 시작하는 클래스명을 만들지 않는다", () => {
  assert.equal(toClassName("1. Title"), "layer-1-title");
  assert.equal(toClassName("btn-buy"), "btn-buy");
});

test("groupByProximity는 직전 값이 아니라 그룹의 첫 값(anchor) 기준으로 묶어 체이닝 오류를 막는다", () => {
  // 0→2, 2→4는 각각 tolerance(2) 이내지만, 그룹 전체 범위(4-0=4)는 tolerance를 넘는다.
  // anchor(첫 값) 기준으로 비교하면 [0, 2]와 [4]로 올바르게 분리된다.
  const groups = groupByProximity([0, 2, 4], 2);

  assert.deepEqual(groups, [
    [0, 2],
    [4]
  ]);
});

test("자식 레이어가 겹쳐서 간격이 음수가 되면 gap은 0으로 방어된다", () => {
  // CSS gap 속성은 음수를 허용하지 않으므로, 계산된 평균 gap이 음수여도 0으로 클램프되어야 한다.
  const parent = { rect: { x: 0, y: 0, width: 200, height: 50 } };
  const overlappingRowChildren = [
    { rect: { x: 0, y: 0, width: 50, height: 50 } },
    { rect: { x: 40, y: 0, width: 50, height: 50 } }
  ];

  const layout = inferLayout(parent, overlappingRowChildren);

  assert.equal(layout.display, "flex");
  assert.equal(layout.flexDirection, "row");
  assert.equal(layout.gap, 0);
});
