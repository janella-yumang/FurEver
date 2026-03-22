require('dotenv').config();
const { db } = require('./database');
const Product = require('./models/Product');

const CATEGORY_NAMES = [
  'Pet Food',
  'Treats',
  'Toys',
  'Grooming',
  'Health',
  'Accessories',
  'Habitat',
];

const PET_TYPES = ['Dog', 'Cat', 'Fish', 'Bird', 'Rabbit', 'Hamster', 'Reptile', 'Other'];

const MORE_PRODUCTS = [
  {
    name: 'Rabbit Timothy Hay Pellets',
    categoryName: 'Pet Food',
    petType: 'Rabbit',
    price: 13.99,
    countInStock: 70,
    image: 'https://images.unsplash.com/photo-1583337130417-3346a1f4d7c1?w=400&q=80',
    description: 'Fiber-rich timothy hay pellets for healthy rabbit digestion.',
    barcode: 'FE-NEW-001',
    variants: ['1kg', '2kg'],
    expirationDate: '2027-02-15',
  },
  {
    name: 'Dried Mealworm Bird Treats',
    categoryName: 'Treats',
    petType: 'Bird',
    price: 9.49,
    countInStock: 85,
    image: 'https://images.unsplash.com/photo-1522926193341-e9ffd686c60f?w=400&q=80',
    description: 'High-protein dried mealworms for parrots and songbirds.',
    barcode: 'FE-NEW-002',
    variants: ['80g', '160g'],
    expirationDate: '2026-12-01',
  },
  {
    name: 'Floating Turtle Basking Dock',
    categoryName: 'Habitat',
    petType: 'Reptile',
    price: 18.99,
    countInStock: 40,
    image: 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=400&q=80',
    description: 'Adjustable floating dock with ramp for turtles and terrapins.',
    barcode: 'FE-NEW-003',
    variants: ['Small', 'Large'],
    expirationDate: '',
  },
  {
    name: 'Natural Catnip Plush Mouse',
    categoryName: 'Toys',
    petType: 'Cat',
    price: 6.99,
    countInStock: 130,
    image: 'https://images.unsplash.com/photo-1511044568932-338cba0ad803?w=400&q=80',
    description: 'Soft plush mouse toy stuffed with organic catnip.',
    barcode: 'FE-NEW-004',
    variants: ['Single', '3-pack'],
    expirationDate: '',
  },
  {
    name: 'Hypoallergenic Puppy Wipes',
    categoryName: 'Grooming',
    petType: 'Dog',
    price: 7.99,
    countInStock: 95,
    image: 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?w=400&q=80',
    description: 'Fragrance-free wipes for paws, coat, and sensitive skin.',
    barcode: 'FE-NEW-005',
    variants: ['40 sheets', '80 sheets'],
    expirationDate: '2027-03-30',
  },
  {
    name: 'Omega-3 Fish Immune Booster',
    categoryName: 'Health',
    petType: 'Fish',
    price: 15.49,
    countInStock: 60,
    image: 'https://images.unsplash.com/photo-1524704654690-b56c05c78a00?w=400&q=80',
    description: 'Liquid supplement to support fish immunity and coloration.',
    barcode: 'FE-NEW-006',
    variants: ['60ml', '120ml'],
    expirationDate: '2026-10-20',
  },
  {
    name: 'Universal Travel Pet Carrier',
    categoryName: 'Accessories',
    petType: 'Other',
    price: 39.99,
    countInStock: 28,
    image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&q=80',
    description: 'Ventilated soft carrier suitable for small pets and exotics.',
    barcode: 'FE-NEW-007',
    variants: ['Small', 'Medium'],
    expirationDate: '',
  },
  {
    name: 'Calming Chamomile Rabbit Treat Bites',
    categoryName: 'Treats',
    petType: 'Rabbit',
    price: 8.29,
    countInStock: 75,
    image: 'https://images.unsplash.com/photo-1535241749838-299277b6305f?w=400&q=80',
    description: 'Gentle botanical snack bites for rabbits and guinea pigs.',
    barcode: 'FE-NEW-008',
    variants: ['100g'],
    expirationDate: '2026-09-05',
  },
  {
    name: 'Hamster Exercise Tunnel Set',
    categoryName: 'Habitat',
    petType: 'Hamster',
    price: 17.49,
    countInStock: 48,
    image: 'https://images.unsplash.com/photo-1425082661507-3f9c4cba2aae?w=400&q=80',
    description: 'Expandable tunnel kit to enrich hamster enclosures.',
    barcode: 'FE-NEW-009',
    variants: ['6-piece set'],
    expirationDate: '',
  },
  {
    name: 'Bird Beak Care Mineral Block',
    categoryName: 'Health',
    petType: 'Bird',
    price: 5.99,
    countInStock: 110,
    image: 'https://images.unsplash.com/photo-1444464666168-49d633b86797?w=400&q=80',
    description: 'Mineral-rich pecking block for beak conditioning and calcium.',
    barcode: 'FE-NEW-010',
    variants: ['Single', '2-pack'],
    expirationDate: '2028-01-01',
  },
];

function seedMoreProducts() {
  const categories = db.prepare('SELECT id, name FROM categories').all();
  const categoryMap = categories.reduce((acc, row) => {
    acc[row.name] = row.id;
    return acc;
  }, {});

  for (const categoryName of CATEGORY_NAMES) {
    if (!categoryMap[categoryName]) {
      throw new Error(`Missing category: ${categoryName}`);
    }
  }

  let inserted = 0;
  for (const product of MORE_PRODUCTS) {
    const exists = Product.findByBarcode(product.barcode);
    if (exists) {
      continue;
    }

    Product.create({
      ...product,
      category: categoryMap[product.categoryName],
      lowStockThreshold: 10,
    });
    inserted += 1;
  }

  const categoryCoverage = db.prepare(`
    SELECT c.name AS category, COUNT(p.id) AS total
    FROM categories c
    LEFT JOIN products p ON p.category = c.id
    GROUP BY c.id, c.name
    ORDER BY c.name ASC
  `).all();

  const petCoverageRows = db.prepare(`
    SELECT TRIM(COALESCE(petType, '')) AS petType, COUNT(*) AS total
    FROM products
    WHERE TRIM(COALESCE(petType, '')) <> ''
    GROUP BY TRIM(COALESCE(petType, ''))
    ORDER BY petType ASC
  `).all();
  const petCoverageMap = petCoverageRows.reduce((acc, row) => {
    acc[row.petType] = row.total;
    return acc;
  }, {});

  const missingPetTypes = PET_TYPES.filter((pet) => !petCoverageMap[pet]);
  const missingCategories = categoryCoverage.filter((row) => Number(row.total) === 0).map((row) => row.category);

  console.log(`Added ${inserted} new products.`);
  console.log('Category coverage:');
  categoryCoverage.forEach((row) => console.log(`  - ${row.category}: ${row.total}`));

  console.log('Pet coverage:');
  PET_TYPES.forEach((pet) => console.log(`  - ${pet}: ${petCoverageMap[pet] || 0}`));

  if (missingCategories.length === 0 && missingPetTypes.length === 0) {
    console.log('Coverage check passed: every category and pet type has at least 1 product.');
  } else {
    if (missingCategories.length) {
      console.log(`Missing categories: ${missingCategories.join(', ')}`);
    }
    if (missingPetTypes.length) {
      console.log(`Missing pet types: ${missingPetTypes.join(', ')}`);
    }
    process.exitCode = 1;
  }
}

try {
  seedMoreProducts();
} catch (error) {
  console.error('Failed to add products:', error.message);
  process.exit(1);
}
