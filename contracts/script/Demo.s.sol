// script/Demo.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/GovernanceBoard.sol";
import "../src/CredentialRegistry.sol";

contract Demo is Script {
    uint256 constant MEMBER1_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 constant MEMBER2_PK = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    uint256 constant MEMBER3_PK = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;
    uint256 constant ISSUER_PK  = 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6;

    function run() external {
        address member1 = vm.addr(MEMBER1_PK);
        address member2 = vm.addr(MEMBER2_PK);
        address member3 = vm.addr(MEMBER3_PK);
        address issuer  = vm.addr(ISSUER_PK);

        console2.log("Board member 1:", member1);
        console2.log("Board member 2:", member2);
        console2.log("Issuer institution:", issuer);

        vm.startBroadcast(MEMBER1_PK);
        GovernanceBoard board = new GovernanceBoard(member1, member2, member3);
        CredentialRegistry registry = new CredentialRegistry(address(board));
        console2.log("GovernanceBoard deployed at:", address(board));
        console2.log("CredentialRegistry deployed at:", address(registry));

        board.submitProposal(issuer, 1);
        console2.log("Proposal submitted: issuer, tier 1");
        vm.stopBroadcast();

        vm.startBroadcast(MEMBER2_PK);
        board.approveProposal(0);
        console2.log("Approved by member2 -- 2-of-3 quorum reached");
        vm.stopBroadcast();

        console2.log("Issuer activated?", board.isActivatedIssuer(issuer));

        bytes32 leaf0 = keccak256(abi.encodePacked("credential-0"));
        bytes32 leaf1 = keccak256(abi.encodePacked("credential-1"));
        bytes32 leaf2 = keccak256(abi.encodePacked("credential-2"));
        bytes32 leaf3 = keccak256(abi.encodePacked("credential-3"));
        bytes32 h01 = _hashPair(leaf0, leaf1);
        bytes32 h23 = _hashPair(leaf2, leaf3);
        bytes32 root = _hashPair(h01, h23);

        console2.log("Computed Merkle root:");
        console2.logBytes32(root);

        vm.startBroadcast(ISSUER_PK);
        registry.registerBatch(root, 0);
        console2.log("Batch registered by issuer");
        vm.stopBroadcast();

        bytes32[] memory proof = new bytes32[](2);
        proof[0] = leaf1;
        proof[1] = h23;

        bool isValid = registry.verify(root, leaf0, proof);
        console2.log("VERIFICATION RESULT for credential-0:", isValid);
    }

    function _hashPair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b
            ? keccak256(abi.encodePacked(a, b))
            : keccak256(abi.encodePacked(b, a));
    }
}