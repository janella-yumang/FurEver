require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db } = require('./database');
const User = require('./models/User');

async function addUsers() {
  console.log('Adding users...\n');

  const users = [
    {
      name: 'Emma Rose Pascua',
      email: 'emmarose15.pascua@gmail.com',
      password: 'password123',
      phone: '09123456789',
      isAdmin: true,
      role: 'admin',
    },
    {
      name: 'Kylie Yumang',
      email: 'kylieyumang44@gmail.com',
      password: 'password123',
      phone: '09111111111',
      isAdmin: true,
      role: 'admin',
    },
    {
      name: 'User Account',
      email: 'erpemem.pascua@gmail.com',
      password: 'password123',
      phone: '09987654321',
      isAdmin: false,
      role: 'customer',
    },
  ];

  for (const userData of users) {
    try {
      // Check if user already exists
      const existing = User.findOne({ email: userData.email });
      
      if (existing) {
        console.log(`  ✓ User already exists: ${userData.email}`);
      } else {
        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        
        // Create user
        const user = User.create({
          name: userData.name,
          email: userData.email,
          password: hashedPassword,
          phone: userData.phone,
          isAdmin: userData.isAdmin,
          role: userData.role,
          emailVerified: true,
        });
        
        const roleLabel = userData.isAdmin ? 'ADMIN' : 'USER';
        console.log(`  ✓ Added ${roleLabel}: ${userData.email}`);
      }
    } catch (err) {
      console.error(`  ✗ Error adding user ${userData.email}:`, err.message);
    }
  }

  const allUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
  console.log(`\n✓ Complete!`);
  console.log(`  Total users in database: ${allUsers.count}`);
}

addUsers();
