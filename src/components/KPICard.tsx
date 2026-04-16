'use client'

type Props = {
  title: string
  value: string
  sub?: string
  color?: 'gold' | 'green' | 'orange' | 'red'
}

const colors = {
  gold: 'bg-[#2B2318] border-[#3d3020] text-[#C8A96E]',
  green: 'bg-[#1a2e1a] border-[#2a4a2a] text-green-400',
  orange: 'bg-[#2e1f0a] border-[#4a3010] text-orange-400',
  red: 'bg-[#2e0a0a] border-[#4a1010] text-red-400',
}

export default function KPICard({ title, value, sub, color = 'gold' }: Props) {
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-sm font-medium opacity-60 uppercase tracking-wide">{title}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-sm opacity-50">{sub}</p>}
    </div>
  )
}
