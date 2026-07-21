import { useRef, useState } from "react";
import type { DragEvent, ChangeEvent } from "react";
import type { TilesMeta } from "../App";

/** スキップされたファイル名を表示する最大件数 */
const MAX_SKIPPED_NAMES = 5;

interface Props {
  /** 現在保持しているタイルの累計枚数 */
  tileCount: number;
  /** 直近のタイル追加バッチの結果 (未アップロードなら null) */
  tilesMeta: TilesMeta | null;
  /** タイル読み込み中の進捗 (読み込み中でなければ null) */
  loading: { done: number; total: number } | null;
  disabled?: boolean;
  onUploadFiles: (files: File[]) => void;
  onClearAll: () => void;
}

export default function TileSetPanel({
  tileCount,
  tilesMeta,
  loading,
  disabled,
  onUploadFiles,
  onClearAll,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const busy = disabled || !!loading;

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) onUploadFiles(Array.from(files));
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (!busy) handleFiles(e.dataTransfer.files);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = "";
  };

  return (
    <div className="tileset card">
      <h2>タイル画像</h2>

      <div
        className={`tileset-drop${dragging ? " dragging" : ""}${busy ? " disabled" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (!busy) inputRef.current?.click();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy)
            inputRef.current?.click();
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
        <p className="tileset-drop-title">
          タイルにする画像をドラッグ&ドロップ (複数可・追加できます)
        </p>
        <p className="tileset-drop-hint">またはクリックしてファイルを選択</p>
      </div>

      {loading && (
        <div className="progress tileset-progress">
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${loading.total ? (loading.done / loading.total) * 100 : 0}%`,
              }}
            />
          </div>
          <span className="progress-label">
            {loading.done}/{loading.total}
          </span>
        </div>
      )}

      {tilesMeta && !loading && (
        <div className="tileset-status">
          <p>
            現在のタイル: {tileCount}枚
            <br />
            {tilesMeta.lastAdded === 0 &&
            tilesMeta.lastSkipped === 0 &&
            tilesMeta.lastDuplicates > 0
              ? "選択した写真はすべて追加済みでした"
              : `今回${tilesMeta.lastAdded}枚を追加しました`}
            {tilesMeta.lastAdded > 0 && tilesMeta.lastDuplicates > 0 && (
              <> (追加済みの{tilesMeta.lastDuplicates}枚はスキップ)</>
            )}
          </p>
          {tilesMeta.lastSkipped > 0 && (
            <details className="tileset-skipped">
              <summary>
                {tilesMeta.lastSkipped}
                枚は読み込めませんでした
                (非対応形式や破損の可能性)。枚数を減らして再度お試しください。
              </summary>
              <ul>
                {tilesMeta.skippedNames
                  .slice(0, MAX_SKIPPED_NAMES)
                  .map((name, i) => (
                    <li key={`${i}-${name}`}>{name}</li>
                  ))}
                {tilesMeta.skippedNames.length > MAX_SKIPPED_NAMES && (
                  <li>
                    ほか{tilesMeta.skippedNames.length - MAX_SKIPPED_NAMES}件
                  </li>
                )}
              </ul>
            </details>
          )}
        </div>
      )}

      {tileCount > 0 && !loading && (
        <button
          type="button"
          className="tileset-clear"
          onClick={onClearAll}
          disabled={busy}
        >
          タイルをすべて削除
        </button>
      )}

      <div className="tileset-note">
        <p>
          写真は中央を正方形に切り抜いて使用します。枚数が多く色彩が豊かなほど仕上がりが良くなります。
        </p>
        <p className="tileset-note-heading">注意事項</p>
        <ul>
          <li>
            iPhoneなどのスマートフォンでは、一度に大量の写真を選ぶと「写真を読み込めません」などのエラーになることがあります。20〜30枚ずつ数回に分けて追加してください。
          </li>
          <li>
            写真は追加方式で読み込まれます。同じ写真を再選択しても自動的にスキップされるため、分割して追加しても重複しません。
          </li>
          <li>
            枚数が多いと読み込みに時間がかかることがありますが、処理中も画面は操作できます。
          </li>
          <li>
            画像は外部に送信されません。タイルはリロードすると消えるため、再度追加してください。
          </li>
        </ul>
      </div>
    </div>
  );
}
