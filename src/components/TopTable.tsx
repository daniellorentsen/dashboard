'use client'

import { useState } from 'react'

type Row = {
  name: string
  omsætning: number
  profit: number
  profitPct: number
  antal: number
  enheder: number
}

type Props = {
  title: string
  rows: Row[]
}

const LIMIT_OPTIONS = [10, 20, 30, 100, 0] // 0 = alle

function fmt(v: number) {
  return new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(v)
}

export default function TopTable({ title, rows }: Props) {
  const [limit, setLimit] = useState(20)

  if (rows.length === 0) return null

  const visible = limit === 0 ? rows : rows.slice(0, limit)

  const total = rows.reduce(
    (acc, row) => ({
      omsætning: acc.omsætning + row.omsætning,
      profit: acc.profit + row.profit,
      enheder: acc.enheder + row.enheder,
      antal: acc.antal + row.antal,
    }),
    { omsætning: 0, profit: 0, enheder: 0, antal: 0 }
  )
  const totalProfitPct = total.omsætning > 0 ? (total.profit / total.omsætning) * 100 : 0


  return (
    <div className="rounded-xl border border-[#3d3020] bg-[#2B2318] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#C8A96E] uppercase tracking-wide">{title}</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#a89070]">Vis</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-lg border border-[#3d3020] bg-[#1a1410] px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#C8A96E]"
          >
            {LIMIT_OPTIONS.map((o) => (
              <option key={o} value={o}>{o === 0 ? 'Alle' : o}</option>
            ))}
          </select>
          <span className="text-xs text-[#a89070]">af {rows.length}</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#3d3020] text-left text-xs text-[#a89070]">
              <th className="pb-2 font-medium">Navn</th>
              <th className="pb-2 text-right font-medium">Omsætning (DKK)</th>
              <th className="pb-2 text-right font-medium">Profit (DKK)</th>
              <th className="pb-2 text-right font-medium">DB%</th>
              <th className="pb-2 text-right font-medium">Enheder</th>
              <th className="pb-2 text-right font-medium">Fakturaer</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b-2 border-[#C8A96E] bg-[#3d3020]">
              <td className="py-2 font-bold text-[#C8A96E]">Total ({rows.length})</td>
              <td className="py-2 text-right font-bold text-[#C8A96E]">{fmt(total.omsætning)}</td>
              <td className="py-2 text-right font-bold text-[#C8A96E]">{fmt(total.profit)}</td>
              <td className="py-2 text-right font-bold text-[#C8A96E]">{totalProfitPct.toFixed(1)}%</td>
              <td className="py-2 text-right font-bold text-[#C8A96E]">{fmt(total.enheder)}</td>
              <td className="py-2 text-right font-bold text-[#C8A96E]">{total.antal}</td>
            </tr>
            {visible.map((row, i) => (
              <tr key={i} className="border-b border-[#3d3020] last:border-0 hover:bg-[#3d3020]/50 transition-colors">
                <td className="py-2 font-medium text-[#e0c99a]">{row.name}</td>
                <td className="py-2 text-right text-white">{fmt(row.omsætning)}</td>
                <td className="py-2 text-right text-green-400">{fmt(row.profit)}</td>
                <td className={`py-2 text-right ${row.profitPct >= 20 ? 'text-green-400' : row.profitPct >= 10 ? 'text-orange-400' : 'text-red-400'}`}>
                  {row.profitPct.toFixed(1)}%
                </td>
                <td className="py-2 text-right text-white">{fmt(row.enheder)}</td>
                <td className="py-2 text-right text-[#a89070]">{row.antal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
