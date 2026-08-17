const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { ethers } = require('ethers');

function hashCredential(credential) {
    const normalizedAddress = ethers.getAddress(credential.issuerAddress.trim());
    
    const encoded = ethers.solidityPacked(
        ['string', 'string', 'string', 'address', 'string', 'string', 'string'],
        [
            credential.studentName.trim(), 
            credential.degreeTitle.trim(), 
            credential.rollNumber.trim(), 
            normalizedAddress,
            credential.major ? credential.major.trim() : '', 
            credential.honors ? credential.honors.trim() : '', 
            credential.nationalId ? credential.nationalId.trim() : ''
        ]
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