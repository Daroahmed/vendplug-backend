const axios = require('axios');

class PaystackService {
  constructor() {
    this.baseURL = 'https://api.paystack.co';
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY;
    
    if (!this.secretKey || !this.publicKey) {
      throw new Error('Paystack keys not configured in environment variables');
    }
    
    this.httpClient = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Get Paystack wallet balance
   * @returns {Promise<Object>} - Paystack balance response
   */
  async getBalance() {
    try {
      const response = await this.httpClient.get('/balance');
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching Paystack balance:', error.response?.data || error.message);
      throw new Error(`Failed to fetch balance: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Initialize a payment transaction for wallet funding
   * @param {Object} paymentData - Payment details
   * @returns {Promise<Object>} - Paystack response with authorization URL
   */
  async initializePayment(paymentData) {
    try {
      const { email, amount, reference, callback_url, metadata = {} } = paymentData;
      
      // Validate required fields
      if (!email || !amount || !reference) {
        throw new Error('Missing required fields: email, amount, reference');
      }

      // Convert amount to Kobo (Paystack expects amount in Kobo)
      const amountInKobo = Math.round(amount * 100);
      
      const payload = {
        email,
        amount: amountInKobo,
        reference,
        callback_url,
        metadata: {
          ...metadata,
          source: 'vendplug_escrow',
          timestamp: new Date().toISOString()
        }
      };

      console.log('🚀 Initializing Paystack payment:', { email, amount, reference });
      
      const response = await this.httpClient.post('/transaction/initialize', payload);
      
      console.log('✅ Payment initialized successfully:', response.data.data.reference);
      
      return {
        success: true,
        data: response.data.data,
        message: 'Payment initialized successfully'
      };
      
    } catch (error) {
      console.error('❌ Paystack payment initialization failed:', error.message);
      
      if (error.response?.data) {
        return {
          success: false,
          error: error.response.data.message || 'Payment initialization failed',
          code: error.response.data.status || 'UNKNOWN_ERROR'
        };
      }
      
      return {
        success: false,
        error: error.message || 'Payment initialization failed',
        code: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Verify a payment transaction
   * @param {string} reference - Transaction reference from Paystack
   * @returns {Promise<Object>} - Payment verification result
   */
  async verifyPayment(reference) {
    try {
      if (!reference) {
        throw new Error('Transaction reference is required');
      }

      console.log('🔍 Verifying Paystack payment:', reference);
      
      const response = await this.httpClient.get(`/transaction/verify/${reference}`);
      const transaction = response.data.data;
      
      // Check if payment was successful
      if (transaction.status === 'success') {
        console.log('✅ Payment verified successfully:', {
          reference: transaction.reference,
          amount: transaction.amount / 100, // Convert from Kobo to Naira
          customer: transaction.customer.email
        });
        
        return {
          success: true,
          data: {
            reference: transaction.reference,
            amount: transaction.amount / 100,
            currency: transaction.currency,
            customer: transaction.customer,
            paidAt: transaction.paid_at,
            metadata: transaction.metadata
          },
          message: 'Payment verified successfully'
        };
      } else {
        console.log('❌ Payment not successful:', transaction.status);
        
        return {
          success: false,
          error: `Payment not successful. Status: ${transaction.status}`,
          data: transaction
        };
      }
      
    } catch (error) {
      console.error('❌ Paystack payment verification failed:', error.message);
      
      if (error.response?.data) {
        return {
          success: false,
          error: error.response.data.message || 'Payment verification failed',
          code: error.response.data.status || 'UNKNOWN_ERROR'
        };
      }
      
      return {
        success: false,
        error: error.message || 'Payment verification failed',
        code: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Create a transfer recipient for automated payouts
   * @param {Object} recipientData - Bank account details
   * @returns {Promise<Object>} - Recipient creation result
   */
  async createTransferRecipient(recipientData) {
    try {
      const { type, name, account_number, bank_code, currency = 'NGN' } = recipientData;
      
      if (!type || !name || !account_number || !bank_code) {
        throw new Error('Missing required fields: type, name, account_number, bank_code');
      }

      console.log('🏦 Creating transfer recipient:', { name, account_number, bank_code });
      
      const payload = {
        type,
        name,
        account_number,
        bank_code,
        currency
      };

      const response = await this.httpClient.post('/transferrecipient', payload);
      
      console.log('✅ Transfer recipient created:', response.data.data.recipient_code);
      
      return {
        success: true,
        data: response.data.data,
        message: 'Transfer recipient created successfully'
      };
      
    } catch (error) {
      console.error('❌ Transfer recipient creation failed:', error.message);
      
      if (error.response?.data) {
        return {
          success: false,
          error: error.response.data.message || 'Recipient creation failed',
          code: error.response.data.status || 'UNKNOWN_ERROR'
        };
      }
      
      return {
        success: false,
        error: error.message || 'Recipient creation failed',
        code: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Initiate a transfer to a recipient
   * @param {Object} transferData - Transfer details
   * @returns {Promise<Object>} - Transfer initiation result
   */
  async initiateTransfer(transferData) {
    try {
      const { source, amount, recipient, reason, currency = 'NGN', reference } = transferData;
      
      if (!source || !amount || !recipient) {
        throw new Error('Missing required fields: source, amount, recipient');
      }

      // Convert amount to Kobo
      const amountInKobo = Math.round(amount * 100);
      
      console.log('💸 Initiating transfer:', { amount, recipient, reason });
      
      const payload = {
        source,
        amount: amountInKobo,
        recipient,
        reason,
        currency,
        ...(reference ? { reference } : {})
      };

      const response = await this.httpClient.post('/transfer', payload);
      
      console.log('✅ Transfer initiated successfully:', response.data.data.transfer_code);
      
      return {
        success: true,
        data: response.data.data,
        message: 'Transfer initiated successfully'
      };
      
    } catch (error) {
      console.error('❌ Transfer initiation failed:', error.message);
      
      if (error.response?.data) {
        return {
          success: false,
          error: error.response.data.message || 'Transfer initiation failed',
          code: error.response.data.status || 'UNKNOWN_ERROR'
        };
      }
      
      return {
        success: false,
        error: error.message || 'Transfer initiation failed',
        code: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Get transfer by reference (Paystack: /transfer/verify/:reference)
   * @param {string} reference - Our idempotent transfer reference
   * @returns {Promise<Object>} - Transfer details (status, transfer_code, amount, etc.)
   */
  async getTransfer(reference) {
    try {
      if (!reference) {
        throw new Error('Reference is required');
      }

      console.log('🔍 Verifying transfer by reference:', reference);

      const response = await this.httpClient.get(`/transfer/verify/${reference}`);

      // Paystack returns { status: true, data: { status: 'success' | 'failed' | 'pending', ... } }
      const transfer = response.data.data;
      console.log('📦 Transfer verify result:', { status: transfer.status, transfer_code: transfer.transfer_code });

      return transfer;
    } catch (error) {
      console.error('❌ Transfer verify failed:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.message || 'Failed to verify transfer');
    }
  }

  /**
   * Fetch transfer details
   * @param {string} transferCode - Transfer code from Paystack
   * @returns {Promise<Object>} - Transfer details
   */
  async fetchTransfer(transferCode) {
    try {
      if (!transferCode) {
        throw new Error('Transfer code is required');
      }

      console.log('🔍 Fetching transfer details:', transferCode);
      
      const response = await this.httpClient.get(`/transfer/${transferCode}`);
      
      console.log('✅ Transfer details fetched:', response.data.data.status);
      
      return {
        success: true,
        data: response.data.data,
        message: 'Transfer details fetched successfully'
      };
      
    } catch (error) {
      console.error('❌ Transfer fetch failed:', error.message);
      
      if (error.response?.data) {
        return {
          success: false,
          error: error.response.data.message || 'Transfer fetch failed',
          code: error.response.data.status || 'UNKNOWN_ERROR'
        };
      }
      
      return {
        success: false,
        error: error.message || 'Transfer fetch failed',
        code: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Verify bank account number
   * @param {string} accountNumber - Bank account number
   * @param {string} bankCode - Bank code
   * @returns {Promise<Object>} - Account verification result
   */
  async verifyBankAccount(accountNumber, bankCode) {
    try {
      if (!accountNumber || !bankCode) {
        throw new Error('Account number and bank code are required');
      }

      console.log('🏦 Verifying bank account:', { accountNumber, bankCode });
      
      const response = await this.httpClient.get(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
      
      console.log('✅ Bank account verified:', response.data.data.account_name);
      
      return {
        success: true,
        data: response.data.data,
        message: 'Bank account verified successfully'
      };
      
    } catch (error) {
      console.error('❌ Bank account verification failed:', error.message);
      
      if (error.response?.data) {
        return {
          success: false,
          error: error.response.data.message || 'Account verification failed',
          code: error.response.data.status || 'UNKNOWN_ERROR'
        };
      }
      
      return {
        success: false,
        error: error.message || 'Account verification failed',
        code: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Get list of Nigerian banks
   * @returns {Promise<Object>} - List of banks
   */
  async getBanks() {
    try {
      console.log('🏦 Fetching Nigerian banks list');
      
      const response = await this.httpClient.get('/bank?country=nigeria');
      
      console.log('✅ Banks list fetched:', response.data.data.length, 'banks');
      
      return {
        success: true,
        data: response.data.data,
        message: 'Banks list fetched successfully'
      };
      
    } catch (error) {
      console.error('❌ Banks list fetch failed:', error.message);
      
      if (error.response?.data) {
        return {
          success: false,
          error: error.response.data.message || 'Banks list fetch failed',
          code: error.response.data.status || 'UNKNOWN_ERROR'
        };
      }
      
      return {
        success: false,
        error: error.message || 'Banks list fetch failed',
        code: 'NETWORK_ERROR'
      };
    }
  }
}

module.exports = PaystackService;
