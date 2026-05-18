// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GovernanceBoard {
    error GovernanceBoard__NotBoardMember();
    error GovernanceBoard__AlreadyVoted();
    error GovernanceBoard__ProposalNotFound();
    error GovernanceBoard__AlreadyActivated();
    error GovernanceBoard__InvalidTier();
    error GovernanceBoard__ProposalAlreadyExecuted();
 
    event ProposalSubmitted(uint256 indexed proposalId, address indexed institution, uint8 tier);
    event ProposalApproved(uint256 indexed proposalId, address indexed approvedBy);
    event IssuerActivated(address indexed institution, uint8 tier);
    event IssuerRevoked(address indexed institution, address indexed revokedBy);

    enum ProposalStatus {
        Pending,
        Executed,
        Cancelled
    }

    enum IssuerTier {
        None,
        Tier1,
        Tier2
    }

    struct Proposal{
        address institution;
        IssuerTier tier;
        uint8 approvalCount;
        ProposalStatus status;
        address proposedBy;
    }

    address[3] public boardMembers;
    mapping(address => bool) isBoardMember;

    uint256 proposalCount = 0;
    mapping(uint256 => Proposal) proposals;
    mapping(uint256 => mapping(address => bool)) hasVoted;
    mapping(address => IssuerTier) issuerTier;

    constructor(address _member1, address _member2, address _member3) {
        boardMembers[0] = _member1;
        boardMembers[1] = _member2;
        boardMembers[2] = _member3;
    
        isBoardMember[_member1] = true;
        isBoardMember[_member2] = true;
        isBoardMember[_member3] = true;
    }

    modifier onlyBoardMember() {
        if(!isBoardMember[msg.sender]) revert GovernanceBoard__NotBoardMember();
        _;
    }

    modifier checkTier(uint8 _tier) {
        if(_tier != 1 && _tier != 2) revert GovernanceBoard__InvalidTier();
        _;
    }

    modifier checkAlreadyActive(address _institution) {
        if(issuerTier[_institution] != IssuerTier.None) revert GovernanceBoard__AlreadyActivated();
        _;
    }

    function submitProposal(address _institution, uint8 _tier) public onlyBoardMember checkTier(_tier) checkAlreadyActive(_institution) {

        uint256 currentId = proposalCount;
        proposals[proposalCount] = Proposal({
            institution: _institution,
            tier: IssuerTier(_tier),
            approvalCount: 1,
            status: ProposalStatus.Pending,
            proposedBy: msg.sender
        });

        hasVoted[proposalCount][msg.sender] = true;
        proposalCount += 1;

        emit ProposalSubmitted(currentId, _institution, _tier);
    }
}