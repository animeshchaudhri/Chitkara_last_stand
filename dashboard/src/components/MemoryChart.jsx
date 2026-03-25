import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import './MemoryChart.css'

const TOOLTIP_STYLE = {
  background: 'rgba(3, 7, 18, 0.92)',
  border: '1px solid rgba(148, 163, 184, 0.12)',
  borderRadius: '10px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  backdropFilter: 'blur(20px)',
}

export default function MemoryChart({ snapshots, colors, labels }) {
  const data = Object.entries(snapshots).map(([key, snap]) => ({
    name: labels[key],
    memory: snap.memoryMB,
    key,
  }))

  return (
    <div className="memory-wrapper">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: 'rgba(241,245,249,0.4)', fontSize: 11, fontFamily: 'Inter' }}
            axisLine={{ stroke: 'rgba(148,163,184,0.08)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(241,245,249,0.3)', fontSize: 10, fontFamily: 'Inter' }}
            axisLine={false}
            tickLine={false}
            unit=" MB"
            width={55}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: 'rgba(241,245,249,0.5)', fontSize: 11, marginBottom: 6 }}
            itemStyle={{ fontSize: 12, fontWeight: 600 }}
            formatter={(v) => [`${v} MB`, 'Memory Usage']}
            cursor={{ fill: 'rgba(241,245,249,0.03)' }}
          />
          <Bar dataKey="memory" name="Memory" radius={[6, 6, 0, 0]} maxBarSize={72}>
            {data.map((entry) => (
              <Cell key={entry.key} fill={colors[entry.key]} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
