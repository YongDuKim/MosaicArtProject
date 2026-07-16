import type { TileInfo } from './types'
import { averageColorOfBitmap } from './colorUtils'

/** タイルとして保持する正方形ビットマップの1辺 (n の最大値 128 の2倍の品質余裕) */
const TILE_SIZE = 256

/**
 * 中央の正方形を切り抜いて TILE_SIZE px に縮小する。
 * アスペクト比の違う写真を歪ませず、フル解像度のビットマップを保持しないための前処理。
 */
async function cropToSquareTile(source: ImageBitmap): Promise<ImageBitmap> {
  const side = Math.min(source.width, source.height)
  const sx = (source.width - side) / 2
  const sy = (source.height - side) / 2
  const size = Math.min(TILE_SIZE, side)

  // 高解像度写真を一気に縮小するとエイリアシングで細部が潰れるため、
  // 目標の2倍を超える間は1/2ずつ段階的に縮小してから最終サイズへ描画する
  let current: OffscreenCanvas | ImageBitmap = source
  let currentSide = side
  let cropX = sx
  let cropY = sy
  while (currentSide > size * 2) {
    const half = Math.ceil(currentSide / 2)
    const halfCanvas = new OffscreenCanvas(half, half)
    const halfCtx = halfCanvas.getContext('2d')
    if (!halfCtx) throw new Error('2Dコンテキストを取得できませんでした')
    halfCtx.imageSmoothingQuality = 'high'
    halfCtx.drawImage(current, cropX, cropY, currentSide, currentSide, 0, 0, half, half)
    current = halfCanvas
    currentSide = half
    cropX = 0
    cropY = 0
  }

  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2Dコンテキストを取得できませんでした')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(current, cropX, cropY, currentSide, currentSide, 0, 0, size, size)
  return createImageBitmap(canvas)
}

async function toTileInfo(name: string, blob: Blob): Promise<TileInfo> {
  const full = await createImageBitmap(blob)
  try {
    const bitmap = await cropToSquareTile(full)
    return { name, avgColor: averageColorOfBitmap(bitmap), bitmap }
  } finally {
    full.close()
  }
}

/** タイルセットの読み込み結果 */
export interface TilesLoadResult {
  tiles: TileInfo[]
  /** デコードできずスキップしたファイル数 (HEIC・動画・破損ファイルなど) */
  skipped: number
  total: number
}

/**
 * ユーザーが選択したファイル群からタイルセットを作る。
 * 読めないファイルはスキップして続行し、skipped で件数を返す。
 */
export async function loadTiles(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<TilesLoadResult> {
  const total = files.length
  const queue = [...files]
  const tiles: TileInfo[] = []
  let done = 0
  let skipped = 0

  // 数百枚のデコードを直列にすると遅いため、少数並列で処理する
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      try {
        tiles.push(await toTileInfo(file.name, file))
      } catch {
        skipped++
      }
      done++
      onProgress?.(done, total)
    }
  })
  await Promise.all(workers)

  tiles.sort((a, b) => a.name.localeCompare(b.name))
  return { tiles, skipped, total }
}
