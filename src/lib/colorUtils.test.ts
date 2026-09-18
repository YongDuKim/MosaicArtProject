import { describe, expect, test } from "vitest";
import {
  findClosestColorIndex,
  findSimilarColorIndices,
  pickTileIndex,
} from "./colorUtils";

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

describe("findSimilarColorIndices", () => {
  const palette: [number, number, number][] = [
    [0, 0, 0],
    [10, 0, 0],
    [0, 12, 0],
    [255, 255, 255],
  ];

  test("最近傍との距離差が tolerance 以内の候補をすべて返す", () => {
    // 最近傍は黒 (距離 0)。[10,0,0] は距離 10、[0,12,0] は距離 12
    expect(findSimilarColorIndices(0, 0, 0, palette, 10)).toEqual([0, 1]);
    expect(findSimilarColorIndices(0, 0, 0, palette, 12)).toEqual([0, 1, 2]);
  });

  test("tolerance が 0 なら最近傍だけを返す", () => {
    expect(findSimilarColorIndices(0, 0, 0, palette, 0)).toEqual([0]);
  });

  test("最近傍が完全一致でなくても、そこからの差分で判定する", () => {
    // 目標 [5,0,0] は [0,0,0] と [10,0,0] がどちらも距離 5 で最近傍
    expect(findSimilarColorIndices(5, 0, 0, palette, 0)).toEqual([0, 1]);
    // [0,12,0] は距離 13。最近傍 5 + tolerance 8 = 13 で含まれる
    expect(findSimilarColorIndices(5, 0, 0, palette, 8)).toEqual([0, 1, 2]);
  });
});

describe("pickTileIndex", () => {
  const palette: [number, number, number][] = [
    [0, 0, 0],
    [10, 0, 0],
    [0, 12, 0],
    [255, 255, 255],
  ];

  test("tolerance が 0 なら乱数を使わず最近傍を返す", () => {
    const random = () => {
      throw new Error("乱数は使わないはず");
    };
    expect(pickTileIndex(1, 0, 0, palette, 0, random)).toBe(0);
  });

  test("候補の中から乱数に応じて選ぶ", () => {
    // 候補は [0, 1, 2]
    expect(pickTileIndex(0, 0, 0, palette, 12, () => 0)).toBe(0);
    expect(pickTileIndex(0, 0, 0, palette, 12, () => 0.5)).toBe(1);
    expect(pickTileIndex(0, 0, 0, palette, 12, () => 0.99)).toBe(2);
  });

  test("候補が最近傍1つだけなら常にそれを返す", () => {
    expect(pickTileIndex(255, 255, 255, palette, 5, () => 0.99)).toBe(3);
  });
});
