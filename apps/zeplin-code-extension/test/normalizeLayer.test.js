import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeLayer, buildAssetIndexBySourceId } from "../src/layout/normalizeLayer.js";
import { buildComponent } from "../src/layout/buildHtml.js";

// 아래 원본 형태(snake_case, 부모 기준 상대좌표, border.fill.color, text_styles[].style)는
// docs.zeplin.dev/reference/layer의 실제 스키마와, fetch-screen.js로 받아본 실제 화면 데이터로
// 직접 검증한 구조를 그대로 재현한 것이다.
const rawCard = {
  id: "card-id",
  source_id: "1:1",
  type: "group",
  name: "Card",
  rect: { x: 0, y: 0, width: 300, height: 296, absolute: { x: 0, y: 0 } },
  fills: [],
  borders: [],
  border_radius: 12,
  layers: [
    {
      id: "thumb-id",
      source_id: "1:2",
      type: "group",
      name: "img-thumbnail",
      // 부모(Card) 기준 상대좌표: 이미지가 카드 맨 위에 딱 붙어있어 (0, 0)
      rect: { x: 0, y: 0, width: 300, height: 180, absolute: { x: 0, y: 0 } },
      fills: [],
      borders: [],
      layers: []
    },
    {
      id: "title-id",
      source_id: "1:3",
      type: "text",
      name: "Title",
      content: "무선 이어폰 Pro",
      // 부모(Card) 기준 상대좌표: 이미지 아래, 좌우 16px 안쪽 패딩
      rect: { x: 16, y: 196, width: 268, height: 28, absolute: { x: 16, y: 196 } },
      fills: [],
      borders: [
        {
          position: "inside",
          thickness: 2,
          fill: { type: "color", color: { r: 1, g: 2, b: 3, a: 1 } }
        }
      ],
      text_styles: [
        {
          range: { location: 0, length: 10 },
          style: {
            font_family: "Pretendard",
            font_size: 18,
            font_weight: 600,
            line_height: 24,
            text_align: "left",
            color: { r: 34, g: 34, b: 34, a: 1 }
          }
        }
      ],
      layers: []
    }
  ]
};

test("normalizeLayer는 border_radius(snake_case)를 borderRadius로 변환한다", () => {
  const normalized = normalizeLayer(rawCard);

  assert.equal(normalized.borderRadius, 12);
});

test("normalizeLayer는 text_styles[].style(snake_case, 중첩)을 평탄한 textStyles로 변환한다", () => {
  const normalized = normalizeLayer(rawCard);
  const title = normalized.layers.find((child) => child.name === "Title");

  assert.deepEqual(title.textStyles[0], {
    fontFamily: "Pretendard",
    fontSize: 18,
    fontWeight: 600,
    lineHeight: 24,
    textAlign: "left",
    color: { r: 34, g: 34, b: 34, a: 1 }
  });
});

test("normalizeLayer는 border.fill.color(중첩)를 평탄한 border.color로 변환한다", () => {
  const normalized = normalizeLayer(rawCard);
  const title = normalized.layers.find((child) => child.name === "Title");

  assert.deepEqual(title.borders[0], { thickness: 2, color: { r: 1, g: 2, b: 3, a: 1 } });
});

test("normalizeLayer는 부모 기준 상대좌표(rect.x/y)를 rect.absolute를 이용해 화면 기준 절대좌표로 변환한다", () => {
  const normalized = normalizeLayer(rawCard);
  const title = normalized.layers.find((child) => child.name === "Title");

  // rect.absolute가 있으면 그 값을 그대로 신뢰해야 한다 (부모 rect.x를 또 빼는 이중 상대화 금지)
  assert.deepEqual(title.rect, { x: 16, y: 196, width: 268, height: 28 });
});

test("normalizeLayer는 rect.absolute가 없으면 부모의 누적 절대좌표에 자신의 상대좌표를 더해 계산한다", () => {
  const rawWithoutAbsolute = {
    id: "root",
    type: "group",
    name: "Root",
    rect: { x: 10, y: 10, width: 100, height: 100 },
    layers: [
      {
        id: "child",
        type: "shape",
        name: "Child",
        // 부모(Root) 기준 상대좌표 (5, 5) → 화면 기준 절대좌표는 (10+5, 10+5) = (15, 15)여야 한다
        rect: { x: 5, y: 5, width: 20, height: 20 },
        layers: []
      }
    ]
  };

  const normalized = normalizeLayer(rawWithoutAbsolute);

  assert.deepEqual(normalized.layers[0].rect, { x: 15, y: 15, width: 20, height: 20 });
});

test("normalizeLayer는 screen 버전 응답 최상위 assets 배열을 layer_source_id로 매칭해 이미지 URL을 채운다", () => {
  const assetIndexBySourceId = buildAssetIndexBySourceId([
    {
      layer_source_id: "1:2",
      layer_name: "img-thumbnail",
      contents: [{ url: "https://cdn.zeplin.dev/thumbnail.png", density: "1x", format: "png" }]
    }
  ]);

  const normalized = normalizeLayer(rawCard, { assetIndexBySourceId });
  const thumbnail = normalized.layers.find((child) => child.name === "img-thumbnail");

  assert.deepEqual(thumbnail.assets, [{ url: "https://cdn.zeplin.dev/thumbnail.png" }]);
});

test("normalizeLayer는 이미 평탄화된(camelCase) 레거시 fixture 입력도 그대로 지원한다", () => {
  const legacyFlatLayer = {
    name: "btn-buy",
    type: "component",
    rect: { x: 16, y: 240, width: 126, height: 40 },
    borderRadius: 8,
    fills: [{ type: "color", color: { r: 29, g: 99, b: 255, a: 1 } }]
  };

  const normalized = normalizeLayer(legacyFlatLayer);

  assert.equal(normalized.borderRadius, 8);
  assert.deepEqual(normalized.fills, legacyFlatLayer.fills);
});

test("정규화된 실제 Zeplin 데이터로 buildComponent를 실행하면 border-radius/폰트/이미지가 모두 CSS/HTML에 반영된다", () => {
  const assetIndexBySourceId = buildAssetIndexBySourceId([
    {
      layer_source_id: "1:2",
      contents: [{ url: "https://cdn.zeplin.dev/thumbnail.png" }]
    }
  ]);
  const normalized = normalizeLayer(rawCard, { assetIndexBySourceId });

  const { html, css } = buildComponent(normalized);

  assert.match(html, /src="https:\/\/cdn\.zeplin\.dev\/thumbnail\.png"/);
  assert.match(css, /border-radius: 12px;/);
  assert.match(css, /font-family: Pretendard;/);
  assert.match(css, /line-height: 24px;/);
});
