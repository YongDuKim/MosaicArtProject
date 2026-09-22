import { pickTileIndex } from "./colorUtils";
import type { ColorComparison } from "./types";

/** RGB のタプルと区別し、比較以外の描画・色補正に混入させない */
export interface OklabColor {
  L: number;
  a: number;
  b: number;
}

/** ばらつきは各方式の距離をそのまま表示する。方式間の換算は行わない */
export const COLOR_COMPARISONS = {
  rgb: {
    label: "RGB",
    hint: "RGB の数値の近さで選ぶ",
    max: 50,
    step: 1,
    defaultTolerance: 10,
    decimals: 0,
  },
  oklab: {
    label: "Oklab",
    hint: "見た目の明るさ・色味の近さで選ぶ",
    max: 0.1,
    step: 0.001,
    defaultTolerance: 0.01,
    decimals: 3,
  },
} as const;

/** 0〜1 の sRGB 成分を線形化する (CSS Color 4 の sRGB transfer function) */
export function srgbChannelToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/**
 * 0〜255 の既存の代表 sRGB 色を Oklab に変換する。
 * 行列: https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab
 * 画素ごとに変換して平均する処理ではない
 */
export function srgbToOklab(r: number, g: number, b: number): OklabColor {
  const lr = srgbChannelToLinear(r / 255);
  const lg = srgbChannelToLinear(g / 255);
  const lb = srgbChannelToLinear(b / 255);
  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/**
 * タイルの比較色を生成ごとに準備する。返す関数はセルの代表 RGB 色を受け取る。
 * Oklab はタイルごとに準備時1回、セルごとに選択時1回だけ変換する。
 * tolerance の単位は選択した色空間のユークリッド距離
 */
export function prepareTilePicker(
  avgColors: [number, number, number][],
  comparison: ColorComparison,
): (
  r: number,
  g: number,
  b: number,
  tolerance: number,
  random?: () => number,
) => number {
  if (comparison === "rgb") {
    return (r, g, b, tolerance, random) =>
      pickTileIndex(r, g, b, avgColors, tolerance, random);
  }

  // 座標のタプルへの変換は比較処理の内部に限定する。元の RGB 配列は保持する
  const oklabCoordinates = avgColors.map(
    ([r, g, b]): [number, number, number] => {
      const color = srgbToOklab(r, g, b);
      return [color.L, color.a, color.b];
    },
  );
  return (r, g, b, tolerance, random) => {
    const target = srgbToOklab(r, g, b);
    return pickTileIndex(
      target.L,
      target.a,
      target.b,
      oklabCoordinates,
      tolerance,
      random,
    );
  };
}
