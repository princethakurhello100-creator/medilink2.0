require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('./src/models');

async function seedAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  const existing = await User.findOne({ role: 'admin' });
  if (existing) {
    console.log('Admin already exists:', existing.email);
    process.exit(0);
  }
  const passwordHash = await bcrypt.hash('Admin@1234!', 12);
  const admin = await User.create({
    email: 'admin@medilink.com',
    passwordHash,
    role: 'admin',
  });
  console.log('Master admin created:', admin.email);
  console.log('Password: Admin@1234!');
  console.log('CHANGE THIS PASSWORD IN PRODUCTION');
  process.exit(0);
}

seedAdmin().catch(err => { console.error(err); process.exit(1); });
