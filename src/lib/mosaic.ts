import type {
  JpegResolution,
  MosaicDone,
  MosaicPlan,
  WorkerRequest,
} from "./types";
import { findClosestColorIndex } from "./colorUtils";
import { JPEG_QUALITY, extensionForMimeType, mimeForFormat } from "./format";
import { drawDownscaled } from "./resize";

/** ブラウザの canvas 1辺の実用上限に合わせた出力1辺の最大値 (デスクトップ) */
export const MAX_OUTPUT_DIM = 16384;

/**
 * モバイル端末での出力1辺の最大値。
 * iOS の WebKit は canvas の面積上限が小さく (実用上 4096×4096 程度)、
 * 超えると drawImage / convertToBlob が InvalidStateError を投げる。
 */
export const MOBILE_MAX_OUTPUT_DIM = 4096;

/** 実行中の端末に応じた出力1辺の上限を返す */
export function deviceMaxOutputDim(): number {
  if (typeof navigator === "undefined") return MAX_OUTPUT_DIM;
  const ua = navigator.userAgent;
  // タッチ対応のデスクトップ (Windows ノート等) は maxTouchPoints > 1 になるため、
  // それ単独ではモバイル判定しない。判定は userAgent を主に用いる。
  // iPadOS 13+ は Mac を偽装するので、その場合のみタッチ数を併用して補足する。
  const iPadOS = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  const mobile = /iPhone|iPad|iPod|Android|Mobile/i.test(ua) || iPadOS;
  return mobile ? MOBILE_MAX_OUTPUT_DIM : MAX_OUTPUT_DIM;
}

/**
 * JPG の書き出し解像度ごとの、出力長辺の上限 (px)。
 * high は縮小しない (生成した原寸のまま書き出す)。
 */
export const JPEG_RESOLUTION_LIMITS: Record<JpegResolution, number> = {
  low: 2048,
  medium: 4096,
  high: Infinity,
};

/**
 * 長辺を上限に収めたときの書き出しサイズ。
 * 元より大きくはしない (拡大しても情報は増えないため)。
 */
export function scaledOutputSize(
  width: number,
  height: number,
  maxLongEdge: number,
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) return { width, height };
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * 出力レイアウトを計算する。
 * grid = 入力サイズ / x、出力 = grid × n (mosaic_art_mk5.py と同じ)。
 * 出力が maxDim を超える場合はタイル解像度 n を自動縮小する。
 */
export function computePlan(
  imageWidth: number,
  imageHeight: number,
  x: number,
  n: number,
  maxDim = deviceMaxOutputDim(),
): MosaicPlan {
  const gridWidth = Math.max(1, Math.floor(imageWidth / x));
  const gridHeight = Math.max(1, Math.floor(imageHeight / x));
  const maxGrid = Math.max(gridWidth, gridHeight);
  let effectiveN = n;
  let capped = false;
  if (maxGrid * n > maxDim) {
    effectiveN = Math.max(1, Math.floor(maxDim / maxGrid));
    capped = true;
  }
  return {
    gridWidth,
    gridHeight,
    effectiveN,
    outputWidth: gridWidth * effectiveN,
    outputHeight: gridHeight * effectiveN,
    capped,
    maxDim,
  };
}

/** 書き出し用に出力キャンバスを縮小する。上限内ならそのまま返す。 */
function downscaleForExport(
  source: OffscreenCanvas,
  maxLongEdge: number,
): OffscreenCanvas {
  const target = scaledOutputSize(source.width, source.height, maxLongEdge);
  if (target.width === source.width && target.height === source.height) {
    return source;
  }
  return drawDownscaled(
    source,
    { x: 0, y: 0, width: source.width, height: source.height },
    target.width,
    target.height,
  );
}

/** モザイクアートを生成する (Worker 内で実行される) */
export async function generateMosaic(
  req: WorkerRequest,
  onProgress: (percent: number, label?: string) => void,
): Promise<MosaicDone> {
  const {
    input,
    tiles,
    gridWidth,
    gridHeight,
    n,
    rotate,
    colorAdjust,
    format,
    jpegResolution,
  } = req;

  // 入力画像をグリッドサイズに縮小し、1ピクセル = 1セルの平均色として読む
  const small = new OffscreenCanvas(gridWidth, gridHeight);
  const smallCtx = small.getContext("2d", { willReadFrequently: true });
  if (!smallCtx) throw new Error("2Dコンテキストを取得できませんでした");
  smallCtx.imageSmoothingQuality = "high";
  smallCtx.drawImage(input, 0, 0, gridWidth, gridHeight);
  const cellData = smallCtx.getImageData(0, 0, gridWidth, gridHeight).data;
  // transfer されたコピーなので、読み終わったら即座に解放してメモリを抑える
  input.close();

  // タイルを n×n に事前リサイズし、色シフト用にピクセル配列も保持する
  const tileCanvases: OffscreenCanvas[] = [];
  const tilePixels: Uint8ClampedArray[] = [];
  for (const tile of tiles) {
    // 256px のタイルを n (既定25) まで一気に縮小するとエイリアシングが出るため、
    // 段階的縮小を挟む
    const canvas = drawDownscaled(
      tile.bitmap,
      { x: 0, y: 0, width: tile.bitmap.width, height: tile.bitmap.height },
      n,
      n,
      { willReadFrequently: colorAdjust > 0 },
    );
    tileCanvases.push(canvas);
    if (colorAdjust > 0) {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("2Dコンテキストを取得できませんでした");
      tilePixels.push(ctx.getImageData(0, 0, n, n).data);
    }
    tile.bitmap.close();
  }
  const avgColors = tiles.map((tile) => tile.avgColor);

  // 色シフト後のタイルを描画するための使い回しスクラッチ
  const scratch = new OffscreenCanvas(n, n);
  const scratchCtx = scratch.getContext("2d");
  if (!scratchCtx) throw new Error("2Dコンテキストを取得できませんでした");
  const scratchData = new ImageData(n, n);

  const output = new OffscreenCanvas(gridWidth * n, gridHeight * n);
  const outCtx = output.getContext("2d");
  if (!outCtx) throw new Error("2Dコンテキストを取得できませんでした");

  const counts = new Array<number>(tiles.length).fill(0);
  const assignments = new Uint16Array(gridWidth * gridHeight);
  let lastPercent = -1;

  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const i = (gy * gridWidth + gx) * 4;
      const tileIndex = findClosestColorIndex(
        cellData[i],
        cellData[i + 1],
        cellData[i + 2],
        avgColors,
      );
      counts[tileIndex]++;
      assignments[gy * gridWidth + gx] = tileIndex;

      // 色補正: セル目標色とタイル平均色の差分を全ピクセルに加算する。
      // 単色を上塗りせずテクスチャを保つため、拡大してもタイルの中身が判別できる
      const avg = avgColors[tileIndex];
      const dr = Math.round((cellData[i] - avg[0]) * colorAdjust);
      const dg = Math.round((cellData[i + 1] - avg[1]) * colorAdjust);
      const db = Math.round((cellData[i + 2] - avg[2]) * colorAdjust);
      let source: OffscreenCanvas = tileCanvases[tileIndex];
      if (colorAdjust > 0 && (dr !== 0 || dg !== 0 || db !== 0)) {
        const src = tilePixels[tileIndex];
        const dst = scratchData.data;
        for (let p = 0; p < src.length; p += 4) {
          dst[p] = src[p] + dr;
          dst[p + 1] = src[p + 1] + dg;
          dst[p + 2] = src[p + 2] + db;
          dst[p + 3] = 255;
        }
        scratchCtx.putImageData(scratchData, 0, 0);
        source = scratch;
      }

      const rotation = rotate ? Math.floor(Math.random() * 4) : 0;
      if (rotation === 0) {
        outCtx.drawImage(source, gx * n, gy * n);
      } else {
        outCtx.save();
        outCtx.translate(gx * n + n / 2, gy * n + n / 2);
        outCtx.rotate((rotation * Math.PI) / 2);
        outCtx.drawImage(source, -n / 2, -n / 2);
        outCtx.restore();
      }
    }
    // エンコード (大出力では数十秒かかる) の分を残すため 90% までに収める
    const percent = Math.round(((gy + 1) / gridHeight) * 90);
    if (percent !== lastPercent) {
      lastPercent = percent;
      onProgress(percent);
    }
  }

  const mime = mimeForFormat(format);
  // PNG は劣化なしで残す用途なので常に原寸。JPG だけ書き出し解像度を適用する
  const encodeSource =
    format === "jpeg"
      ? downscaleForExport(output, JPEG_RESOLUTION_LIMITS[jpegResolution])
      : output;
  onProgress(95, `${extensionForMimeType(mime).toUpperCase()}エンコード中…`);
  // 品質は PNG では無視される
  const blob = await encodeSource.convertToBlob({
    type: mime,
    quality: JPEG_QUALITY,
  });

  const totalTiles = gridWidth * gridHeight;
  const stats = tiles
    .map((tile, i) => ({
      name: tile.name,
      index: i,
      count: counts[i],
      percentage: (counts[i] / totalTiles) * 100,
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    type: "done",
    blob,
    stats,
    tileNames: tiles.map((tile) => tile.name),
    assignments,
    totalTiles,
    usedTileKinds: stats.length,
    tileKindsTotal: tiles.length,
    gridWidth,
    gridHeight,
    outputWidth: encodeSource.width,
    outputHeight: encodeSource.height,
  };
}
