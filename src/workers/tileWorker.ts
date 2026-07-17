import type { TileWorkerRequest, TileWorkerResponse } from '../lib/types'
import { loadTilesStreaming } from '../lib/tiles'

// DOM lib と WebWorker lib の型競合を避けるため Worker 型にキャストして使う
const ctx = self as unknown as Worker

const post = (message: TileWorkerResponse, transfer?: Transferable[]) =>
  ctx.postMessage(message, transfer ?? [])

ctx.onmessage = async (event: MessageEvent<TileWorkerRequest>) => {
  const { files, concurrency } = event.data
  try {
    const result = await loadTilesStreaming(files, concurrency, {
      onTile: (tile, done, total) =>
        post(
          {
            type: 'tile',
            name: tile.name,
            key: tile.key,
            avgColor: tile.avgColor,
            bitmap: tile.bitmap,
            done,
            total,
          },
          [tile.bitmap],
        ),
      onSkip: (name, done, total) => post({ type: 'skipped', name, done, total }),
    })
    post({ type: 'batch-done', ...result })
  } catch (err) {
    post({ type: 'batch-error', message: err instanceof Error ? err.message : String(err) })
  }
}
