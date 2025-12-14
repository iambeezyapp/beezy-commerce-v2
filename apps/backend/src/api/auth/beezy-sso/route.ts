import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import crypto from 'node:crypto'

interface BeezySSoPayload {
  entityId: string
  entityName: string
  userId: string
  email: string
  role: 'admin' | 'member'
  timestamp: number
  signature: string
}

function verifySignature(
  payload: Omit<BeezySSoPayload, 'signature'>,
  signature: string,
  secret: string
): boolean {
  const message = `${payload.entityId}:${payload.userId}:${payload.timestamp}`
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

// POST /auth/beezy-sso - SSO login from Beezy
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const payload = req.body as BeezySSoPayload
    const { entityId, entityName, userId, email, role, timestamp, signature } =
      payload

    // Validate required fields
    if (!entityId || !userId || !email || !signature) {
      res.status(400).json({ error: 'Missing required fields' })
      return
    }

    // Check timestamp (5 minute window)
    const now = Date.now()
    if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
      res.status(401).json({ error: 'Token expired' })
      return
    }

    // Verify signature
    const ssoSecret = process.env.BEEZY_SSO_SECRET || 'beezy-sso-secret'
    const isValid = verifySignature(
      { entityId, entityName, userId, email, role, timestamp },
      signature,
      ssoSecret
    )

    if (!isValid) {
      res.status(401).json({ error: 'Invalid signature' })
      return
    }

    const db = req.scope.resolve('__pg_connection__')

    // Ensure tenants table exists
    await db.raw(`
      CREATE TABLE IF NOT EXISTS public.tenants (
        id VARCHAR(255) PRIMARY KEY,
        entity_id VARCHAR(255) UNIQUE NOT NULL,
        entity_name VARCHAR(255) NOT NULL,
        schema_name VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Check if tenant exists, create if not
    const tenantResult = await db.raw(
      `SELECT * FROM public.tenants WHERE entity_id = ?`,
      [entityId]
    )

    let tenant = tenantResult.rows?.[0]

    if (!tenant) {
      // Auto-create tenant
      const id = `tenant_${entityId}`
      const schemaName = `tenant_entity_${entityId.replace(/-/g, '_')}`

      await db.raw(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)

      await db.raw(
        `
        INSERT INTO public.tenants (id, entity_id, entity_name, schema_name, status)
        VALUES (?, ?, ?, ?, 'active')
      `,
        [id, entityId, entityName || `Entity ${entityId}`, schemaName]
      )

      tenant = {
        id,
        entity_id: entityId,
        entity_name: entityName,
        schema_name: schemaName,
        status: 'active'
      }
    }

    // Set cookies for tenant context
    res.cookie('tenant_id', entityId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    })

    res.cookie('tenant_schema', tenant.schema_name, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    })

    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        entityId: tenant.entity_id,
        entityName: tenant.entity_name,
        schemaName: tenant.schema_name
      },
      user: {
        id: userId,
        email,
        role
      },
      redirectUrl: '/app'
    })
  } catch (error: any) {
    console.error('SSO Error:', error)
    res.status(500).json({ error: error.message })
  }
}
