import { NextRequest, NextResponse } from 'next/server'
import { authApiUrl } from '@/utils/auth/authApiUrl'

export async function GET(req: NextRequest) {
    const redirectPath = safeRedirectPath(req.nextUrl.searchParams.get('redirectPath') || req.nextUrl.searchParams.get('path'))
    const target = new URL(`${authApiUrl().replace(/\/$/, '')}/auth/sso/start`)
    target.searchParams.set('redirectPath', redirectPath)
    return NextResponse.redirect(target)
}

function safeRedirectPath(path: string | null) {
    if (!path || !path.startsWith('/') || path.startsWith('//')) return '/dashboard'
    return path
}
