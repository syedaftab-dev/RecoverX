/**
 * Tool: get_product
 * Fetches product details from catalog-service by UUID.
 */

const DEFAULT_CATALOG_URL = process.env.CATALOG_SERVICE_URL || 'http://catalog-service:4001';

async function getProduct(productId, options = {}) {
  if (!productId) {
    return {
      success: false,
      error: 'Missing required parameter: productId',
    };
  }

  const baseUrl = options.baseUrl || DEFAULT_CATALOG_URL;

  try {
    const res = await fetch(`${baseUrl}/products/${productId}`);
    if (res.status === 404) {
      return {
        success: false,
        error: `Product with ID '${productId}' not found in catalog.`,
        notFound: true,
      };
    }

    if (!res.ok) {
      return {
        success: false,
        error: `Catalog service returned error HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      product: data.product || data,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to connect to catalog-service: ${err.message}`,
    };
  }
}

module.exports = { getProduct };
