// Varekategorier fra Customer-Order-Portal (Supabase-tabellen `products`).
// Rename-, override- og sorteringsreglerne er kopieret fra portalen
// (src/app/api/products/route.ts og src/components/product-catalogue.tsx)
// — hold dem i sync, hvis de ændres der.

export const FALLBACK_CATEGORY = 'Øvrige'

// Category name corrections — applied to all items regardless of product number
const CATEGORY_RENAMES: Record<string, string> = {
  'Straciatella': 'Stracciatella',
  'Fyldt Pasta': 'Frisk Fyldt Pasta',
  'Frisk Pasta': 'Frisk bånd pasta',
}

// Hardcoded category overrides — survives re-syncs from Rackbeat
const PRODUCT_CATEGORY_OVERRIDES: Record<string, string> = {
  '64423': 'ØKO Pålæg',
  '68441': 'ØKO Pålæg',
  '69623': 'ØKO Pålæg',
  '56911': 'ØKO Pålæg',
  '66911': 'ØKO Pålæg',
  '10341': 'Pålæg, hel enhed',
  '201411': 'Salami, hele stykker',
  '201481': 'Salami, hele stykker',
  '201431': 'Salami, hele stykker',
  '201471': 'Salami, hele stykker',
  '201421': 'Salami, hele stykker',
  '201451': 'Salami, hele stykker',
  '3610':  'Mozzarella',
  '17308': 'Færdigretter',
  '17307': 'Færdigretter',
  '1007':  'Salsiccia',
  '1008':  'Salsiccia',
  '073Z9': 'Stracciatella',
  '15027': 'Frisk Fyldt Gnocchi',
  '15024': 'Frisk Fyldt Gnocchi',
  '17099': 'Frisk Fyldt Pasta',
  '17309': 'Frisk Fyldt Pasta',
}

// Preferred category order per group (uppercase) — listed first in order, rest alphabetically
const CATEGORY_ORDER: Record<string, string[]> = {
  'CITTERIO':    ['ØKO Pålæg'],
  'FURLOTTI':    ['Pålæg i skiver'],
  'SMSS':        ['Salsiccia', 'Salami, hele stykker'],
  'VALENT':      ['Serrano', 'Chorizo', 'Tapas', 'Fuet'],
  'RANA':        ['Frisk Fyldt Pasta', 'Frisk bånd pasta', 'Frisk Gnocchi', 'Frisk Fyldt Gnocchi', 'Saucer', 'Færdigretter'],
}

/** Builds the final number → category map from raw Supabase rows. */
export function buildCategoryMap(rows: { number: string; product_category: string | null }[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const row of rows) {
    if (!row.product_category) continue
    map[row.number] = CATEGORY_RENAMES[row.product_category] ?? row.product_category
  }
  return { ...map, ...PRODUCT_CATEGORY_OVERRIDES }
}

/** Looks up an item's category, tolerating leading-zero differences in item numbers. */
export function categoryFor(map: Record<string, string>, itemNumber: string): string {
  return map[itemNumber] ?? map[itemNumber.replace(/^0+/, '')] ?? FALLBACK_CATEGORY
}

export function compareCategories(groupName: string) {
  const order = CATEGORY_ORDER[groupName.toUpperCase()] ?? []
  return (a: string, b: string) => {
    if (a === b) return 0
    if (a === FALLBACK_CATEGORY) return 1
    if (b === FALLBACK_CATEGORY) return -1
    const ai = order.indexOf(a)
    const bi = order.indexOf(b)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.localeCompare(b, 'da')
  }
}
