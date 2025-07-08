// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Script} from 'lib/forge-std/src/Script.sol';
import {console} from 'lib/forge-std/src/console.sol';
import {BalanceContainerRootVerifier} from '../src/BalanceContainerRootVerifier.sol';

contract DeployBalanceContainerRootVerifier is Script {
    function run() external returns (BalanceContainerRootVerifier deployed) {
        // Generalized index for balance container in beacon state
        // This value is calculated from the SSZ tree structure
        // uint256 gIndexBalanceContainer = 549755813890;

        vm.startBroadcast();
        deployed = new BalanceContainerRootVerifier();
        vm.stopBroadcast();

        console.log('BalanceContainerRootVerifier deployed at:', address(deployed));
    }
}
