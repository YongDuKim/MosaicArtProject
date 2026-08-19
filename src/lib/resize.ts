/**
 * 画像の高品質な縮小。
 *
 * `drawImage` で一度に大きく縮小すると、縮小率に対して元画像の高周波成分が
 * 残りすぎてエイリアシングが起きる。細部が潰れて画質が落ちるだけでなく、
 * 元画像に無い高周波ノイズが生まれるため JPEG の圧縮効率も下がる。
 * 目標の2倍を超える間は1/2ずつ縮小し、各段階を実質的なローパスとして働かせる。
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
