/**
 * Script to delete verified users from MongoDB
 * Run this once to clean up the database before using offline quick-login system
 * 
 * Usage:
 * node delete-verified-users.js
 */

const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load env from server dir first, then parent
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const User = require('./models/User');

async function deleteVerifiedUsers() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.CONNECTION_STRING;
    if (!mongoUri) {
      throw new Error('No MongoDB URI found in environment');
    }

    await mongoose.connect(mongoUri, {
      autoIndex: true
    });
    console.log('✓ MongoDB connected');

    // Find and display verified users
    const verifiedUsers = await User.find({ emailVerified: true });
    if (verifiedUsers.length === 0) {
      console.log('ℹ No verified users found in database');
      await mongoose.disconnect();
      return;
    }

    console.log('\n📋 Verified users to be deleted:');
    verifiedUsers.forEach((user) => {
      console.log(`   • ${user.name} (${user.email}) - ${user.isAdmin ? 'Admin' : 'Customer'}`);
    });

    // Delete verified users
    const result = await User.deleteMany({ emailVerified: true });
    console.log(`\n✓ Deleted ${result.deletedCount} verified user(s) from MongoDB`);

    // Show remaining users
    const remaining = await User.countDocuments();
    console.log(`ℹ Remaining users in database: ${remaining}`);

    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB\n');
  } catch (err) {
    console.error('Error deleting users:', err.message);
    process.exit(1);
  }
}

deleteVerifiedUsers();
