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

    function run() external {
        address verifierAddress = address(0x0215b3a07E673Ec73FfD27834f7aB73f877E59b5);
        ValidatorVerifier verifier = ValidatorVerifier(verifierAddress);

        // Read validatorProof from proof.json
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, '/script/proof.json');
        string memory json = vm.readFile(path);
        bytes memory data = json.parseRaw('$.proof');
        bytes32[] memory validatorProof = abi.decode(data, (bytes32[]));

        SSZ.Validator memory validator = SSZ.Validator({
            pubkey: hex'962d2407ecb575d95934614a24317392512e45bd6ed9360535c6f96d9c746a63572e224cb025552c07f6992607ff9f86',
            withdrawalCredentials: 0x000c65e9f32d1e73edb60e08bce7d50843a9768129e489e02da5de1b0be18541,
            effectiveBalance: 32000000000,
            slashed: false,
            activationEligibilityEpoch: 0,
            activationEpoch: 0,
            exitEpoch: 18446744073709551615,
            withdrawableEpoch: 18446744073709551615
        });
        uint64 validatorIndex = 0;
        uint64 ts = 1750084082;

        vm.startBroadcast();
        bool result = verifier.proveValidator(validatorProof, validator, validatorIndex, ts);
        console.log('result', result);
        // The ValidatorProven event will be visible in the transaction logs
        vm.stopBroadcast();
    }
}
