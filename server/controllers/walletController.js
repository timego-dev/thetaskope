const WalletConnection = require('../models/WalletConnection');
const asyncErrorHandler = require('../middlewares/helpers/asyncErrorHandler');

/**
 * POST /api/v1/wallet/connect
 *
 * Body: { address: string }
 *
 * Stores the wallet address in the database.
 * If the address already exists, updates lastConnectedAt.
 * Returns the stored record and whether it was newly created.
 */
exports.saveWalletAddress = asyncErrorHandler(async (req, res) => {
  const { address } = req.body;

  if (!address) {
    return res.status(400).json({
      success: false,
      message: 'Wallet address is required',
    });
  }

  // Basic Ethereum address format check (0x + 40 hex chars)
  const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
  if (!ETH_ADDRESS_RE.test(address)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid Ethereum address format',
    });
  }

  // Upsert: insert on first connect, update timestamp on subsequent connects
  const wallet = await WalletConnection.findOneAndUpdate(
    { address: address.toLowerCase() },
    { lastConnectedAt: new Date() },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const isNew = wallet.createdAt.getTime() === wallet.updatedAt.getTime();

  res.status(isNew ? 201 : 200).json({
    success: true,
    message: isNew ? 'Wallet address saved' : 'Wallet connection updated',
    wallet,
  });
});
