/**
 * 画像縮小の共通処理。目標の2倍を超える間は1/2ずつ縮小する。
 *
 * 大きな縮小率を `drawImage` 一回で処理すると、エンジンの実装によっては
 * エイリアシングが出る。Chrome では一回の縮小と段階的縮小で画質・JPEG の
 * ファイルサイズとも差が出ないことを確認済みだが、縮小結果をエンジンの
 * リサンプラ任せにしないために自前で段階的に縮める。
 * 縮小箇所が3か所 (タイル読み込み・生成時のタイル配置・JPG 書き出し) あるため、
 * 実装をここへ集約する。
 */

/** 縮小元として切り出す領域 */
export interface SourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 段階的縮小で経由する中間サイズの列。
 * 最終サイズは含まない (縮小率が2倍以内になった時点で打ち切る)。
 */
export function halvingSteps(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): { width: number; height: number }[] {
  const steps: { width: number; height: number }[] = [];
  let width = sourceWidth;
  let height = sourceHeight;
  while (width > targetWidth * 2 && height > targetHeight * 2) {
    width = Math.ceil(width / 2);
    height = Math.ceil(height / 2);
    steps.push({ width, height });
  }
  return steps;
}

function context2d(
  canvas: OffscreenCanvas,
  willReadFrequently: boolean,
): OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { willReadFrequently });
  if (!ctx) throw new Error("2Dコンテキストを取得できませんでした");
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

/** 中間キャンバスを速やかに解放する (原寸に近く大きいため) */
function release(canvas: OffscreenCanvas): void {
  canvas.width = 0;
  canvas.height = 0;
}

/**
 * 元画像の指定領域を、段階的縮小を挟んで目標サイズへ描画したキャンバスを返す。
 * 拡大方向や2倍以内の縮小では中間段階を作らず、そのまま描画する。
 */
export function drawDownscaled(
  source: ImageBitmap | OffscreenCanvas,
  rect: SourceRect,
  targetWidth: number,
  targetHeight: number,
  options: { willReadFrequently?: boolean } = {},
): OffscreenCanvas {
  let current: ImageBitmap | OffscreenCanvas = source;
  let { x, y, width, height } = rect;

  for (const step of halvingSteps(
    rect.width,
    rect.height,
    targetWidth,
    targetHeight,
  )) {
    const canvas = new OffscreenCanvas(step.width, step.height);
    context2d(canvas, false).drawImage(
      current,
      x,
      y,
      width,
      height,
      0,
      0,
      step.width,
      step.height,
    );
    if (current !== source) release(current as OffscreenCanvas);
    current = canvas;
    x = 0;
    y = 0;
    width = step.width;
    height = step.height;
  }

  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  context2d(canvas, options.willReadFrequently ?? false).drawImage(
    current,
    x,
    y,
    width,
    height,
    0,
    0,
    targetWidth,
    targetHeight,
  );
  if (current !== source) release(current as OffscreenCanvas);
  return canvas;
}
