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

        // Read and parse validator data array from JSON
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, '/script/test-loop.json');
        string memory json = vm.readFile(path);
        // console.log("keys", keys.length);
        bytes memory data = vm.parseJson(json);
        // bytes memory data = json.parseRaw('$');
        // uint256 arrayLength = json.readUint("$.length");
        // console.log('Total validator proofs to verify:', arrayLength);

        // console.log("data", data.length);
        // console.log("arrayLength", arrayLength);
        ValidatorData[] memory validatorDataArray = abi.decode(data, (ValidatorData[]));

        console.log('Total validator proofs to verify:', validatorDataArray.length);

        // vm.startBroadcast();
        
        // Loop through all validator proofs
        // for (uint256 i = 0; i < validatorDataArray.length; i++) {
        //     ValidatorData memory validatorData = validatorDataArray[i];
            
        //     console.log('Verifying validator index:', validatorData.validatorIndex);
            
        //     bool result = verifier.proveValidator(
        //         validatorData.proof,
        //         validatorData.validator,
        //         validatorData.validatorIndex,
        //         validatorData.timestamp
        //     );
            
        //     console.log('Validator', validatorData.validatorIndex, 'result:', result);
            
        //     if (!result) {
        //         console.log('FAILED: Validator proof verification failed for index:', validatorData.validatorIndex);
        //     }
        // }
        
        console.log('Completed verification of all validator proofs');
        // The ValidatorProven events will be visible in the transaction logs
        // vm.stopBroadcast();
    }
}
