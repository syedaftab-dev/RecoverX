const catalogService = require('../services/catalog.service');

class CatalogController {
  /**
   * GET /products
   * List all products with optional category query param.
   */
  async listProducts(req, res) {
    try {
      const { category } = req.query;
      const result = await catalogService.getAllProducts(category);

      res.setHeader('X-Cache-Source', result.source);
      return res.status(200).json({
        success: true,
        source: result.source,
        count: result.data.length,
        products: result.data,
      });
    } catch (err) {
      console.error('Error in listProducts:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve catalog products.',
      });
    }
  }

  /**
   * GET /products/:id
   * Get product details by ID.
   */
  async getProduct(req, res) {
    try {
      const { id } = req.params;
      const result = await catalogService.getProductById(id);

      if (!result) {
        return res.status(404).json({
          success: false,
          error: `Product with ID '${id}' not found.`,
        });
      }

      res.setHeader('X-Cache-Source', result.source);
      return res.status(200).json({
        success: true,
        source: result.source,
        product: result.data,
      });
    } catch (err) {
      console.error(`Error in getProduct (${req.params.id}):`, err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve product details.',
      });
    }
  }

  /**
   * POST /stock/check
   * Check product stock availability for a given quantity.
   */
  async checkStock(req, res) {
    try {
      const { productId, quantity = 1 } = req.body;

      if (!productId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: productId',
        });
      }

      const result = await catalogService.checkStock(productId, quantity);

      if (!result.exists) {
        return res.status(404).json({
          success: false,
          error: result.message,
        });
      }

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      console.error('Error in checkStock:', err.message);
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
  }
}

module.exports = new CatalogController();
