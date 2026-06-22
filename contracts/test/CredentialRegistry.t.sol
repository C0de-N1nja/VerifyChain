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
        registry.revokeCredential(mockLeaf);
        assertTrue(registry.isLeafRevoked(mockLeaf));
    }
}