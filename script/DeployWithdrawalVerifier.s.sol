// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Script} from 'lib/forge-std/src/Script.sol';
import {WithdrawalsVerifier} from '../src/WithdrawalsVerifier.sol';

contract DeployWithdrawalVerifier is Script {
    function run() external returns (WithdrawalsVerifier deployed) {
        // You can set this to any value you want
        uint256 gIndex = 206272;
        vm.startBroadcast();
        deployed = new WithdrawalsVerifier(gIndex);
        vm.stopBroadcast();
    }
}
