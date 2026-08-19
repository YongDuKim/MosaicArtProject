import type {
  JpegResolution,
  MosaicParams,
  MosaicPlan,
  OutputFormat,
} from "../lib/types";
import { JPEG_RESOLUTION_LIMITS, scaledOutputSize } from "../lib/mosaic";

const RESOLUTIONS: { value: JpegResolution; label: string }[] = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];

const FORMATS: { value: OutputFormat; label: string; hint: string }[] = [
  { value: "jpeg", label: "JPG", hint: "ファイルサイズが小さい" },
  { value: "png", label: "PNG", hint: "劣化しないがサイズが大きい" },
];

interface Props {
  params: MosaicParams;
  onChange: (params: MosaicParams) => void;
  plan: MosaicPlan | null;
  canGenerate: boolean;
  generating: boolean;
  onGenerate: () => void;
}

export default function ParamsPanel({
  params,
  onChange,
  plan,
  canGenerate,
  generating,
  onGenerate,
}: Props) {
  return (
    <div className="params card">
      <h2>パラメータ</h2>

      <label className="param-row">
        <span>
          グリッド解像度 <code>x = {params.x}</code>
          <small>小さいほどタイルが細かくなる</small>
        </span>
        <input
          type="range"
          min={1}
          max={128}
          value={params.x}
          disabled={generating}
          onChange={(e) => onChange({ ...params, x: Number(e.target.value) })}
        />
      </label>

      <label className="param-row">
        <span>
          タイル解像度 <code>n = {params.n}</code>
          <small>
            タイル1枚の出力ピクセル数 (大きいほど拡大時に鮮明)。奇数は JPG
            が約1割重くなるため偶数のみ
          </small>
        </span>
        <input
          type="range"
          min={8}
          max={128}
          step={2}
          value={params.n}
          disabled={generating}
          onChange={(e) => onChange({ ...params, n: Number(e.target.value) })}
        />
      </label>

      <label className="param-row">
        <span>
          色補正 <code>{params.colorAdjust}%</code>
          <small>元画像の色にどれだけ近づけるか (0で補正なし)</small>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={params.colorAdjust}
          disabled={generating}
          onChange={(e) =>
            onChange({ ...params, colorAdjust: Number(e.target.value) })
          }
        />
      </label>

      <fieldset className="param-format" disabled={generating}>
        <legend>
          出力形式
          <small>写真素材では JPG の方が大幅に小さくなる</small>
        </legend>
        {FORMATS.map((format) => (
          <label key={format.value}>
            <input
              type="radio"
              name="output-format"
              value={format.value}
              checked={params.format === format.value}
              onChange={() => onChange({ ...params, format: format.value })}
            />
            {format.label}
            <small>{format.hint}</small>
          </label>
        ))}
      </fieldset>

      {params.format === "jpeg" && (
        <fieldset className="param-format" disabled={generating}>
          <legend>
            JPGの解像度
            <small>下げるとダウンロードするファイルが軽くなる</small>
          </legend>
          {RESOLUTIONS.map((resolution) => {
            const limit = JPEG_RESOLUTION_LIMITS[resolution.value];
            const size = plan
              ? scaledOutputSize(plan.outputWidth, plan.outputHeight, limit)
              : null;
            return (
              <label key={resolution.value}>
                <input
                  type="radio"
                  name="jpeg-resolution"
                  value={resolution.value}
                  checked={params.jpegResolution === resolution.value}
                  onChange={() =>
                    onChange({ ...params, jpegResolution: resolution.value })
                  }
                />
                {resolution.label}
                <small>
                  {size
                    ? `${size.width.toLocaleString()} × ${size.height.toLocaleString()} px`
                    : limit === Infinity
                      ? "原寸のまま"
                      : `長辺 ${limit.toLocaleString()}px 以下`}
                </small>
              </label>
            );
          })}
        </fieldset>
      )}

      <label className="param-check">
        <input
          type="checkbox"
          checked={params.rotate}
          disabled={generating}
          onChange={(e) => onChange({ ...params, rotate: e.target.checked })}
        />
        タイルをランダム回転する (0/90/180/270度)
      </label>

      {plan && (
        <div className="plan-info">
          <p>
            グリッド: {plan.gridWidth} × {plan.gridHeight} (総タイル数{" "}
            {(plan.gridWidth * plan.gridHeight).toLocaleString()})
          </p>
          <p>
            出力サイズ: {plan.outputWidth.toLocaleString()} ×{" "}
            {plan.outputHeight.toLocaleString()} px
          </p>
          {plan.capped && (
            <p className="warning">
              出力サイズがこの端末の上限 ({plan.maxDim.toLocaleString()}px)
              を超えるため、タイル解像度を n = {params.n} → {plan.effectiveN}{" "}
              に自動調整します。タイルを鮮明にしたい場合は グリッド解像度 x
              を大きくしてください
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        className="generate-button"
        disabled={!canGenerate || generating}
        onClick={onGenerate}
      >
        {generating ? "生成中…" : "モザイクアートを生成"}
      </button>
    </div>
  );
}
