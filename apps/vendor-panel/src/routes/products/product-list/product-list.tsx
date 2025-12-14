import { SingleColumnPage } from "../../../components/layout/pages"
import { useDashboardExtension } from "../../../extensions"
import { ProductListCreateBuzz } from "./components/product-list-create-buzz"
import { ProductListTable } from "./components/product-list-table"

export const ProductList = () => {
  const { getWidgets } = useDashboardExtension()

  return (
    <SingleColumnPage
      widgets={{
        after: getWidgets("product.list.after"),
        before: getWidgets("product.list.before"),
      }}
    >
      <ProductListTable />
      <ProductListCreateBuzz />
    </SingleColumnPage>
  )
}
