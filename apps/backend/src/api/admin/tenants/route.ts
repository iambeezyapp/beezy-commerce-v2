import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'

// GET /admin/tenants - List all tenants
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const db = req.scope.resolve('__pg_connection__')

    const result = await db.raw(
      `SELECT * FROM public.tenants ORDER BY created_at DESC`
    )

    const tenants = (result.rows || []).map((row: any) => ({
      id: row.id,
      entityId: row.entity_id,
      entityName: row.entity_name,
      schemaName: row.schema_name,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    res.json({ tenants })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

// POST /admin/tenants - Create a new tenant
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { entityId, entityName } = req.body as {
      entityId: string
      entityName: string
    }

    if (!entityId || !entityName) {
      res.status(400).json({ error: 'entityId and entityName are required' })
      return
    }

    const db = req.scope.resolve('__pg_connection__')

    const id = `tenant_${entityId}`
    const schemaName = `tenant_entity_${entityId.replace(/-/g, '_')}`

    // Check if tenant already exists
    const existing = await db.raw(
      `SELECT * FROM public.tenants WHERE entity_id = ?`,
      [entityId]
    )

    if (existing.rows?.length > 0) {
      res.json({
        tenant: {
          id: existing.rows[0].id,
          entityId: existing.rows[0].entity_id,
          entityName: existing.rows[0].entity_name,
          schemaName: existing.rows[0].schema_name,
          status: existing.rows[0].status
        },
        message: 'Tenant already exists'
      })
      return
    }

    // Create the schema for this tenant
    await db.raw(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)

    // Insert tenant record
    await db.raw(
      `
      INSERT INTO public.tenants (id, entity_id, entity_name, schema_name, status)
      VALUES (?, ?, ?, ?, 'active')
    `,
      [id, entityId, entityName, schemaName]
    )

    res.status(201).json({
      tenant: {
        id,
        entityId,
        entityName,
        schemaName,
        status: 'active'
      },
      message: 'Tenant created successfully'
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
