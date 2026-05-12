import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import './ErrorRateChart.css'

const TOOLTIP_STYLE = {
  background: 'rgba(3, 7, 18, 0.92)',
  border: '1px solid rgba(148, 163, 184, 0.12)',
  borderRadius: '10px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  backdropFilter: 'blur(20px)',
}

export default function ErrorRateChart({ history, colors, labels }) {
  if (history.length < 2) {
    return (
      <div className="chart-placeholder">
        Collecting error rate data...
      </div>
    )
  }

  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={history} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradMono" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={colors.monolithic}    stopOpacity={0.25}/>
              <stop offset="95%" stopColor={colors.monolithic}    stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="gradMs" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={colors.microservices} stopOpacity={0.25}/>
              <stop offset="95%" stopColor={colors.microservices} stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="gradHybrid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={colors.hybrid}        stopOpacity={0.25}/>
              <stop offset="95%" stopColor={colors.hybrid}        stopOpacity={0}/>
            </linearGradient>
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
            unit="%"
            width={45}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: 'rgba(241,245,249,0.5)', fontSize: 11, marginBottom: 6 }}
            itemStyle={{ fontSize: 12, fontWeight: 600 }}
            formatter={(value, name) => [`${value}%`, labels[name] || name]}
          />
          <Legend
            formatter={name => <span style={{ color: 'rgba(241,245,249,0.5)', fontSize: 11 }}>{labels[name] || name}</span>}
          />
          <Area type="monotone" dataKey="monoError"   stroke={colors.monolithic}    strokeWidth={2} fillOpacity={1} fill="url(#gradMono)"   name="monolithic" />
          <Area type="monotone" dataKey="msError"     stroke={colors.microservices} strokeWidth={2} fillOpacity={1} fill="url(#gradMs)"     name="microservices" />
          <Area type="monotone" dataKey="hybridError" stroke={colors.hybrid}        strokeWidth={2} fillOpacity={1} fill="url(#gradHybrid)" name="hybrid" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
