import type { MosaicParams, MosaicPlan } from '../lib/types'

interface Props {
  params: MosaicParams
  onChange: (params: MosaicParams) => void
  plan: MosaicPlan | null
  canGenerate: boolean
  generating: boolean
  onGenerate: () => void
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
          max={20}
          value={params.x}
          disabled={generating}
          onChange={(e) => onChange({ ...params, x: Number(e.target.value) })}
        />
      </label>

      <label className="param-row">
        <span>
          タイル解像度 <code>n = {params.n}</code>
          <small>タイル1枚の出力ピクセル数 (大きいほど拡大時に鮮明)</small>
        </span>
        <input
          type="range"
          min={8}
          max={128}
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
          onChange={(e) => onChange({ ...params, colorAdjust: Number(e.target.value) })}
        />
      </label>

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
            グリッド: {plan.gridWidth} × {plan.gridHeight} (総タイル数{' '}
            {(plan.gridWidth * plan.gridHeight).toLocaleString()})
          </p>
          <p>
            出力サイズ: {plan.outputWidth.toLocaleString()} ×{' '}
            {plan.outputHeight.toLocaleString()} px
          </p>
          {plan.capped && (
            <p className="warning">
              出力サイズがこの端末の上限 ({plan.maxDim.toLocaleString()}px) を超えるため、タイル解像度を
              n = {params.n} → {plan.effectiveN} に自動調整します。タイルを鮮明にしたい場合は
              グリッド解像度 x を大きくしてください
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
        {generating ? '生成中…' : 'モザイクアートを生成'}
      </button>
    </div>
  )
}
