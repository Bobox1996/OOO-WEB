import { randomInt } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const cookieName = 'ooo_home_v1'

export function GET(request: NextRequest) {
  const saved = request.cookies.get(cookieName)?.value
  const assigned = saved === 'works' || saved === 'sumiyoshi'
  const variant = assigned ? saved : (randomInt(100) < 80 ? 'works' : 'sumiyoshi')
  // A relative Location keeps the visitor on their original production or preview domain.
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: '/' + variant + request.nextUrl.search, 'Cache-Control': 'private, no-store' },
  })
  if (!assigned) {
    response.cookies.set(cookieName, variant, {
      httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:',
      path: '/', maxAge: 180 * 24 * 60 * 60,
    })
  }
  return response
}
