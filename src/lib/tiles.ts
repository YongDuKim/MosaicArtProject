import type { TileInfo } from "./types";
import { averageColorOfBitmap } from "./colorUtils";
import { decodeImageBitmap } from "./decode";
import { drawDownscaled } from "./resize";

/** タイルとして保持する正方形ビットマップの1辺 (n の最大値 128 の2倍の品質余裕) */
const TILE_SIZE = 256;

/**
 * デコード時に縮小する目標幅。最終縮小は自前の高品質描画で仕上げるため、
 * TILE_SIZE の2倍を確保してエンジン側 resize の品質差を吸収する。
 */
const DECODE_TARGET = TILE_SIZE * 2;

/** タイルの重複判定キー。iOS のピッカーは再選択のたびに再変換して lastModified が変わるため、名前とサイズのみで判定する */
export const tileKey = (file: File) => `${file.name}:${file.size}`;

/**
 * デコード時に縮小してビットマップを得る。
 * 12MP 級の写真をフル解像度でデコードするとメモリを大きく消費し、
 * スマートフォンではクラッシュや極端な低速化の原因になるため。
 * resize オプション未対応のエンジンではフル解像度デコードにフォールバックする
 * (cropToSquareTile が任意サイズを正規化するので結果は同じ)。
 */
async function decodeReduced(blob: Blob): Promise<ImageBitmap> {
  try {
    let bitmap = await decodeImageBitmap(blob, {
      resizeWidth: DECODE_TARGET,
      resizeQuality: "high",
    });
    // 横長パノラマ等で短辺 (高さ) がタイルサイズを下回った場合は高さ基準で取り直す
    if (bitmap.height < TILE_SIZE) {
      bitmap.close();
      bitmap = await decodeImageBitmap(blob, {
        resizeHeight: DECODE_TARGET,
        resizeQuality: "high",
      });
    }
    return bitmap;
  } catch {
    return decodeImageBitmap(blob);
  }
}

/**
 * 中央の正方形を切り抜いて TILE_SIZE px に縮小する。
 * アスペクト比の違う写真を歪ませず、フル解像度のビットマップを保持しないための前処理。
 */
async function cropToSquareTile(source: ImageBitmap): Promise<ImageBitmap> {
  const side = Math.min(source.width, source.height);
  const size = Math.min(TILE_SIZE, side);
  const canvas = drawDownscaled(
    source,
    {
      x: (source.width - side) / 2,
      y: (source.height - side) / 2,
      width: side,
      height: side,
    },
    size,
    size,
  );
  return createImageBitmap(canvas);
}

async function toTileInfo(file: File): Promise<TileInfo> {
  const reduced = await decodeReduced(file);
  try {
    const bitmap = await cropToSquareTile(reduced);
    return {
      name: file.name,
      key: tileKey(file),
      avgColor: averageColorOfBitmap(bitmap),
      bitmap,
    };
  } finally {
    reduced.close();
  }
}

/** タイル読み込みの進行コールバック */
export interface TileLoadCallbacks {
  onTile: (tile: TileInfo, done: number, total: number) => void;
  onSkip: (name: string, done: number, total: number) => void;
}

/** タイルセットの読み込み結果 */
export interface TilesLoadResult {
  loaded: number;
  /** デコードできずスキップしたファイル数 (HEIC・動画・破損ファイルなど) */
  skipped: number;
  total: number;
}

/**
 * ファイル群をタイルへ変換し、1枚完了するごとにコールバックへ流す。
 * 読めないファイルはスキップして続行する。
 */
export async function loadTilesStreaming(
  files: File[],
  concurrency: number,
  callbacks: TileLoadCallbacks,
): Promise<TilesLoadResult> {
  const total = files.length;
  const queue = [...files];
  let done = 0;
  let loaded = 0;
  let skipped = 0;

  // 数百枚のデコードを直列にすると遅いため、少数並列で処理する
  const workers = Array.from(
    { length: Math.min(concurrency, queue.length) },
    async () => {
      for (let file = queue.shift(); file; file = queue.shift()) {
        try {
          const tile = await toTileInfo(file);
          done++;
          loaded++;
          callbacks.onTile(tile, done, total);
        } catch {
          done++;
          skipped++;
          callbacks.onSkip(file.name, done, total);
        }
      }
    },
  );
  await Promise.all(workers);

  return { loaded, skipped, total };
}

/**
 * メインスレッド用フォールバック: Worker が生成できない環境で
 * ファイル群からタイル配列を作る。
 */
export async function loadTiles(
  files: File[],
  concurrency: number,
  onProgress?: (done: number, total: number) => void,
): Promise<{ tiles: TileInfo[]; skipped: string[]; total: number }> {
  const tiles: TileInfo[] = [];
  const skipped: string[] = [];
  await loadTilesStreaming(files, concurrency, {
    onTile: (tile, done, total) => {
      tiles.push(tile);
      onProgress?.(done, total);
    },
    onSkip: (name, done, total) => {
      skipped.push(name);
      onProgress?.(done, total);
    },
  });
  return { tiles, skipped, total: files.length };
}
