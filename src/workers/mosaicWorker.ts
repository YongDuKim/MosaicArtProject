import type { WorkerRequest, WorkerResponse } from '../lib/types'
import { generateMosaic } from '../lib/mosaic'

// DOM lib と WebWorker lib の型競合を避けるため Worker 型にキャストして使う
const ctx = self as unknown as Worker

const post = (message: WorkerResponse) => ctx.postMessage(message)

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    const result = await generateMosaic(event.data, (percent, label) =>
      post({ type: 'progress', percent, label }),
    )
    post(result)
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
