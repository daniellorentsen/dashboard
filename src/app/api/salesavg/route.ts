import { NextResponse } from 'next/server'
import { fetchInvoices } from '@/lib/rackbeat'

export const dynamic = 'force-dynamic'

const WEEKS_BACK = 8
const remap = (num: string) => num.endsWith('.UB') ? num.slice(0, -3) : num

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const from = new Date()
    from.setDate(from.getDate() - WEEKS_BACK * 7)
    const fromStr = from.toISOString().slice(0, 10)

    const invoices = await fetchInvoices(fromStr, today)

    // Count how many of each weekday exist in the period (denominator for averages)
    const weekdayCounts = new Array(7).fill(0)
    const cursor = new Date(fromStr + 'T00:00:00')
    const end = new Date(today + 'T00:00:00')
    while (cursor <= end) {
      weekdayCounts[cursor.getDay()]++
      cursor.setDate(cursor.getDate() + 1)
    }

    // Sum quantities per item per weekday
    const totals: Record<string, number[]> = {}
    for (const inv of invoices) {
      if (inv.is_creditnote) continue
      if (inv.invoice_date < fromStr || inv.invoice_date > today) continue
      const wd = new Date(inv.invoice_date + 'T00:00:00').getDay()
      for (const line of inv.lines) {
        if (line.child_type !== 'product') continue
        const num = remap(line.child_id)
        if (!totals[num]) totals[num] = new Array(7).fill(0)
        totals[num][wd] += line.quantity
      }
    }

    // Convert to average per weekday occurrence in the period
    const salesAvg: Record<string, number[]> = {}
    for (const [num, wdTotals] of Object.entries(totals)) {
      salesAvg[num] = wdTotals.map((total, wd) =>
        weekdayCounts[wd] > 0 ? total / weekdayCounts[wd] : 0
      )
    }

    return NextResponse.json(salesAvg)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Kunne ikke hente salgshistorik' }, { status: 500 })
  }
}
