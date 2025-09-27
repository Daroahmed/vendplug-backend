const axios = require('axios');

const fundWallet = async () => {
  try {
    const response = await axios.post('http://localhost:5000/api/wallet/fund-buyer', {
      accountNumber: 'BP4257980805', // ✅ Paste exact value here node fundTest.js

      amount: 50000
    });

    console.log('✅ Wallet funded:', response.data);
  } catch (error) {
    console.error('❌ Error funding wallet:', error.response?.data || error.message);
  }
};

fundWallet();
