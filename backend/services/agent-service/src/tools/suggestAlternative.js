/**
 * Tool: suggest_alternative
 * Finds up to 3 in-stock fallback products in the same category when a stock-out occurs.
 */

const DEFAULT_CATALOG_URL = process.env.CATALOG_SERVICE_URL || 'http://catalog-service:4001';

async function suggestAlternative(productId, options = {}) {
  if (!productId) {
    return {
      success: false,
      error: 'Missing required parameter: productId',
    };
  }

  const baseUrl = options.baseUrl || DEFAULT_CATALOG_URL;

  try {
    // 1. Fetch source product details to determine category
    const productRes = await fetch(`${baseUrl}/products/${productId}`);
    if (!productRes.ok) {
      return {
        success: false,
        error: `Could not find source product with ID '${productId}'`,
      };
    }

    const productData = await productRes.json();
    const sourceProduct = productData.product || productData;
    const category = sourceProduct.category;

    if (!category) {
      return {
        success: true,
        sourceProduct,
        alternatives: [],
        message: 'Source product has no category assigned.',
      };
    }

    // 2. Fetch all products in the same category
    const catRes = await fetch(`${baseUrl}/products?category=${encodeURIComponent(category)}`);
    const catData = await catRes.json();
    const categoryProducts = catData.products || [];

    // 3. Filter out current product and filter for in-stock items, pick up to 3
    const alternatives = categoryProducts
      .filter((p) => p.id !== productId && Number(p.stock_quantity) > 0)
      .slice(0, 3);

    return {
      success: true,
      sourceProduct: {
        id: sourceProduct.id,
        name: sourceProduct.name,
        category: sourceProduct.category,
        price: sourceProduct.price,
        stock_quantity: sourceProduct.stock_quantity,
      },
      category,
      count: alternatives.length,
      alternatives,
      explanation: alternatives.length > 0
        ? `Found ${alternatives.length} in-stock alternative(s) in category '${category}'.`
        : `No alternative in-stock products currently found in category '${category}'.`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to query alternatives from catalog-service: ${err.message}`,
    };
  }
}

module.exports = { suggestAlternative };
