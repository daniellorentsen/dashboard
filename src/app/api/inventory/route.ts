import { NextResponse } from 'next/server'
import { fetchItems, fetchOrders, fetchPurchaseOrders } from '@/lib/rackbeat'

export const dynamic = 'force-dynamic'

export type Movement = { itemNumber: string; date: string; qty: number }

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const windowStart = new Date()
    windowStart.setDate(windowStart.getDate() - 7)
    const windowStartStr = windowStart.toISOString().slice(0, 10)

    const [items, orders, purchaseOrders] = await Promise.all([
      fetchItems(),
      fetchOrders(),
      fetchPurchaseOrders(),
    ])

    const activeItems = items.filter((i) => !i.is_barred && i.inventory_enabled)

    // Sales orders → outgoing movements (by deliver_at date)
    // Dates older than the 7-day window are clamped to the window start
    const orderLines: Movement[] = []
    for (const order of orders) {
      if (order.is_cancelled || order.is_shipped) continue
      const rawDate = order.deliver_at ?? order.order_date
      const date = rawDate < windowStartStr ? windowStartStr : rawDate
      for (const line of order.lines ?? []) {
        if (line.child_type !== 'product') continue
        const remaining = (line.quantity ?? 0) - (line.quantity_shipped ?? 0)
        if (remaining > 0) orderLines.push({ itemNumber: line.child_id, date, qty: remaining })
      }
    }

    // Purchase orders → incoming movements (by preferred_delivery_date or line delivery_date)
    const purchaseLines: Movement[] = []
    for (const po of purchaseOrders) {
      if (po.is_cancelled || po.is_received) continue
      for (const line of po.lines ?? []) {
        const rawDate = line.delivery_date ?? po.preferred_delivery_date ?? today
        const date = rawDate < windowStartStr ? windowStartStr : rawDate
        const remaining = (line.quantity ?? 0) - (line.quantity_received ?? 0)
        if (remaining > 0) purchaseLines.push({ itemNumber: line.child_id, date, qty: remaining })
      }
    }

    return NextResponse.json({ items: activeItems, orderLines, purchaseLines })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Kunne ikke hente lagerdata' }, { status: 500 })
  }
}
