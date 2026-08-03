import {
  bigserial,
  boolean,
  index,
  inet,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const allowedSignatures = pgTable(
  'allowed_signatures',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey(),
    sha256Hash: text('sha256_hash').notNull().unique(),
    packageName: text('package_name'),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    isActive: boolean('is_active').default(true),
  },
  (t) => [
    index('idx_allowed_signatures_hash').on(t.sha256Hash),
    index('idx_allowed_signatures_active').on(t.isActive),
  ]
)

export const leechEvents = pgTable(
  'leech_events',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    packageName: text('package_name').notNull(),
    sha256Signature: text('sha256_signature').notNull(),
    androidVersion: text('android_version'),
    deviceModel: text('device_model'),
    ipAddress: inet('ip_address'),
    requestStatus: text('request_status').notNull(),
    rejectionReason: text('rejection_reason'),
    nonce: text('nonce').notNull(),
    requestHash: text('request_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_leech_events_timestamp').on(t.timestamp),
    index('idx_leech_events_package').on(t.packageName),
    index('idx_leech_events_signature').on(t.sha256Signature),
    index('idx_leech_events_nonce').on(t.nonce),
    index('idx_leech_events_status').on(t.requestStatus),
  ]
)

export const nonceCache = pgTable(
  'nonce_cache',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey(),
    nonce: text('nonce').notNull().unique(),
    usedAt: timestamp('used_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: inet('ip_address'),
  },
  (t) => [
    index('idx_nonce_cache_nonce').on(t.nonce),
    index('idx_nonce_cache_expires').on(t.expiresAt),
  ]
)
