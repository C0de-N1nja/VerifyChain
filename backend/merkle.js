const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { ethers } = require('ethers');

function hashCredential(credential) {
  const encoded = ethers.solidityPacked(
    ['string', 'string', 'address'],
    [credential.studentName, credential.degreeTitle, credential.issuerAddress]
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
