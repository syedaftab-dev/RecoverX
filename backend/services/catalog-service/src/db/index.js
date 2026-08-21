const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const seedProducts = require('./seeds/products');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://recoverx:recoverx@postgres:5432/recoverx',
});

async function initDB() {
  const client = await pool.connect();
  try {
    console.log('📦 Initializing Catalog database schema & migrations...');
    
    // 1. Run migration
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '001_create_products.sql'),
      'utf-8'
    );
    await client.query(migrationSQL);
    console.log('✅ Migration 001_create_products applied successfully.');

    // 2. Check if products exist; if not, seed them
    const countRes = await client.query('SELECT COUNT(*) FROM products');
    const count = parseInt(countRes.rows[0].count, 10);

    if (count === 0) {
      console.log('🌱 Seeding initial mock products into database...');
      for (const p of seedProducts) {
        await client.query(
          `INSERT INTO products (name, description, price, stock_quantity, category)
           VALUES ($1, $2, $3, $4, $5)`,
          [p.name, p.description, p.price, p.stock_quantity, p.category]
        );
      }
      console.log(`✅ Seeded ${seedProducts.length} mock products.`);
    } else {
      console.log(`ℹ️ Catalog already populated (${count} products present). Skipping seed.`);
    }
  } catch (err) {
    console.error('❌ Error during Catalog DB initialization:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initDB,
};
