const governanceBoardAbi = require('./abis/GovernanceBoard.json');
const credentialRegistryAbi = require('./abis/CredentialRegistry.json');
const { ethers } = require('ethers');

require('dotenv').config();

const provider = new ethers.JsonRpcProvider(process.env.ZKSYNC_SEPOLIA_RPC);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const governanceBoard = new ethers.Contract(
  process.env.GOVERNANCE_BOARD_ADDRESS,
  governanceBoardAbi,
  wallet
);

const credentialRegistry = new ethers.Contract(
  process.env.CREDENTIAL_REGISTRY_ADDRESS,
  credentialRegistryAbi,
  wallet
);

module.exports = { provider, wallet, governanceBoard, credentialRegistry };