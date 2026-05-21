const BASE_URL = process.env.RACKBEAT_BASE_URL!
const API_KEY = process.env.RACKBEAT_API_KEY!

const headers = {
  Authorization: `Bearer ${API_KEY}`,
  Accept: 'application/json',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvoiceLine = {
  id: number
  name: string
  quantity: number
  line_price: number
  line_total: number
  line_gross_profit_percentage: number
  item_cost_price: number
  discount_percentage: number
  child_id: string
  child_type: string
  item?: {
    number: string
    name: string
    group?: { number: number; name: string } | null
    default_supplier?: { name: string } | null
  } | null
}

export type Invoice = {
  number: number
  invoice_date: string
  due_date: string
  currency: string
  currency_rate: number
  total_subtotal: number
  total_vat: number
  total_total: number
  total_base_currency: number
  total_profit: number
  total_profit_percentage: number
  total_cost: number
  is_creditnote: boolean
  is_booked: boolean
  customer_id: number
  customer: {
    number: number
    name: string
    customer_group_id: number | null
    customer_group?: { number: number; name: string } | null
  }
  lines: InvoiceLine[]
}

export type Customer = {
  number: number
  name: string
  is_barred: boolean
  customer_group?: { number: number; name: string } | null
}

export type ItemStock = {
  number: string
  name: string
  stock_quantity: number
  in_order_quantity: number
  available_quantity: number
  purchased_quantity: number
  is_barred: boolean
  inventory_enabled: boolean
  group: { number: number; name: string } | null
  default_supplier: { number: number; name: string } | null
}

export type OrderLine = {
  id: number
  child_id: string
  child_type: string
  quantity: number
  quantity_shipped: number
  delivery_date: string | null
}

export type Order = {
  number: number
  order_date: string
  deliver_at: string | null
  is_booked: boolean
  is_cancelled: boolean
  is_shipped: boolean
  is_partly_shipped: boolean
  lines: OrderLine[]
}

export type PurchaseOrderLine = {
  id: number
  child_id: string
  quantity: number
  quantity_received: number
  delivery_date: string | null
}

export type PurchaseOrder = {
  number: number
  purchase_date: string
  preferred_delivery_date: string | null
  is_booked: boolean
  is_cancelled: boolean
  is_received: boolean
  lines: PurchaseOrderLine[]
}

export type OrderShipmentLine = {
  id: number
  child_id: string
  child_type: string
  quantity: number
}

export type OrderShipment = {
  id: number
  is_shipped: boolean
  shipping_date: string | null
  lines: OrderShipmentLine[]
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

export async function fetchInvoices(from: string, to: string): Promise<Invoice[]> {
  const all: Invoice[] = []
  let page = 1
  const limit = 100

  // API-filteret bruger ikke invoice_date, så vi henter med 45 dages buffer
  // og filtrerer selv på invoice_date i API-ruten
  const bufferedFrom = new Date(from)
  bufferedFrom.setDate(bufferedFrom.getDate() - 45)
  const bufferedTo = new Date(to)
  bufferedTo.setDate(bufferedTo.getDate() + 45)
  const apiFrom = bufferedFrom.toISOString().slice(0, 10)
  const apiTo = bufferedTo.toISOString().slice(0, 10)

  while (true) {
    const url = `${BASE_URL}/customer-invoices?from=${apiFrom}&to=${apiTo}&booked=true&limit=${limit}&page=${page}`
    const res = await fetch(url, { headers, next: { revalidate: 300 } })
    if (!res.ok) throw new Error(`Rackbeat invoices error: ${res.status}`)
    const data = await res.json()
    const invoices: Invoice[] = data.customer_invoices ?? []
    all.push(...invoices)
    if (invoices.length < limit) break
    page++
  }

  return all
}

async function fetchAllPages<T>(
  buildUrl: (page: number) => string,
  key: string,
  revalidate: number,
): Promise<T[]> {
  const res = await fetch(buildUrl(1), { headers, next: { revalidate } })
  if (!res.ok) throw new Error(`Rackbeat fetch error: ${res.status} ${buildUrl(1)}`)
  const data = await res.json()
  const first: T[] = data[key] ?? []
  const totalPages: number = data.pages ?? 1
  if (totalPages <= 1) return first
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) => i + 2).map((page) =>
      fetch(buildUrl(page), { headers, next: { revalidate } })
        .then((r) => r.json())
        .then((d) => (d[key] ?? []) as T[])
    )
  )
  return [first, ...rest].flat()
}

export async function fetchItems(): Promise<ItemStock[]> {
  return fetchAllPages<ItemStock>(
    (page) => `${BASE_URL}/items?limit=100&page=${page}`,
    'items',
    300,
  )
}

export async function fetchOrders(): Promise<Order[]> {
  return fetchAllPages<Order>(
    (page) => `${BASE_URL}/orders?booked=true&limit=100&page=${page}`,
    'orders',
    300,
  )
}

export async function fetchPurchaseOrders(): Promise<PurchaseOrder[]> {
  return fetchAllPages<PurchaseOrder>(
    (page) => `${BASE_URL}/purchase-orders?booked=true&limit=100&page=${page}`,
    'purchase_orders',
    300,
  )
}

export async function fetchReceivedPurchaseOrders(from: string): Promise<PurchaseOrder[]> {
  return fetchAllPages<PurchaseOrder>(
    (page) => `${BASE_URL}/purchase-orders?booked=true&received=true&from=${from}&limit=100&page=${page}`,
    'purchase_orders',
    300,
  )
}

export async function fetchShipments(from: string): Promise<OrderShipment[]> {
  return fetchAllPages<OrderShipment>(
    (page) => `${BASE_URL}/order-shipments?shipped=true&from=${from}&limit=100&page=${page}`,
    'order_shipments',
    300,
  )
}

export async function fetchCustomers(): Promise<Customer[]> {
  const all: Customer[] = []
  let page = 1
  const limit = 100

  while (true) {
    const url = `${BASE_URL}/customers?limit=${limit}&page=${page}`
    const res = await fetch(url, { headers, next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`Rackbeat customers error: ${res.status}`)
    const data = await res.json()
    const customers: Customer[] = data.customers ?? []
    all.push(...customers)
    if (customers.length < limit) break
    page++
  }

  return all
}
