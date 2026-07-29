import { describe, expect, test } from "vitest";
import { findClosestColorIndex } from "./colorUtils";

describe("findClosestColorIndex", () => {
  const palette: [number, number, number][] = [
    [0, 0, 0],
    [255, 0, 0],
    [0, 255, 0],
    [255, 255, 255],
  ];

  test("完全一致する色があればそれを選ぶ", () => {
    expect(findClosestColorIndex(255, 0, 0, palette)).toBe(1);
    expect(findClosestColorIndex(255, 255, 255, palette)).toBe(3);
  });

  test("一致がなければ RGB 二乗距離が最小の色を選ぶ", () => {
    // 暗いグレーは黒 (index 0) が最も近い
    expect(findClosestColorIndex(20, 20, 20, palette)).toBe(0);
    // 明るい赤寄りの色は赤 (index 1) が最も近い
    expect(findClosestColorIndex(200, 30, 30, palette)).toBe(1);
  });

  test("距離が同じなら先に現れた候補を選ぶ", () => {
    const tie: [number, number, number][] = [
      [0, 0, 0],
      [20, 0, 0],
    ];
    expect(findClosestColorIndex(10, 0, 0, tie)).toBe(0);
  });

  test("候補が1つならそれを返す", () => {
    expect(findClosestColorIndex(123, 45, 67, [[0, 0, 0]])).toBe(0);
  });
});
