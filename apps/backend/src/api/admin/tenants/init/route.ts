import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'

// POST /admin/tenants/init - Initialize the tenant system
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const db = req.scope.resolve('__pg_connection__')

    // Create tenants table if not exists
    await db.raw(`
      CREATE TABLE IF NOT EXISTS public.tenants (
        id VARCHAR(255) PRIMARY KEY,
        entity_id VARCHAR(255) UNIQUE NOT NULL,
        entity_name VARCHAR(255) NOT NULL,
        schema_name VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_tenants_entity_id ON public.tenants(entity_id);
      CREATE INDEX IF NOT EXISTS idx_tenants_schema_name ON public.tenants(schema_name);
    `)

    res.json({
      success: true,
      message: 'Tenant system initialized successfully'
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
