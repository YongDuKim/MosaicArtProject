import { describe, expect, test, vi } from "vitest";
import {
  prepareTilePicker,
  srgbChannelToLinear,
  srgbToOklab,
} from "./colorComparison";
import { findSimilarColorIndices, pickTileIndex } from "./colorUtils";

describe("sRGB → Oklab", () => {
  // 独立した参照実装 Color.js 0.7.1 (https://colorjs.io/) の
  // new Color("srgb", rgb.map(v => v / 255)).to("oklab").coords から取得。
  // 本実装の式で期待値を再計算しない。行列係数の精度差を考慮して小数6桁で比較する
  test.each([
    { rgb: [0, 0, 0], lab: [0, 0, 0] },
    { rgb: [255, 255, 255], lab: [1, 0, 0] },
    {
      rgb: [255, 0, 0],
      lab: [0.6279553639214311, 0.2248630684262744, 0.125846277330585],
    },
    {
      rgb: [0, 255, 0],
      lab: [0.8664396175234368, -0.23388758093655815, 0.1794984451609376],
    },
    {
      rgb: [0, 0, 255],
      lab: [0.45201371817442365, -0.03245697517079771, -0.3115281656775778],
    },
    { rgb: [128, 128, 128], lab: [0.5998708056221469, 0, 0] },
    {
      rgb: [64, 128, 192],
      lab: [0.5872086004774627, -0.03953725056147639, -0.11186058237236235],
    },
    { rgb: [10, 10, 10], lab: [0.1447879553888796, 0, 0] },
    { rgb: [11, 11, 11], lab: [0.14957711653082623, 0, 0] },
  ])("参照値と一致する: $rgb", ({ rgb, lab }) => {
    const actual = srgbToOklab(rgb[0], rgb[1], rgb[2]);
    expect(actual.L).toBeCloseTo(lab[0], 6);
    expect(actual.a).toBeCloseTo(lab[1], 6);
    expect(actual.b).toBeCloseTo(lab[2], 6);
  });

  test("sRGB の線形化は暗部と中間調で異なる式を使う", () => {
    // CSS Color 4 の sRGB transfer function の参照値
    expect(srgbChannelToLinear(0)).toBe(0);
    expect(srgbChannelToLinear(0.04045)).toBeCloseTo(0.0031308049535603713, 14);
    expect(srgbChannelToLinear(0.04046)).toBeCloseTo(0.003131594552688991, 14);
    expect(srgbChannelToLinear(0.5)).toBeCloseTo(0.21404114048223255, 14);
    expect(srgbChannelToLinear(1)).toBe(1);
  });
});

describe("Oklab のタイル選択", () => {
  test("同じ代表 RGB 色でも方式によって最近傍が変わる", () => {
    const palette: [number, number, number][] = [
      [128, 0, 0],
      [0, 128, 0],
      [0, 0, 128],
    ];
    const before = structuredClone(palette);
    const random = vi.fn(() => 0.5);
    expect(prepareTilePicker(palette, "rgb")(128, 120, 128, 0, random)).toBe(0);
    expect(prepareTilePicker(palette, "oklab")(128, 120, 128, 0, random)).toBe(
      1,
    );
    expect(random).not.toHaveBeenCalled();
    expect(palette).toEqual(before); // 色補正に使う RGB を書き換えない
  });

  test("Oklab でも同距離なら先の候補、正の許容差なら候補内から選ぶ", () => {
    const pick = prepareTilePicker(
      [
        [128, 128, 128],
        [128, 128, 128],
        [255, 0, 0],
      ],
      "oklab",
    );
    const random = vi.fn(() => 0.75);
    expect(pick(128, 128, 128, 0, random)).toBe(0);
    expect(random).not.toHaveBeenCalled();
    expect(pick(128, 128, 128, 0.001, () => 0)).toBe(0);
    expect(pick(128, 128, 128, 0.001, random)).toBe(1);
    expect(random).toHaveBeenCalledTimes(1);
  });

  test("許容差は RGB の尺度でなく Oklab の距離として適用する", () => {
    const pick = prepareTilePicker(
      [
        [128, 128, 128],
        [140, 140, 140],
        [255, 255, 255],
      ],
      "oklab",
    );
    // Color.js による先頭2色の距離は約0.04022
    expect(pick(128, 128, 128, 0.03, () => 0.99)).toBe(0);
    expect(pick(128, 128, 128, 0.05, () => 0.99)).toBe(1);
  });

  test("負の色成分を含む Oklab 座標で許容差の境界を含める", () => {
    // 二進数で厳密に表せる座標で境界条件を確認する。
    // 目標は (0.5, 0, 0)、最小距離0.125 + 許容差0.125 = 0.25
    const palette: [number, number, number][] = [
      [0.375, 0, 0],
      [0.5, -0.25, 0],
      [0.5, 0, 0.25],
      [0.5, 0, 0.250000001],
    ];
    expect(findSimilarColorIndices(0.5, 0, 0, palette, 0.125)).toEqual([
      0, 1, 2,
    ]);
    expect(findSimilarColorIndices(0.5, 0, 0, palette, 0.124999999)).toEqual([
      0,
    ]);
    // 同じ幅の乱数区間を各候補に割り当て、元の順序で選ぶ
    expect(
      [0, 0.32, 0.34, 0.66, 0.67, 0.99].map((value) =>
        pickTileIndex(0.5, 0, 0, palette, 0.125, () => value),
      ),
    ).toEqual([0, 0, 1, 1, 2, 2]);
  });
});

describe("RGB の互換性", () => {
  // main 0a76ad4 の pickTileIndex と生成時の回転から取得した選択結果。
  // 同距離、境界、候補1枚、ばらつき0/既定/最大と、乱数消費の順序を含む
  test.each([
    {
      tolerance: 0,
      rotate: false,
      result: [
        [0, 0],
        [0, 0],
        [3, 0],
        [4, 0],
        [1, 0],
      ],
      calls: 0,
    },
    {
      tolerance: 0,
      rotate: true,
      result: [
        [0, 3],
        [0, 0],
        [3, 2],
        [4, 2],
        [1, 0],
      ],
      calls: 5,
    },
    {
      tolerance: 10,
      rotate: false,
      result: [
        [2, 0],
        [0, 0],
        [3, 0],
        [4, 0],
        [0, 0],
      ],
      calls: 5,
    },
    {
      tolerance: 10,
      rotate: true,
      result: [
        [2, 0],
        [1, 2],
        [3, 1],
        [4, 1],
        [1, 0],
      ],
      calls: 10,
    },
    {
      tolerance: 50,
      rotate: false,
      result: [
        [2, 0],
        [0, 0],
        [3, 0],
        [4, 0],
        [0, 0],
      ],
      calls: 5,
    },
    {
      tolerance: 50,
      rotate: true,
      result: [
        [2, 0],
        [1, 2],
        [3, 1],
        [4, 1],
        [2, 0],
      ],
      calls: 10,
    },
  ])(
    "従来と一致する: 許容差$tolerance、回転$rotate",
    ({ tolerance, rotate, result, calls }) => {
      const palette: [number, number, number][] = [
        [0, 0, 0],
        [10, 0, 0],
        [0, 12, 0],
        [255, 255, 255],
        [128, 128, 128],
      ];
      const cells = [
        [5, 0, 0],
        [0, 0, 0],
        [255, 255, 255],
        [120, 110, 130],
        [25, 0, 0],
      ];
      const sequence = [0.9, 0.2, 0.5, 0.7, 0.01, 0.25, 0.99, 0.4];
      let index = 0;
      const random = vi.fn(() => sequence[index++ % sequence.length]);
      const pick = prepareTilePicker(palette, "rgb");
      expect(
        cells.map(([r, g, b]) => [
          pick(r, g, b, tolerance, random),
          rotate ? Math.floor(random() * 4) : 0,
        ]),
      ).toEqual(result);
      expect(random).toHaveBeenCalledTimes(calls);
    },
  );
});
