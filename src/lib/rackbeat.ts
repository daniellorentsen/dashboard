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
