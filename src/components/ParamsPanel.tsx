import type {
  MosaicParams,
  MosaicPlan,
  OutputFormat,
  OutputSize,
} from "../lib/types";
import { OUTPUT_SIZE_TARGETS } from "../lib/mosaic";

const SIZES: { value: OutputSize; label: string }[] = [
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

      <fieldset className="param-format" disabled={generating}>
        <legend>
          出力サイズ
          <small>大きいほど鮮明だがファイルも重くなる</small>
        </legend>
        {SIZES.map((size) => (
          <label key={size.value}>
            <input
              type="radio"
              name="output-size"
              value={size.value}
              checked={params.outputSize === size.value}
              onChange={() => onChange({ ...params, outputSize: size.value })}
            />
            {size.label}
            <small>
              長辺 {OUTPUT_SIZE_TARGETS[size.value].toLocaleString()}px 目安
            </small>
          </label>
        ))}
      </fieldset>

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
            {plan.outputHeight.toLocaleString()} px (タイル解像度 n ={" "}
            {plan.effectiveN})
          </p>
          {plan.capped && (
            <p className="warning">
              この端末の上限 ({plan.maxDim.toLocaleString()}px)
              に収まるよう、タイル解像度を n = {plan.effectiveN}{" "}
              に自動調整しました。タイルを鮮明にしたい場合は グリッド解像度 x
              を大きくしてください
            </p>
          )}
          {!plan.capped &&
            Math.max(plan.outputWidth, plan.outputHeight) >
              OUTPUT_SIZE_TARGETS[params.outputSize] && (
              <p className="warning">
                グリッドが細かいため、出力が目標の長辺 (
                {OUTPUT_SIZE_TARGETS[params.outputSize].toLocaleString()}px)
                を超えます。小さくするには グリッド解像度 x を大きくしてください
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
