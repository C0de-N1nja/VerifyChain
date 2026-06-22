// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/GovernanceBoard.sol";

contract GovernanceBoardTest is Test {
    GovernanceBoard public board;
    address public member1 = address(0x1);
    address public member2 = address(0x2);
    address public member3 = address(0x3);
    address public nonMember = address(0x4);
    address public institution = address(0x5);

    function setUp() public {
        board = new GovernanceBoard(member1, member2, member3);
    }

    function test_ConstructorSetsBoardMembers() public view {
        assertTrue(board.isGovernanceMember(member1));
        assertTrue(board.isGovernanceMember(member2));
        assertTrue(board.isGovernanceMember(member3));
        assertFalse(board.isGovernanceMember(nonMember));
    }

    function test_SubmitProposalByMember() public {
        vm.prank(member1);
        board.submitProposal(institution, 1);
        
        GovernanceBoard.Proposal memory prop = board.getProposal(0);
        assertEq(prop.institution, institution);
        assertEq(uint8(prop.tier), 1);
        assertEq(prop.approvalCount, 1);
    }

    function test_RevertWhen_SubmitProposalByNonMember() public {
        vm.prank(nonMember);
        vm.expectRevert(GovernanceBoard.GovernanceBoard__NotBoardMember.selector);
        board.submitProposal(institution, 1);
    }

    function test_ApproveProposalReachesQuorum() public {
        vm.prank(member1);
        board.submitProposal(institution, 1);

        vm.prank(member2);
        board.approveProposal(0);

        assertTrue(board.isActivatedIssuer(institution));
        assertEq(uint8(board.getIssuerTier(institution)), 1);
    }

    function test_RevertWhen_AlreadyVoted() public {
        vm.startPrank(member1);
        board.submitProposal(institution, 1);
        
        vm.expectRevert(GovernanceBoard.GovernanceBoard__AlreadyVoted.selector);
        board.approveProposal(0);
        vm.stopPrank();
    }

    function test_RevokeIssuer() public {
        vm.prank(member1);
        board.submitProposal(institution, 1);
        vm.prank(member2);
        board.approveProposal(0);
        assertTrue(board.isActivatedIssuer(institution));

        vm.prank(member1);
        board.revokeIssuer(institution);

        assertFalse(board.isActivatedIssuer(institution));
        assertEq(uint8(board.getIssuerTier(institution)), 0);
    }
}