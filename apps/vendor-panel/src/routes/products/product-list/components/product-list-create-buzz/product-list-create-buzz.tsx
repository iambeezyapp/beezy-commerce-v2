/**
 * Porté depuis: apps/backend/src/admin/widgets/product-list-create-buzz-action.tsx
 * Widget qui affiche les produits avec recherche, filtres et bouton "Create Buzz"
 *
 * Fonctionnalités:
 * - Recherche par nom de produit
 * - Filtre par statut (All/Published/Draft)
 * - Pagination (3 produits par page)
 * - Affichage des images, ID et statut
 * - Bouton "Create Buzz" individuel pour chaque produit
 */
import { PencilSquare } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Input,
  Select,
  Text,
  toast,
} from "@medusajs/ui"
import { useEffect, useState } from "react"

export const ProductListCreateBuzz = () => {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingBuzzFor, setCreatingBuzzFor] = useState<string | null>(null)

  // États pour la recherche et filtres
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize] = useState(3)
  const [totalCount, setTotalCount] = useState(0)

  // Charger les produits quand les filtres changent
  useEffect(() => {
    loadProducts()
  }, [searchQuery, statusFilter, pageIndex])

  const loadProducts = async () => {
    setLoading(true)
    try {
      // Construire l'URL avec les paramètres
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: (pageIndex * pageSize).toString(),
        fields:
          "id,title,status,thumbnail,*collection,*sales_channels,*categories,*tags,*variants,*variants.prices",
      })

      if (searchQuery) {
        params.append("q", searchQuery)
      }

      if (statusFilter !== "all") {
        params.append("status[]", statusFilter)
      }

      const response = await fetch(`/vendor/products?${params.toString()}`, {
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error("Failed to load products")
      }

      const data = await response.json()
      setProducts(data.products || [])
      setTotalCount(data.count || 0)
    } catch (error) {
      console.error("Load products error:", error)
      toast.error("Error", {
        description: "Failed to load products",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBuzz = async (product: any) => {
    try {
      setCreatingBuzzFor(product.id)

      toast.info("Opening Beezy", {
        description: `Redirecting to create Buzz for ${product.title}...`,
      })

      // Build redirect URL with query params
      const beezyBaseUrl =
        import.meta.env.VITE_BEEZY_URL || "http://localhost:3004"
      const params = new URLSearchParams({
        tab: "create",
        step: "content",
        buzzType: "product",
        productId: product.id,
        productTitle: product.title || "",
        productDescription: product.description || "",
        productImage: product.thumbnail || "",
      })

      // Redirect to Beezy campaigns page with pre-filled data
      const redirectUrl = `${beezyBaseUrl}/beezness/campaigns?${params.toString()}`
      window.open(redirectUrl, "_blank")

      toast.success("Beezy Opened!", {
        description: `Create your Buzz for ${product.title} in the new tab`,
      })
    } catch (error) {
      toast.error("Error", {
        description: "Failed to open Beezy. Please try again.",
      })
      console.error("Create Buzz Error:", error)
    } finally {
      setCreatingBuzzFor(null)
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-ui-fg-base font-medium">
              Create Buzz from Products
            </h3>
            <Text className="text-ui-fg-subtle mt-1 text-sm">
              Recherchez et créez un Buzz pour vos produits
            </Text>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex-1">
            <Input
              size="small"
              type="search"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPageIndex(0) // Reset to first page on search
              }}
            />
          </div>
          <Select
            size="small"
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value)
              setPageIndex(0) // Reset to first page on filter
            }}
          >
            <Select.Trigger>
              <Select.Value placeholder="Status" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All Status</Select.Item>
              <Select.Item value="published">Published</Select.Item>
              <Select.Item value="draft">Draft</Select.Item>
            </Select.Content>
          </Select>
        </div>

        {/* Products List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-ui-fg-subtle text-sm">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-ui-fg-subtle text-sm">
              {searchQuery || statusFilter !== "all"
                ? "No products found matching your criteria."
                : "No products found."}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 space-y-3">
              {products.map((product) => {
                // Calculer le prix le plus bas parmi toutes les variantes
                let lowestPrice = null
                let priceAmount = null
                let currency = null

                if (product.variants && product.variants.length > 0) {
                  // Parcourir toutes les variantes et leurs prix pour trouver le plus bas
                  for (const variant of product.variants) {
                    if (variant.prices && variant.prices.length > 0) {
                      for (const price of variant.prices) {
                        if (
                          price.amount &&
                          (!lowestPrice || price.amount < lowestPrice.amount)
                        ) {
                          lowestPrice = price
                          priceAmount = price.amount
                          currency = price.currency_code?.toUpperCase()
                        }
                      }
                    }
                  }
                }

                return (
                  <div
                    key={product.id}
                    className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-ui-bg-base-hover"
                  >
                    {/* Image - même taille que la liste des produits Medusa (40px) */}
                    {product.thumbnail ? (
                      <img
                        src={product.thumbnail}
                        alt={product.title}
                        className="h-10 w-10 flex-shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-ui-bg-subtle text-[10px] text-ui-fg-muted">
                        No img
                      </div>
                    )}

                    {/* Informations produit */}
                    <div className="min-w-0 flex-1">
                      {/* Titre et ID */}
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {product.title}
                          </p>
                          <code className="mt-1 inline-block rounded bg-ui-bg-base px-1.5 py-0.5 font-mono text-xs text-ui-fg-subtle">
                            {product.id}
                          </code>
                        </div>
                        <Badge
                          color={
                            product.status === "published" ? "green" : "grey"
                          }
                          size="small"
                        >
                          {product.status}
                        </Badge>
                      </div>

                      {/* Détails en ligne */}
                      <div className="flex flex-wrap gap-2 text-xs text-ui-fg-subtle">
                        {/* Prix */}
                        {priceAmount && (
                          <span className="inline-flex items-center gap-1">
                            {product.variants && product.variants.length > 1 && (
                              <span className="text-ui-fg-muted">
                                À partir de
                              </span>
                            )}
                            <span className="text-sm font-semibold text-ui-fg-base">
                              {(priceAmount / 100).toFixed(2)} {currency}
                            </span>
                          </span>
                        )}
                        {!priceAmount && (
                          <span className="italic text-ui-fg-muted">
                            Prix non défini
                          </span>
                        )}

                        {/* Variantes */}
                        {product.variants && (
                          <span>
                            • {product.variants.length} variant
                            {product.variants.length > 1 ? "s" : ""}
                          </span>
                        )}

                        {/* Collection */}
                        {product.collection && (
                          <span>• {product.collection.title}</span>
                        )}

                        {/* Sales Channels */}
                        {product.sales_channels &&
                          product.sales_channels.length > 0 && (
                            <span>• {product.sales_channels[0].name}</span>
                          )}

                        {/* Categories */}
                        {product.categories && product.categories.length > 0 && (
                          <span>
                            •{" "}
                            {product.categories
                              .map((c: any) => c.name)
                              .join(", ")}
                          </span>
                        )}

                        {/* Tags */}
                        {product.tags && product.tags.length > 0 && (
                          <span>
                            • {product.tags.map((t: any) => t.value).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bouton Create Buzz */}
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleCreateBuzz(product)}
                      disabled={creatingBuzzFor === product.id}
                      className="flex-shrink-0"
                    >
                      <PencilSquare className="mr-1" />
                      {creatingBuzzFor === product.id
                        ? "Creating..."
                        : "Create Buzz"}
                    </Button>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t pt-4">
                <Text className="text-ui-fg-subtle text-sm">
                  Showing {pageIndex * pageSize + 1} to{" "}
                  {Math.min((pageIndex + 1) * pageSize, totalCount)} of{" "}
                  {totalCount} products
                </Text>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                    disabled={pageIndex === 0}
                  >
                    Previous
                  </Button>
                  <Text className="text-ui-fg-subtle text-sm">
                    Page {pageIndex + 1} of {totalPages}
                  </Text>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() =>
                      setPageIndex((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={pageIndex >= totalPages - 1}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Container>
  )
}
