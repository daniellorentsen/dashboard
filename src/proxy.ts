import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const auth = request.headers.get('authorization')

  if (auth?.startsWith('Basic ')) {
    const decoded = atob(auth.slice(6))
    const colon = decoded.indexOf(':')
    if (colon > -1) {
      const user = decoded.slice(0, colon)
      const pass = decoded.slice(colon + 1)
      if (
        user === process.env.BASIC_AUTH_USER &&
        pass === process.env.BASIC_AUTH_PASSWORD
      ) {
        return NextResponse.next()
      }
    }
  }

  return new NextResponse('Adgang nægtet', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Niels Thams Dashboard"' },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
