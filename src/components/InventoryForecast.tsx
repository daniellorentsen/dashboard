'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import MultiSelect from './MultiSelect'
import type { ItemStock } from '@/lib/rackbeat'

type Movement = { itemNumber: string; date: string; qty: number }

type InventoryData = {
  items: ItemStock[]
  orderLines: Movement[]
  purchaseLines: Movement[]
}

const DAY_NAMES = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør']

// 7 days back + today + 20 days forward = 28 columns
function makeDates(daysBack = 7, daysForward = 20): string[] {
  const base = new Date()
  return Array.from({ length: daysBack + 1 + daysForward }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() - daysBack + i)
    return d.toISOString().slice(0, 10)
  })
}

function fmtHeader(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return { day: DAY_NAMES[d.getDay()], num: `${d.getDate()}/${d.getMonth() + 1}` }
}

function isWeekend(dateStr: string) {
  const day = new Date(dateStr + 'T00:00:00').getDay()
  return day === 0 || day === 6
}

function heatColor(value: number, max: number): string {
  if (value < 0) return 'hsl(0, 80%, 65%)'
  if (value === 0 || max === 0) return 'hsl(25, 85%, 60%)'
  const ratio = Math.min(value / max, 1)
  const hue = 25 + ratio * 95
  const lightness = 55 + ratio * 8
  return `hsl(${hue}, 70%, ${lightness}%)`
}

export default function InventoryForecast() {
  const [data, setData] = useState<InventoryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groupFilter, setGroupFilter] = useState<string[]>([])
  const [itemFilter, setItemFilter] = useState<string[]>([])
  const [focusDate, setFocusDate] = useState<string>('')
  const [forecastOn, setForecastOn] = useState(false)
  const [salesAvg, setSalesAvg] = useState<Record<string, number[]> | null>(null)
  const [forecastLoading, setForecastLoading] = useState(false)

  const dates = useMemo(() => makeDates(), [])
  const today = new Date().toISOString().slice(0, 10)
  const todayIdx = dates.indexOf(today)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/inventory')
      if (!res.ok) throw new Error('API fejl')
      setData(await res.json())
    } catch {
      setError('Kunne ikke hente lagerdata fra Rackbeat')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function loadForecast() {
    setForecastLoading(true)
    try {
      const res = await fetch('/api/salesavg')
      if (!res.ok) throw new Error()
      setSalesAvg(await res.json())
      setForecastOn(true)
    } finally {
      setForecastLoading(false)
    }
  }

  function toggleForecast() {
    if (forecastLoading) return
    if (!forecastOn && salesAvg === null) loadForecast()
    else setForecastOn((v) => !v)
  }

  // ── Merge .UB variants into their base item ─────────────────────────────────

  const mergedData = useMemo(() => {
    if (!data) return null
    const remap = (num: string) => num.endsWith('.UB') ? num.slice(0, -3) : num

    const ubStock = new Map<string, number>()
    for (const item of data.items) {
      if (item.number.endsWith('.UB')) {
        const base = remap(item.number)
        ubStock.set(base, (ubStock.get(base) ?? 0) + item.stock_quantity)
      }
    }

    const items = data.items
      .filter((item) => !item.number.endsWith('.UB'))
      .map((item) => {
        const extra = ubStock.get(item.number) ?? 0
        return extra ? { ...item, stock_quantity: item.stock_quantity + extra } : item
      })

    const orderLines = data.orderLines.map((l) => ({ ...l, itemNumber: remap(l.itemNumber) }))
    const purchaseLines = data.purchaseLines.map((l) => ({ ...l, itemNumber: remap(l.itemNumber) }))

    return { items, orderLines, purchaseLines }
  }, [data])

  // ── Filter options ──────────────────────────────────────────────────────────

  const groups = useMemo(() => {
    if (!mergedData) return []
    const s = new Set<string>()
    for (const item of mergedData.items) if (item.group?.name) s.add(item.group.name)
    return Array.from(s).sort()
  }, [mergedData])

  const itemOptions = useMemo(() => {
    if (!mergedData) return []
    const map = new Map<string, string>()
    for (const item of mergedData.items) {
      if (groupFilter.length > 0 && !groupFilter.includes(item.group?.name ?? '')) continue
      map.set(item.number, item.name)
    }
    return Array.from(map.entries()).sort(([, a], [, b]) => a.localeCompare(b))
  }, [mergedData, groupFilter])

  // ── Filtered items ──────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    if (!mergedData) return []
    return mergedData.items.filter((item) => {
      if (groupFilter.length > 0 && !groupFilter.includes(item.group?.name ?? '')) return false
      if (itemFilter.length > 0 && !itemFilter.includes(item.number)) return false
      return true
    })
  }, [mergedData, groupFilter, itemFilter])

  // ── Movement index: itemNumber → date → { in, out } ────────────────────────

  const movIdx = useMemo(() => {
    if (!mergedData) return new Map<string, Record<string, { in: number; out: number }>>()
    const idx = new Map<string, Record<string, { in: number; out: number }>>()

    function add(itemNum: string, date: string, key: 'in' | 'out', qty: number) {
      if (!idx.has(itemNum)) idx.set(itemNum, {})
      const m = idx.get(itemNum)!
      if (!m[date]) m[date] = { in: 0, out: 0 }
      m[date][key] += qty
    }

    for (const l of mergedData.orderLines) add(l.itemNumber, l.date, 'out', l.qty)
    for (const l of mergedData.purchaseLines) add(l.itemNumber, l.date, 'in', l.qty)
    return idx
  }, [mergedData])

  // ── Forecast per item ───────────────────────────────────────────────────────
  // stock_quantity = physical stock NOW (today). We reconstruct what the stock
  // "should have been" on past dates by reversing any overdue open-order movements,
  // then project forward. This way today's column always equals stock_quantity.

  const forecasts = useMemo(() => {
    return filteredItems.map((item) => {
      const movements = movIdx.get(item.number) ?? {}

      // Reverse past movements to get the starting stock at dates[0]
      let startStock = item.stock_quantity
      for (let i = 0; i < todayIdx; i++) {
        const m = movements[dates[i]]
        if (m) startStock = startStock + m.out - m.in
      }

      // Apply all movements forward from dates[0]
      let running = startStock
      const values = dates.map((date) => {
        const m = movements[date]
        if (m) running = running + m.in - m.out
        return running
      })

      return { item, values, minValue: Math.min(...values), maxValue: Math.max(...values) }
    })
  }, [filteredItems, movIdx, dates, todayIdx])

  // Sort: items that go negative first, then by group → name
  const sorted = useMemo(() => {
    return [...forecasts].sort((a, b) => {
      if (a.minValue < 0 && b.minValue >= 0) return -1
      if (b.minValue < 0 && a.minValue >= 0) return 1
      const ga = a.item.group?.name ?? ''
      const gb = b.item.group?.name ?? ''
      return ga !== gb ? ga.localeCompare(gb) : a.item.name.localeCompare(b.item.name)
    })
  }, [forecasts])

  // ── Forecast adjustments: expected unconfirmed sales per item per date ──────

  const forecastAdjustments = useMemo(() => {
    if (!forecastOn || !salesAvg) return new Map<string, (number | null)[]>()
    const map = new Map<string, (number | null)[]>()
    for (const item of filteredItems) {
      const avg = salesAvg[item.number]
      const movements = movIdx.get(item.number) ?? {}
      let cumExtra = 0
      const extras = dates.map((date, i) => {
        if (i < todayIdx + 3) return null
        const wd = new Date(date + 'T00:00:00').getDay()
        const expected = avg?.[wd] ?? 0
        const confirmed = movements[date]?.out ?? 0
        cumExtra += Math.max(0, expected - confirmed)
        return cumExtra
      })
      map.set(item.number, extras)
    }
    return map
  }, [forecastOn, salesAvg, filteredItems, movIdx, dates, todayIdx])

  // ── Render ──────────────────────────────────────────────────────────────────

  const COL_ITEM = 210
  const COL_DATE = 52

  return (
    <div className="min-h-screen bg-[#1a1410]">
      {/* Header */}
      <header className="bg-[#2B2318] border-b border-[#3d3020]">
        <div className="px-6 py-4 flex items-center gap-4">
          <div className="w-8 h-8 bg-[#C8A96E] rounded flex items-center justify-center shrink-0">
            <span className="text-[#2B2318] font-bold text-sm">T</span>
          </div>
          <div>
            <span className="text-white font-bold text-sm tracking-widest uppercase">Niels Thams</span>
            <span className="text-[#C8A96E] text-[10px] tracking-widest uppercase block leading-none">Lager Dashboard</span>
          </div>
          <nav className="ml-auto flex gap-6">
            <Link href="/" className="text-xs text-[#a89070] hover:text-[#C8A96E] transition-colors uppercase tracking-wide">Salg</Link>
            <span className="text-xs text-[#C8A96E] border-b border-[#C8A96E] uppercase tracking-wide pb-px">Lager</span>
          </nav>
        </div>
      </header>

      <div className="px-4 py-5">
        {/* Filters */}
        <div className="mb-4 rounded-xl border border-[#3d3020] bg-[#2B2318] p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#a89070] uppercase tracking-wide">Varegruppe</label>
              <MultiSelect
                options={groups.map((g) => ({ value: g, label: g }))}
                value={groupFilter}
                onChange={(v) => { setGroupFilter(v); setItemFilter([]) }}
                placeholder="Alle varegrupper"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#a89070] uppercase tracking-wide">Varenummer</label>
              <MultiSelect
                options={itemOptions.map(([num, name]) => ({ value: num, label: `${num} – ${name}` }))}
                value={itemFilter}
                onChange={setItemFilter}
                placeholder="Alle varer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#a89070] uppercase tracking-wide">Fokus dag</label>
              <input
                type="date"
                value={focusDate}
                onChange={(e) => setFocusDate(e.target.value)}
                className="rounded-lg border border-[#3d3020] bg-[#1a1410] px-3 py-[7px] text-sm text-[#c8b090] focus:outline-none focus:border-blue-500 [color-scheme:dark]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#a89070] uppercase tracking-wide">Salgsforecast</label>
              <button
                onClick={toggleForecast}
                disabled={forecastLoading}
                className={`rounded-lg px-4 py-[7px] text-sm font-semibold transition-colors disabled:opacity-50 ${
                  forecastOn
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'border border-[#3d3020] bg-[#1a1410] text-[#a89070] hover:text-[#c8b090]'
                }`}
              >
                {forecastLoading ? 'Henter...' : forecastOn ? 'Til' : 'Fra'}
              </button>
            </div>
            <button
              onClick={load} disabled={loading}
              className="rounded-lg bg-[#C8A96E] px-5 py-2 text-sm font-semibold text-[#2B2318] hover:bg-[#e0c99a] disabled:opacity-50 transition-colors"
            >
              {loading ? 'Henter...' : 'Opdater'}
            </button>
            {mergedData && (
              <span className="text-xs text-[#a89070] ml-2 self-center">
                {filteredItems.length} varer · {mergedData.orderLines.length} salgslinjer · {mergedData.purchaseLines.length} indkøbslinjer
              </span>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mb-3 flex items-center gap-5 text-xs text-[#a89070]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-red-900/50 border border-red-700" />
            Negativt lager
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm border border-orange-500" />
            Nul på lager
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#2B2318] border border-[#C8A96E]/40" />
            I dag
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-sm text-red-400 border border-red-800">{error}</div>
        )}
        {loading && !data && (
          <div className="text-sm text-[#a89070]">Henter data fra Rackbeat — dette kan tage 10-15 sekunder første gang...</div>
        )}

        {/* Table */}
        {sorted.length > 0 && (
          <div className="rounded-xl border border-[#3d3020] overflow-hidden">
            <div className="overflow-x-auto">
              <table
                className="text-xs border-collapse bg-[#2B2318]"
                style={{ tableLayout: 'fixed', width: `${COL_ITEM + dates.length * COL_DATE}px` }}
              >
                <colgroup>
                  <col style={{ width: `${COL_ITEM}px` }} />
                  {dates.map((d) => <col key={d} style={{ width: `${COL_DATE}px` }} />)}
                </colgroup>

                <thead>
                  <tr className="border-b-2 border-[#3d3020]">
                    <th className="sticky left-0 z-20 bg-[#2B2318] px-3 py-2 text-left text-[#a89070] font-medium">
                      Vare ({sorted.length})
                    </th>
                    {dates.map((date) => {
                      const { day, num } = fmtHeader(date)
                      const isToday = date === today
                      const isFocus = focusDate !== '' && date === focusDate
                      const weekend = isWeekend(date)
                      return (
                        <th
                          key={date}
                          className={`py-1.5 text-center font-medium leading-tight ${
                            isToday
                              ? 'text-[#C8A96E] bg-[#C8A96E]/10 border-l-2 border-l-white/70 border-r-2 border-r-white/70'
                              : isFocus
                              ? 'text-blue-300 bg-blue-900/20 border-l-2 border-l-blue-400/80 border-r-2 border-r-blue-400/80'
                              : weekend
                              ? 'text-[#5a4535]'
                              : 'text-[#a89070]'
                          }${isFocus && isToday ? ' border-l-blue-400/80 border-r-blue-400/80' : ''}`}
                        >
                          <div className="text-[10px]">{day}</div>
                          <div>{num}</div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>

                <tbody>
                  {sorted.map(({ item, values, maxValue }) => (
                    <tr key={item.number} className="group border-b border-[#3d3020] last:border-0">
                      {/* Sticky item column */}
                      <td className="sticky left-0 z-10 bg-[#2B2318] group-hover:bg-[#3d3020] px-3 py-1.5 transition-colors">
                        <div className="font-semibold text-[#C8A96E] truncate leading-tight" title={item.number}>
                          {item.number}
                        </div>
                        <div className="text-[10px] text-[#a89070] truncate leading-tight" title={item.name}>
                          {item.name}
                        </div>
                      </td>

                      {/* Date cells */}
                      {values.map((value, i) => {
                        const date = dates[i]
                        const isToday = date === today
                        const isFocus = focusDate !== '' && date === focusDate
                        const weekend = isWeekend(date)
                        const hasIncoming = (movIdx.get(item.number)?.[date]?.in ?? 0) > 0
                        const extra = forecastOn ? (forecastAdjustments.get(item.number)?.[i] ?? null) : null
                        const forecastValue = extra !== null && extra > 0 ? Math.round(value - extra) : null
                        return (
                          <td
                            key={date}
                            className={`py-1.5 text-center tabular-nums transition-colors ${
                              value < 0 ? 'bg-red-900/50 font-semibold' : hasIncoming ? 'bg-green-900/50' : ''
                            } ${
                              isToday ? 'bg-[#C8A96E]/8 border-l-2 border-l-white/70 border-r-2 border-r-white/70' : weekend ? 'bg-[#1f1a15]' : ''
                            } ${
                              isFocus ? 'border-l-2 border-l-blue-400/80 border-r-2 border-r-blue-400/80' : ''
                            } group-hover:brightness-110`}
                            style={{ color: heatColor(value, maxValue) }}
                          >
                            <div className="leading-none">{value}</div>
                            {forecastValue !== null && (
                              <div
                                className="text-[9px] leading-none mt-0.5 opacity-75"
                                style={{ color: heatColor(forecastValue, maxValue) }}
                              >
                                ({forecastValue})
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && mergedData && sorted.length === 0 && (
          <div className="rounded-xl border border-[#3d3020] bg-[#2B2318] p-10 text-center text-[#a89070]">
            Ingen aktive varer matcher de valgte filtre.
          </div>
        )}
      </div>
    </div>
  )
}
