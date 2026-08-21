const express = require('express');
const router = express.Router();
const catalogController = require('../controllers/catalog.controller');

// Products listing and details
router.get('/products', (req, res) => catalogController.listProducts(req, res));
router.get('/products/:id', (req, res) => catalogController.getProduct(req, res));

// Stock check endpoint
router.post('/stock/check', (req, res) => catalogController.checkStock(req, res));

module.exports = router;
