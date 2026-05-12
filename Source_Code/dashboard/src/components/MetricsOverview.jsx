import './MetricsOverview.css'

const stat = (label, value, unit = '') => ({ label, value, unit })

export default function MetricsOverview({ snapshots, colors, labels }) {
  return (
    <div className="overview-grid">
      {Object.entries(snapshots).map(([key, snap]) => (
        <div
          key={key}
          className={`arch-card ${!snap.online ? 'offline' : ''}`}
          style={{ '--accent': colors[key] }}
        >
          {/* Card header */}
          <div className="card-header">
            <span className="arch-name">{labels[key]}</span>
            <span className={`status-dot ${snap.online ? 'online' : 'offline'}`}>
              {snap.online ? '● Online' : '○ Offline'}
            </span>
          </div>

          {/* Stats grid */}
          <div className="stats-grid">
            {[
              stat('Avg Response', snap.avgResponseTime, 'ms'),
              stat('P95 Response', snap.p95ResponseTime, 'ms'),
              stat('Req/min',      snap.requestsPerMinute, ''),
              stat('Error Rate',   snap.errorRate, '%'),
              stat('Total Req',    snap.totalRequests, ''),
              stat('Memory',       snap.memoryMB, 'MB'),
              stat('Uptime',       snap.uptimeSeconds, 's'),
            ].map(s => (
              <div className="stat-item" key={s.label}>
                <span className="stat-value">
                  {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
                  {s.unit && <small> {s.unit}</small>}
                </span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
