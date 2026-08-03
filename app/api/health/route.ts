import { NextResponse } from 'next/server'

export async function GET(): Promise<
  NextResponse<{
    status: string
    database: string
    allowedSignaturesCount: number
    timestamp: string
    version: string
  }>
> {
  try {
    // Check if DATABASE_URL is configured
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          database: 'not_configured',
          allowedSignaturesCount: 0,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
        { status: 503 }
      )
    }

    // Import db here to avoid initialization errors during build
    const { db } = await import('@/lib/db')
    const { allowedSignatures } = await import('@/lib/schema')

    // Test database connection
    const signatureCount = await db
      .select()
      .from(allowedSignatures)

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      allowedSignaturesCount: signatureCount.length,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    })
  } catch (error) {
    console.error('[Health Check] Database error:', error)
    return NextResponse.json(
      {
        status: 'unhealthy',
        database: 'error',
        allowedSignaturesCount: 0,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
      { status: 503 }
    )
  }
}
