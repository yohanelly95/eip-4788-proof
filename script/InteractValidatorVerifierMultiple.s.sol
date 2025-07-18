// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Script} from 'lib/forge-std/src/Script.sol';
import {ValidatorVerifier} from '../src/ValidatorVerifier.sol';
import {SSZ} from '../src/SSZ.sol';
import {stdJson} from 'forge-std/StdJson.sol';
import {Vm} from 'lib/forge-std/src/Vm.sol';
import {console} from 'forge-std/console.sol';

contract InteractValidatorVerifierMultiple is Script {
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

        string memory root = vm.projectRoot();
        string memory path = string.concat(root, '/script/test-off-chain-loop.json');
        string memory json = vm.readFile(path);

        console.log('JSON file read successfully');

        uint256 arrayLength = 10;
        console.log('Processing', arrayLength, 'validators');

        ValidatorData[] memory validatorDataArray = new ValidatorData[](arrayLength);

        for (uint256 i = 0; i < arrayLength; i++) {
            console.log('Parsing validator at index:', i);

            string memory indexStr = vm.toString(i);

            bytes32[] memory proof = abi.decode(
                vm.parseJson(json, string(abi.encodePacked('[', indexStr, '].proof'))),
                (bytes32[])
            );

            // Parse validator fields
            bytes memory pubkey = abi.decode(
                vm.parseJson(json, string(abi.encodePacked('[', indexStr, '].validator.pubkey'))),
                (bytes)
            );
            bytes32 withdrawalCredentials = abi.decode(
                vm.parseJson(json, string(abi.encodePacked('[', indexStr, '].validator.withdrawal_credentials'))),
                (bytes32)
            );
            uint64 effectiveBalance = abi.decode(
                vm.parseJson(json, string(abi.encodePacked('[', indexStr, '].validator.effective_balance'))),
                (uint64)
            );
            bool slashed = abi.decode(
                vm.parseJson(json, string(abi.encodePacked('[', indexStr, '].validator.slashed'))),
                (bool)
            );
            uint64 activationEligibilityEpoch = abi.decode(
                vm.parseJson(json, string(abi.encodePacked('[', indexStr, '].validator.activation_eligibility_epoch'))),
                (uint64)
            );
            uint64 activationEpoch = abi.decode(
                vm.parseJson(json, string(abi.encodePacked('[', indexStr, '].validator.activation_epoch'))),
                (uint64)
            );
            uint64 exitEpoch = abi.decode(
                vm.parseJson(json, string(abi.encodePacked('[', indexStr, '].validator.exit_epoch'))),
                (uint64)
            );
            uint64 withdrawableEpoch = abi.decode(
                vm.parseJson(json, string(abi.encodePacked('[', indexStr, '].validator.withdrawable_epoch'))),
                (uint64)
            );

            uint64 validatorIndex = abi.decode(
                vm.parseJson(json, string(abi.encodePacked('[', indexStr, '].validatorIndex'))),
                (uint64)
            );
            uint64 timestamp = abi.decode(
                vm.parseJson(json, string(abi.encodePacked('[', indexStr, '].timestamp'))),
                (uint64)
            );

            // Construct validator
            SSZ.Validator memory validator = SSZ.Validator({
                pubkey: pubkey,
                withdrawalCredentials: withdrawalCredentials,
                effectiveBalance: effectiveBalance,
                slashed: slashed,
                activationEligibilityEpoch: activationEligibilityEpoch,
                activationEpoch: activationEpoch,
                exitEpoch: exitEpoch,
                withdrawableEpoch: withdrawableEpoch
            });

            validatorDataArray[i] = ValidatorData({
                proof: proof,
                validator: validator,
                validatorIndex: validatorIndex,
                timestamp: timestamp
            });

            console.log('Successfully parsed validator at array index', i);
        }

        vm.startBroadcast();

        // Loop through all validator proofs
        for (uint256 i = 0; i < validatorDataArray.length; i++) {
            ValidatorData memory validatorData = validatorDataArray[i];
            
            string memory validatorIndexStr = vm.toString(uint256(validatorData.validatorIndex));
            console.log('Validator Index:', validatorIndexStr);
            
            bool result = verifier.proveValidator(
                validatorData.proof,
                validatorData.validator,
                validatorData.validatorIndex,
                validatorData.timestamp
            );

            console.log('- Verification result:', result);

            if (!result) {
                console.log('FAILED: Validator proof verification failed for index:', i);
                console.log('Validator index:', validatorIndexStr);
                // revert('Failed to verify validator');
            }
        }

        console.log('Completed verification of all validator proofs');
        vm.stopBroadcast();
    }
}
