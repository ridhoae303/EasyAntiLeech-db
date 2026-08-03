import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Lazy-load security module
    const { generateHmac } = await import('@/lib/security')

    const payload = {
      androidVersion: body.androidVersion,
      deviceModel: body.deviceModel,
      nonce: body.nonce,
      packageName: body.packageName,
      sha256Signature: body.sha256Signature,
      timestamp: body.timestamp,
    }

    const hmac = generateHmac(payload)

    return NextResponse.json({
      hmac,
      payload,
    })
  } catch (error) {
    console.error('[Test API] Error:', error)
    return NextResponse.json({ error: 'Failed to calculate HMAC' }, { status: 500 })
  }
}
