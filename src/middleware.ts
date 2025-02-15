import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
    const theme = req.cookies.get('theme')?.value || 'dark'
    const res = NextResponse.next()
    res.headers.set('x-theme', theme)
    return res
}
