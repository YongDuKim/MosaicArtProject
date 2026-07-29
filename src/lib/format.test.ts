import { describe, expect, test } from "vitest";
import { buildStatsText, formatPercent, formatTimestamp } from "./format";
import type { MosaicDone } from "./types";

describe("formatPercent", () => {
  test("100 を指数表記にしない", () => {
    // toPrecision(2) は 100 を "1.0e+2" にするため、そのまま返してはいけない
    expect(formatPercent(100)).toBe("100");
  });

  test("有効数字2桁に丸める", () => {
    expect(formatPercent(33.33333)).toBe("33");
    expect(formatPercent(0.04166)).toBe("0.042");
  });

  test("末尾の余分な0を残さない", () => {
    expect(formatPercent(5)).toBe("5");
  });
});

describe("formatTimestamp", () => {
  test("YYYYMMDD_HHMMSS 形式でゼロ埋めする", () => {
    // ローカル時刻で組み立てるため、生成も表示もローカル時刻で一致する
    expect(formatTimestamp(new Date(2026, 0, 5, 3, 7, 9))).toBe(
      "20260105_030709",
    );
  });

  test("月は1始まりで出力する", () => {
    expect(formatTimestamp(new Date(2026, 11, 31, 23, 59, 59))).toBe(
      "20261231_235959",
    );
  });
});

describe("buildStatsText", () => {
  const result: MosaicDone = {
    type: "done",
    blob: new Blob(),
    stats: [
      { name: "a.jpg", index: 0, count: 3, percentage: 75 },
      { name: "b.jpg", index: 1, count: 1, percentage: 25 },
    ],
    tileNames: ["a.jpg", "b.jpg"],
    assignments: new Uint16Array([0, 0, 0, 1]),
    totalTiles: 4,
    usedTileKinds: 2,
    tileKindsTotal: 5,
    gridWidth: 2,
    gridHeight: 2,
    outputWidth: 50,
    outputHeight: 50,
  };

  test("タイルごとの使用回数と割合を並べる", () => {
    const text = buildStatsText(result, "input.png");
    expect(text).toContain("a.jpg: 3回 (75%)");
    expect(text).toContain("b.jpg: 1回 (25%)");
  });

  test("入力画像名と集計値を含む", () => {
    const text = buildStatsText(result, "input.png");
    expect(text).toContain("入力画像: input.png");
    expect(text).toContain("使用されたプリセット画像の種類: 2 / 5");
    expect(text).toContain("総タイル数: 4");
    expect(text).toContain("グリッドサイズ: 2 × 2");
  });
});
