/**
 * Tool: check_stock
 * Queries catalog-service to verify live inventory availability for a quantity.
 */

const DEFAULT_CATALOG_URL = process.env.CATALOG_SERVICE_URL || 'http://catalog-service:4001';

async function checkStock(productId, quantity = 1, options = {}) {
  if (!productId) {
    return {
      success: false,
      error: 'Missing required parameter: productId',
    };
  }

  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty <= 0) {
    return {
      success: false,
      error: 'Quantity must be a positive integer.',
    };
  }

  const baseUrl = options.baseUrl || DEFAULT_CATALOG_URL;

  try {
    const res = await fetch(`${baseUrl}/stock/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity: qty }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.error || `Stock check failed with HTTP ${res.status}`,
      };
    }

    return {
      success: true,
      available: data.available,
      productId: data.productId,
      productName: data.productName,
      currentStock: data.currentStock,
      requestedQuantity: qty,
      isLowStock: data.isLowStock || false,
      isOutOfStock: data.isOutOfStock || false,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to connect to catalog-service: ${err.message}`,
    };
  }
}

module.exports = { checkStock };
