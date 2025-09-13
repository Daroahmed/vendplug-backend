const mongoose = require('mongoose');
require('dotenv').config();

async function checkStaffReferences() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Check all collections for 'Staff' references
    const collections = ['disputes', 'transactions', 'payoutrequests', 'bankaccounts', 'notifications'];
    
    for (const collectionName of collections) {
      const collection = mongoose.connection.db.collection(collectionName);
      const count = await collection.countDocuments({});
      console.log(`${collectionName}: ${count} documents`);
      
      // Check for Staff references
      const staffDocs = await collection.find({ 
        $or: [
          { userType: 'Staff' },
          { initiatorType: 'Staff' },
          { 'complainant.userType': 'Staff' },
          { 'respondent.userType': 'Staff' },
          { 'raisedByType': 'Staff' },
          { 'messages.sender.userType': 'Staff' },
          { 'evidence.uploadedByType': 'Staff' },
          { recipientType: 'Staff' }
        ]
      }).toArray();
      
      if (staffDocs.length > 0) {
        console.log(`❌ Found ${staffDocs.length} documents with Staff reference in ${collectionName}`);
        staffDocs.forEach((doc, i) => {
          console.log(`Document ${i + 1}:`, JSON.stringify(doc, null, 2));
        });
      } else {
        console.log(`✅ No Staff references in ${collectionName}`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkStaffReferences();
