/**
 * Porté depuis: apps/backend/src/admin/widgets/product-create-buzz-action.tsx
 * Widget qui ajoute un bouton "Create Buzz" dans la page détails d'un produit
 */
import { PencilSquare } from "@medusajs/icons"
import { Button, Container, toast } from "@medusajs/ui"
import { ExtendedAdminProduct } from "../../../../../types/products"

type ProductBuzzSectionProps = {
  product: ExtendedAdminProduct
}

export const ProductBuzzSection = ({ product }: ProductBuzzSectionProps) => {
  // Safety check - don't render if product is undefined
  if (!product) {
    return null
  }

  const handleCreateBuzz = async () => {
    try {
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
        productImage: product.thumbnail || product.images?.[0]?.url || "",
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
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h2 className="text-ui-fg-base font-medium">Beezy Integration</h2>
          <p className="text-ui-fg-subtle text-sm">
            Create a Buzz from this product
          </p>
        </div>
        <Button variant="secondary" onClick={handleCreateBuzz}>
          <PencilSquare className="mr-2" />
          Create Buzz
        </Button>
      </div>
    </Container>
  )
}
