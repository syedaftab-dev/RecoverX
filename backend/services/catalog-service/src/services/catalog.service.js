const db = require('../db');
const { getCached, setCached } = require('../redis/client');

const CACHE_TTL_SECONDS = 60;

class CatalogService {
  /**
   * Get all products with optional category filter and Redis caching.
   */
  async getAllProducts(category = null) {
    const cacheKey = category ? `catalog:products:${category.toLowerCase()}` : 'catalog:products:all';
    
    // Check Redis cache
    const cachedData = await getCached(cacheKey);
    if (cachedData) {
      return { source: 'cache', data: cachedData };
    }

    // Query Postgres database
    let queryText = 'SELECT * FROM products';
    const params = [];
    if (category) {
      queryText += ' WHERE LOWER(category) = LOWER($1)';
      params.push(category);
    }
    queryText += ' ORDER BY price ASC';

    const res = await db.query(queryText, params);
    const products = res.rows;

    // Cache result in Redis
    await setCached(cacheKey, products, CACHE_TTL_SECONDS);

    return { source: 'database', data: products };
  }

  /**
   * Get single product by UUID.
   */
  async getProductById(id) {
    const cacheKey = `catalog:product:${id}`;
    const cachedData = await getCached(cacheKey);
    if (cachedData) {
      return { source: 'cache', data: cachedData };
    }

    const res = await db.query('SELECT * FROM products WHERE id = $1', [id]);
    if (res.rows.length === 0) {
      return null;
    }

    const product = res.rows[0];
    await setCached(cacheKey, product, CACHE_TTL_SECONDS);
    return { source: 'database', data: product };
  }

  /**
   * Check if requested quantity is in stock.
   */
  async checkStock(productId, requestedQuantity = 1) {
    const qty = parseInt(requestedQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      throw new Error('Requested quantity must be a positive integer.');
    }

    // Query direct database (source of truth for stock)
    const res = await db.query(
      'SELECT id, name, price, stock_quantity, category FROM products WHERE id = $1',
      [productId]
    );

    if (res.rows.length === 0) {
      return {
        exists: false,
        message: 'Product not found.',
      };
    }

    const product = res.rows[0];
    const available = product.stock_quantity >= qty;

    return {
      exists: true,
      available,
      productId: product.id,
      productName: product.name,
      price: product.price,
      currentStock: product.stock_quantity,
      requestedQuantity: qty,
      isLowStock: product.stock_quantity > 0 && product.stock_quantity <= 3,
      isOutOfStock: product.stock_quantity === 0,
    };
  }
}

module.exports = new CatalogService();
