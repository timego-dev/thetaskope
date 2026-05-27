const mongoose = require('mongoose');

/**
 * Records every unique wallet address that has connected to the app.
 * Uses upsert on the address so the same wallet is never stored twice —
 * a second connect just refreshes lastConnectedAt.
 */
const walletConnectionSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      required: [true, 'Wallet address is required'],
      unique: true,
      lowercase: true, // normalise to checksumless lowercase for consistent lookup
      trim: true,
      match: [
        /^0x[0-9a-fA-F]{40}$/,
        'Please provide a valid Ethereum address (0x + 40 hex chars)',
      ],
    },
    lastConnectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WalletConnection', walletConnectionSchema);
