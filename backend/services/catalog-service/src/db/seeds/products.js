// Mock products seed dataset for RecoverX
module.exports = [
  {
    name: 'AuraPods Pro Wireless Earbuds',
    description: 'Active noise cancelling wireless earbuds with spatial audio and 32-hour battery life.',
    price: 3499.00,
    stock_quantity: 45,
    category: 'Audio',
  },
  {
    name: 'AuraBand Fitness Tracker 5',
    description: 'AMOLED display, 24/7 heart-rate and SpO2 tracking, 5ATM water resistance.',
    price: 1999.00,
    stock_quantity: 60,
    category: 'Wearables',
  },
  {
    name: 'PulseFlow Smartwatch Ultra',
    description: 'Titanium bezel, offline GPS tracking, ECG sensor, and cellular LTE connectivity.',
    price: 8999.00,
    stock_quantity: 18,
    category: 'Wearables',
  },
  {
    name: 'NovaCharge 65W GaN Fast Charger',
    description: 'Ultra-compact 3-port USB-C fast charging brick with intelligent power distribution.',
    price: 1299.00,
    stock_quantity: 85,
    category: 'Accessories',
  },
  {
    name: 'SoundSphere 360 Bluetooth Speaker',
    description: 'Immersive 360-degree sound with IPX7 waterproofing and RGB dynamic lighting ring.',
    price: 2499.00,
    stock_quantity: 30,
    category: 'Audio',
  },
  {
    name: 'Apex Mechanical Keyboard (RGB Brown Switches)',
    description: 'Hot-swappable mechanical gaming keyboard with aluminum frame and PBT keycaps.',
    price: 4599.00,
    stock_quantity: 12,
    category: 'Accessories',
  },
  {
    name: 'ErgoGlide Ergonomic Wireless Mouse',
    description: 'Precision optical sensor, dual-mode Bluetooth/2.4GHz, ergonomic thumb rest.',
    price: 1499.00,
    stock_quantity: 25,
    category: 'Accessories',
  },
  {
    name: 'Lumina Smart Desk Lamp Pro',
    description: 'Color temperature tunable, ambient light sensor, wireless phone charging base.',
    price: 2799.00,
    stock_quantity: 14,
    category: 'Smart Home',
  },
  {
    name: 'SonicShield Studio ANC Headphones (Limited Edition)',
    description: 'Audiophile planar magnetic drivers, hybrid active noise cancellation, memory foam ear cups.',
    price: 14999.00,
    stock_quantity: 2, // Low stock for mid-checkout stock-out recovery test!
    category: 'Audio',
  },
  {
    name: 'VoltBank 20,000mAh Power Delivery Bank',
    description: 'Fast charge laptops and phones simultaneously with real-time digital percentage display.',
    price: 2199.00,
    stock_quantity: 40,
    category: 'Accessories',
  },
  {
    name: 'HyperVision 4K Ultra Webcam',
    description: 'Auto-framing AI sensor, dual noise-cancelling mics, HDR 60fps streaming.',
    price: 5499.00,
    stock_quantity: 1, // Critical stock (1 unit left)
    category: 'Accessories',
  },
  {
    name: 'HydroPulse Smart Water Bottle',
    description: 'UV-C self-cleaning sterilization, hydration reminder LED, temperature display.',
    price: 1799.00,
    stock_quantity: 22,
    category: 'Smart Home',
  },
];
