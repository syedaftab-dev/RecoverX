const { getProduct } = require('./getProduct');
const { checkStock } = require('./checkStock');
const { applyDiscount } = require('./applyDiscount');
const { createOrder } = require('./createOrder');
const { retryPayment } = require('./retryPayment');
const { suggestAlternative } = require('./suggestAlternative');
const { escalateToHuman } = require('./escalateToHuman');

module.exports = {
  getProduct,
  checkStock,
  applyDiscount,
  createOrder,
  retryPayment,
  suggestAlternative,
  escalateToHuman,
};
