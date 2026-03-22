require('dotenv').config();
const { db } = require('./database');

function addVouchers() {
  console.log('Adding promotional vouchers...\n');

  const vouchers = [
    {
      title: '20% Off Pet Food',
      message: 'Get 20% discount on all pet food items',
      imageUrl: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&q=80',
      promoCode: 'PETFOOD20',
      discountType: 'percent',
      discountValue: 20,
      maxDiscount: 500,
      minOrderAmount: 100,
      startsAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      isActive: 1,
      maxClaims: 1000,
    },
    {
      title: '₱500 Off on Orders Over ₱2000',
      message: 'Spend ₱2000 and get ₱500 discount',
      imageUrl: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&q=80',
      promoCode: 'SAVE500',
      discountType: 'fixed',
      discountValue: 500,
      maxDiscount: 500,
      minOrderAmount: 2000,
      startsAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days
      isActive: 1,
      maxClaims: 500,
    },
    {
      title: 'Free Shipping on Toys & Accessories',
      message: 'FREE SHIPPING on all toys and accessories purchases',
      imageUrl: 'https://images.unsplash.com/photo-1610940968556-9aa96f1fb2a8?w=400&q=80',
      promoCode: 'FREESHIP',
      discountType: 'percent',
      discountValue: 15,
      maxDiscount: 250,
      minOrderAmount: 500,
      startsAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
      isActive: 1,
      maxClaims: 750,
    },
    {
      title: 'Buy 2 Get 1 Treats Free',
      message: 'Purchase any 2 pet treats and get 1 free!',
      imageUrl: 'https://images.unsplash.com/photo-1597808860023-8ec45a1d4b87?w=400&q=80',
      promoCode: 'TREATS2FOR1',
      discountType: 'percent',
      discountValue: 33,
      maxDiscount: 300,
      minOrderAmount: 150,
      startsAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(), // 21 days
      isActive: 1,
      maxClaims: 600,
    },
    {
      title: 'New Customer Welcome - ₱300 Off',
      message: 'First time shoppers get ₱300 off their purchase',
      imageUrl: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&q=80',
      promoCode: 'WELCOME300',
      discountType: 'fixed',
      discountValue: 300,
      maxDiscount: 300,
      minOrderAmount: 500,
      startsAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
      isActive: 1,
      maxClaims: 400,
    },
  ];

  const insertVoucher = db.prepare(`
    INSERT INTO vouchers (
      title, message, imageUrl, promoCode, discountType, discountValue,
      maxDiscount, minOrderAmount, startsAt, expiresAt, isActive, maxClaims
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let added = 0;
  let skipped = 0;

  for (const voucher of vouchers) {
    try {
      // Check if promo code already exists
      const existing = db.prepare('SELECT * FROM vouchers WHERE promoCode = ?').get(voucher.promoCode);
      
      if (existing) {
        console.log(`  ✓ Voucher already exists: ${voucher.promoCode}`);
        skipped++;
      } else {
        insertVoucher.run(
          voucher.title,
          voucher.message,
          voucher.imageUrl,
          voucher.promoCode,
          voucher.discountType,
          voucher.discountValue,
          voucher.maxDiscount,
          voucher.minOrderAmount,
          voucher.startsAt,
          voucher.expiresAt,
          voucher.isActive,
          voucher.maxClaims
        );
        console.log(`  ✓ Added voucher: ${voucher.promoCode} - ${voucher.title}`);
        added++;
      }
    } catch (err) {
      console.error(`  ✗ Error adding voucher ${voucher.promoCode}:`, err.message);
    }
  }

  const allVouchers = db.prepare('SELECT COUNT(*) as count FROM vouchers').get();
  console.log(`\n✓ Complete!`);
  console.log(`  Added: ${added} vouchers`);
  console.log(`  Skipped: ${skipped} vouchers`);
  console.log(`  Total vouchers in database: ${allVouchers.count}`);
}

addVouchers();
