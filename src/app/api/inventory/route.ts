import { NextResponse } from 'next/server'
import { fetchItems, fetchOrders, fetchPurchaseOrders, fetchShipments } from '@/lib/rackbeat'

export const dynamic = 'force-dynamic'

export type Movement = { itemNumber: string; date: string; qty: number }

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const windowStart = new Date()
    windowStart.setDate(windowStart.getDate() - 7)
    const windowStartStr = windowStart.toISOString().slice(0, 10)

    const [items, orders, purchaseOrders, shipments] = await Promise.all([
      fetchItems(),
      fetchOrders(),
      fetchPurchaseOrders(),
      fetchShipments(windowStartStr),
    ])

    const activeItems = items.filter((i) => !i.is_barred && i.inventory_enabled)

    // Open sales orders → future outgoing movements
    const orderLines: Movement[] = []
    for (const order of orders) {
      if (order.is_cancelled || order.is_shipped) continue
      const rawDate = order.deliver_at ?? order.order_date
      const date = rawDate < today ? today : rawDate
      for (const line of order.lines ?? []) {
        if (line.child_type !== 'product') continue
        const remaining = (line.quantity ?? 0) - (line.quantity_shipped ?? 0)
        if (remaining > 0) orderLines.push({ itemNumber: line.child_id, date, qty: remaining })
      }
    }

    // Open purchase orders → future incoming movements
    const purchaseLines: Movement[] = []
    for (const po of purchaseOrders) {
      if (po.is_cancelled || po.is_received) continue
      for (const line of po.lines ?? []) {
        const rawDate = line.delivery_date ?? po.preferred_delivery_date ?? today
        const date = rawDate < today ? today : rawDate
        const remaining = (line.quantity ?? 0) - (line.quantity_received ?? 0)
        if (remaining > 0) purchaseLines.push({ itemNumber: line.child_id, date, qty: remaining })
      }
    }

    // Actual shipments → past outgoing movements (for backward reconstruction)
    const shipmentLines: Movement[] = []
    for (const shipment of shipments) {
      if (!shipment.is_shipped || !shipment.shipping_date) continue
      const date = shipment.shipping_date < windowStartStr ? windowStartStr : shipment.shipping_date
      for (const line of shipment.lines ?? []) {
        if (line.child_type !== 'product') continue
        if (line.quantity > 0) shipmentLines.push({ itemNumber: line.child_id, date, qty: line.quantity })
      }
    }

    // Received purchase orders in window → past incoming movements (for backward reconstruction)
    const receivedLines: Movement[] = []
    for (const po of purchaseOrders) {
      if (po.is_cancelled || !po.is_received) continue
      for (const line of po.lines ?? []) {
        const rawDate = line.delivery_date ?? po.preferred_delivery_date
        if (!rawDate) continue
        const date = rawDate < windowStartStr ? windowStartStr : rawDate
        if (date > today) continue
        const qty = line.quantity_received ?? line.quantity ?? 0
        if (qty > 0) receivedLines.push({ itemNumber: line.child_id, date, qty })
      }
    }

    return NextResponse.json({ items: activeItems, orderLines, purchaseLines, shipmentLines, receivedLines })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Kunne ikke hente lagerdata' }, { status: 500 })
  }
}
