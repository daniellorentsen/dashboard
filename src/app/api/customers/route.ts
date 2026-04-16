import { NextResponse } from 'next/server'
import { fetchCustomers } from '@/lib/rackbeat'

export async function GET() {
  try {
    const customers = await fetchCustomers()
    return NextResponse.json(customers)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Kunne ikke hente kunder' }, { status: 500 })
  }
}
