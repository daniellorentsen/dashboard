'use client'

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

function fmt(v: number) {
  return new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(v)
}

export default function TopTable({ title, rows }: Props) {
  if (rows.length === 0) return null

  return (
    <div className="rounded-xl border border-[#3d3020] bg-[#2B2318] p-5">
      <h2 className="mb-3 text-sm font-semibold text-[#C8A96E] uppercase tracking-wide">{title}</h2>
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
            {rows.map((row, i) => (
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
