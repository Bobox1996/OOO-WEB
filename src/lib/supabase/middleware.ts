import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (request.nextUrl.pathname === '/admin/login') {
      // Allow access to login page
      if (user) {
        // Check if user is authorized as admin
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id')
          .eq('email', user.email)
          .single()

        if (adminUser) {
          // Redirect authorized admin users to dashboard
          const url = request.nextUrl.clone()
          url.pathname = '/admin/dashboard'
          return NextResponse.redirect(url)
        }
        // If not authorized, let them stay on login page (they'll see error)
      }
    } else {
      // Protect other admin routes
      if (!user) {
        const url = request.nextUrl.clone()
        url.pathname = '/admin/login'
        return NextResponse.redirect(url)
      } else {
        // Check if user is authorized as admin
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id')
          .eq('email', user.email)
          .single()

        if (!adminUser) {
          // User is logged in but not authorized as admin
          const url = request.nextUrl.clone()
          url.pathname = '/admin/login'
          url.searchParams.set('error', 'unauthorized')
          return NextResponse.redirect(url)
        }
      }
    }
  }

  // Protect app routes
  if (request.nextUrl.pathname.startsWith('/app')) {
    if (request.nextUrl.pathname === '/app/login') {
      // Allow access to login page
      if (user) {
        // Check if user is authorized as app user
        const { data: appUser } = await supabase
          .from('app_users')
          .select('id, stopped')
          .eq('email', user.email)
          .single()

        if (appUser && !appUser.stopped) {
          // Redirect authorized (and not stopped) app users to app
          const url = request.nextUrl.clone()
          url.pathname = '/app'
          return NextResponse.redirect(url)
        }
        // If not authorized or stopped, let them stay on login page (they'll see error)
      }
    } else {
      // Protect other app routes
      if (!user) {
        const url = request.nextUrl.clone()
        url.pathname = '/app/login'
        return NextResponse.redirect(url)
      } else {
        // Check if user is authorized as app user
        const { data: appUser } = await supabase
          .from('app_users')
          .select('id, stopped')
          .eq('email', user.email)
          .single()

        if (!appUser) {
          // User is logged in but not authorized as app user
          const url = request.nextUrl.clone()
          url.pathname = '/app/login'
          url.searchParams.set('error', 'unauthorized')
          return NextResponse.redirect(url)
        }

        if (appUser.stopped) {
          // User is stopped
          const url = request.nextUrl.clone()
          url.pathname = '/app/login'
          url.searchParams.set('error', 'stopped')
          return NextResponse.redirect(url)
        }
      }
    }
  }

  return supabaseResponse
}
