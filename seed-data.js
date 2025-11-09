// seed-data.js
require('dotenv').config();
const mongoose = require('mongoose');

const MASTER_DB_URI = process.env.MASTER_DB_URI || 'mongodb://127.0.0.1:27017/phishing_master';

async function seedData() {
  try {
    console.log('🚀 Starting seed process...\n');
    
    const masterConn = await mongoose.createConnection(MASTER_DB_URI);
    console.log('✅ Connected to master database');

    const { schema: SuperadminSchema } = require('./src/models/master/Superadmin');
    const { schema: TenantSchema } = require('./src/models/master/Tenant');

    const Superadmin = masterConn.model('Superadmin', SuperadminSchema);
    const Tenant = masterConn.model('Tenant', TenantSchema);

    // Create Superadmin
    console.log('📝 Creating Superadmin...');
    const existingSuperadmin = await Superadmin.findOne({ email: 'superadmin@example.com' });
    
    let superadminId;
    if (!existingSuperadmin) {
      const superadmin = await Superadmin.create({
        email: 'superadmin@example.com',
        password: 'SuperSecurePass123!',
        name: 'Super Admin',
        role: 'superadmin',
        permissions: {
          canCreateTenants: true,
          canDeleteTenants: true,
          canViewAllTenants: true,
          canManageSubscriptions: true,
          canManageSuperadmins: true,
        },
        isActive: true,
      });
      superadminId = superadmin._id;
      console.log('✅ Superadmin created:', superadmin.email);
    } else {
      superadminId = existingSuperadmin._id;
      console.log('ℹ️  Superadmin already exists');
    }

    // Create Test Tenant
    console.log('\n📝 Creating Test Tenant...');
    const existingTenant = await Tenant.findOne({ subdomain: 'testcorp' });
    
    let tenant;
    if (!existingTenant) {
      const tenantId = new mongoose.Types.ObjectId().toString();
      const dbName = `tenant_${tenantId}`;
      
      tenant = await Tenant.create({
        tenantId: tenantId,
        organizationName: 'Test Corporation',
        subdomain: 'testcorp',
        databaseName: dbName,
        primaryAdminEmail: 'admin@testcorp.com',
        contactName: 'Admin User',
        contactPhone: '+1234567890',
        plan: {
          type: 'trial',
          maxUsers: 10,
          maxCampaigns: 5,
          features: [],
        },
        status: 'active',
        isActive: true,
        createdBy: superadminId,
        settings: {
          timezone: 'America/New_York',
          language: 'en',
        },
      });
      console.log('✅ Tenant created:', tenant.subdomain);
      console.log('   Database:', tenant.databaseName);
    } else {
      tenant = existingTenant;
      console.log('ℹ️  Tenant already exists');
    }

    // Create Tenant Admin User
    console.log('\n📝 Creating Tenant Admin User...');
    const tenantDbUri = `mongodb://127.0.0.1:27017/${tenant.databaseName}`;
    const tenantConn = await mongoose.createConnection(tenantDbUri);

    const { schema: UserSchema } = require('./src/models/tenant/User');
    const User = tenantConn.model('User', UserSchema);

    const existingUser = await User.findOne({ email: 'admin@testcorp.com' });
    
    if (!existingUser) {
      await User.create({
        email: 'admin@testcorp.com',
        password: 'SecurePassword123!',
        name: 'Admin User',
        role: 'admin',
        isActive: true,
        isEmailVerified: true,
      });
      console.log('✅ Admin user created');
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    await masterConn.close();
    await tenantConn.close();

    console.log('\n' + '='.repeat(60));
    console.log('🎉 SEED DATA CREATED!');
    console.log('='.repeat(60));
    console.log('\n📋 LOGIN CREDENTIALS:\n');
    console.log('🔐 SUPERADMIN:');
    console.log('   Email: superadmin@example.com');
    console.log('   Password: SuperSecurePass123!\n');
    console.log('🏢 TENANT ADMIN:');
    console.log('   Tenant: testcorp');
    console.log('   Email: admin@testcorp.com');
    console.log('   Password: SecurePassword123!\n');
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

seedData();
