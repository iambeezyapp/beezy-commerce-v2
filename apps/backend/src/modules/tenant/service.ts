import { MedusaService } from '@medusajs/framework/utils'

interface TenantData {
  id: string
  entityId: string
  entityName: string
  schemaName: string
  status: 'active' | 'inactive' | 'pending'
  createdAt: Date
  updatedAt: Date
}

interface CreateTenantInput {
  entityId: string
  entityName: string
}

class TenantModuleService extends MedusaService({}) {
  private db: any

  constructor(container: any) {
    super(container)
    this.db = container.resolve('__pg_connection__')
  }

  async initializeTenantSystem(): Promise<void> {
    await this.db.raw(`
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
  }

  async createTenant(input: CreateTenantInput): Promise<TenantData> {
    const { entityId, entityName } = input
    const id = `tenant_${entityId}`
    const schemaName = `tenant_entity_${entityId.replace(/-/g, '_')}`

    // Check if tenant already exists
    const existing = await this.getTenantByEntityId(entityId)
    if (existing) {
      return existing
    }

    // Create the schema for this tenant
    await this.db.raw(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)

    // Insert tenant record
    await this.db.raw(
      `
      INSERT INTO public.tenants (id, entity_id, entity_name, schema_name, status)
      VALUES (?, ?, ?, ?, 'active')
      ON CONFLICT (entity_id) DO UPDATE SET
        entity_name = EXCLUDED.entity_name,
        updated_at = NOW()
    `,
      [id, entityId, entityName, schemaName]
    )

    return this.getTenantByEntityId(entityId) as Promise<TenantData>
  }

  async getTenantByEntityId(entityId: string): Promise<TenantData | null> {
    const result = await this.db.raw(
      `SELECT * FROM public.tenants WHERE entity_id = ?`,
      [entityId]
    )

    const row = result.rows?.[0]
    if (!row) return null

    return {
      id: row.id,
      entityId: row.entity_id,
      entityName: row.entity_name,
      schemaName: row.schema_name,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  async getTenantBySchemaName(schemaName: string): Promise<TenantData | null> {
    const result = await this.db.raw(
      `SELECT * FROM public.tenants WHERE schema_name = ?`,
      [schemaName]
    )

    const row = result.rows?.[0]
    if (!row) return null

    return {
      id: row.id,
      entityId: row.entity_id,
      entityName: row.entity_name,
      schemaName: row.schema_name,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  async listTenants(): Promise<TenantData[]> {
    const result = await this.db.raw(
      `SELECT * FROM public.tenants ORDER BY created_at DESC`
    )

    return (result.rows || []).map((row: any) => ({
      id: row.id,
      entityId: row.entity_id,
      entityName: row.entity_name,
      schemaName: row.schema_name,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  }

  async updateTenantStatus(
    entityId: string,
    status: 'active' | 'inactive'
  ): Promise<TenantData | null> {
    await this.db.raw(
      `UPDATE public.tenants SET status = ?, updated_at = NOW() WHERE entity_id = ?`,
      [status, entityId]
    )

    return this.getTenantByEntityId(entityId)
  }

  async deleteTenant(entityId: string): Promise<boolean> {
    const tenant = await this.getTenantByEntityId(entityId)
    if (!tenant) return false

    // Drop the schema (careful - this deletes all data!)
    await this.db.raw(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`)

    // Delete tenant record
    await this.db.raw(`DELETE FROM public.tenants WHERE entity_id = ?`, [
      entityId
    ])

    return true
  }

  async switchToTenantSchema(schemaName: string): Promise<void> {
    await this.db.raw(`SET search_path TO "${schemaName}", public`)
  }

  async resetToPublicSchema(): Promise<void> {
    await this.db.raw(`SET search_path TO public`)
  }
}

export default TenantModuleService
