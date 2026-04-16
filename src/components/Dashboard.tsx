'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Invoice, InvoiceLine } from '@/lib/rackbeat'
import KPICard from './KPICard'
import RevenueChart from './RevenueChart'
import TopTable from './TopTable'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(v)
}

function thisYear() {
  const now = new Date()
  return {
    from: `${now.getFullYear()}-01-01`,
    to: now.toISOString().slice(0, 10),
  }
}

// ─── Line-level helpers ───────────────────────────────────────────────────────

function lineGroup(line: InvoiceLine) {
  return line.item?.group?.name ?? null
}

function lineItemNumber(line: InvoiceLine) {
  return line.child_id ?? line.item?.number ?? null
}

function lineMatchesItemFilter(line: InvoiceLine, itemGroup: string, itemNumber: string) {
  if (itemGroup && lineGroup(line) !== itemGroup) return false
  if (itemNumber && lineItemNumber(line) !== itemNumber) return false
  return true
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

type AggRow = { name: string; omsætning: number; profit: number; profitPct: number; antal: number; enheder: number }

// Invoice-level aggregation (no item filters active)
// Uses total_subtotal (excl. VAT) * currency_rate to match Rackbeat's "Salgspris" column
function aggregateByInvoice(invoices: Invoice[], keyFn: (inv: Invoice) => string): AggRow[] {
  const map = new Map<string, { omsætning: number; profit: number; antal: number; enheder: number }>()
  for (const inv of invoices) {
    const key = keyFn(inv)
    if (!key) continue
    const rate = inv.currency_rate ?? 1
    const enheder = (inv.lines ?? []).reduce((s, l) => s + (l.quantity ?? 0), 0)
    const cur = map.get(key) ?? { omsætning: 0, profit: 0, antal: 0, enheder: 0 }
    map.set(key, {
      omsætning: cur.omsætning + inv.total_subtotal * rate,
      profit: cur.profit + inv.total_profit * rate,
      antal: cur.antal + 1,
      enheder: cur.enheder + enheder,
    })
  }
  return toRows(map)
}

// Line-level aggregation (when item filters active)
function aggregateByLine(
  invoices: Invoice[],
  keyFn: (inv: Invoice) => string,
  itemGroup: string,
  itemNumber: string,
): AggRow[] {
  const map = new Map<string, { omsætning: number; profit: number; antal: number; enheder: number }>()
  for (const inv of invoices) {
    const key = keyFn(inv)
    if (!key) continue
    const rate = inv.currency_rate ?? 1
    for (const line of inv.lines ?? []) {
      if (!lineMatchesItemFilter(line, itemGroup, itemNumber)) continue
      const cur = map.get(key) ?? { omsætning: 0, profit: 0, antal: 0, enheder: 0 }
      const lineRevenue = line.line_total * rate
      const lineProfit = (line.line_total - line.quantity * line.item_cost_price) * rate
      map.set(key, {
        omsætning: cur.omsætning + lineRevenue,
        profit: cur.profit + lineProfit,
        antal: cur.antal + 1,
        enheder: cur.enheder + (line.quantity ?? 0),
      })
    }
  }
  return toRows(map)
}

function toRows(map: Map<string, { omsætning: number; profit: number; antal: number; enheder: number }>): AggRow[] {
  return Array.from(map.entries())
    .map(([name, v]) => ({
      name,
      omsætning: v.omsætning,
      profit: v.profit,
      profitPct: v.omsætning > 0 ? (v.profit / v.omsætning) * 100 : 0,
      antal: v.antal,
      enheder: v.enheder,
    }))
    .sort((a, b) => b.omsætning - a.omsætning)
    .slice(0, 20)
}

// Chart data by month
function byMonth(invoices: Invoice[], itemGroup: string, itemNumber: string) {
  const map = new Map<string, { omsætning: number; profit: number }>()
  const useLinelevel = itemGroup || itemNumber

  for (const inv of invoices) {
    const label = inv.invoice_date?.slice(0, 7) ?? 'ukendt'
    const rate = inv.currency_rate ?? 1
    const cur = map.get(label) ?? { omsætning: 0, profit: 0 }

    if (!useLinelevel) {
      map.set(label, {
        omsætning: cur.omsætning + inv.total_subtotal * rate,
        profit: cur.profit + inv.total_profit * rate,
      })
    } else {
      for (const line of inv.lines ?? []) {
        if (!lineMatchesItemFilter(line, itemGroup, itemNumber)) continue
        map.set(label, {
          omsætning: cur.omsætning + line.line_total * rate,
          profit: cur.profit + (line.line_total - line.quantity * line.item_cost_price) * rate,
        })
      }
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, v]) => ({ label, ...v }))
}

// ─── Types ────────────────────────────────────────────────────────────────────

type GroupBy = 'customer' | 'customer_group' | 'none'

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [from, setFrom] = useState(thisYear().from)
  const [to, setTo] = useState(thisYear().to)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<GroupBy>('customer')

  // Filters
  const [customerFilter, setCustomerFilter] = useState('')
  const [customerGroupFilter, setCustomerGroupFilter] = useState('')
  const [itemGroupFilter, setItemGroupFilter] = useState('')
  const [itemNumberFilter, setItemNumberFilter] = useState('')

  const activeItemFilter = itemGroupFilter || itemNumberFilter

  // ─── Derived filter options ─────────────────────────────────────────────────

  const customerGroups = useMemo(() => {
    const s = new Set<string>()
    for (const inv of invoices) {
      const g = inv.customer?.customer_group?.name
      if (g) s.add(g)
    }
    return Array.from(s).sort()
  }, [invoices])

  const customers = useMemo(() => {
    const s = new Set<string>()
    for (const inv of invoices) {
      if (inv.customer?.name) s.add(inv.customer.name)
    }
    return Array.from(s).sort()
  }, [invoices])

  const itemGroups = useMemo(() => {
    const s = new Set<string>()
    for (const inv of invoices) {
      for (const line of inv.lines ?? []) {
        const g = lineGroup(line)
        if (g) s.add(g)
      }
    }
    return Array.from(s).sort()
  }, [invoices])

  // Item numbers filtered by selected item group
  const itemNumbers = useMemo(() => {
    const map = new Map<string, string>() // number → name
    for (const inv of invoices) {
      for (const line of inv.lines ?? []) {
        const num = lineItemNumber(line)
        if (!num) continue
        if (itemGroupFilter && lineGroup(line) !== itemGroupFilter) continue
        map.set(num, line.name ?? num)
      }
    }
    return Array.from(map.entries()).sort(([, a], [, b]) => a.localeCompare(b))
  }, [invoices, itemGroupFilter])

  // ─── Filtered invoices ──────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      // Kreditnotaer inkluderes som negative værdier (trækkes fra nettoomsætning)
      if (customerFilter && inv.customer?.name !== customerFilter) return false
      if (customerGroupFilter && inv.customer?.customer_group?.name !== customerGroupFilter) return false
      if (activeItemFilter) {
        const hasMatch = (inv.lines ?? []).some((line) =>
          lineMatchesItemFilter(line, itemGroupFilter, itemNumberFilter)
        )
        if (!hasMatch) return false
      }
      return true
    })
  }, [invoices, customerFilter, customerGroupFilter, itemGroupFilter, itemNumberFilter, activeItemFilter])

  // ─── KPIs ───────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    if (!activeItemFilter) {
      const omsætning = filtered.reduce((s, inv) => s + inv.total_subtotal * (inv.currency_rate ?? 1), 0)
      const profit = filtered.reduce((s, inv) => s + inv.total_profit * (inv.currency_rate ?? 1), 0)
      const antal = filtered.length
      return { omsætning, profit, antal, profitPct: omsætning > 0 ? (profit / omsætning) * 100 : 0 }
    }

    let omsætning = 0, profit = 0, antal = 0
    for (const inv of filtered) {
      const rate = inv.currency_rate ?? 1
      for (const line of inv.lines ?? []) {
        if (!lineMatchesItemFilter(line, itemGroupFilter, itemNumberFilter)) continue
        omsætning += line.line_total * rate
        profit += (line.line_total - line.quantity * line.item_cost_price) * rate
        antal++
      }
    }
    return { omsætning, profit, antal, profitPct: omsætning > 0 ? (profit / omsætning) * 100 : 0 }
  }, [filtered, itemGroupFilter, itemNumberFilter, activeItemFilter])

  // ─── Chart & table ──────────────────────────────────────────────────────────

  const chartData = useMemo(
    () => byMonth(filtered, itemGroupFilter, itemNumberFilter),
    [filtered, itemGroupFilter, itemNumberFilter]
  )

  const tableData = useMemo(() => {
    const keyFn = groupBy === 'customer'
      ? (inv: Invoice) => inv.customer?.name ?? 'Ukendt'
      : (inv: Invoice) => inv.customer?.customer_group?.name ?? 'Ingen gruppe'

    if (groupBy === 'none') return []
    return activeItemFilter
      ? aggregateByLine(filtered, keyFn, itemGroupFilter, itemNumberFilter)
      : aggregateByInvoice(filtered, keyFn)
  }, [filtered, groupBy, itemGroupFilter, itemNumberFilter, activeItemFilter])

  // ─── Debug info ─────────────────────────────────────────────────────────────

  const debugInfo = useMemo(() => {
    if (invoices.length === 0) return null
    const dates = invoices.map(inv => inv.invoice_date).filter(Boolean).sort()
    return {
      total: invoices.length,
      booked: invoices.filter(inv => inv.is_booked).length,
      earliest: dates[0],
      latest: dates[dates.length - 1],
      outsidePeriod: invoices.filter(inv => inv.invoice_date < from || inv.invoice_date > to).length,
    }
  }, [invoices, from, to])

  // ─── Data fetch ─────────────────────────────────────────────────────────────

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/invoices?from=${from}&to=${to}`)
      if (!res.ok) throw new Error('API fejl')
      setInvoices(await res.json())
    } catch {
      setError('Kunne ikke hente data fra Rackbeat')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f5f2ee]">
      {/* Header */}
      <header className="bg-[#2B2318] border-b border-[#3d3020]">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center gap-4">
          <div className="w-8 h-8 bg-[#C8A96E] rounded flex items-center justify-center">
            <span className="text-[#2B2318] font-bold text-sm">T</span>
          </div>
          <div>
            <span className="text-white font-bold text-sm tracking-widest uppercase">Niels Thams</span>
            <span className="text-[#C8A96E] text-[10px] tracking-widest uppercase block leading-none">Salgs Dashboard</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Filters */}
        <div className="mb-6 rounded-xl border border-[#3d3020] bg-[#2B2318] p-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Date range */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#a89070] uppercase tracking-wide">Fra dato</label>
              <input
                type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border border-[#3d3020] bg-[#1a1410] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#C8A96E]"
              style={{ colorScheme: 'dark' }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#a89070] uppercase tracking-wide">Til dato</label>
              <input
                type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border border-[#3d3020] bg-[#1a1410] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#C8A96E]"
              style={{ colorScheme: 'dark' }}
              />
            </div>

            <div className="h-8 w-px bg-[#3d3020]" />

            {/* Customer filters */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#a89070] uppercase tracking-wide">Kundegruppe</label>
              <select
                value={customerGroupFilter}
                onChange={(e) => { setCustomerGroupFilter(e.target.value); setCustomerFilter('') }}
                className="rounded-lg border border-[#3d3020] bg-[#1a1410] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#C8A96E]"
              >
                <option value="">Alle grupper</option>
                {customerGroups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#a89070] uppercase tracking-wide">Kunde</label>
              <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="rounded-lg border border-[#3d3020] bg-[#1a1410] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#C8A96E]"
              >
                <option value="">Alle kunder</option>
                {customers.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="h-8 w-px bg-[#3d3020]" />

            {/* Item filters */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#a89070] uppercase tracking-wide">Varegruppe</label>
              <select
                value={itemGroupFilter}
                onChange={(e) => { setItemGroupFilter(e.target.value); setItemNumberFilter('') }}
                className="rounded-lg border border-[#3d3020] bg-[#1a1410] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#C8A96E]"
              >
                <option value="">Alle varegrupper</option>
                {itemGroups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#a89070] uppercase tracking-wide">Varenummer</label>
              <select
                value={itemNumberFilter}
                onChange={(e) => setItemNumberFilter(e.target.value)}
                className="rounded-lg border border-[#3d3020] bg-[#1a1410] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#C8A96E]"
              >
                <option value="">Alle varer</option>
                {itemNumbers.map(([num, name]) => (
                  <option key={num} value={num}>{num} – {name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={load} disabled={loading}
              className="rounded-lg bg-[#C8A96E] px-5 py-2 text-sm font-semibold text-[#2B2318] hover:bg-[#e0c99a] disabled:opacity-50 transition-colors"
            >
              {loading ? 'Henter...' : 'Hent data'}
            </button>
          </div>

          {/* Active item filter notice */}
          {activeItemFilter && (
            <p className="mt-3 text-xs text-[#C8A96E]">
              Tal vises på linje-niveau for{' '}
              {itemGroupFilter && <span>varegruppe <strong>{itemGroupFilter}</strong></span>}
              {itemGroupFilter && itemNumberFilter && ' / '}
              {itemNumberFilter && <span>varenr. <strong>{itemNumberFilter}</strong></span>}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-sm text-red-400 border border-red-800">{error}</div>
        )}
        {loading && (
          <div className="mb-6 text-sm text-[#a89070]">Henter fakturaer fra Rackbeat...</div>
        )}

        {/* Debug info */}
        {debugInfo && (
          <div className={`mb-4 rounded-lg border px-4 py-3 text-xs font-mono ${debugInfo.outsidePeriod > 0 ? 'border-orange-500 bg-orange-100' : 'border-[#3d3020] bg-[#2B2318]'}`}>
            <span className={`font-semibold ${debugInfo.outsidePeriod > 0 ? 'text-orange-900' : 'text-[#C8A96E]'}`}>Faktura-data: </span>
            <span className={debugInfo.outsidePeriod > 0 ? 'text-orange-900' : 'text-white'}>
              {debugInfo.total} fakturaer hentet · ældste invoice_date: <strong>{debugInfo.earliest}</strong> · nyeste: <strong>{debugInfo.latest}</strong>
            </span>
            {debugInfo.outsidePeriod > 0 && (
              <span className="ml-3 font-semibold text-orange-800">⚠ {debugInfo.outsidePeriod} fakturaer har invoice_date uden for valgt periode — disse filtreres fra</span>
            )}
          </div>
        )}

        {/* KPI Cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <KPICard title="Omsætning" value={`${fmt(kpis.omsætning)} kr.`} sub={`${kpis.antal} ${activeItemFilter ? 'linjer' : 'fakturaer'}`} color="gold" />
          <KPICard title="Profit" value={`${fmt(kpis.profit)} kr.`} color="green" />
          <KPICard title="DB%" value={`${kpis.profitPct.toFixed(1)}%`} color={kpis.profitPct >= 20 ? 'green' : kpis.profitPct >= 10 ? 'orange' : 'red'} />
          <KPICard title="Antal fakturaer" value={String(filtered.length)} color="gold" />
        </div>

        {/* Chart */}
        <div className="mb-6">
          <RevenueChart data={chartData} />
        </div>

        {/* Group by toggle + Table */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs font-medium text-[#a89070] uppercase tracking-wide">Gruppér efter:</span>
          {(['customer', 'customer_group', 'none'] as GroupBy[]).map((g) => (
            <button
              key={g} onClick={() => setGroupBy(g)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                groupBy === g
                  ? 'bg-[#C8A96E] text-[#2B2318]'
                  : 'bg-[#2B2318] text-[#a89070] border border-[#3d3020] hover:border-[#C8A96E] hover:text-[#C8A96E]'
              }`}
            >
              {g === 'customer' ? 'Kunde' : g === 'customer_group' ? 'Kundegruppe' : 'Ingen'}
            </button>
          ))}
        </div>

        {groupBy !== 'none' && (
          <TopTable
            title={groupBy === 'customer' ? 'Top kunder' : 'Top kundegrupper'}
            rows={tableData}
          />
        )}
      </div>
    </div>
  )
}
