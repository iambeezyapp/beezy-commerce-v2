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
  entityId: string,
  userId: string,
  timestamp: number,
  signature: string,
  secret: string
): boolean {
  const message = `${entityId}:${userId}:${timestamp}`
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

/**
 * GET /auth/beezy-sso-redirect
 * Handle SSO redirect from Beezy with token in URL
 *
 * Query params:
 * - token: Base64url encoded JSON payload with signature
 * - redirect: Path to redirect to after auth (default: /app)
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const token = req.query.token as string
    const redirectPath = (req.query.redirect as string) || '/app'

    if (!token) {
      res.status(400).json({ error: 'Missing token parameter' })
      return
    }

    // Decode the token
    let payload: BeezySSoPayload
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf-8')
      payload = JSON.parse(decoded)
    } catch {
      res.status(400).json({ error: 'Invalid token format' })
      return
    }

    const { entityId, entityName, userId, email, role, timestamp, signature } = payload

    // Validate required fields
    if (!entityId || !userId || !email || !signature) {
      res.status(400).json({ error: 'Missing required fields in token' })
      return
    }

    // Check timestamp (5 minute window)
    const now = Date.now()
    if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
      res.status(401).json({ error: 'Token expired' })
      return
    }

    // Verify signature
    const ssoSecret = process.env.BEEZY_SSO_SECRET || 'beezy-sso-shared-secret-change-in-prod'
    const isValid = verifySignature(entityId, userId, timestamp, signature, ssoSecret)

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
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/'
    })

    res.cookie('tenant_schema', tenant.schema_name, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    })

    // Store user info in cookie for the admin panel
    res.cookie('beezy_user', JSON.stringify({
      id: userId,
      email,
      role,
      entityId,
      entityName: tenant.entity_name
    }), {
      httpOnly: false, // Allow JS access for the admin panel
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    })

    // Redirect to the target path
    res.redirect(redirectPath)
  } catch (error: unknown) {
    console.error('SSO Redirect Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    res.status(500).json({ error: errorMessage })
  }
}
