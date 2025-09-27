const mongoose = require('mongoose');
require('dotenv').config();

async function fixAdIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vendplug-escrow');
    console.log('✅ Connected to MongoDB');

    // Get the Ad collection
    const db = mongoose.connection.db;
    const adCollection = db.collection('ads');

    // List all indexes
    console.log('📋 Current indexes:');
    const indexes = await adCollection.indexes();
    indexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Drop the problematic compound index
    try {
      await adCollection.dropIndex({ targetPages: 1, targetUserTypes: 1 });
      console.log('✅ Dropped problematic compound index');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️ Index already dropped or never existed');
      } else {
        console.log('⚠️ Error dropping index:', error.message);
      }
    }

    // Create separate indexes
    try {
      await adCollection.createIndex({ targetPages: 1 });
      console.log('✅ Created targetPages index');
    } catch (error) {
      console.log('⚠️ Error creating targetPages index:', error.message);
    }

    try {
      await adCollection.createIndex({ targetUserTypes: 1 });
      console.log('✅ Created targetUserTypes index');
    } catch (error) {
      console.log('⚠️ Error creating targetUserTypes index:', error.message);
    }

    // List indexes again to confirm
    console.log('\n📋 Updated indexes:');
    const newIndexes = await adCollection.indexes();
    newIndexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log('\n✅ Index fix completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixAdIndex();
