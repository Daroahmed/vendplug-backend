const BankAccount = require('../models/BankAccount');
const { paystackService } = require('../controllers/paystackController');

// Add new bank account
const addBankAccount = async (req, res) => {
  try {
    const { bankName, bankCode, accountNumber, accountName } = req.body;
    const userId = req.user.id;
    
    // More robust role detection
    let userType;
    if (req.user.role && req.user.role.toLowerCase() === 'vendor') {
      userType = 'Vendor';
    } else if (req.user.role && req.user.role.toLowerCase() === 'agent') {
      userType = 'Agent';
    } else {
      // Fallback - try to determine from the user model
      userType = 'Vendor'; // Default fallback
    }

    // Verify account with Paystack
    const verificationResult = await paystackService.verifyBankAccount(accountNumber, bankCode);
    
    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bank account details'
      });
    }

    // Check if account number already exists for this user
    const existingAccount = await BankAccount.findOne({
      userId,
      userType,
      accountNumber
    });

    if (existingAccount) {
      return res.status(400).json({
        success: false,
        message: 'Bank account already exists'
      });
    }

    // Set as default if it's the first account
    const isDefault = !(await BankAccount.findOne({ userId, userType }));

    const bankAccount = new BankAccount({
      userId,
      userType,
      bankName,
      bankCode,
      accountNumber,
      accountName: verificationResult.data.account_name,
      isVerified: true,
      isDefault
    });

    await bankAccount.save();

    res.status(201).json({
      success: true,
      message: 'Bank account added successfully',
      data: bankAccount
    });

  } catch (error) {
    console.error('Error adding bank account:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add bank account',
      error: error.message
    });
  }
};

// Get user's bank accounts
const getBankAccounts = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // More robust role detection
    let userType;
    if (req.user.role && req.user.role.toLowerCase() === 'vendor') {
      userType = 'Vendor';
    } else if (req.user.role && req.user.role.toLowerCase() === 'agent') {
      userType = 'Agent';
    } else {
      // Fallback - try to determine from the user model
      userType = 'Vendor'; // Default fallback
    }

    const bankAccounts = await BankAccount.find({ userId, userType })
      .sort({ isDefault: -1, createdAt: -1 });

    res.json({
      success: true,
      data: bankAccounts
    });

  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bank accounts',
      error: error.message
    });
  }
};

// Set default bank account
const setDefaultBankAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    const userId = req.user.id;
    
    // More robust role detection
    let userType;
    if (req.user.role && req.user.role.toLowerCase() === 'vendor') {
      userType = 'Vendor';
    } else if (req.user.role && req.user.role.toLowerCase() === 'agent') {
      userType = 'Agent';
    } else {
      // Fallback - try to determine from the user model
      userType = 'Vendor'; // Default fallback
    }

    // Remove default from all accounts
    await BankAccount.updateMany(
      { userId, userType },
      { isDefault: false }
    );

    // Set new default
    const bankAccount = await BankAccount.findOneAndUpdate(
      { _id: accountId, userId, userType },
      { isDefault: true },
      { new: true }
    );

    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    res.json({
      success: true,
      message: 'Default bank account updated',
      data: bankAccount
    });

  } catch (error) {
    console.error('Error setting default bank account:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update default bank account',
      error: error.message
    });
  }
};

// Delete bank account
const deleteBankAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    const userId = req.user.id;
    
    // More robust role detection
    let userType;
    if (req.user.role && req.user.role.toLowerCase() === 'vendor') {
      userType = 'Vendor';
    } else if (req.user.role && req.user.role.toLowerCase() === 'agent') {
      userType = 'Agent';
    } else {
      // Fallback - try to determine from the user model
      userType = 'Vendor'; // Default fallback
    }

    const bankAccount = await BankAccount.findOne({ _id: accountId, userId, userType });

    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    if (bankAccount.isDefault) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete default bank account'
      });
    }

    await BankAccount.findByIdAndDelete(accountId);

    res.json({
      success: true,
      message: 'Bank account deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting bank account:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete bank account',
      error: error.message
    });
  }
};

module.exports = {
  addBankAccount,
  getBankAccounts,
  setDefaultBankAccount,
  deleteBankAccount
};
