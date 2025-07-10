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
        string memory path = string.concat(root, '/script/validator_330_233340.json');
        string memory json = vm.readFile(path);
        
        // Parse the new JSON format without $ prefixes
        ValidatorData memory validatorData;
        validatorData.proof = json.readBytes32Array('.proof');
        validatorData.validatorIndex = uint64(json.readUint('.validatorIndex'));
        validatorData.timestamp = uint64(json.readUint('.timestamp'));
        
        // Parse validator struct
        validatorData.validator.pubkey = json.readBytes('.validator.pubkey');
        validatorData.validator.withdrawalCredentials = json.readBytes32('.validator.withdrawal_credentials');
        validatorData.validator.effectiveBalance = uint64(json.readUint('.validator.effective_balance'));
        validatorData.validator.slashed = json.readBool('.validator.slashed');
        validatorData.validator.activationEligibilityEpoch = uint64(json.readUint('.validator.activation_eligibility_epoch'));
        validatorData.validator.activationEpoch = uint64(json.readUint('.validator.activation_epoch'));
        validatorData.validator.exitEpoch = uint64(json.readUint('.validator.exit_epoch'));
        validatorData.validator.withdrawableEpoch = uint64(json.readUint('.validator.withdrawable_epoch'));
        bool result = verifier.proveValidator(
            validatorData.proof,
            validatorData.validator,
            validatorData.validatorIndex,
            validatorData.timestamp
        );
        console.log('Result:', result);
    }
}
