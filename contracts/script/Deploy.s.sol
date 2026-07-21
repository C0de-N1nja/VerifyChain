// script/Deploy.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/GovernanceBoard.sol";
import "../src/CredentialRegistry.sol";

contract Deploy is Script {
    function run() external returns (GovernanceBoard, CredentialRegistry) {
        address member1 = vm.envAddress("BOARD_MEMBER_1");
        address member2 = vm.envAddress("BOARD_MEMBER_2");
        address member3 = vm.envAddress("BOARD_MEMBER_3");

        vm.startBroadcast();
        GovernanceBoard board = new GovernanceBoard(member1, member2, member3);
        CredentialRegistry registry = new CredentialRegistry(address(board));
        vm.stopBroadcast();

        console2.log("GovernanceBoard:", address(board));
        console2.log("CredentialRegistry:", address(registry));
        return (board, registry);
    }
}