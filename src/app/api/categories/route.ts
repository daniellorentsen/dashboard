import { NextResponse } from 'next/server'
import { buildCategoryMap } from '@/lib/categories'

export const dynamic = 'force-dynamic'

type Row = { number: string; product_category: string | null }

const PAGE_SIZE = 1000

export async function GET() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Without Supabase credentials the page still works — every item falls back to "Øvrige".
  if (!url || !key) {
    return NextResponse.json({ categories: buildCategoryMap([]), configured: false })
  }

  try {
    const rows: Row[] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const res = await fetch(
        `${url}/rest/v1/products?select=number,product_category&product_category=not.is.null&order=number&limit=${PAGE_SIZE}&offset=${offset}`,
        {
          // Legacy service_role keys are JWTs and go in Authorization too; new sb_secret_ keys only in apikey
          headers: key.startsWith('eyJ') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key },
          next: { revalidate: 300 },
        },
      )
      if (!res.ok) throw new Error(`Supabase error: ${res.status} ${await res.text()}`)
      const page: Row[] = await res.json()
      rows.push(...page)
      if (page.length < PAGE_SIZE) break
    }
    return NextResponse.json({ categories: buildCategoryMap(rows), configured: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Kunne ikke hente varekategorier' }, { status: 500 })
  }
}
