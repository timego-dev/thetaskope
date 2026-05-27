const express = require('express');
const { saveWalletAddress } = require('../controllers/walletController');

const router = express.Router();

// POST /api/v1/wallet/connect
router.route('/wallet/connect').post(saveWalletAddress);

module.exports = router;
