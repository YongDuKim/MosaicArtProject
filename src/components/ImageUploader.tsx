import { useRef, useState } from "react";
import type { DragEvent, ChangeEvent } from "react";

interface Props {
  onSelect: (file: File) => void;
  previewUrl: string | null;
  fileName: string | null;
  disabled?: boolean;
}

export default function ImageUploader({
  onSelect,
  previewUrl,
  fileName,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    // デスクトップでは HEIC の File.type が空になることがあるため拡張子でも許可する
    if (
      file &&
      (file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name))
    ) {
      onSelect(file);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled) handleFiles(e.dataTransfer.files);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = "";
  };

  return (
    <div
      className={`uploader${dragging ? " dragging" : ""}${disabled ? " disabled" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled)
          inputRef.current?.click();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        hidden
        onChange={handleChange}
        disabled={disabled}
      />
      {previewUrl ? (
        <div className="uploader-preview">
          <img src={previewUrl} alt="入力画像プレビュー" />
          <p className="uploader-filename">{fileName}</p>
          <p className="uploader-hint">クリックまたはドロップで差し替え</p>
        </div>
      ) : (
        <div className="uploader-empty">
          <p className="uploader-title">画像をドラッグ&ドロップ</p>
          <p className="uploader-hint">またはクリックしてファイルを選択</p>
        </div>
      )}
    </div>
  );
}
