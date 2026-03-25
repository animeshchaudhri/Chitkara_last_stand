import './LiveIndicator.css'

export default function LiveIndicator({ snapshots, pollCount }) {
  const allOnline = Object.values(snapshots).every(s => s.online)
  const someOnline = Object.values(snapshots).some(s => s.online)
  const status = allOnline ? 'all' : someOnline ? 'partial' : 'none'

  return (
    <div className={`live-indicator status-${status}`}>
      <div className="pulse-dot"></div>
      <div className="indicator-text">
        <span className="status-label">
          {status === 'all' && '● All Systems Online'}
          {status === 'partial' && '◐ Partial Systems'}
          {status === 'none' && '○ All Offline'}
        </span>
        <span className="poll-count">{pollCount} polls</span>
      </div>
    </div>
  )
}
