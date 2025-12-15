import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export default async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  // Define protected routes (for future use)
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/api/private') ||
    pathname.startsWith('/api/organizations') ||
    pathname.startsWith('/api/users') ||
    pathname.startsWith('/api/roles') ||
    pathname.startsWith('/api/tenants')

  // For now, skip authentication checks in Edge Runtime
  // TODO: Implement Edge Runtime compatible auth
  console.log(`Protected route check: ${isProtectedRoute} for ${pathname}`)

  // Add security headers to response
  const response = NextResponse.next()

  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';"
  )

  return response
}

export const middlewareConfig = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Apply middleware to all routes except static files
    '/(api|trpc)(.*)',
  ],
}
