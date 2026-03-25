import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import './ResponseTimeChart.css'

const TOOLTIP_STYLE = {
  background: 'rgba(3, 7, 18, 0.92)',
  border: '1px solid rgba(148, 163, 184, 0.12)',
  borderRadius: '10px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  backdropFilter: 'blur(20px)',
}

export default function ResponseTimeChart({ history, colors, labels }) {
  if (history.length < 2) {
    return (
      <div className="chart-placeholder">
        Waiting for live data — needs at least 2 polls
      </div>
    )
  }

  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={history} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
          <defs>
            {Object.entries(colors).map(([key, color]) => (
              <filter key={key} id={`glow-${key}`}>
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'rgba(241,245,249,0.3)', fontSize: 10, fontFamily: 'Inter' }}
            axisLine={{ stroke: 'rgba(148,163,184,0.08)' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: 'rgba(241,245,249,0.3)', fontSize: 10, fontFamily: 'Inter' }}
            axisLine={false}
            tickLine={false}
            unit=" ms"
            width={55}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: 'rgba(241,245,249,0.5)', fontSize: 11, marginBottom: 6 }}
            itemStyle={{ fontSize: 12, fontWeight: 600 }}
            formatter={(value, name) => [`${value} ms`, labels[name] || name]}
          />
          <Legend
            formatter={name => <span style={{ color: 'rgba(241,245,249,0.5)', fontSize: 11 }}>{labels[name] || name}</span>}
          />
          {Object.entries(colors).map(([key, color]) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 0, fill: color, filter: `url(#glow-${key})` }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
