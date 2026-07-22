require('dotenv').config();

const governanceBoardAbi = require('./abis/GovernanceBoard.json');
const credentialRegistryAbi = require('./abis/CredentialRegistry.json');
const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider(process.env.ZKSYNC_SEPOLIA_RPC);

const governanceBoard = new ethers.Contract(
	process.env.GOVERNANCE_BOARD_ADDRESS,
	governanceBoardAbi,
	provider
);

const credentialRegistry = new ethers.Contract(
	process.env.CREDENTIAL_REGISTRY_ADDRESS,
	credentialRegistryAbi,
	provider
);

module.exports = { provider, governanceBoard, credentialRegistry };