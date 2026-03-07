require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db } = require('./database');
const Category = require('./models/Category');
const Product = require('./models/Product');
const User = require('./models/User');
const Notification = require('./models/Notification');

function seed() {
  console.log('Seeding SQLite database...\n');

  // ─── Categories ───────────────────────────────────────────
  const categoryDefs = [
    { name: 'Pet Food', color: '#FF8C42', icon: 'food-drumstick' },
    { name: 'Treats', color: '#FFA726', icon: 'cookie' },
    { name: 'Toys', color: '#66BB6A', icon: 'gamepad-variant' },
    { name: 'Grooming', color: '#42A5F5', icon: 'content-cut' },
    { name: 'Health', color: '#EF5350', icon: 'medical-bag' },
    { name: 'Accessories', color: '#AB47BC', icon: 'collar' },
    { name: 'Habitat', color: '#8D6E63', icon: 'home' },
  ];
  const categoryMap = {};
  for (const def of categoryDefs) {
    // Check if already exists
    const existing = db.prepare('SELECT * FROM categories WHERE name = ?').get(def.name);
    if (existing) {
      categoryMap[def.name] = existing.id;
      console.log(`  Category exists: ${def.name}`);
    } else {
      const cat = Category.create(def);
      categoryMap[def.name] = cat.id;
      console.log(`  Created category: ${def.name}`);
    }
  }

  // ─── Products ─────────────────────────────────────────────
  // Clear existing products
  db.prepare('DELETE FROM reviews').run();
  db.prepare('DELETE FROM products').run();
  console.log('\nCleared existing products');

  const sampleProducts = [
    {
      name: 'Chicken & Rice Dog Food',
      category: categoryMap['Pet Food'],
      petType: 'Dog',
      price: 34.99,
      countInStock: 80,
      image: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=400&q=80',
      description: 'Premium dry dog food made with real chicken and brown rice. Ingredients: chicken, brown rice, peas, chicken fat, flaxseed, vitamins A, D3, E, B12. Usage: Feed 1-2 cups daily depending on dog size.',
      barcode: 'FE-FOOD-001',
      variants: ['2kg', '5kg', '10kg'],
      expirationDate: '2026-08-15',
    },
    {
      name: 'Salmon Pate Cat Food',
      category: categoryMap['Pet Food'],
      petType: 'Cat',
      price: 27.49,
      countInStock: 65,
      image: 'https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=400&q=80',
      description: 'Grain-free wet cat food with wild-caught salmon. Ingredients: salmon, chicken liver, water, tapioca starch, sunflower oil, taurine. Usage: Serve 1 can per 3kg body weight daily.',
      barcode: 'FE-FOOD-002',
      variants: ['85g can', '156g can', '12-pack'],
      expirationDate: '2026-05-20',
    },
    {
      name: 'Crunchy Peanut Butter Dog Treats',
      category: categoryMap['Treats'],
      petType: 'Dog',
      price: 11.99,
      countInStock: 120,
      image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=400&q=80',
      description: 'All-natural baked dog treats with peanut butter. Ingredients: oat flour, peanut butter (xylitol-free), eggs, honey. Usage: Give 2-4 treats per day as rewards.',
      barcode: 'FE-TREAT-001',
      variants: ['100g', '250g', '500g'],
      expirationDate: '2026-03-10',
    },
    {
      name: 'Interactive Feather Wand Cat Toy',
      category: categoryMap['Toys'],
      petType: 'Cat',
      price: 8.99,
      countInStock: 90,
      image: 'https://images.unsplash.com/photo-1531209869568-96b8fd6b7e78?w=400&q=80',
      description: 'Telescoping feather wand toy to stimulate your cat\'s hunting instincts. Includes 3 interchangeable feather attachments.',
      barcode: 'FE-TOY-001',
      variants: [],
      expirationDate: '',
    },
    {
      name: 'Oatmeal & Aloe Dog Shampoo',
      category: categoryMap['Grooming'],
      petType: 'Dog',
      price: 16.99,
      countInStock: 45,
      image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&q=80',
      description: 'Gentle, soap-free shampoo for sensitive skin. Ingredients: colloidal oatmeal, aloe vera extract, coconut-derived surfactants, vitamin E, chamomile.',
      barcode: 'FE-GROOM-001',
      variants: ['250ml', '500ml', '1L'],
      expirationDate: '',
    },
    {
      name: 'Multivitamin Chews for Cats',
      category: categoryMap['Health'],
      petType: 'Cat',
      price: 19.99,
      countInStock: 55,
      image: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&q=80',
      description: 'Daily multivitamin soft chews supporting immune health, coat shine, and digestion. Ingredients: taurine, omega-3 fish oil, biotin, zinc, probiotics.',
      barcode: 'FE-HEALTH-001',
      variants: ['30 chews', '60 chews', '120 chews'],
      expirationDate: '2026-11-30',
    },
    {
      name: 'Adjustable Nylon Dog Harness',
      category: categoryMap['Accessories'],
      petType: 'Dog',
      price: 22.99,
      countInStock: 35,
      image: 'https://images.unsplash.com/photo-1570649889742-f049cd451bba?w=400&q=80',
      description: 'No-pull dog harness with breathable mesh padding. Front and back leash attachment points. Reflective strips for nighttime visibility.',
      barcode: 'FE-ACC-001',
      variants: ['XS', 'S', 'M', 'L', 'XL'],
      expirationDate: '',
    },
    {
      name: 'Tropical Fish Food Pellets',
      category: categoryMap['Pet Food'],
      petType: 'Fish',
      price: 9.99,
      countInStock: 100,
      image: 'https://images.unsplash.com/photo-1546696418-0dffeefbbe9b?w=400&q=80',
      description: 'Slow-sinking micro pellets for tropical freshwater fish. Ingredients: fish meal, spirulina, krill, wheat germ, garlic, astaxanthin for color enhancement.',
      barcode: 'FE-FOOD-003',
      variants: ['50g', '100g', '200g'],
      expirationDate: '2027-01-15',
    },
    {
      name: 'Wooden Hideout for Small Pets',
      category: categoryMap['Habitat'],
      petType: 'Hamster',
      price: 14.49,
      countInStock: 40,
      image: 'https://images.unsplash.com/photo-1425082661507-3f9c4cba2aae?w=400&q=80',
      description: 'Natural pine wood hideout for hamsters, gerbils, and mice. Provides a cozy resting spot and chew surface for dental health.',
      barcode: 'FE-HAB-001',
      variants: ['Small', 'Medium'],
      expirationDate: '',
    },
    {
      name: 'Colorful Rope Perch for Birds',
      category: categoryMap['Accessories'],
      petType: 'Bird',
      price: 12.49,
      countInStock: 50,
      image: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=400&q=80',
      description: 'Flexible cotton rope perch in vibrant colors. Promotes foot exercise and beak trimming. 100% cotton, non-toxic dyes.',
      barcode: 'FE-ACC-002',
      variants: ['Small (30cm)', 'Large (60cm)'],
      expirationDate: '',
    },
  ];

  for (const p of sampleProducts) {
    const created = Product.create(p);
    console.log(`  + ${created.name} (₱${created.price})`);
  }
  console.log(`\nInserted ${sampleProducts.length} products`);

  // ─── Default Users ────────────────────────────────────────
  const defaultPassword = bcrypt.hashSync('password123', 10);

  const defaultUsers = [
    {
      name: 'Jannella Yumang', email: 'admin@furever.com', password: defaultPassword,
      phone: '09181234567', isAdmin: true, role: 'admin',
      shippingAddress: '123 FurEver HQ, Quezon City, Metro Manila, 1100',
      preferredPets: [], emailVerified: true, isActive: true,
    },
    {
      name: 'Emma Pascua', email: 'user@furever.com', password: defaultPassword,
      phone: '09171234567', isAdmin: false, role: 'customer',
      shippingAddress: '456 Pet Lover Ave, Makati City, Metro Manila, 1200',
      preferredPets: ['Dog', 'Cat'], emailVerified: true, isActive: true,
    },
    {
      name: 'Juan Dela Cruz', email: 'juan@furever.com', password: defaultPassword,
      phone: '09191234567', isAdmin: false, role: 'customer',
      shippingAddress: '789 Sampaguita St, Cebu City, Cebu, 6000',
      preferredPets: ['Fish', 'Bird'], emailVerified: true, isActive: true,
    },
  ];

  for (const u of defaultUsers) {
    const existing = User.findOne({ email: u.email });
    if (!existing) {
      User.create(u);
      console.log(`  Created user: ${u.name} (${u.email}) [${u.role}]`);
    } else {
      console.log(`  User exists: ${u.email}`);
    }
  }

  // ─── Sample Notifications ─────────────────────────────────
  const adminUser = User.findOne({ email: 'admin@furever.com' });
  if (adminUser) {
    const count = Notification.find({ userId: adminUser.id }).length;
    if (count === 0) {
      const notifs = [
        { user: adminUser.id, type: 'admin_new_order', title: 'New Order Placed', message: 'Emma Pascua placed order #A1B2C3D4 with 3 item(s) totaling ₱72.97.' },
        { user: adminUser.id, type: 'admin_order_delivered', title: 'Order Delivered', message: 'Order #E5F6G7H8 from Juan Dela Cruz (2 items, ₱45.98) has been delivered.' },
        { user: adminUser.id, type: 'admin_low_stock', title: 'Low Stock Warning', message: '"Crunchy Peanut Butter Dog Treats" is running low — only 5 left.' },
        { user: adminUser.id, type: 'admin_out_of_stock', title: 'Out of Stock Alert', message: '"Interactive Feather Wand Cat Toy" is now out of stock.' },
        { user: adminUser.id, type: 'admin_new_order', title: 'New Order Placed', message: 'Juan Dela Cruz placed order #X9Y8Z7W6 with 1 item(s) totaling ₱34.99.' },
      ];
      for (const n of notifs) Notification.create(n);
      console.log(`  Seeded ${notifs.length} admin notifications`);
    }
  }

  console.log('\n✓ Seed complete!');
  console.log('\nDefault credentials:');
  console.log('  Admin: admin@furever.com / password123');
  console.log('  User:  user@furever.com  / password123');
  console.log('  User:  juan@furever.com  / password123');
}

seed();
