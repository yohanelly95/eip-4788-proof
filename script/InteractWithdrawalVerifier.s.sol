// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Script} from 'lib/forge-std/src/Script.sol';
import {WithdrawalsVerifier} from '../src/WithdrawalsVerifier.sol';
import {SSZ} from '../src/SSZ.sol';
import {stdJson} from 'forge-std/StdJson.sol';
import {Vm} from 'lib/forge-std/src/Vm.sol';
import {console} from 'forge-std/console.sol';

contract InteractWithdrawalVerifier is Script {
    using stdJson for string;

    struct WithdrawalData {
        bytes32 blockRoot;
        bytes32[] proof;
        SSZ.Withdrawal withdrawal;
        uint8 withdrawalIndex;
        uint64 ts;
        uint256 gI;
    }

    function run() external {
        // Deploy or use existing verifier (update address as needed)
        address verifierAddress = address(0x245Dfb7A8e02169710a7B8f0eC706b5a59739Bb0);
        WithdrawalsVerifier verifier = WithdrawalsVerifier(verifierAddress);

        // Read and parse withdrawal data from JSON
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, '/script/withdrawal_0_12001010.json');
        string memory json = vm.readFile(path);
        
        // Parse JSON data manually due to custom format
        bytes32 blockRoot = json.readBytes32('.$0__blockRoot');
        
        // Parse proof array
        string[] memory proofStrings = json.readStringArray('.$1__proof');
        bytes32[] memory proof = new bytes32[](proofStrings.length);
        for (uint i = 0; i < proofStrings.length; i++) {
            proof[i] = bytes32(vm.parseBytes(proofStrings[i]));
        }
        
        // Parse withdrawal data
        uint64 index = uint64(json.readUint('.$2__withdrawal.$0__index'));
        uint64 validatorIndex = uint64(json.readUint('.$2__withdrawal.$1__validatorIndex'));
        address withdrawalAddress = json.readAddress('.$2__withdrawal.$2__address');
        uint64 amount = uint64(json.readUint('.$2__withdrawal.$3__amount'));
        
        SSZ.Withdrawal memory withdrawal = SSZ.Withdrawal({
            index: index,
            validatorIndex: validatorIndex,
            _address: withdrawalAddress,
            amount: amount
        });
        
        uint8 withdrawalIndex = uint8(json.readUint('.$3__withdrawalIndex'));
        uint64 ts = uint64(json.readUint('.$4__ts'));
        uint256 gI = json.readUint('.$5__gI');

        console.log('Verifying withdrawal with data:');
        console.log('Block Root:', vm.toString(blockRoot));
        console.log('Withdrawal Index:', withdrawalIndex);
        console.log('Validator Index:', validatorIndex);
        console.log('Amount:', amount);
        console.log('Address:', withdrawalAddress);
        console.log('Timestamp:', ts);
        console.log('Generalized Index:', gI);
        console.log('Proof length:', proof.length);

        // Verify the withdrawal
        // vm.startBroadcast();
        bool result = verifier.submitWithdrawal(
            proof,
            withdrawal,
            withdrawalIndex,
            ts
        );
        console.log('Verification result:', result);
        // vm.stopBroadcast();
    }
}