const axios = require('axios');

const fundWallet = async () => {
  try {
    const response = await axios.post('http://localhost:5009/api/wallet/fund-buyer', {
      accountNumber: 'BP1753475994309', // ✅ Paste exact value here node fundTest.js

      amount: 10000
    });

    console.log('✅ Wallet funded:', response.data);
  } catch (error) {
    console.error('❌ Error funding wallet:', error.response?.data || error.message);
  }
};

fundWallet();
