import { NextResponse } from 'next/server'
import { fetchInvoices, fetchReceivedPurchaseOrders } from '@/lib/rackbeat'

export const dynamic = 'force-dynamic'

const WEEKS_BACK = 8
const remap = (num: string) => num.endsWith('.UB') ? num.slice(0, -3) : num

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const from = new Date()
    from.setDate(from.getDate() - WEEKS_BACK * 7)
    const fromStr = from.toISOString().slice(0, 10)

    const [invoices, receivedPOs] = await Promise.all([
      fetchInvoices(fromStr, today),
      fetchReceivedPurchaseOrders(fromStr),
    ])

    // Count how many of each weekday exist in the period (denominator for averages)
    const weekdayCounts = new Array(7).fill(0)
    const cursor = new Date(fromStr + 'T00:00:00')
    const end = new Date(today + 'T00:00:00')
    while (cursor <= end) {
      weekdayCounts[cursor.getDay()]++
      cursor.setDate(cursor.getDate() + 1)
    }

    // Sum quantities per item per weekday + per date
    const totals: Record<string, number[]> = {}
    const dailySales: Record<string, Record<string, number>> = {}

    for (const inv of invoices) {
      if (inv.is_creditnote) continue
      if (inv.invoice_date < fromStr || inv.invoice_date > today) continue
      const wd = new Date(inv.invoice_date + 'T00:00:00').getDay()
      for (const line of inv.lines) {
        if (line.child_type !== 'product') continue
        const num = remap(line.child_id)
        if (!totals[num]) totals[num] = new Array(7).fill(0)
        totals[num][wd] += line.quantity
        if (!dailySales[num]) dailySales[num] = {}
        dailySales[num][inv.invoice_date] = (dailySales[num][inv.invoice_date] ?? 0) + line.quantity
      }
    }

    // Convert to average per weekday occurrence in the period
    const salesAvg: Record<string, number[]> = {}
    for (const [num, wdTotals] of Object.entries(totals)) {
      salesAvg[num] = wdTotals.map((total, wd) =>
        weekdayCounts[wd] > 0 ? total / weekdayCounts[wd] : 0
      )
    }

    // Received purchase orders → incoming deliveries per item per date
    const dailyReceived: Record<string, Record<string, number>> = {}
    for (const po of receivedPOs) {
      if (po.is_cancelled) continue
      for (const line of po.lines ?? []) {
        const dateStr = line.delivery_date ?? po.preferred_delivery_date
        if (!dateStr || dateStr < fromStr || dateStr > today) continue
        const num = remap(line.child_id)
        const qty = line.quantity_received ?? 0
        if (qty <= 0) continue
        if (!dailyReceived[num]) dailyReceived[num] = {}
        dailyReceived[num][dateStr] = (dailyReceived[num][dateStr] ?? 0) + qty
      }
    }

    return NextResponse.json({ salesAvg, dailySales, dailyReceived })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Kunne ikke hente salgshistorik' }, { status: 500 })
  }
}
