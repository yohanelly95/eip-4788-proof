// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Script} from 'lib/forge-std/src/Script.sol';
import {ValidatorVerifier} from '../src/ValidatorVerifier.sol';
import {SSZ} from '../src/SSZ.sol';
import {stdJson} from 'forge-std/StdJson.sol';
import {Vm} from 'lib/forge-std/src/Vm.sol';
import {console} from 'forge-std/console.sol';

contract InteractValidatorVerifier is Script {
    using stdJson for string;

    struct ValidatorData {
        bytes32[] proof;
        SSZ.Validator validator;
        uint64 validatorIndex;
        uint64 timestamp;
    }

    function run() external {
        address verifierAddress = address(0x7a56A2B85915ef4DcB4B8a4112C12A75919359d9);
        ValidatorVerifier verifier = ValidatorVerifier(verifierAddress);

        // Read and parse validator data from JSON
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, '/script/validator_9_42600.json');
        string memory json = vm.readFile(path);
        bytes memory data = json.parseRaw('$');
        ValidatorData memory validatorData = abi.decode(data, (ValidatorData));

        // vm.startBroadcast();
        bool result = verifier.proveValidator(
            validatorData.proof,
            validatorData.validator,
            validatorData.validatorIndex,
            validatorData.timestamp
        );
        console.log('result', result);
        // The ValidatorProven event will be visible in the transaction logs
        // vm.stopBroadcast();
    }
}
