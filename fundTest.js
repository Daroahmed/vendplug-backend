const axios = require('axios');

const fundWallet = async () => {
  try {
    const response = await axios.post('http://localhost:5002/api/wallet/fund-buyer', {
      accountNumber: 'AP4833983871', // ✅ Paste exact value here node fundTest.js

      amount: 10000
    });

    console.log('✅ Wallet funded:', response.data);
  } catch (error) {
    console.error('❌ Error funding wallet:', error.response?.data || error.message);
  }
};

fundWallet();
