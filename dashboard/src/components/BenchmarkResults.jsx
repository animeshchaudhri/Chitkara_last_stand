import { useState, useEffect } from 'react'
import './BenchmarkResults.css'

// Paper Section 4 numbers — used as fallback if benchmark_summary.json isn't present
// Avg RT and p95 RT match Table 1 in the paper; requestsPerMin = RPS × 60
const PAPER_DATA = {
  monolithic: {
    50:  { avgResponseTime: 42,   p95ResponseTime: 73,   requestsPerMin: 7020,  errorRate: 0.00, dataP95: 61,   reportP95: 76,   runsAveraged: 3 },
    200: { avgResponseTime: 191,  p95ResponseTime: 423,  requestsPerMin: 6180,  errorRate: 0.33, dataP95: 391,  reportP95: 447,  runsAveraged: 3 },
    500: { avgResponseTime: 1347, p95ResponseTime: 3210, requestsPerMin: 4140,  errorRate: 4.71, dataP95: 3050, reportP95: 3310, runsAveraged: 3 },
  },
  microservices: {
    50:  { avgResponseTime: 63,  p95ResponseTime: 101, requestsPerMin: 4800,  errorRate: 0.00, dataP95: 89,  reportP95: 104, runsAveraged: 3 },
    200: { avgResponseTime: 129, p95ResponseTime: 207, requestsPerMin: 9240,  errorRate: 0.00, dataP95: 187, reportP95: 214, runsAveraged: 3 },
    500: { avgResponseTime: 188, p95ResponseTime: 318, requestsPerMin: 15900, errorRate: 0.19, dataP95: 289, reportP95: 331, runsAveraged: 3 },
  },
  hybrid: {
    50:  { avgResponseTime: 55,  p95ResponseTime: 86,  requestsPerMin: 5460,  errorRate: 0.00, dataP95: 74,  reportP95: 91,  runsAveraged: 3 },
    200: { avgResponseTime: 146, p95ResponseTime: 241, requestsPerMin: 8220,  errorRate: 0.00, dataP95: 212, reportP95: 251, runsAveraged: 3 },
    500: { avgResponseTime: 258, p95ResponseTime: 503, requestsPerMin: 11640, errorRate: 0.51, dataP95: 471, reportP95: 531, runsAveraged: 3 },
  },
}

const VU_LABELS = { 50: 'Low (50 VUs)', 200: 'Medium (200 VUs)', 500: 'High (500 VUs)' }

const ARCH_COLORS = {
  monolithic:    '#3b82f6',
  microservices: '#f59e0b',
  hybrid:        '#10b981',
}

const ARCH_LABELS = {
  monolithic:    'Monolithic',
  microservices: 'Microservices',
  hybrid:        'Hybrid',
}

// Weighted scoring formula used in the paper:
//   Score = Σ(weight_i × normalised_i) / Σ(weight_i)   where normalised ∈ [0, 5]
const CRITERIA = [
  { key: 'scalability',  label: 'High-load Scalability', weight: 2.0 },
  { key: 'performance',  label: 'Low-load Performance',  weight: 1.0 },
  { key: 'security',     label: 'Security Enforcement',  weight: 2.0 },
  { key: 'efficiency',   label: 'Resource Efficiency',   weight: 1.5 },
  { key: 'simplicity',   label: 'Operational Simplicity',weight: 1.0 },
]

// Derive per-criterion scores from benchmark data.
// Uses relative ranking between architectures so scores are always meaningful
// once at least one data point exists per VU level.
function deriveScores(data) {
  const archs = ['monolithic', 'microservices', 'hybrid']
  const scores = {}
  archs.forEach(a => { scores[a] = {} })

  // ── Low-load performance: avg RT at 50 VUs (lower RT = better score) ──
  // Normalise relative to worst performer so best always gets 5.0
  const rt50 = archs.map(a => data[a]?.[50]?.avgResponseTime ?? null)
  const validRt50 = rt50.filter(v => v !== null)
  if (validRt50.length) {
    const worst50 = Math.max(...validRt50)
    const best50  = Math.min(...validRt50)
    const range50 = worst50 - best50 || 1
    archs.forEach((a, i) => {
      const rt = rt50[i]
      scores[a].performance = rt === null ? 0
        : parseFloat((5 - ((rt - best50) / range50) * 2).toFixed(1))  // 3–5 range
    })
  } else {
    archs.forEach(a => { scores[a].performance = 0 })
  }

  // ── High-load scalability: avg RT at 500 VUs (60%) + error rate (40%) ──
  const rt500  = archs.map(a => data[a]?.[500]?.avgResponseTime ?? null)
  const err500 = archs.map(a => data[a]?.[500]?.errorRate ?? null)
  const validRt500 = rt500.filter(v => v !== null)
  if (validRt500.length) {
    const worst500 = Math.max(...validRt500)
    const best500  = Math.min(...validRt500)
    const range500 = worst500 - best500 || 1
    archs.forEach((a, i) => {
      const rt  = rt500[i]
      const err = err500[i] ?? 0
      if (rt === null) { scores[a].scalability = 0; return }
      const rtScore  = (1 - (rt  - best500) / range500) * 3   // 0–3
      const errScore = (1 - Math.min(err, 10) / 10)    * 2   // 0–2 (capped at 10% err)
      scores[a].scalability = parseFloat(Math.min(5, rtScore + errScore).toFixed(1))
    })
  } else {
    archs.forEach(a => { scores[a].scalability = 0 })
  }

  // ── Security: fixed from paper Section 4.3 analysis ──
  scores.monolithic.security    = 3.0  // correct JWT but single point of config risk
  scores.microservices.security = 2.0  // per-service impl — had real exp-claim bug
  scores.hybrid.security        = 5.0  // centralised gateway, consistent enforcement

  // ── Resource efficiency: memory at 500 VUs from paper (lower = better) ──
  const mem = { monolithic: 410, microservices: 855, hybrid: 590 }
  const maxMem = Math.max(...Object.values(mem))
  const minMem = Math.min(...Object.values(mem))
  const memRange = maxMem - minMem
  archs.forEach(a => {
    scores[a].efficiency = parseFloat((5 - ((mem[a] - minMem) / memRange) * 3).toFixed(1))
  })

  // ── Operational simplicity: fixed by architectural complexity ──
  scores.monolithic.simplicity    = 5.0
  scores.hybrid.simplicity        = 4.0
  scores.microservices.simplicity = 2.0

  return scores
}

function weightedScore(scores, arch) {
  const totalWeight = CRITERIA.reduce((s, c) => s + c.weight, 0)
  const weighted    = CRITERIA.reduce((s, c) => s + c.weight * (scores[arch]?.[c.key] ?? 0), 0)
  return parseFloat((weighted / totalWeight).toFixed(2))
}

function StarBar({ value, max = 5 }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="star-bar-wrap" title={`${value} / ${max}`}>
      <div className="star-bar-bg">
        <div className="star-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="star-val">{value}</span>
    </div>
  )
}

export default function BenchmarkResults() {
  const [data, setData]     = useState(PAPER_DATA)   // default: paper numbers
  const [activeVU, setActiveVU] = useState(500)
  const [source, setSource] = useState('paper')       // 'paper' | 'run'

  useEffect(() => {
    fetch('/benchmark_summary.json')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(json => {
        // Only use fetched data if summarize-results.js explicitly marked it as a k6 run
        // AND it has actual non-null values
        const isRealRun = json.source === 'k6'
        const hasData = json.data && Object.values(json.data).some(arch =>
          Object.values(arch).some(v => v !== null && v?.avgResponseTime)
        )
        if (isRealRun && hasData) { setData(json.data); setSource('run') }
      })
      .catch(() => {})  // silently fall back to PAPER_DATA
  }, [])

  const scores = deriveScores(data)
  const archs  = ['monolithic', 'microservices', 'hybrid']
  const vus    = [50, 200, 500]

  const row = (arch) => data[arch]?.[activeVU]

  return (
    <div className="bench-root">

      {/* ── Source indicator + VU selector ───────────────────── */}
      <div className="bench-toolbar">
        <div className="vu-tabs">
          {vus.map(v => (
          <button
            key={v}
            className={`vu-tab ${activeVU === v ? 'active' : ''}`}
            onClick={() => setActiveVU(v)}
          >
            {VU_LABELS[v]}
          </button>
        ))}
        </div>
        <span className={`source-badge ${source}`}>
          {source === 'run' ? 'From k6 runs' : 'Paper Section 4 data'}
        </span>
      </div>

      {/* ── Performance table ────────────────────────────────── */}
      <div className="bench-table-wrap">
        <table className="bench-table">
          <thead>
            <tr>
              <th>Metric</th>
              {archs.map(a => (
                <th key={a} style={{ color: ARCH_COLORS[a] }}>{ARCH_LABELS[a]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Avg Response Time',  key: 'avgResponseTime', unit: 'ms', low: true },
              { label: 'P95 Response Time',  key: 'p95ResponseTime', unit: 'ms', low: true },
              { label: 'Requests / min',     key: 'requestsPerMin',  unit: '',   low: false },
              { label: 'Error Rate',         key: 'errorRate',       unit: '%',  low: true },
              { label: 'Data Write p95',     key: 'dataP95',         unit: 'ms', low: true },
              { label: 'Report p95',         key: 'reportP95',       unit: 'ms', low: true },
            ].map(({ label, key, unit, low }) => {
              const vals = archs.map(a => row(a)?.[key] ?? null)
              const valid = vals.filter(v => v !== null)
              const best  = valid.length ? (low ? Math.min(...valid) : Math.max(...valid)) : null
              const worst = valid.length ? (low ? Math.max(...valid) : Math.min(...valid)) : null
              return (
                <tr key={key}>
                  <td className="bench-metric-name">{label}</td>
                  {archs.map((a, i) => {
                    const v = vals[i]
                    const cls = v === null ? '' : v === best ? 'best' : v === worst ? 'worst' : ''
                    return (
                      <td key={a} className={`bench-val ${cls}`}>
                        {v === null ? '—' : `${v.toLocaleString()}${unit ? ' ' + unit : ''}`}
                        {cls === 'best'  && <span className="badge best-badge">Best</span>}
                        {cls === 'worst' && <span className="badge worst-badge">Worst</span>}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Scoring formula + ratings ───────────────────────── */}
      <div className="scoring-section">
        <div className="formula-box">
          <h3 className="formula-title">Composite Score Formula</h3>
          <p className="formula">
            S(a) = <span className="sigma">Σ</span> (w<sub>i</sub> × s<sub>i,a</sub>) / <span className="sigma">Σ</span> w<sub>i</sub>
          </p>
          <p className="formula-desc">
            where <em>s<sub>i,a</sub> ∈ [0, 5]</em> is the score of architecture <em>a</em> on criterion <em>i</em>,
            and <em>w<sub>i</sub></em> is the criterion weight.
            Scalability and Security are weighted 2× to reflect their importance in resource-constrained production environments.
          </p>
          <div className="weights-row">
            {CRITERIA.map(c => (
              <span key={c.key} className="weight-chip">
                {c.label} <strong>w={c.weight}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="ratings-grid">
          {archs.map(a => {
            const ws = weightedScore(scores, a)
            return (
              <div key={a} className="rating-card" style={{ borderColor: ARCH_COLORS[a] }}>
                <h4 style={{ color: ARCH_COLORS[a] }}>{ARCH_LABELS[a]}</h4>
                <div className="overall-score" style={{ color: ARCH_COLORS[a] }}>
                  {ws} <span className="score-denom">/ 5</span>
                </div>
                {CRITERIA.map(c => (
                  <div key={c.key} className="criterion-row">
                    <span className="crit-label">{c.label}</span>
                    <StarBar value={scores[a]?.[c.key] ?? 0} />
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
