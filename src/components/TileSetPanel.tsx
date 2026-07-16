import { useRef, useState } from 'react'
import type { DragEvent, ChangeEvent } from 'react'

interface Props {
  /** タイルセットの読み込み結果 (未アップロードなら null) */
  tilesMeta: { count: number; skipped: number; total: number } | null
  /** タイル読み込み中の進捗 (読み込み中でなければ null) */
  loading: { done: number; total: number } | null
  disabled?: boolean
  onUploadFiles: (files: File[]) => void
}

export default function TileSetPanel({ tilesMeta, loading, disabled, onUploadFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const busy = disabled || !!loading

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) onUploadFiles(Array.from(files))
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    if (!busy) handleFiles(e.dataTransfer.files)
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
    e.target.value = ''
  }

  return (
    <div className="tileset card">
      <h2>タイル画像</h2>

      <div
        className={`tileset-drop${dragging ? ' dragging' : ''}${busy ? ' disabled' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (!busy) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (!busy) inputRef.current?.click()
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !busy) inputRef.current?.click()
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleChange}
          disabled={busy}
        />
        <p className="tileset-drop-title">タイルにする画像をドラッグ&ドロップ (複数可)</p>
        <p className="tileset-drop-hint">またはクリックしてファイルを選択</p>
      </div>

      {loading && (
        <div className="progress tileset-progress">
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${loading.total ? (loading.done / loading.total) * 100 : 0}%` }}
            />
          </div>
          <span className="progress-label">
            {loading.done}/{loading.total}
          </span>
        </div>
      )}

      {tilesMeta && !loading && (
        <p className="tileset-status">
          {tilesMeta.total}枚中{tilesMeta.count}枚を読み込みました
          {tilesMeta.skipped > 0 && (
            <span className="tileset-skipped">
              <br />
              {tilesMeta.skipped}枚は読み込めずスキップしました (HEICなどの非対応形式の可能性)
            </span>
          )}
        </p>
      )}

      <p className="tileset-note">
        写真は中央を正方形に切り抜いて使用します。枚数が多く色彩が豊かなほど仕上がりが良くなります。
        画像は外部に送信されず、リロードすると消えます。
      </p>
    </div>
  )
}
