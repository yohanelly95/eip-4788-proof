// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Script} from 'lib/forge-std/src/Script.sol';
import {BalanceContainerRootVerifier} from '../src/BalanceContainerRootVerifier.sol';
import {stdJson} from 'forge-std/StdJson.sol';
import {Vm} from 'lib/forge-std/src/Vm.sol';
import {console} from 'forge-std/console.sol';

contract InteractBalanceContainerRootVerifier is Script {
    using stdJson for string;

    function run() external {
        // Deploy or use existing verifier (update address as needed)
        address verifierAddress = address(0x5FbDB2315678afecb367f032d93F642f64180aa3); // Deployed address
        BalanceContainerRootVerifier verifier = BalanceContainerRootVerifier(verifierAddress);

        // Read and parse balance data from JSON
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, '/script/balanceVerification_10_207000.json');
        string memory json = vm.readFile(path);

        console.log('Reading balance proof data from:', path);

        // Parse JSON data using current format
        bytes32 balanceContainerRoot = json.readBytes32('.balanceContainerRoot');
        bytes32 packedBalances = json.readBytes32('.packedBalances');
        uint256 validatorIndex = json.readUint('.validatorIndex');
        uint256 leafIndex = json.readUint('.leafIndex');
        uint64 currentBalance = uint64(json.readUint('.currentBalance'));
        uint64 slot = uint64(json.readUint('.slot'));
        uint64 ts = uint64(json.readUint('.timestamp'));

        // Parse balance proof array
        bytes32[] memory balanceProofTemp = abi.decode(json.parseRaw('.balanceProof'), (bytes32[]));
        bytes32[] memory balanceProof = balanceProofTemp;

        // Parse balance container proof array
        bytes32[] memory balanceContainerProofTemp = abi.decode(json.parseRaw('.balanceContainerProof'), (bytes32[]));
        bytes32[] memory balanceContainerProof = balanceContainerProofTemp;

        console.log('Verifying balance container with data:');
        console.log('Balance Container Root:', vm.toString(balanceContainerRoot));
        console.log('Validator Index:', validatorIndex);
        console.log('Current Balance:', currentBalance);
        console.log('Packed Balances:', vm.toString(packedBalances));
        console.log('Slot:', slot);
        console.log('Timestamp:', ts);
        console.log('Leaf Index:', leafIndex);
        console.log('Balance Proof Length:', balanceProof.length);

        // Test 1: Verify the validator's balance using verifyBalance
        console.log('\n=== Testing Balance Verification ===');

        vm.startBroadcast();
        bool verifiedBalance = verifier.verifyBalance(balanceProof, packedBalances, balanceContainerRoot, leafIndex);
        console.log('Balance verification result:', verifiedBalance);
        if (!verifiedBalance) {
            console.log('ERROR: Balance verification FAILED');
            revert('Balance verification failed');
        }


        vm.stopBroadcast();

        console.log('\n=== Verification Summary ===');
        console.log('Balance verification:', verifiedBalance ? 'PASSED' : 'FAILED');
        if (verifiedBalance) {
            console.log('Successfully verified validator', validatorIndex);
        } else {
            console.log('ERROR: Balance verification FAILED');
        }
    }
}
