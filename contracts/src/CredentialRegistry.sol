// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

interface IGovernanceBoard {
    function isActivatedIssuer(address issuer) external view returns (bool);
    function getIssuerTier(address issuer) external view returns (uint8);
}
contract CredentialRegistry {

    error CredentialRegistry__NotActivatedIssuer();
    error CredentialRegistry__AlreadyRevoked();
    error CredentialRegistry__InvalidProof();
    error CredentialRegistry__BatchNotFound();
    error CredentialRegistry__Expired();
    error CredentialRegistry__NotBatchOwner();

    event BatchRegistered(bytes32 indexed merkleRoot, address indexed issuer, uint256 expiryTimestamp);
    event CredentialRevoked(bytes32 indexed leafHash, address indexed revokedBy);

    struct BatchRecord {
        address issuer;
        uint256 expiryTimestamp;
        bool isRevoked;
        string ipfsHash;
    }

    address public governanceBoard;
    mapping(bytes32 => BatchRecord) public batches;
    mapping(bytes32 => bool) public revokedLeaves;

    constructor(address _governanceBoard) {
        governanceBoard = _governanceBoard;
    }

    modifier onlyActivatedIssuer() {
        if (!IGovernanceBoard(governanceBoard).isActivatedIssuer(msg.sender)) {
            revert CredentialRegistry__NotActivatedIssuer();
        }
        _;
    }

    function registerBatch(bytes32 _merkleRoot, uint256 _expiryTimestamp, string memory _ipfsHash) public onlyActivatedIssuer {
        batches[_merkleRoot] = BatchRecord({
            issuer: msg.sender,
            expiryTimestamp: _expiryTimestamp,
            isRevoked: false,
            ipfsHash: _ipfsHash
        });

        emit BatchRegistered(_merkleRoot, msg.sender, _expiryTimestamp);
    }

    function revokeCredential(bytes32 _leafHash, bytes32 _merkleRoot) public onlyActivatedIssuer {
        if (revokedLeaves[_leafHash]) revert CredentialRegistry__AlreadyRevoked();
        if (batches[_merkleRoot].issuer == address(0)) revert CredentialRegistry__BatchNotFound();
        if (batches[_merkleRoot].issuer != msg.sender) revert CredentialRegistry__NotBatchOwner();

        revokedLeaves[_leafHash] = true;
        emit CredentialRevoked(_leafHash, msg.sender);
    }

    function verify(bytes32 _merkleRoot, bytes32 _leaf, bytes32[] calldata _proof) public view returns (bool) {
        BatchRecord memory batch = batches[_merkleRoot];

        if (batch.issuer == address(0)) revert CredentialRegistry__BatchNotFound();
        if (revokedLeaves[_leaf]) return false;
        if (batch.expiryTimestamp != 0 && block.timestamp > batch.expiryTimestamp) return false;

        return MerkleProof.verify(_proof, _merkleRoot, _leaf);
    }

    function getBatch(bytes32 _merkleRoot) public view returns (BatchRecord memory) {
        return batches[_merkleRoot];
    }

    function getIpfsHash(bytes32 _merkleRoot) public view returns (string memory) {
        return batches[_merkleRoot].ipfsHash;
    }

    function isLeafRevoked(bytes32 _leafHash) public view returns (bool) {
        return revokedLeaves[_leafHash];
    }
}