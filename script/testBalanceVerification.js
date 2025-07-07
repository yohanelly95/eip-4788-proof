import { MetalayerProofGenerator } from './metalayerProofGenerator.js';
import fs from 'fs';

/**
 * 
 * Configuration for different networks:
 * 
 * MAINNET:
 * - beaconNodeUrl: 'https://beacon-node.example.com'
 * - genesisTime: 1606824023
 * - validatorIndices: Your mainnet validators
 * 
 * GOERLI (deprecated):
 * - beaconNodeUrl: 'https://goerli.beacon-node.example.com'
 * - genesisTime: 1616508000
 * 
 * SEPOLIA:
 * - beaconNodeUrl: 'https://sepolia.beacon-node.example.com'
 * - genesisTime: 1655733600
 * 
 * HOLESKY:
 * - beaconNodeUrl: 'https://holesky.beacon-node.example.com'
 * - genesisTime: 1695902400
 */

async function generateAndTestBalanceProof() {
    // Configuration - adjust these for your network
    const config = {
        beaconNodeUrl: 'http://138.201.157.91:4002', // Example beacon node
        slot: 207000,                                 // Target slot
        validatorIndex: 10,                           // Validator to verify
        outputFile: 'balanceVerification_test.json'  // Output filename
    };

    console.log('Generating balance verification proof...');
    console.log('Configuration:', config);

    const proofGen = new MetalayerProofGenerator(config.beaconNodeUrl);

    try {
        // 1. Generate the balance proof data
        console.log('\n1. Fetching beacon state and generating proofs...');
        const balanceData = await proofGen.prepareBalanceProofs(config.slot, [config.validatorIndex]);
        const proof = balanceData.balanceProofs[0];

        console.log('\n2. Balance proof generated:');
        console.log('   - Validator Index:', config.validatorIndex);
        console.log('   - Current Balance:', proof.currentBalanceGwei / 1e9, 'ETH');
        console.log('   - Leaf Index:', proof.leafIndex);
        console.log('   - Position in Leaf:', proof.positionInLeaf);
        console.log('   - Packed Balances:', proof.packedBalances);
        console.log('   - Proof Length:', proof.proof.length);

        // 2. Format for our contract testing
        const contractData = {
            // Balance container verification
            balanceContainerRoot: balanceData.balanceContainerRoot,
            balanceContainerProof: balanceData.balanceContainerProof,
            
            // Individual balance verification
            validatorIndex: config.validatorIndex,
            leafIndex: proof.leafIndex,
            packedBalances: proof.packedBalances,
            balanceProof: proof.proof,
            
            // Additional data
            currentBalance: proof.currentBalanceGwei,
            allBalancesInLeaf: proof.allBalancesInLeaf,
            beaconBlockRoot: balanceData.beaconBlockRoot,
            slot: config.slot,
            timestamp: balanceData.timestamp
        };

        // 3. Save to file
        fs.writeFileSync(config.outputFile, JSON.stringify(contractData, null, 2));
        console.log(`\n3. Contract test data saved to ${config.outputFile}`);

        // 4. Generate Solidity test code
        console.log('\n4. Solidity test code for this data:');
        console.log(generateSolidityTest(contractData));

        // 5. Also save in the format expected by InteractBalanceContainerRootVerifier
        const interactFormat = {
            "$0__proof": proof.proof.join(''),
            "$1__balanceContainerRoot": balanceData.balanceContainerRoot,
            "$2__balanceProof": {
                "$0__pubkeyHash": proof.pubkeyHash,
                "$1__balanceRoot": proof.packedBalances,
                "$2__proof": proof.proof.join('')
            },
            "$3__validatorIndex": config.validatorIndex,
            "$4__validatorBalance": proof.currentBalanceGwei,
            "$5__slot": config.slot,
            "$6__ts": balanceData.timestamp
        };

        const interactFile = `balanceContainerRoot_${config.validatorIndex}_${config.slot}.json`;
        fs.writeFileSync(`script/${interactFile}`, JSON.stringify(interactFormat, null, 2));
        console.log(`\n5. InteractBalanceContainerRootVerifier format saved to script/${interactFile}`);

        return contractData;

    } catch (error) {
        console.error('Error generating balance proof:', error);
        throw error;
    }
}

function generateSolidityTest(data) {
    return `
// Test function for BalanceContainerRootVerifier
function testBalanceVerification() public {
    BalanceContainerRootVerifier verifier = BalanceContainerRootVerifier(VERIFIER_ADDRESS);
    
    // Test data
    bytes32 balanceContainerRoot = ${data.balanceContainerRoot};
    bytes32 packedBalances = ${data.packedBalances};
    uint256 leafIndex = ${data.leafIndex};
    
    // Proof array
    bytes32[] memory proof = new bytes32[](${data.balanceProof.length});
    ${data.balanceProof.map((p, i) => `proof[${i}] = ${p};`).join('\n    ')}
    
    // Verify the balance
    bool isValid = verifier.verifyBalance(
        proof,
        packedBalances,
        balanceContainerRoot,
        leafIndex
    );
    
    require(isValid, "Balance verification failed");
    console.log("Balance verification successful!");
    
    // Extract individual balance
    uint8 position = uint8(${data.validatorIndex} % 4);
    uint64 extractedBalance = verifier.extractBalance(packedBalances, position);
    console.log("Extracted balance:", extractedBalance);
    require(extractedBalance == ${data.currentBalance}, "Balance mismatch");
}`;
}

// Additional test functions

async function testMultipleValidators() {
    console.log('\nTesting multiple validators in same checkpoint...');
    
    const config = {
        beaconNodeUrl: 'http://138.201.157.91:4002',
        slot: 114999,
        validatorIndices: [10, 11, 12, 100, 101, 102] // Mix of same and different leaves
    };

    const proofGen = new MetalayerProofGenerator(config.beaconNodeUrl);
    
    try {
        const balanceData = await proofGen.prepareBalanceProofs(config.slot, config.validatorIndices);
        
        // Group by leaf index
        const leafGroups = {};
        for (const proof of balanceData.balanceProofs) {
            const leafIdx = proof.leafIndex;
            if (!leafGroups[leafIdx]) {
                leafGroups[leafIdx] = [];
            }
            leafGroups[leafIdx].push(proof);
        }

        console.log('\nValidators grouped by leaf:');
        for (const [leafIdx, proofs] of Object.entries(leafGroups)) {
            console.log(`\nLeaf ${leafIdx}:`);
            for (const proof of proofs) {
                console.log(`  - Validator ${proof.validatorIndex}: ${proof.currentBalanceGwei / 1e9} ETH (position ${proof.positionInLeaf})`);
            }
            console.log(`  - Packed balances: ${proofs[0].packedBalances}`);
        }

        // Save grouped data
        fs.writeFileSync('multipleValidators_test.json', JSON.stringify({
            balanceContainerRoot: balanceData.balanceContainerRoot,
            balanceContainerProof: balanceData.balanceContainerProof,
            leafGroups: leafGroups
        }, null, 2));

        console.log('\nMultiple validator test data saved to multipleValidators_test.json');

    } catch (error) {
        console.error('Error testing multiple validators:', error);
    }
}

// Main execution
async function main() {
    console.log('Metalayer Balance Verification Test Script');
    console.log('==========================================\n');

    try {
        // Test 1: Single validator
        await generateAndTestBalanceProof();

        // Test 2: Multiple validators (uncomment to run)
        // await testMultipleValidators();

        console.log('\n✅ All tests completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}