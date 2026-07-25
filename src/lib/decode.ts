/**
 * 画像デコードの共通処理。
 *
 * デスクトップの Chrome/Firefox/Edge は HEIC/HEIF を createImageBitmap で
 * デコードできない。iOS はピッカーが渡す時点で JPEG へ変換するため問題ないが、
 * PC ではブラウザ内でデコードする必要がある。
 * HEIC を検出したときだけ heic-to (wasm2js。外部通信・外部ファイル取得なし) を
 * 動的 import してデコードし、通常の画像は従来どおりネイティブ処理する。
 */

/** ISOBMFF (ftyp) の major brand が HEIC/HEIF 系かを判定する */
const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "heim",
  "heis",
  "hevc",
  "hevx",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
  "heif",
]);

/**
 * 先頭バイトのマジックナンバーで HEIC/HEIF かを判定する。
 * デスクトップでは File.type が空になることが多く拡張子も当てにできないため、
 * 中身で判定する。
 */
export async function isHeic(blob: Blob): Promise<boolean> {
  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  if (head.length < 12) return false;
  const ftyp = String.fromCharCode(head[4], head[5], head[6], head[7]);
  if (ftyp !== "ftyp") return false;
  const brand = String.fromCharCode(head[8], head[9], head[10], head[11]);
  return HEIF_BRANDS.has(brand);
}

/**
 * Blob を ImageBitmap へデコードする。HEIC/HEIF はブラウザ内で変換してから返す。
 * heic-to は数 MB あるため、HEIC を実際に検出したときだけ動的 import する。
 */
export async function decodeImageBitmap(
  blob: Blob,
  options?: ImageBitmapOptions,
): Promise<ImageBitmap> {
  if (await isHeic(blob)) {
    const { heicTo } = await import("heic-to");
    return heicTo({ blob, type: "bitmap", options });
  }
  return options ? createImageBitmap(blob, options) : createImageBitmap(blob);
}
