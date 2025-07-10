// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Script} from 'lib/forge-std/src/Script.sol';
import {console} from 'lib/forge-std/src/console.sol';
import {BalanceContainerRootVerifier} from '../src/BalanceContainerRootVerifier.sol';

contract DeployBalanceContainerRootVerifier is Script {
    function run() external returns (BalanceContainerRootVerifier deployed) {

        vm.startBroadcast();
        deployed = new BalanceContainerRootVerifier();
        vm.stopBroadcast();

        console.log('BalanceContainerRootVerifier deployed at:', address(deployed));
    }
}
