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

/**
 * 同じ色空間の3成分を比較し、二乗距離が最小のインデックスを返す。
 * RGB では R/G/B、Oklab では L/a/b を渡す。同距離なら先の候補を優先する
 */
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

/**
 * 目標色へのユークリッド距離が最小距離 + tolerance 以内の
 * インデックスを元の順序で返す。成分と tolerance は同じ色空間の尺度で指定する。
 * 色が近いタイルが多数あるとき、常に同じ1枚に集中させずに散らすための候補集合。
 */
export function findSimilarColorIndices(
  r: number,
  g: number,
  b: number,
  avgColors: [number, number, number][],
  tolerance: number,
): number[] {
  const closest = findClosestColorIndex(r, g, b, avgColors);
  const [cr, cg, cb] = avgColors[closest];
  const closestDistance = Math.sqrt(
    (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2,
  );
  const limit = (closestDistance + tolerance) ** 2;
  const candidates: number[] = [];
  for (let i = 0; i < avgColors.length; i++) {
    const [tr, tg, tb] = avgColors[i];
    const d = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2;
    if (d <= limit) candidates.push(i);
  }
  return candidates;
}

/**
 * セルに貼るタイルを選ぶ。tolerance が 0 なら最近傍を返し、
 * 正なら目標色への距離が最小距離 + tolerance 以内の候補から一様ランダムに1枚選ぶ。
 * random はテストで固定できるように注入する (0 以上 1 未満を返すこと)。
 */
export function pickTileIndex(
  r: number,
  g: number,
  b: number,
  avgColors: [number, number, number][],
  tolerance: number,
  random: () => number = Math.random,
): number {
  if (tolerance <= 0) return findClosestColorIndex(r, g, b, avgColors);
  const candidates = findSimilarColorIndices(r, g, b, avgColors, tolerance);
  return candidates[Math.floor(random() * candidates.length)];
}
