/**
 * 画像全体の平均色を計算する。
 * 小さいキャンバスに縮小描画してピクセル平均を取る
 * (Python版の GaussianBlur(2) + mean と実質同等)。
 */
export function averageColorOfBitmap(
  bitmap: ImageBitmap,
  sampleSize = 32,
): [number, number, number] {
  const canvas = new OffscreenCanvas(sampleSize, sampleSize);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2Dコンテキストを取得できませんでした");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, sampleSize, sampleSize);
  const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
  let r = 0;
  let g = 0;
  let b = 0;
  const pixels = sampleSize * sampleSize;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  return [
    Math.round(r / pixels),
    Math.round(g / pixels),
    Math.round(b / pixels),
  ];
}

/** RGB二乗距離が最小のタイルのインデックスを返す */
export function findClosestColorIndex(
  r: number,
  g: number,
  b: number,
  avgColors: [number, number, number][],
): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < avgColors.length; i++) {
    const [tr, tg, tb] = avgColors[i];
    const d = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}
