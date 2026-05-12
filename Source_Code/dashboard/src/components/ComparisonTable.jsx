import './ComparisonTable.css'

const METRICS = [
  { key: 'avgResponseTime',   label: 'Avg Response Time', unit: 'ms',    lowerBetter: true },
  { key: 'p95ResponseTime',   label: 'P95 Response Time', unit: 'ms',    lowerBetter: true },
  { key: 'requestsPerMinute', label: 'Requests / min',    unit: '',      lowerBetter: false },
  { key: 'errorRate',         label: 'Error Rate',        unit: '%',     lowerBetter: true },
  { key: 'totalRequests',     label: 'Total Requests',    unit: '',      lowerBetter: false },
  { key: 'totalErrors',       label: 'Total Errors',      unit: '',      lowerBetter: true },
  { key: 'memoryMB',          label: 'Memory Usage',      unit: 'MB',    lowerBetter: true },
  { key: 'uptimeSeconds',     label: 'Uptime',            unit: 's',     lowerBetter: false },
]

function badge(value, allValues, lowerBetter) {
  const online = allValues.filter(v => v !== null)
  if (online.length < 2) return ''
  const best  = lowerBetter ? Math.min(...online) : Math.max(...online)
  const worst = lowerBetter ? Math.max(...online) : Math.min(...online)
  if (value === best)  return 'best'
  if (value === worst) return 'worst'
  return ''
}

export default function ComparisonTable({ snapshots, colors, labels }) {
  const archs = Object.keys(snapshots)

  return (
    <div className="table-wrapper">
      <table className="comparison-table">
        <thead>
          <tr>
            <th>Metric</th>
            {archs.map(key => (
              <th key={key} style={{ color: colors[key] }}>
                {labels[key]}
                <br />
                <span className={`online-indicator ${snapshots[key].online ? 'on' : 'off'}`}>
                  {snapshots[key].online ? '● live' : '○ offline'}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRICS.map(({ key, label, unit, lowerBetter }) => {
            const values = archs.map(a => snapshots[a][key] ?? null)
            return (
              <tr key={key}>
                <td className="metric-name">{label}</td>
                {archs.map((a, i) => {
                  const val  = snapshots[a][key] ?? 0
                  const cls  = badge(val, values, lowerBetter)
                  return (
                    <td key={a} className={`metric-val ${cls}`}>
                      {val.toLocaleString()}{unit && <small> {unit}</small>}
                      {cls === 'best'  && <span className="badge best-badge">✓ Best</span>}
                      {cls === 'worst' && <span className="badge worst-badge">⚠ Worst</span>}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
