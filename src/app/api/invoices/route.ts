import { NextRequest, NextResponse } from 'next/server'
import { fetchInvoices } from '@/lib/rackbeat'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const from = searchParams.get('from') ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
  const to = searchParams.get('to') ?? new Date().toISOString().slice(0, 10)

  try {
    const all = await fetchInvoices(from, to)
    // Kun bogførte fakturaer med invoice_date inden for perioden
    // (Rackbeats API-filter bruger ikke invoice_date, så vi filtrerer selv)
    const invoices = all.filter(inv =>
      inv.is_booked === true &&
      inv.invoice_date >= from &&
      inv.invoice_date <= to
    )
    return NextResponse.json(invoices)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Kunne ikke hente fakturaer' }, { status: 500 })
  }
}
