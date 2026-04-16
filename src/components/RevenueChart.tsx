'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

type DataPoint = {
  label: string
  omsætning: number
  profit: number
}

type Props = {
  data: DataPoint[]
}

function formatDKK(value: number) {
  return new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }).format(value)
}

export default function RevenueChart({ data }: Props) {
  if (data.length === 0) return null

  return (
    <div className="rounded-xl border border-[#3d3020] bg-[#2B2318] p-5">
      <h2 className="mb-4 text-sm font-semibold text-[#C8A96E] uppercase tracking-wide">Omsætning & profit over tid</h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3d3020" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#a89070' }} />
          <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: '#a89070' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#2B2318', border: '1px solid #3d3020', borderRadius: '8px', color: '#e0c99a' }}
            formatter={(value: number) => formatDKK(value)}
          />
          <Legend wrapperStyle={{ color: '#a89070', fontSize: 12 }} />
          <Line type="monotone" dataKey="omsætning" stroke="#C8A96E" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="profit" stroke="#7ab87a" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
