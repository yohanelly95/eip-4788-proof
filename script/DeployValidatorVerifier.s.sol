// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Script} from 'lib/forge-std/src/Script.sol';
import {console} from 'lib/forge-std/src/console.sol';
import {ValidatorVerifier} from '../src/ValidatorVerifier.sol';

contract DeployValidatorVerifier is Script {
    function run() external returns (ValidatorVerifier deployed) {
        // You can set this to any value you want
        uint256 gIndex = 1572301627719680;
        vm.startBroadcast();
        deployed = new ValidatorVerifier(gIndex);
        vm.stopBroadcast();
        console.log('ValidatorVerifier deployed at:', address(deployed));
    }
}
