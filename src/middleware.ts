
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
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
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    )
                    response = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const path = request.nextUrl.pathname

    // Allow access to login, auth callback, and unauthorized pages
    // Allow access to login, auth callback, and unauthorized pages
    // Also allow access to ALL API routes as requested
    // /.well-known = public OAuth discovery metadata (MCP connectors fetch it unauthenticated)
    if (path.startsWith('/login') || path.startsWith('/auth') || path.startsWith('/unauthorized') || path.startsWith('/api') || path.startsWith('/.well-known')) {
        return response
    }

    // If no user, redirect to login
    if (!user) {
        const redirect = NextResponse.redirect(new URL('/login', request.url))
        // OAuth consent needs its authorization_id after login; /auth/callback reads this cookie.
        if (path.startsWith('/oauth/consent')) {
            redirect.cookies.set('post_login_next', path + request.nextUrl.search, {
                path: '/', maxAge: 600, httpOnly: true, sameSite: 'lax',
            })
        }
        return redirect
    }

    // Check if user is in whitelist (user_profiles)
    // We can't use the simple select count because RLS might block it if we don't have a profile yet?
    // Actually, if they are logged in but not in user_profiles, they shouldn't see anything.
    // But to be safe and explicit, let's query the table.

    try {
        const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('email')
            .eq('email', user.email)
            .single()

        if (error || !profile) {
            console.log('User not in whitelist:', user.email)
            // Redirect to unauthorized page
            return NextResponse.redirect(new URL('/unauthorized', request.url))
        }
    } catch (err) {
        console.error('Middleware auth check error:', err)
        return NextResponse.redirect(new URL('/unauthorized', request.url))
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
