require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Product = require('./models/Product');
const Category = require('./models/Category');
const User = require('./models/User');
const Notification = require('./models/Notification');

const MONGO_URI = process.env.MONGODB_URI || process.env.CONNECTION_STRING;

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Get or create categories
  const categoryNames = ['Pet Food', 'Treats', 'Toys', 'Grooming', 'Health', 'Accessories', 'Habitat'];
  const categoryMap = {};

  for (const name of categoryNames) {
    let cat = await Category.findOne({ name });
    if (!cat) {
      cat = await new Category({ name, color: '#FF8C42', icon: 'paw' }).save();
      console.log(`Created category: ${name}`);
    }
    categoryMap[name] = cat._id;
  }

  // Clear existing products
  await Product.deleteMany({});
  console.log('Cleared existing products');

  const sampleProducts = [
    {
      name: 'Chicken & Rice Dog Food',
      category: categoryMap['Pet Food'],
      petType: 'Dog',
      price: 34.99,
      countInStock: 80,
      image: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=400&q=80',
      description: 'Premium dry dog food made with real chicken and brown rice. Ingredients: chicken, brown rice, peas, chicken fat, flaxseed, vitamins A, D3, E, B12. Usage: Feed 1-2 cups daily depending on dog size. Safety: Not suitable for puppies under 8 weeks.',
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
      description: 'Grain-free wet cat food with wild-caught salmon. Ingredients: salmon, chicken liver, water, tapioca starch, sunflower oil, taurine. Usage: Serve 1 can per 3kg body weight daily. Safety: Refrigerate after opening, use within 3 days.',
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
      description: 'All-natural baked dog treats with peanut butter. Ingredients: oat flour, peanut butter (xylitol-free), eggs, honey. Usage: Give 2-4 treats per day as rewards. Safety: Contains peanuts. Not for dogs with nut allergies. Keep in a cool dry place.',
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
      description: 'Telescoping feather wand toy to stimulate your cat\'s hunting instincts. Includes 3 interchangeable feather attachments. Usage: Wave and drag along floor to engage play. Safety: Supervise play at all times; store out of pet\'s reach when not in use to avoid ingestion of small parts.',
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
      description: 'Gentle, soap-free shampoo for sensitive skin. Ingredients: colloidal oatmeal, aloe vera extract, coconut-derived surfactants, vitamin E, chamomile. Usage: Wet coat thoroughly, lather and massage in, rinse well. Repeat if needed. Safety: For external use only. Avoid contact with eyes. If irritation occurs, discontinue use.',
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
      description: 'Daily multivitamin soft chews supporting immune health, coat shine, and digestion. Ingredients: taurine, omega-3 fish oil, biotin, zinc, probiotics, chicken liver flavor. Usage: Give 1 chew daily for cats over 1 year. Size guide: suitable for cats 2kg+. Safety: Do not exceed recommended dosage. Consult vet if pregnant or nursing.',
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
      description: 'No-pull dog harness with breathable mesh padding. Front and back leash attachment points. Size guide: XS (chest 30-38cm), S (38-48cm), M (48-60cm), L (60-75cm), XL (75-90cm). Usage: Adjust straps for a snug fit—two fingers should fit between harness and body. Safety: Check fit regularly as your pup grows. Reflective strips for nighttime visibility.',
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
      description: 'Slow-sinking micro pellets for tropical freshwater fish. Ingredients: fish meal, spirulina, krill, wheat germ, garlic, astaxanthin for color enhancement. Usage: Feed 2-3 times daily, only as much as fish consume in 2 minutes. Safety: Keep container sealed. Store in a cool, dry place away from direct sunlight.',
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
      description: 'Natural pine wood hideout for hamsters, gerbils, and mice. Provides a cozy resting spot and chew surface for dental health. Size guide: Small (12x10x8cm) fits dwarf hamsters; Medium (18x14x12cm) fits Syrian hamsters. Usage: Place in cage on flat bedding. Safety: Made from untreated, pet-safe wood. Replace when heavily chewed.',
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
      description: 'Flexible cotton rope perch in vibrant colors. Promotes foot exercise and beak trimming. Size guide: Small (30cm, for budgies/finches), Large (60cm, for cockatiels/conures). Usage: Bend into desired shape and attach with included hardware to cage bars. Safety: 100% cotton, non-toxic dyes. Inspect regularly and replace if frayed to prevent entanglement.',
      barcode: 'FE-ACC-002',
      variants: ['Small (30cm)', 'Large (60cm)'],
      expirationDate: '',
    },
  ];

  const inserted = await Product.insertMany(sampleProducts);
  console.log(`Inserted ${inserted.length} sample products:`);
  inserted.forEach((p) => console.log(`  - ${p.name} ($${p.price})`));

  // ─── Seed default Admin and User accounts ─────────────────────────
  const defaultPassword = await bcrypt.hash('password123', 10);

  const defaultUsers = [
    {
      name: 'Jannella Yumang',
      email: 'admin@furever.com',
      password: defaultPassword,
      phone: '09181234567',
      isAdmin: true,
      role: 'admin',
      shippingAddress: '123 FurEver HQ, Quezon City, Metro Manila, 1100',
      preferredPets: [],
      emailVerified: true,
      isActive: true,
      image: '',
    },
    {
      name: 'Emma Pascua',
      email: 'user@furever.com',
      password: defaultPassword,
      phone: '09171234567',
      isAdmin: false,
      role: 'customer',
      shippingAddress: '456 Pet Lover Ave, Makati City, Metro Manila, 1200',
      preferredPets: ['Dog', 'Cat'],
      emailVerified: true,
      isActive: true,
      image: '',
    },
    {
      name: 'Juan Dela Cruz',
      email: 'juan@furever.com',
      password: defaultPassword,
      phone: '09191234567',
      isAdmin: false,
      role: 'customer',
      shippingAddress: '789 Sampaguita St, Cebu City, Cebu, 6000',
      preferredPets: ['Fish', 'Bird'],
      emailVerified: true,
      isActive: true,
      image: '',
    },
  ];

  for (const userData of defaultUsers) {
    const existing = await User.findOne({ email: userData.email });
    if (!existing) {
      await new User(userData).save();
      console.log(`Created user: ${userData.name} (${userData.email}) [${userData.role}]`);
    } else {
      console.log(`User already exists: ${userData.email}`);
    }
  }
  console.log('\nDefault credentials:');
  console.log('  Admin: admin@furever.com / password123 (Jannella Yumang)');
  console.log('  User:  user@furever.com  / password123 (Emma Pascua)');
  console.log('  User:  juan@furever.com  / password123 (Juan Dela Cruz)');

  // ─── Seed sample admin notifications ────────────────────────────────
  const adminUser = await User.findOne({ email: 'admin@furever.com' });
  if (adminUser) {
    const existingNotifs = await Notification.countDocuments({ user: adminUser._id });
    if (existingNotifs === 0) {
      const sampleNotifications = [
        {
          user: adminUser._id,
          type: 'admin_new_order',
          title: 'New Order Placed',
          message: 'Emma Pascua placed order #A1B2C3D4 with 3 item(s) totaling $72.97.',
          read: false,
        },
        {
          user: adminUser._id,
          type: 'admin_order_delivered',
          title: 'Order Delivered',
          message: 'Order #E5F6G7H8 from Juan Dela Cruz (2 item(s), $45.98) has been delivered successfully.',
          read: false,
        },
        {
          user: adminUser._id,
          type: 'admin_low_stock',
          title: 'Low Stock Warning',
          message: '"Crunchy Peanut Butter Dog Treats" is running low — only 5 left in stock (threshold: 10).',
          read: false,
        },
        {
          user: adminUser._id,
          type: 'admin_out_of_stock',
          title: 'Out of Stock Alert',
          message: '"Interactive Feather Wand Cat Toy" is now out of stock (0 remaining). Please restock immediately.',
          read: false,
        },
        {
          user: adminUser._id,
          type: 'admin_new_order',
          title: 'New Order Placed',
          message: 'Juan Dela Cruz placed order #X9Y8Z7W6 with 1 item(s) totaling $34.99.',
          read: true,
        },
      ];
      await Notification.insertMany(sampleNotifications);
      console.log(`  Seeded ${sampleNotifications.length} sample admin notifications`);
    } else {
      console.log(`  Admin notifications already exist (${existingNotifs}), skipping`);
    }
  }

  await mongoose.disconnect();
  console.log('Done! Disconnected.');
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
