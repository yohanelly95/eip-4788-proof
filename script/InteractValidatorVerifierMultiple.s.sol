// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Script} from 'lib/forge-std/src/Script.sol';
import {ValidatorVerifier} from '../src/ValidatorVerifier.sol';
import {SSZ} from '../src/SSZ.sol';
import {stdJson} from 'forge-std/StdJson.sol';
import {Vm} from 'lib/forge-std/src/Vm.sol';
import {console} from 'forge-std/console.sol';

contract InteractValidatorMultipleVerifier is Script {
    using stdJson for string;

    function run() external {
        address verifierAddress = address(0xf4F8a1B50c27917a20083C877721cF16535c0162);
        ValidatorVerifier verifier = ValidatorVerifier(verifierAddress);

        // Read and parse consolidated validator data from JSON
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, '/script/test-on-chain-loop.json');
        string memory json = vm.readFile(path);

        // Parse individual fields from JSON
        bytes32 blockRoot = json.readBytes32('.blockRoot');
        uint64 timestamp = uint64(json.readUint('.timestamp'));

        // Parse validator indices array
        uint64[] memory validatorIndices = abi.decode(json.parseRaw('.validatorIndices'), (uint64[]));

        // Parse proofs array
        bytes32[][] memory proofs = abi.decode(json.parseRaw('.proofs'), (bytes32[][]));

        // Parse validators array - need to handle each validator individually
        uint256 validatorCount = validatorIndices.length;
        SSZ.Validator[] memory validators = new SSZ.Validator[](validatorCount);

        for (uint256 i = 0; i < validatorCount; i++) {
            string memory validatorPath = string.concat('.validators[', vm.toString(i), ']');

            // Parse pubkey as hex string and convert to bytes
            bytes memory pubkeyBytes = vm.parseBytes(json.readString(string.concat(validatorPath, '.pubkey')));
            validators[i] = SSZ.Validator({
                pubkey: pubkeyBytes,
                withdrawalCredentials: json.readBytes32(string.concat(validatorPath, '.withdrawal_credentials')),
                effectiveBalance: uint64(json.readUint(string.concat(validatorPath, '.effective_balance'))),
                slashed: json.readBool(string.concat(validatorPath, '.slashed')),
                activationEligibilityEpoch: uint64(
                    json.readUint(string.concat(validatorPath, '.activation_eligibility_epoch'))
                ),
                activationEpoch: uint64(json.readUint(string.concat(validatorPath, '.activation_epoch'))),
                exitEpoch: uint64(json.readUint(string.concat(validatorPath, '.exit_epoch'))),
                withdrawableEpoch: uint64(json.readUint(string.concat(validatorPath, '.withdrawable_epoch')))
            });
        }

        console.log('Block root:', vm.toString(blockRoot));
        console.log('Timestamp:', vm.toString(timestamp));

        vm.startBroadcast();

        // Use proveValidators function to verify all validators at once
        bool[] memory results = verifier.proveValidators(proofs, validators, validatorIndices, timestamp);

        vm.stopBroadcast();

        // Log results
        console.log('Verification results:');
        for (uint256 i = 0; i < results.length; i++) {
            console.log('Validator index:', vm.toString(validatorIndices[i]));
            console.log('Result:', results[i]);

            if (!results[i]) {
                console.log('FAILED: Validator proof verification failed for index:', validatorIndices[i]);
            }
        }

        // Count successful verifications
        uint256 successCount = 0;
        for (uint256 i = 0; i < results.length; i++) {
            if (results[i]) {
                successCount++;
            }
        }

        console.log('Successfully verified', vm.toString(successCount));
    }
}
