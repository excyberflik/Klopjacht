const User = require('../models/User');
const bcrypt = require('bcryptjs');

async function initDatabase() {
  try {
    console.log('🔧 Initializing database...');
    
    // Check if super admin exists
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@klopjacht.com';
    const existingSuperAdmin = await User.findOne({ 
      email: superAdminEmail,
      role: 'super_admin' 
    });

    if (!existingSuperAdmin) {
      console.log('👤 Creating super admin user...');
      
      const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';
      
      const superAdmin = new User({
        email: superAdminEmail,
        password: superAdminPassword,
        name: 'Super Administrator',
        role: 'super_admin',
        organization: 'Klopjacht Platform',
        isActive: true
      });

      await superAdmin.save();
      console.log(`✅ Super admin created with email: ${superAdminEmail}`);
      console.log(`🔑 Default password: ${superAdminPassword}`);
      console.log('⚠️  Please change the default password after first login!');
    } else {
      console.log('✅ Super admin already exists');
    }

    // Create indexes for better performance
    await createIndexes();
    
    console.log('✅ Database initialization completed');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

async function createIndexes() {
  try {
    console.log('📊 Creating database indexes...');
    
    // User indexes
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ role: 1 });
    await User.collection.createIndex({ createdBy: 1 });
    await User.collection.createIndex({ isActive: 1 });
    
    console.log('✅ Database indexes created');
  } catch (error) {
    console.error('❌ Failed to create indexes:', error);
    // Don't throw error for indexes as they might already exist
  }
}

module.exports = initDatabase;
