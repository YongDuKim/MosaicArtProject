import { useEffect, useRef } from "react";

/** サムネイルの表示サイズ (CSS ピクセル) */
const THUMB_PX = 32;

/**
 * タイル bitmap を小さな canvas に描くサムネイル。
 * bitmap はセンタークロップ済みの正方形なので、正方形 canvas にそのまま収まる。
 * ImageBitmap は <img> に直接使えないため canvas で描画する (Blob URL 不要)。
 */
export default function TileThumb({
  bitmap,
}: {
  bitmap: ImageBitmap | undefined;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !bitmap) return;
    // Retina でぼやけないよう devicePixelRatio 分の解像度で描く
    const dpr = window.devicePixelRatio || 1;
    canvas.width = THUMB_PX * dpr;
    canvas.height = THUMB_PX * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  }, [bitmap]);

  if (!bitmap) {
    return <span className="tile-thumb tile-thumb--missing" aria-hidden />;
  }
  return <canvas ref={ref} className="tile-thumb" aria-hidden />;
}
