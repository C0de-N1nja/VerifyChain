const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { ethers } = require('ethers');

function hashCredential(credential) {
	// Normalize address casing using checksum address
	const normalizedAddress = ethers.getAddress(credential.issuerAddress.trim());
	
	const encoded = ethers.solidityPacked(
		['string', 'string', 'address'],
		[credential.studentName.trim(), credential.degreeTitle.trim(), normalizedAddress]
	);
	return keccak256(encoded);
}

function buildMerkleTree(credentials) {
	const leaves = credentials.map(hashCredential);
	const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
	const root = tree.getHexRoot();
	return { tree, leaves, root };
}

module.exports = { hashCredential, buildMerkleTree };