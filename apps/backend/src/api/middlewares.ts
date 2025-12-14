import {
  defineMiddlewares,
  type MiddlewaresConfigEntry
} from '@medusajs/framework/http'
import { tenantMiddleware } from './middlewares/tenant'

export default defineMiddlewares({
  routes: [
    // Apply tenant middleware to store routes
    {
      matcher: '/store/*',
      middlewares: [tenantMiddleware]
    },
    // Apply tenant middleware to vendor routes
    {
      matcher: '/vendor/*',
      middlewares: [tenantMiddleware]
    }
  ] as MiddlewaresConfigEntry[]
})
