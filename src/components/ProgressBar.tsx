interface Props {
  percent: number;
  /** パーセント表示の代わりに出す段階ラベル (例: PNGエンコード中…) */
  label?: string | null;
}

export default function ProgressBar({ percent, label }: Props) {
  return (
    <div className="progress">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="progress-label">{label ?? `${percent}%`}</span>
    </div>
  );
}
