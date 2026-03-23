/**
 * Seeding script for MongoDB
 * Initializes database with baseline categories, users, and vouchers
 */

const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

// Load .env
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const {
  connectDB,
  Category,
  Product,
  User,
  Voucher,
  nowISO,
} = require('./database');

const INITIAL_CATEGORIES = [
  { name: 'Pet Food', color: '#FF8C42', icon: 'food-drumstick' },
  { name: 'Treats', color: '#FFA726', icon: 'cookie' },
  { name: 'Toys', color: '#66BB6A', icon: 'gamepad-variant' },
  { name: 'Grooming', color: '#42A5F5', icon: 'content-cut' },
  { name: 'Health', color: '#EF5350', icon: 'medical-bag' },
  { name: 'Accessories', color: '#AB47BC', icon: 'collar' },
  { name: 'Habitat', color: '#8D6E63', icon: 'home' }
];

const STARTER_PRODUCTS = [
  {
    name: 'Chicken & Rice Dog Food', categoryName: 'Pet Food', petType: 'Dog', price: 34.99,
    countInStock: 80, lowStockThreshold: 10, image: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=400&q=80',
    description: 'Premium dry dog food made with real chicken and brown rice.', barcode: 'FE-FOOD-001',
    variants: ['2kg', '5kg', '10kg'], expirationDate: '2026-08-15'
  },
  {
    name: 'Salmon Pate Cat Food', categoryName: 'Pet Food', petType: 'Cat', price: 27.49,
    countInStock: 65, lowStockThreshold: 10, image: 'https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=400&q=80',
    description: 'Grain-free wet cat food with wild-caught salmon.', barcode: 'FE-FOOD-002',
    variants: ['85g can', '156g can', '12-pack'], expirationDate: '2026-05-20'
  },
  {
    name: 'Crunchy Peanut Butter Dog Treats', categoryName: 'Treats', petType: 'Dog', price: 11.99,
    countInStock: 120, lowStockThreshold: 10, image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=400&q=80',
    description: 'All-natural baked dog treats with peanut butter.', barcode: 'FE-TREAT-001',
    variants: ['100g', '250g', '500g'], expirationDate: '2026-03-10'
  },
  {
    name: 'Interactive Feather Wand Cat Toy', categoryName: 'Toys', petType: 'Cat', price: 8.99,
    countInStock: 90, lowStockThreshold: 10, image: 'https://images.unsplash.com/photo-1531209869568-96b8fd6b7e78?w=400&q=80',
    description: 'Telescoping feather wand toy to stimulate your cat\'s hunting instincts.', barcode: 'FE-TOY-001',
    variants: [], expirationDate: ''
  },
  {
    name: 'Oatmeal & Aloe Dog Shampoo', categoryName: 'Grooming', petType: 'Dog', price: 16.99,
    countInStock: 45, lowStockThreshold: 10, image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&q=80',
    description: 'Gentle, soap-free shampoo for sensitive skin.', barcode: 'FE-GROOM-001',
    variants: ['250ml', '500ml', '1L'], expirationDate: ''
  },
  {
    name: 'Multivitamin Chews for Cats', categoryName: 'Health', petType: 'Cat', price: 19.99,
    countInStock: 55, lowStockThreshold: 10, image: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&q=80',
    description: 'Daily multivitamin soft chews supporting immune health.', barcode: 'FE-HEALTH-001',
    variants: ['30 chews', '60 chews', '120 chews'], expirationDate: '2026-11-30'
  },
  {
    name: 'Adjustable Nylon Dog Harness', categoryName: 'Accessories', petType: 'Dog', price: 22.99,
    countInStock: 35, lowStockThreshold: 10, image: 'https://images.unsplash.com/photo-1570649889742-f049cd451bba?w=400&q=80',
    description: 'No-pull dog harness with breathable mesh padding.', barcode: 'FE-ACC-001',
    variants: ['XS', 'S', 'M', 'L', 'XL'], expirationDate: ''
  },
  {
    name: 'Tropical Fish Food Pellets', categoryName: 'Pet Food', petType: 'Fish', price: 9.99,
    countInStock: 100, lowStockThreshold: 10, image: 'https://images.unsplash.com/photo-1546696418-0dffeefbbe9b?w=400&q=80',
    description: 'Slow-sinking micro pellets for tropical freshwater fish.', barcode: 'FE-FOOD-003',
    variants: ['50g', '100g', '200g'], expirationDate: '2027-01-15'
  },
];

const DEFAULT_USERS = [
  {
    name: 'Jannella Yumang', email: 'admin@furever.com', phone: '09181234567',
    isAdmin: true, role: 'admin', shippingAddress: '123 FurEver HQ, Quezon City, Metro Manila, 1100',
    preferredPets: []
  },
  {
    name: 'Emma Pascua', email: 'user@furever.com', phone: '09171234567',
    isAdmin: false, role: 'customer', shippingAddress: '456 Pet Lover Ave, Makati City, Metro Manila, 1200',
    preferredPets: ['Dog', 'Cat']
  },
  {
    name: 'Juan Dela Cruz', email: 'juan@furever.com', phone: '09191234567',
    isAdmin: false, role: 'customer', shippingAddress: '789 Sampaguita St, Cebu City, Cebu, 6000',
    preferredPets: ['Fish', 'Bird']
  }
];

const DEFAULT_VOUCHERS = [
  {
    title: 'Welcome 10% Off',
    message: 'Use this voucher on your first purchase.',
    imageUrl: '',
    promoCode: 'WELCOME10',
    discountType: 'percent',
    discountValue: 10,
    maxDiscount: 150,
    minOrderAmount: 0,
    startsAt: new Date(),
    expiresAt: new Date('2027-12-31'),
    isActive: true,
    maxClaims: 0,
    claimedCount: 0,
  },
  {
    title: 'Free Shipping Boost',
    message: 'Get a fixed discount to offset shipping for minimum spend.',
    imageUrl: '',
    promoCode: 'SHIP50',
    discountType: 'fixed',
    discountValue: 50,
    maxDiscount: 50,
    minOrderAmount: 499,
    startsAt: new Date(),
    expiresAt: new Date('2027-12-31'),
    isActive: true,
    maxClaims: 0,
    claimedCount: 0,
  },
];

async function seedDatabase() {
  try {
    await connectDB();
    console.log('✓ Connected to MongoDB\n');

    // ─── Seed Categories ────────────────────────────────────
    console.log('Seeding categories...');
    const existingCategories = await Category.countDocuments();
    let categoriesInserted = 0;

    if (existingCategories === 0) {
      await Category.insertMany(INITIAL_CATEGORIES);
      categoriesInserted = INITIAL_CATEGORIES.length;
      console.log(`✓ Inserted ${categoriesInserted} categories`);
    } else {
      console.log(`⚠ Categories already exist (${existingCategories} found), skipping...`);
    }

    // ─── Seed Products ──────────────────────────────────────
    console.log('\nSeeding products...');
    const existingProducts = await Product.countDocuments();
    let productsInserted = 0;

    if (existingProducts === 0) {
      const categories = await Category.find({});
      const categoryMap = {};
      categories.forEach((cat) => {
        categoryMap[cat.name] = cat._id;
      });

      const productsToInsert = STARTER_PRODUCTS.map((p) => ({
        ...p,
        category: categoryMap[p.categoryName],
        categoryName: undefined, // Remove helper field
      }));

      await Product.insertMany(productsToInsert);
      productsInserted = STARTER_PRODUCTS.length;
      console.log(`✓ Inserted ${productsInserted} starter products`);
    } else {
      console.log(`⚠ Products already exist (${existingProducts} found), skipping...`);
    }

    // ─── Seed Users ─────────────────────────────────────────
    console.log('\nSeeding users...');
    const existingUsers = await User.countDocuments();
    let usersInserted = 0;

    if (existingUsers === 0) {
      const usersToInsert = DEFAULT_USERS.map((u) => ({
        ...u,
        password: bcrypt.hashSync('password123', 10),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await User.insertMany(usersToInsert);
      usersInserted = DEFAULT_USERS.length;
      console.log(`✓ Inserted ${usersInserted} default users`);
      console.log('  - admin@furever.com (password: password123)');
      console.log('  - user@furever.com (password: password123)');
      console.log('  - juan@furever.com (password: password123)');
    } else {
      console.log(`⚠ Users already exist (${existingUsers} found), skipping...`);
    }

    // ─── Seed Vouchers ──────────────────────────────────────
    console.log('\nSeeding vouchers...');
    const existingVouchers = await Voucher.countDocuments();
    let vouchersInserted = 0;

    if (existingVouchers === 0) {
      const admin = await User.findOne({ isAdmin: true });
      const vouchersToInsert = DEFAULT_VOUCHERS.map((v) => ({
        ...v,
        createdByUserId: admin?._id || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await Voucher.insertMany(vouchersToInsert);
      vouchersInserted = DEFAULT_VOUCHERS.length;
      console.log(`✓ Inserted ${vouchersInserted} default vouchers`);
    } else {
      console.log(`⚠ Vouchers already exist (${existingVouchers} found), skipping...`);
    }

    console.log('\n✓ Database seeding completed successfully!');
    console.log(`Summary: ${categoriesInserted} categories, ${productsInserted} products, ${usersInserted} users, ${vouchersInserted} vouchers`);

    process.exit(0);
  } catch (error) {
    console.error('✗ Seeding failed:', error.message);
    process.exit(1);
  }
}

// Run seeding
seedDatabase();
