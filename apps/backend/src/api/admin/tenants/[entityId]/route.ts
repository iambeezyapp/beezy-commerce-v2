import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'

// GET /admin/tenants/:entityId - Get a specific tenant
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { entityId } = req.params

    const db = req.scope.resolve('__pg_connection__')

    const result = await db.raw(
      `SELECT * FROM public.tenants WHERE entity_id = ?`,
      [entityId]
    )

    const row = result.rows?.[0]
    if (!row) {
      res.status(404).json({ error: 'Tenant not found' })
      return
    }

    res.json({
      tenant: {
        id: row.id,
        entityId: row.entity_id,
        entityName: row.entity_name,
        schemaName: row.schema_name,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

// PATCH /admin/tenants/:entityId - Update a tenant
export async function PATCH(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { entityId } = req.params
    const { entityName, status } = req.body as {
      entityName?: string
      status?: 'active' | 'inactive'
    }

    const db = req.scope.resolve('__pg_connection__')

    // Check if tenant exists
    const existing = await db.raw(
      `SELECT * FROM public.tenants WHERE entity_id = ?`,
      [entityId]
    )

    if (!existing.rows?.length) {
      res.status(404).json({ error: 'Tenant not found' })
      return
    }

    // Build update query
    const updates: string[] = []
    const values: any[] = []

    if (entityName) {
      updates.push('entity_name = ?')
      values.push(entityName)
    }

    if (status) {
      updates.push('status = ?')
      values.push(status)
    }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()')
      values.push(entityId)

      await db.raw(
        `UPDATE public.tenants SET ${updates.join(', ')} WHERE entity_id = ?`,
        values
      )
    }

    // Fetch updated tenant
    const result = await db.raw(
      `SELECT * FROM public.tenants WHERE entity_id = ?`,
      [entityId]
    )

    const row = result.rows[0]
    res.json({
      tenant: {
        id: row.id,
        entityId: row.entity_id,
        entityName: row.entity_name,
        schemaName: row.schema_name,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

// DELETE /admin/tenants/:entityId - Delete a tenant
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { entityId } = req.params

    const db = req.scope.resolve('__pg_connection__')

    // Get tenant to find schema name
    const result = await db.raw(
      `SELECT * FROM public.tenants WHERE entity_id = ?`,
      [entityId]
    )

    const row = result.rows?.[0]
    if (!row) {
      res.status(404).json({ error: 'Tenant not found' })
      return
    }

    // Drop the schema (this deletes all tenant data!)
    await db.raw(`DROP SCHEMA IF EXISTS "${row.schema_name}" CASCADE`)

    // Delete tenant record
    await db.raw(`DELETE FROM public.tenants WHERE entity_id = ?`, [entityId])

    res.json({
      message: 'Tenant deleted successfully',
      deletedTenant: {
        entityId: row.entity_id,
        entityName: row.entity_name,
        schemaName: row.schema_name
      }
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
