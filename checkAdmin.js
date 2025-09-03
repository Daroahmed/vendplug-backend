require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const Admin = require('./models/Admin');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const admins = await Admin.find({});
    console.log('Existing admins:', admins.map(a => ({
      username: a.username,
      email: a.email,
      isActive: a.isActive,
      role: a.role
    })));
    process.exit(0);
  })
  .catch(console.error);