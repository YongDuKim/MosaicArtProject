import type { MosaicDone } from '../lib/types'
import { buildStatsText, downloadBlob, formatTimestamp } from '../lib/format'

interface Props {
  result: MosaicDone
  inputName: string
  selectedTile: string | null
  onSelectTile: (name: string | null) => void
}

export default function StatsTable({ result, inputName, selectedTile, onSelectTile }: Props) {
  const handleDownload = () => {
    const text = buildStatsText(result, inputName)
    downloadBlob(
      new Blob([text], { type: 'text/plain;charset=utf-8' }),
      `mosaic_stats_${formatTimestamp()}.txt`,
    )
  }

  return (
    <div className="stats card">
      <h2>タイル使用統計</h2>
      <p className="stats-summary">
        使用されたタイルの種類: {result.usedTileKinds} / {result.tileKindsTotal} ・ 総タイル数:{' '}
        {result.totalTiles.toLocaleString()}
        <br />
        <small>行をクリックすると、そのタイルの使用箇所が生成結果にハイライトされます</small>
      </p>
      <div className="stats-table-wrap">
        <table>
          <thead>
            <tr>
              <th>タイル</th>
              <th>使用回数</th>
              <th>割合</th>
            </tr>
          </thead>
          <tbody>
            {result.stats.map((stat) => (
              <tr
                key={stat.name}
                className={stat.name === selectedTile ? 'selected' : undefined}
                onClick={() => onSelectTile(stat.name === selectedTile ? null : stat.name)}
              >
                <td>{stat.name}</td>
                <td>{stat.count.toLocaleString()}</td>
                <td>{stat.percentage.toPrecision(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={handleDownload}>
        統計をテキストで保存
      </button>
    </div>
  )
}
