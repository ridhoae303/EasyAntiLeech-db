import { NextRequest, NextResponse } from 'next/server'
import { desc, eq, gte, lte } from 'drizzle-orm'

interface LogQuery {
  limit?: number
  offset?: number
  status?: string
  packageName?: string
  startDate?: string
  endDate?: string
}

export async function GET(request: NextRequest): Promise<
  NextResponse<{
    logs: any[]
    total: number
    limit: number
    offset: number
  }>
> {
  // Verify admin token for production
  const authHeader = request.headers.get('authorization')
  if (!process.env.ADMIN_API_TOKEN || authHeader !== `Bearer ${process.env.ADMIN_API_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Lazy-load database
    const { db } = await import('@/lib/db')
    const { leechEvents } = await import('@/lib/schema')
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000)
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')
    const packageName = searchParams.get('packageName')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = db.select().from(leechEvents)

    // Build where conditions
    const conditions: any[] = []

    if (status) {
      conditions.push(eq(leechEvents.requestStatus, status))
    }

    if (packageName) {
      conditions.push(eq(leechEvents.packageName, packageName))
    }

    if (startDate) {
      conditions.push(gte(leechEvents.timestamp, new Date(startDate)))
    }

    if (endDate) {
      conditions.push(lte(leechEvents.timestamp, new Date(endDate)))
    }

    if (conditions.length > 0) {
      query = query.where(conditions[0])
      for (let i = 1; i < conditions.length; i++) {
        query = query.where(conditions[i])
      }
    }

    const logs = await query
      .orderBy(desc(leechEvents.timestamp))
      .limit(limit)
      .offset(offset)

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log.id,
        timestamp: log.timestamp,
        packageName: log.packageName,
        sha256Signature: log.sha256Signature,
        androidVersion: log.androidVersion,
        deviceModel: log.deviceModel,
        ipAddress: log.ipAddress,
        requestStatus: log.requestStatus,
        rejectionReason: log.rejectionReason,
        nonce: log.nonce,
        requestHash: log.requestHash,
      })),
      total: logs.length,
      limit,
      offset,
    })
  } catch (error) {
    console.error('[Logs API] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}
