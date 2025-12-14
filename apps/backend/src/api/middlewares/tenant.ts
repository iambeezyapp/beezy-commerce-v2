import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse
} from '@medusajs/framework/http'

declare module '@medusajs/framework/http' {
  interface MedusaRequest {
    tenant?: {
      id: string
      entityId: string
      entityName: string
      schemaName: string
    }
  }
}

export async function tenantMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  // Get tenant ID from header or cookie
  const tenantId =
    (req.headers['x-tenant-id'] as string) ||
    (req.cookies?.tenant_id as string)

  if (!tenantId) {
    // No tenant specified - use default public schema
    return next()
  }

  try {
    const db = req.scope.resolve('__pg_connection__')

    // Lookup tenant by entity ID
    const result = await db.raw(
      `SELECT * FROM public.tenants WHERE entity_id = ? AND status = 'active'`,
      [tenantId]
    )

    const tenant = result.rows?.[0]

    if (!tenant) {
      // Tenant not found - continue without tenant context
      return next()
    }

    // Set tenant context on request
    req.tenant = {
      id: tenant.id,
      entityId: tenant.entity_id,
      entityName: tenant.entity_name,
      schemaName: tenant.schema_name
    }

    // Switch to tenant schema
    await db.raw(`SET search_path TO "${tenant.schema_name}", public`)

    // Continue with request
    next()

    // Reset schema after response (cleanup)
    res.on('finish', async () => {
      try {
        await db.raw(`SET search_path TO public`)
      } catch {
        // Ignore cleanup errors
      }
    })
  } catch (error) {
    console.error('Tenant middleware error:', error)
    next()
  }
}

export default tenantMiddleware
