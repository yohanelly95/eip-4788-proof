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
        bytes pubkey;
        bytes32 withdrawalCredentials;
        uint64 effectiveBalance;
        bool slashed;
        uint64 activationEligibilityEpoch;
        uint64 activationEpoch;
        uint64 exitEpoch;
        uint64 withdrawableEpoch;
    }

    function parseValidators(string memory json) internal pure returns (SSZ.Validator[] memory) {
        bytes[] memory pubkeys = abi.decode(json.parseRaw('.validators[*].pubkey'), (bytes[]));
        console.log('pubkeys length:', pubkeys.length);
        bytes32[] memory withdrawalCredentials = abi.decode(
            json.parseRaw('.validators[*].withdrawalCredentials'),
            (bytes32[])
        );
        console.log('withdrawalCredentials length:', withdrawalCredentials.length);
        uint64[] memory effectiveBalances = abi.decode(json.parseRaw('.validators[*].effectiveBalance'), (uint64[]));
        console.log('effectiveBalances length:', effectiveBalances.length);
        bool[] memory slashed = abi.decode(json.parseRaw('.validators[*].slashed'), (bool[]));
        console.log('slashed length:', slashed.length);
        uint64[] memory activationEligibilityEpochs = abi.decode(
            json.parseRaw('.validators[*].activationEligibilityEpoch'),
            (uint64[])
        );
        uint64[] memory activationEpochs = abi.decode(json.parseRaw('.validators[*].activationEpoch'), (uint64[]));
        uint64[] memory exitEpochs = abi.decode(json.parseRaw('.validators[*].exitEpoch'), (uint64[]));
        uint64[] memory withdrawableEpochs = abi.decode(json.parseRaw('.validators[*].withdrawableEpoch'), (uint64[]));

        SSZ.Validator[] memory validators = new SSZ.Validator[](pubkeys.length);

        for (uint i = 0; i < pubkeys.length; i++) {
            validators[i] = SSZ.Validator({
                pubkey: pubkeys[i],
                withdrawalCredentials: withdrawalCredentials[i],
                effectiveBalance: effectiveBalances[i],
                slashed: slashed[i],
                activationEligibilityEpoch: activationEligibilityEpochs[i],
                activationEpoch: activationEpochs[i],
                exitEpoch: exitEpochs[i],
                withdrawableEpoch: withdrawableEpochs[i]
            });
        }

        return validators;
    }

    function run() external {
        address verifierAddress = address(0xf4F8a1B50c27917a20083C877721cF16535c0162);

        // Check if contract is deployed at the address
        uint256 size;
        assembly {
            size := extcodesize(verifierAddress)
        }
        require(size > 0, 'ValidatorVerifier contract not deployed at specified address');

        ValidatorVerifier verifier = ValidatorVerifier(verifierAddress);

        string memory root = vm.projectRoot();
        string memory path = string.concat(root, '/script/test_1-32.json');
        string memory json = vm.readFile(path);

        // Parse proofs
        bytes32[][] memory proofs = abi.decode(json.parseRaw('.proofs'), (bytes32[][]));
        console.log('Number of proofs:', proofs.length);

        // Parse validators array - use a helper function to avoid stack too deep
        SSZ.Validator[] memory validators = parseValidators(json);
        console.log('Number of validators:', validators.length);

        // Parse validator indices
        uint64[] memory validatorIndices = abi.decode(json.parseRaw('.validatorIndices'), (uint64[]));

        // Parse timestamp
        uint64 timestamp = abi.decode(json.parseRaw('.timestamp'), (uint64));

        // Verify arrays have matching lengths
        require(
            proofs.length == validators.length && validators.length == validatorIndices.length,
            'Array lengths must match'
        );

        // vm.startBroadcast();
        bool[] memory results = verifier.proveValidators(proofs, validators, validatorIndices, timestamp);
        console.log('results length:', results.length);

        // Log results
        for (uint256 i = 0; i < results.length; i++) {
            console.log('Validator', validatorIndices[i], 'verification result:', results[i]);
        }
        // vm.stopBroadcast();
    }
}
