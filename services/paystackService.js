const https = require('https');
const crypto = require('crypto');

class PaystackService {
  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY;
    this.baseURL = 'api.paystack.co';
  }

  /**
   * Initialize a transaction for wallet funding
   */
  async initializeTransaction(params) {
    const { email, amount, reference, metadata } = params;

    const options = {
      hostname: this.baseURL,
      port: 443,
      path: '/transaction/initialize',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      }
    };

    const data = {
      email,
      amount: amount * 100, // Convert to kobo
      reference,
      callback_url: `${process.env.FRONTEND_URL}/wallet/verify`,
      metadata: {
        ...metadata,
        custom_fields: [
          {
            display_name: "Funding Type",
            variable_name: "funding_type",
            value: "wallet_funding"
          }
        ]
      }
    };

    return this.makeRequest(options, data);
  }

  /**
   * Verify a transaction after payment
   */
  async verifyTransaction(reference) {
    const options = {
      hostname: this.baseURL,
      port: 443,
      path: `/transaction/verify/${reference}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.secretKey}`
      }
    };

    return this.makeRequest(options);
  }

  /**
   * Create a dedicated virtual account for a customer
   */
  async createDedicatedAccount(params) {
    const { email, firstName, lastName, phone } = params;

    const options = {
      hostname: this.baseURL,
      port: 443,
      path: '/dedicated_account',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      }
    };

    const data = {
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
      preferred_bank: 'test-bank', // Replace with actual bank in production
      country: 'NG'
    };

    return this.makeRequest(options, data);
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return hash === signature;
  }

  /**
   * Make HTTP request to Paystack API
   */
  makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (err) {
            reject(new Error('Failed to parse response'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  /**
   * Generate unique transaction reference
   */
  static generateReference() {
    return `VP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = new PaystackService();
