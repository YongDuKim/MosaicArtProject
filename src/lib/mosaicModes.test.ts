import { describe, expect, test } from "vitest";
import { oklabToSrgb, prepareTilePicker, srgbToOklab } from "./colorComparison";
import {
  analyzeMosaic,
  hasLimitedPalette,
  MODE_ORDER,
  MODE_SETTINGS,
  prepareModePicker,
} from "./mosaicModes";
import type { ColorComparison, MosaicMode } from "./types";

type RGB = [number, number, number];
const rgba = (colors: RGB[]) =>
  new Uint8ClampedArray(colors.flatMap((c) => [...c, 255]));
const blue: RGB[] = [
  [10, 35, 90],
  [30, 75, 140],
  [65, 130, 190],
  [140, 190, 225],
];
const colors: RGB[] = [
  [10, 10, 10],
  [65, 65, 65],
  [130, 130, 130],
  [230, 230, 230],
];
const assignments = (
  source: RGB[],
  tiles: RGB[],
  mode: MosaicMode,
  comparison: ColorComparison = "oklab",
  width = source.length,
) => {
  const analysis = analyzeMosaic(
    rgba(source),
    width,
    source.length / width,
    tiles,
  );
  const picker = prepareModePicker(analysis, mode, comparison);
  return {
    analysis,
    picker,
    selected: source.map((_, i) => picker.pick(i, 0)),
  };
};

describe("配色解析とモード選択", () => {
  test("色優先は両比較方式で既存の選択と乱数消費を保つ", () => {
    for (const comparison of ["rgb", "oklab"] as const) {
      for (const tolerance of [0, comparison === "rgb" ? 30 : 0.05]) {
        const old = prepareTilePicker(blue, comparison);
        const analysis = analyzeMosaic(rgba(colors), 2, 2, blue);
        const current = prepareModePicker(analysis, "color", comparison);
        let oldCalls = 0,
          calls = 0;
        colors.forEach((c, i) => {
          const expected = old(...c, tolerance, () => {
            oldCalls++;
            return 0.7;
          });
          expect(
            current.pick(i, tolerance, () => {
              calls++;
              return 0.7;
            }),
          ).toBe(expected);
        });
        expect(calls).toBe(oldCalls);
        expect(current.targets).toEqual(analysis.cells);
      }
    }
  });

  test("青系の素材で暗部と背景の順序を保ち、素材の明暗の幅を使う", () => {
    for (const comparison of ["rgb", "oklab"] as const) {
      const { selected } = assignments(colors, blue, "structure", comparison);
      const lightness = selected.map((i) => srgbToOklab(...blue[i]).L);
      expect(lightness).toEqual([...lightness].sort((a, b) => a - b));
      expect(lightness.at(-1)! - lightness[0]).toBeGreaterThan(0.4);
    }
  });

  test("等明度で色味だけが異なる領域を青系素材で区別する", () => {
    const a = oklabToSrgb({ L: 0.6, a: -0.1, b: 0 });
    const b = oklabToSrgb({ L: 0.6, a: 0.1, b: 0 });
    const image = [a, a, b, b, a, a, b, b];
    for (const comparison of ["rgb", "oklab"] as const) {
      const { selected } = assignments(image, blue, "structure", comparison, 4);
      expect(
        Math.abs(
          srgbToOklab(...blue[selected[0]]).L -
            srgbToOklab(...blue[selected[3]]).L,
        ),
      ).toBeGreaterThan(0.25);
      expect(selected[0]).toBe(selected[4]);
      expect(selected[3]).toBe(selected[7]);
    }
  });

  test("素材を変更すると目標配色が更新され、補正先も素材側の色になる", () => {
    const first = assignments(colors, blue, "structure");
    const red: RGB[] = blue.map(([r, g, b]) => [b, g, r]);
    const second = assignments(colors, red, "structure");
    expect(first.picker.targets).not.toEqual(second.picker.targets);
    expect(first.picker.targets[2]).toBeGreaterThan(first.picker.targets[0]);
    expect(second.picker.targets[0]).toBeGreaterThan(second.picker.targets[2]);
  });

  test("元画像と素材で色味の変化する方向が異なっても、等明度の境界を区別する", () => {
    const source = [-0.1, 0.1].map((a) => oklabToSrgb({ L: 0.6, a, b: 0 }));
    const tiles = [-0.12, 0.12].map((b) => oklabToSrgb({ L: 0.6, a: 0, b }));
    for (const comparison of ["rgb", "oklab"] as const) {
      const { selected } = assignments(source, tiles, "structure", comparison);
      expect(selected[0]).not.toBe(selected[1]);
    }
  });

  test("バランスの配色変更量は色優先と形優先の間に収まる", () => {
    const p = MODE_ORDER.map(
      (mode) => assignments(colors, blue, mode).picker.targets,
    );
    const difference = (data: Uint8ClampedArray) =>
      data.reduce((sum, v, i) => sum + Math.abs(v - p[0][i]), 0);
    expect(difference(p[1])).toBeGreaterThan(0);
    expect(difference(p[1])).toBeLessThan(difference(p[2]));
  });

  test("グラデーションの目標色が局所的に反転せず、同じ元色は同じ目標色になる", () => {
    const gradient: RGB[] = Array.from({ length: 32 }, (_, i) => [
      i * 8,
      i * 8,
      i * 8,
    ]);
    const { picker } = assignments(
      [...gradient, ...gradient],
      blue,
      "structure",
      "oklab",
      32,
    );
    const tones = gradient.map(
      (_, i) =>
        srgbToOklab(
          ...(Array.from(picker.targets.slice(i * 4, i * 4 + 3)) as RGB),
        ).L,
    );
    for (let i = 1; i < tones.length; i++)
      expect(tones[i]).toBeGreaterThanOrEqual(tones[i - 1] - 0.003);
    expect(picker.targets.slice(0, 128)).toEqual(picker.targets.slice(128));
  });

  test("単色の元画像・1枚の素材・1セルでも有限値を返す", () => {
    for (const mode of MODE_ORDER) {
      const { selected, picker, analysis } = assignments(
        [[128, 128, 128]],
        [[50, 60, 70]],
        mode,
      );
      expect(selected).toEqual([0]);
      expect([...picker.targets].every(Number.isFinite)).toBe(true);
      expect(hasLimitedPalette(analysis)).toBe(true);
    }
  });

  test("ばらつき0で乱数を使わず、同色の複数写真は正のばらつきで選択できる", () => {
    for (const mode of ["balanced", "structure"] as const) {
      const make = () =>
        assignments(
          [[80, 80, 80]],
          [
            [60, 70, 80],
            [60, 70, 80],
          ],
          mode,
        ).picker;
      expect(
        make().pick(0, 0, () => {
          throw new Error("乱数を使った");
        }),
      ).toBe(0);
      expect(make().pick(0, 0.01, () => 0)).toBe(0);
      expect(make().pick(0, 0.01, () => 0.999)).toBe(1);
    }
  });

  test("解析をやり直しても同じ入力の結果を再現できる", () => {
    for (const mode of MODE_ORDER)
      expect(assignments(colors, blue, mode).selected).toEqual(
        assignments(colors, blue, mode).selected,
      );
  });

  test("隣接セルの評価で、階調の差の再現誤差を減らせる", () => {
    const source: RGB[] = [0, 40, 80, 120, 160, 200, 240].map((v) => [v, v, v]);
    const tiles: RGB[] = [45, 120, 205].map((v) => [v, v, v]);
    const analysis = analyzeMosaic(rgba(source), source.length, 1, tiles);
    const edgeError = (relation: number) => {
      const p = prepareModePicker(analysis, "structure", "oklab", undefined, {
        ...MODE_SETTINGS.structure,
        relation,
      });
      const chosen = source.map(
        (_, i) => srgbToOklab(...tiles[p.pick(i, 0)]).L,
      );
      const target = source.map(
        (_, i) =>
          srgbToOklab(...(Array.from(p.targets.slice(i * 4, i * 4 + 3)) as RGB))
            .L,
      );
      return chosen
        .slice(1)
        .reduce(
          (sum, v, i) =>
            sum + (v - chosen[i] - (target[i + 1] - target[i])) ** 2,
          0,
        );
    };
    expect(edgeError(MODE_SETTINGS.structure.relation)).toBeLessThan(
      edgeError(0),
    );
  });

  test("元画像や素材が空の場合は解析を拒否する", () => {
    expect(() => analyzeMosaic(new Uint8ClampedArray(), 0, 0, blue)).toThrow();
    expect(() => analyzeMosaic(rgba(colors), 4, 1, [])).toThrow();
  });
});

describe("Oklab から描画用 sRGB への変換", () => {
  test("独立した参照座標を原色へ戻す", () => {
    // Color.js 0.7.1 の Oklab 座標。前向きの実装から期待値を生成しない。
    const references: [RGB, RGB][] = [
      [
        [0.6279553639214311, 0.22486306842627443, 0.12584627733058495],
        [255, 0, 0],
      ],
      [
        [0.8664396115356694, -0.23388757418790818, 0.17949847989672985],
        [0, 255, 0],
      ],
      [
        [0.4520137183853429, -0.03245698416876397, -0.3115281476783751],
        [0, 0, 255],
      ],
    ];
    for (const [[L, a, b], expected] of references) {
      const actual = oklabToSrgb({ L, a, b });
      actual.forEach((v, i) =>
        expect(Math.abs(v - expected[i])).toBeLessThan(0.001),
      );
    }
  });
  test("色域外の値を描画できる範囲に収める", () => {
    for (const v of oklabToSrgb({ L: 0.7, a: 1, b: -1 })) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  });
});
