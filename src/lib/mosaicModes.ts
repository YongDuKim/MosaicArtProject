import { oklabToSrgb, prepareTilePicker, srgbToOklab } from "./colorComparison";
import type { ColorComparison, MosaicMode } from "./types";

type RGB = [number, number, number];
export const MODE_ORDER: MosaicMode[] = ["color", "balanced", "structure"];
export const MOSAIC_MODES = {
  color: { label: "色を優先", hint: "元画像の各部分に近い色を選ぶ" },
  balanced: {
    label: "バランス",
    hint: "元の色の印象を残しながら、明暗や境界を保つ",
  },
  structure: {
    label: "形を優先",
    hint: "素材に合わせて配色を変え、輪郭や陰影を表す",
  },
} as const;

interface Distribution {
  low: number;
  high: number;
  meanA: number;
  meanB: number;
  axisA: number;
  axisB: number;
  chromaLow: number;
  chromaHigh: number;
}

export interface MosaicAnalysis {
  cells: Uint8ClampedArray;
  labs: Float32Array;
  width: number;
  height: number;
  source: Distribution;
  palette: Distribution;
  tileColors: RGB[];
  tileLabs: Float32Array;
}

const clamp = (v: number, low = 0, high = 1) =>
  Math.max(low, Math.min(high, v));
const span = (d: Distribution) => d.high - d.low;
const chromaSpan = (d: Distribution) => d.chromaHigh - d.chromaLow;

function distribution(labs: Float32Array): Distribution {
  const count = labs.length / 3;
  const histogram = new Uint32Array(256);
  let low = 1,
    high = 0,
    meanA = 0,
    meanB = 0;
  for (let i = 0; i < labs.length; i += 3) {
    const L = labs[i];
    low = Math.min(low, L);
    high = Math.max(high, L);
    histogram[clamp(Math.floor(L * 255), 0, 255)]++;
    meanA += labs[i + 1] / count;
    meanB += labs[i + 2] / count;
  }
  // 小さな外れ値だけで明暗の幅が決まるのを避ける。単色は幅0のまま扱う。
  let accumulated = 0;
  for (let b = 0; b < 256; b++) {
    accumulated += histogram[b];
    if (accumulated < count * 0.01) low = Math.max(low, b / 255);
    if (accumulated >= count * 0.99) {
      high = Math.min(high, (b + 1) / 255);
      break;
    }
  }
  let aa = 0,
    ab = 0,
    bb = 0;
  for (let i = 0; i < labs.length; i += 3) {
    const a = labs[i + 1] - meanA,
      b = labs[i + 2] - meanB;
    aa += a * a;
    ab += a * b;
    bb += b * b;
  }
  const angle = 0.5 * Math.atan2(2 * ab, aa - bb);
  const axisA = Math.cos(angle),
    axisB = Math.sin(angle);
  let chromaLow = Infinity,
    chromaHigh = -Infinity;
  for (let i = 0; i < labs.length; i += 3) {
    const projection =
      (labs[i + 1] - meanA) * axisA + (labs[i + 2] - meanB) * axisB;
    chromaLow = Math.min(chromaLow, projection);
    chromaHigh = Math.max(chromaHigh, projection);
  }
  return { low, high, meanA, meanB, axisA, axisB, chromaLow, chromaHigh };
}

/** 生成でも使う同じグリッドの代表色を解析する。Canvas や DOM に依存しない。 */
export function analyzeMosaic(
  cells: Uint8ClampedArray,
  width: number,
  height: number,
  tileColors: RGB[],
): MosaicAnalysis {
  if (
    width < 1 ||
    height < 1 ||
    cells.length !== width * height * 4 ||
    !tileColors.length
  ) {
    throw new Error("解析に必要な画像またはタイルがありません");
  }
  const labs = new Float32Array(width * height * 3);
  for (let p = 0; p < width * height; p++) {
    const c = srgbToOklab(cells[p * 4], cells[p * 4 + 1], cells[p * 4 + 2]);
    labs.set([c.L, c.a, c.b], p * 3);
  }
  const tileLabs = new Float32Array(tileColors.length * 3);
  tileColors.forEach((rgb, i) => {
    const c = srgbToOklab(...rgb);
    tileLabs.set([c.L, c.a, c.b], i * 3);
  });
  return {
    cells,
    labs,
    width,
    height,
    source: distribution(labs),
    palette: distribution(tileLabs),
    tileColors,
    tileLabs,
  };
}

export function hasLimitedPalette(analysis: MosaicAnalysis): boolean {
  return span(analysis.palette) < 0.08 && chromaSpan(analysis.palette) < 0.04;
}

/** 実画像比較で調整する内部設定。UI には仕上がりの3択だけを出す。 */
export const MODE_SETTINGS = {
  balanced: { adaptation: 0.55, relation: 0.7, chromaToLightness: 1 },
  structure: { adaptation: 1, relation: 2, chromaToLightness: 1 },
};

/** 素材の明るさごとに平均色を求め、紺〜明るい青などの対応を素材から作る。 */
function paletteRamp(analysis: MosaicAnalysis): Float32Array {
  const ramp = new Float32Array(33 * 2);
  const bandwidth = Math.max(0.025, span(analysis.palette) / 8);
  for (let step = 0; step <= 32; step++) {
    const L = analysis.palette.low + (span(analysis.palette) * step) / 32;
    let weight = 0;
    for (let p = 0; p < analysis.tileLabs.length; p += 3) {
      const w = Math.exp(-0.5 * ((analysis.tileLabs[p] - L) / bandwidth) ** 2);
      weight += w;
      ramp[step * 2] += w * analysis.tileLabs[p + 1];
      ramp[step * 2 + 1] += w * analysis.tileLabs[p + 2];
    }
    ramp[step * 2] /= weight;
    ramp[step * 2 + 1] /= weight;
  }
  return ramp;
}

export interface ModePicker {
  /** 色補正も、この目標 RGB に向けて行う。 */
  targets: Uint8ClampedArray;
  pick: (cell: number, tolerance: number, random?: () => number) => number;
}

/**
 * 配色変換と近傍の関係による選択。色優先は既存の乱数消費順も維持する。
 * 適応モードは全体共通の連続変換と2方向の改善で、走査方向への偏りを抑える。
 */
export function prepareModePicker(
  analysis: MosaicAnalysis,
  mode: MosaicMode,
  comparison: ColorComparison,
  onProgress: (percent: number) => void = () => {},
  settings = mode === "color" ? MODE_SETTINGS.balanced : MODE_SETTINGS[mode],
): ModePicker {
  const { cells, labs, source, palette, tileColors, tileLabs, width, height } =
    analysis;
  if (mode === "color") {
    const picker = prepareTilePicker(tileColors, comparison);
    return {
      targets: cells,
      pick: (cell, tolerance, random) =>
        picker(
          cells[cell * 4],
          cells[cell * 4 + 1],
          cells[cell * 4 + 2],
          tolerance,
          random,
        ),
    };
  }

  const count = width * height;
  const targets = new Uint8ClampedArray(cells.length);
  const targetLabs = new Float32Array(labs.length);
  const ramp = paletteRamp(analysis);
  const sourceChroma = chromaSpan(source);
  const paletteChroma = chromaSpan(palette);
  const missingChroma =
    sourceChroma > 0.02 ? clamp(1 - paletteChroma / sourceChroma) : 0;
  // 明暗がほぼない画像では、色味の差を素材の明暗へ対応させる。
  const chromaWeight =
    missingChroma *
    settings.chromaToLightness *
    (span(source) < 0.04 ? 1 : 0.08);
  const chromaScale =
    sourceChroma > 0.001 ? Math.min(1, paletteChroma / sourceChroma) : 0;
  // 素材に色差があっても、その方向が元画像と直交していると最近傍は潰れる。
  // その場合は元画像の色味の主方向を素材の主方向へ対応させる。
  let projectedLow = Infinity,
    projectedHigh = -Infinity;
  for (let i = 0; i < tileLabs.length; i += 3) {
    const projection =
      tileLabs[i + 1] * source.axisA + tileLabs[i + 2] * source.axisB;
    projectedLow = Math.min(projectedLow, projection);
    projectedHigh = Math.max(projectedHigh, projection);
  }
  const rotateChroma =
    sourceChroma > 0.02 &&
    paletteChroma > 0.04 &&
    projectedHigh - projectedLow < paletteChroma * 0.5;
  const direction =
    source.axisA * palette.axisA + source.axisB * palette.axisB < 0 ? -1 : 1;
  for (let p = 0; p < count; p++) {
    const i = p * 3;
    const tone =
      span(source) > 0.01 ? clamp((labs[i] - source.low) / span(source)) : 0.5;
    const projection =
      (labs[i + 1] - source.meanA) * source.axisA +
      (labs[i + 2] - source.meanB) * source.axisB;
    const chromaTone =
      sourceChroma > 0.001
        ? clamp((projection - source.chromaLow) / sourceChroma)
        : 0.5;
    const t = tone * (1 - chromaWeight) + chromaTone * chromaWeight;
    const step = t * 32,
      start = Math.min(31, Math.floor(step)),
      fraction = step - start;
    const a =
      ramp[start * 2] * (1 - fraction) + ramp[(start + 1) * 2] * fraction;
    const b =
      ramp[start * 2 + 1] * (1 - fraction) +
      ramp[(start + 1) * 2 + 1] * fraction;
    const adapt = settings.adaptation;
    let residualA = labs[i + 1] - source.meanA;
    let residualB = labs[i + 2] - source.meanB;
    if (rotateChroma) {
      const major = residualA * source.axisA + residualB * source.axisB;
      const minor = -residualA * source.axisB + residualB * source.axisA;
      residualA = direction * (major * palette.axisA - minor * palette.axisB);
      residualB = direction * (major * palette.axisB + minor * palette.axisA);
    }
    const rgb = oklabToSrgb({
      L: labs[i] * (1 - adapt) + (palette.low + t * span(palette)) * adapt,
      a: labs[i + 1] * (1 - adapt) + (a + residualA * chromaScale) * adapt,
      b: labs[i + 2] * (1 - adapt) + (b + residualB * chromaScale) * adapt,
    });
    targets.set([...rgb, 255], p * 4);
    const lab = srgbToOklab(
      targets[p * 4],
      targets[p * 4 + 1],
      targets[p * 4 + 2],
    );
    targetLabs.set([lab.L, lab.a, lab.b], i);
  }
  onProgress(20);

  // 同色写真も候補に残す一方、同色だけで近傍候補の枠を埋めない。
  const groups: number[][] = [];
  const groupByColor = new Map<string, number>();
  tileColors.forEach((rgb, tile) => {
    const key = rgb.join(",");
    let group = groupByColor.get(key);
    if (group === undefined) {
      group = groups.length;
      groupByColor.set(key, group);
      groups.push([]);
    }
    groups[group].push(tile);
  });
  const candidateCache = new Map<number, number[]>();
  const distance = (p: number, tile: number) => {
    let result = 0;
    for (let c = 0; c < 3; c++) {
      const delta =
        comparison === "rgb"
          ? (targets[p * 4 + c] - tileColors[tile][c]) / (255 * Math.sqrt(3))
          : targetLabs[p * 3 + c] - tileLabs[tile * 3 + c];
      result += delta * delta;
    }
    return result;
  };
  // 5 bit の色ごとに候補を共有する。セル数×素材数の候補配列を保持しない。
  const candidatesFor = (p: number) => {
    const key =
      (targets[p * 4] >> 3) * 1024 +
      (targets[p * 4 + 1] >> 3) * 32 +
      (targets[p * 4 + 2] >> 3);
    let candidates = candidateCache.get(key);
    if (!candidates) {
      candidates = groups
        .map((_, i) => i)
        .sort((a, b) => distance(p, groups[a][0]) - distance(p, groups[b][0]))
        .slice(0, 12);
      candidateCache.set(key, candidates);
    }
    return candidates;
  };
  const chosen = new Uint32Array(count);
  for (let p = 0; p < count; p++) {
    chosen[p] = groups[candidatesFor(p)[0]][0];
  }
  const neighbors = new Int32Array(4);
  const findNeighbors = (p: number) => {
    let n = 0;
    if (p % width > 0) neighbors[n++] = p - 1;
    if (p % width < width - 1) neighbors[n++] = p + 1;
    if (p >= width) neighbors[n++] = p - width;
    if (p + width < count) neighbors[n++] = p + width;
    return n;
  };
  const score = (p: number, tile: number, neighborCount: number) => {
    let relation = 0;
    for (let n = 0; n < neighborCount; n++) {
      const q = neighbors[n],
        other = chosen[q];
      for (let c = 0; c < 3; c++) {
        const wanted = targetLabs[p * 3 + c] - targetLabs[q * 3 + c];
        const actual = tileLabs[tile * 3 + c] - tileLabs[other * 3 + c];
        relation += (wanted - actual) ** 2;
      }
      const originalL = labs[p * 3] - labs[q * 3];
      // 明確な元画像の明暗を逆転させる候補を抑える。
      if (Math.abs(originalL) > 0.02) {
        const actualL =
          (tileLabs[tile * 3] - tileLabs[other * 3]) * Math.sign(originalL);
        relation += 2 * Math.min(0, actualL) ** 2;
      }
    }
    return (
      distance(p, tile) +
      (settings.relation * relation) / Math.max(1, neighborCount)
    );
  };
  const choose = (
    p: number,
    tolerance: number,
    random: () => number = Math.random,
  ) => {
    const candidates = candidatesFor(p),
      n = findNeighbors(p);
    let best = candidates[0],
      bestScore = Infinity;
    const scores = candidates.map((group) => {
      const value = score(p, groups[group][0], n);
      if (value < bestScore) {
        bestScore = value;
        best = group;
      }
      return value;
    });
    if (tolerance > 0) {
      const allowance =
        comparison === "rgb" ? tolerance / (255 * Math.sqrt(3)) : tolerance;
      const limit = (Math.sqrt(bestScore) + allowance) ** 2;
      const eligible = candidates.filter((_, i) => scores[i] <= limit);
      const total = eligible.reduce(
        (sum, group) => sum + groups[group].length,
        0,
      );
      let index = Math.floor(random() * total);
      for (const group of eligible) {
        if (index < groups[group].length) {
          chosen[p] = groups[group][index];
          return chosen[p];
        }
        index -= groups[group].length;
      }
    }
    chosen[p] = groups[best][0];
    return chosen[p];
  };
  // 反対方向からも評価して、右・下の領域との関係を選択へ反映する。
  for (let p = 0; p < count; p++) choose(p, 0);
  onProgress(60);
  for (let p = count - 1; p >= 0; p--) choose(p, 0);
  onProgress(100);
  return { targets, pick: choose };
}
