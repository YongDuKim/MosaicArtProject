import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import type { MosaicDone, MosaicParams, TileInfo, WorkerRequest, WorkerResponse } from './lib/types'
import { computePlan } from './lib/mosaic'
import { loadTiles } from './lib/tiles'
import ImageUploader from './components/ImageUploader'
import ParamsPanel from './components/ParamsPanel'
import TileSetPanel from './components/TileSetPanel'
import ProgressBar from './components/ProgressBar'
import MosaicPreview from './components/MosaicPreview'
import StatsTable from './components/StatsTable'

interface InputImage {
  file: File
  bitmap: ImageBitmap
  url: string
}

interface Result extends MosaicDone {
  url: string
  inputName: string
}

const DEFAULT_PARAMS: MosaicParams = { x: 5, n: 25, rotate: true, colorAdjust: 50 }

export default function App() {
  const [tiles, setTiles] = useState<TileInfo[] | null>(null)
  const [tilesMeta, setTilesMeta] = useState<{
    count: number
    skipped: number
    total: number
  } | null>(null)
  const [tileLoading, setTileLoading] = useState<{ done: number; total: number } | null>(null)
  const [input, setInput] = useState<InputImage | null>(null)
  const [params, setParams] = useState<MosaicParams>(DEFAULT_PARAMS)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [selectedTile, setSelectedTile] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => () => workerRef.current?.terminate(), [])

  const plan = useMemo(
    () =>
      input ? computePlan(input.bitmap.width, input.bitmap.height, params.x, params.n) : null,
    [input, params.x, params.n],
  )

  const handleSelect = async (file: File) => {
    try {
      const bitmap = await createImageBitmap(file)
      setInput((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev.url)
          prev.bitmap.close()
        }
        return { file, bitmap, url: URL.createObjectURL(file) }
      })
      setError(null)
    } catch {
      setError('画像を読み込めませんでした。別のファイルを試してください。')
    }
  }

  const handleTileUpload = async (files: File[]) => {
    if (tileLoading || generating) return
    setTileLoading({ done: 0, total: files.length })
    setError(null)
    try {
      const { tiles: loaded, skipped, total } = await loadTiles(files, (done, t) =>
        setTileLoading({ done, total: t }),
      )
      if (loaded.length === 0) {
        setError(
          'タイル画像を1枚も読み込めませんでした。対応形式 (JPEG/PNG など) か確認してください。',
        )
        return
      }
      setTiles((prev) => {
        prev?.forEach((t) => t.bitmap.close())
        return loaded
      })
      setTilesMeta({ count: loaded.length, skipped, total })
    } finally {
      setTileLoading(null)
    }
  }

  const handleGenerate = () => {
    if (!tiles || !input || !plan || generating || tileLoading) return
    setGenerating(true)
    setProgress(0)
    setProgressLabel(null)
    setError(null)

    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('./workers/mosaicWorker.ts', import.meta.url), {
        type: 'module',
      })
    }
    const worker = workerRef.current
    const inputName = input.file.name

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data
      if (msg.type === 'progress') {
        setProgress(msg.percent)
        setProgressLabel(msg.label ?? null)
      } else if (msg.type === 'done') {
        setResult((prev) => {
          if (prev) URL.revokeObjectURL(prev.url)
          return { ...msg, url: URL.createObjectURL(msg.blob), inputName }
        })
        setSelectedTile(null)
        setGenerating(false)
      } else {
        setError(`生成に失敗しました: ${msg.message}`)
        setGenerating(false)
      }
    }
    worker.onerror = (event) => {
      setError(`生成に失敗しました: ${event.message}`)
      setGenerating(false)
    }

    const request: WorkerRequest = {
      input: input.bitmap,
      tiles: tiles.map((t) => ({ name: t.name, avgColor: t.avgColor, bitmap: t.bitmap })),
      gridWidth: plan.gridWidth,
      gridHeight: plan.gridHeight,
      n: plan.effectiveN,
      rotate: params.rotate,
      colorAdjust: params.colorAdjust / 100,
    }
    worker.postMessage(request)
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>モザイクアート生成</h1>
        <p>
          アップロードした元画像を、タイル用にアップロードした写真で再構成したモザイクアートに変換します。
          処理はすべてブラウザ内で完結し、画像が外部へ送信されることはありません。
        </p>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="input-row">
        <ImageUploader
          onSelect={handleSelect}
          previewUrl={input?.url ?? null}
          fileName={input?.file.name ?? null}
          disabled={generating}
        />
        <TileSetPanel
          tilesMeta={tilesMeta}
          loading={tileLoading}
          disabled={generating}
          onUploadFiles={handleTileUpload}
        />
        <ParamsPanel
          params={params}
          onChange={setParams}
          plan={plan}
          canGenerate={!!input && !!tiles && !tileLoading}
          generating={generating}
          onGenerate={handleGenerate}
        />
      </div>

      {generating && <ProgressBar percent={progress} label={progressLabel} />}

      {result && (
        <>
          <MosaicPreview
            result={result}
            resultUrl={result.url}
            selectedTile={selectedTile}
            onClearSelection={() => setSelectedTile(null)}
          />
          <StatsTable
            result={result}
            inputName={result.inputName}
            selectedTile={selectedTile}
            onSelectTile={setSelectedTile}
          />
        </>
      )}
    </main>
  )
}
