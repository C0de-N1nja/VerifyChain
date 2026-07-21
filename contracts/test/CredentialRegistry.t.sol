// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/CredentialRegistry.sol";
import "../src/GovernanceBoard.sol";

contract CredentialRegistryTest is Test {
    GovernanceBoard public board;
    CredentialRegistry public registry;

    address public member1 = address(0x1);
    address public member2 = address(0x2);
    address public member3 = address(0x3);
    address public issuer = address(0x5);

    bytes32 public mockRoot = bytes32(uint256(0xabc));
    bytes32 public mockLeaf = bytes32(uint256(0x123));

    function setUp() public {
        board = new GovernanceBoard(member1, member2, member3);
        registry = new CredentialRegistry(address(board));

        vm.prank(member1);
        board.submitProposal(issuer, 1);
        vm.prank(member2);
        board.approveProposal(0);
    }

    function test_RegisterBatchAsActiveIssuer() public {
        vm.prank(issuer);
        registry.registerBatch(mockRoot, 0);

        CredentialRegistry.BatchRecord memory batch = registry.getBatch(mockRoot);
        assertEq(batch.issuer, issuer);
        assertEq(batch.expiryTimestamp, 0);
    }

    function test_RevertWhen_RegisterBatchAsNonIssuer() public {
        vm.prank(address(0x999));
        vm.expectRevert(CredentialRegistry.CredentialRegistry__NotActivatedIssuer.selector);
        registry.registerBatch(mockRoot, 0);
    }

    function test_RevokeCredential() public {
        vm.prank(issuer);
        registry.registerBatch(mockRoot, 0);

        vm.prank(issuer);
        registry.revokeCredential(mockLeaf, mockRoot);
        assertTrue(registry.isLeafRevoked(mockLeaf));
    }

    function test_RevertWhen_RevokeBatchNotFound() public {
        vm.prank(issuer);
        vm.expectRevert(CredentialRegistry.CredentialRegistry__BatchNotFound.selector);
        registry.revokeCredential(mockLeaf, bytes32(uint256(0xdead)));
    }

    function _hashPair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b
            ? keccak256(abi.encodePacked(a, b))
            : keccak256(abi.encodePacked(b, a));
    }

    function test_VerifyValidProofSucceeds() public {
        bytes32 leaf0 = keccak256(abi.encodePacked("credential-0"));
        bytes32 leaf1 = keccak256(abi.encodePacked("credential-1"));
        bytes32 leaf2 = keccak256(abi.encodePacked("credential-2"));
        bytes32 leaf3 = keccak256(abi.encodePacked("credential-3"));

        bytes32 h01 = _hashPair(leaf0, leaf1);
        bytes32 h23 = _hashPair(leaf2, leaf3);
        bytes32 root = _hashPair(h01, h23);

        vm.prank(issuer);
        registry.registerBatch(root, 0);

        bytes32[] memory proof = new bytes32[](2);
        proof[0] = leaf1;
        proof[1] = h23;

        bool result = registry.verify(root, leaf0, proof);
        assertTrue(result);
    }

    function test_VerifyFailsForRevokedLeaf() public {
        bytes32 leaf0 = keccak256(abi.encodePacked("credential-0"));
        bytes32 leaf1 = keccak256(abi.encodePacked("credential-1"));
        bytes32 leaf2 = keccak256(abi.encodePacked("credential-2"));
        bytes32 leaf3 = keccak256(abi.encodePacked("credential-3"));

        bytes32 h01 = _hashPair(leaf0, leaf1);
        bytes32 h23 = _hashPair(leaf2, leaf3);
        bytes32 root = _hashPair(h01, h23);

        vm.prank(issuer);
        registry.registerBatch(root, 0);

        vm.prank(issuer);
        registry.revokeCredential(leaf0, root);

        bytes32[] memory proof = new bytes32[](2);
        proof[0] = leaf1;
        proof[1] = h23;

        bool result = registry.verify(root, leaf0, proof);
        assertFalse(result);
    }

    function test_RevertWhen_VerifyBatchNotFound() public {
        bytes32[] memory emptyProof = new bytes32[](0);
        vm.expectRevert(CredentialRegistry.CredentialRegistry__BatchNotFound.selector);
        registry.verify(bytes32(uint256(0xdead)), mockLeaf, emptyProof);
    }

    function test_VerifyFailsForExpiredBatch() public {
        bytes32 root = keccak256(abi.encodePacked("expiring-batch"));

        vm.prank(issuer);
        registry.registerBatch(root, block.timestamp + 1 days);

        vm.warp(block.timestamp + 2 days);

        bytes32[] memory emptyProof = new bytes32[](0);
        bool result = registry.verify(root, root, emptyProof);
        assertFalse(result);
    }

    function test_RevertWhen_RevokeAsNonBatchOwner() public {
        vm.prank(issuer);
        registry.registerBatch(mockRoot, 0);

        address otherIssuer = address(0x6);
        vm.prank(member1);
        board.submitProposal(otherIssuer, 1);
        vm.prank(member2);
        board.approveProposal(1);

        vm.prank(otherIssuer);
        vm.expectRevert(CredentialRegistry.CredentialRegistry__NotBatchOwner.selector);
        registry.revokeCredential(mockLeaf, mockRoot);
    }
}