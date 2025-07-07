import { concatGindices, createProof, ProofType } from '@chainsafe/persistent-merkle-tree';
import { toHexString } from "@chainsafe/ssz";
import { ssz } from '@lodestar/types';
import crypto from 'crypto';
import { createClient } from './client.js';

/**
 * Complete example showing how to prepare data for all three verification types
 * using a Pectra-supporting beacon node
 * 
 * Network-specific parameters that need adjustment:
 * - beaconNodeUrl: The beacon node endpoint
 * - validatorIndices: The specific validators you want to verify
 */

// Constants matching the Solidity implementation
const BEACON_BLOCK_STATE_ROOT_GINDEX = 11;
const BEACON_STATE_VALIDATORS_GINDEX = 11;
const BEACON_STATE_BALANCES_GINDEX = 12;
const VALIDATOR_REGISTRY_LIMIT = 2n ** 40n;

class MetalayerProofGenerator {
    constructor(beaconNodeUrl) {
        this.beaconNode = beaconNodeUrl;
        // Using electra for latest fork support
        this.BeaconBlock = ssz.electra.BeaconBlock;
        this.BeaconState = ssz.electra.BeaconState;
        this.client = null; // Will be initialized when needed
    }

    async initClient() {
        if (!this.client) {
            // Set environment variable for the client
            process.env.BEACON_NODE_URL = this.beaconNode;
            this.client = await createClient();
        }
        return this.client;
    }

    /**
     * Prepare all data needed for verifyWithdrawalCredentials
     */
    async prepareValidatorCredentialProof(slot, validatorIndex) {
        console.log(`Preparing credential proof for validator ${validatorIndex} at slot ${slot}`);
        
        // 1. Fetch block
        const blockResponse = await fetch(`${this.beaconNode}/eth/v2/beacon/blocks/${slot}`);
        const blockData = await blockResponse.json();
        const blockView = this.BeaconBlock.toView(this.BeaconBlock.fromJson(blockData.data.message));
        const blockRoot = blockView.hashTreeRoot();
        
        // 2. Fetch state
        const stateResponse = await fetch(`${this.beaconNode}/eth/v2/debug/beacon/states/${slot}`, {
            headers: { 'Accept': 'application/octet-stream' }
        });
        const stateSsz = await stateResponse.arrayBuffer();
        const stateView = this.BeaconState.deserializeToView(new Uint8Array(stateSsz));
        const stateRoot = stateView.hashTreeRoot();
        
        // 3. Verify state root matches block
        if (toHexString(stateRoot) !== blockData.data.message.state_root) {
            throw new Error('State root mismatch');
        }
        
        // 4. Get validator data
        const validator = stateView.validators.get(validatorIndex);
        const validatorObj = {
            pubkey: toHexString(validator.pubkey),
            withdrawalCredentials: toHexString(validator.withdrawalCredentials),
            effectiveBalance: validator.effectiveBalance,
            slashed: validator.slashed,
            activationEligibilityEpoch: validator.activationEligibilityEpoch,
            activationEpoch: validator.activationEpoch,
            exitEpoch: validator.exitEpoch,
            withdrawableEpoch: validator.withdrawableEpoch
        };
        
        // 5. Generate state root proof
        const tree = blockView.tree.clone();
        const stateRootProof = createProof(tree.rootNode, {
            type: ProofType.single,
            gindex: BEACON_BLOCK_STATE_ROOT_GINDEX
        });
        
        // 6. Generate validator proof
        // Attach state tree to block tree
        tree.setNode(BEACON_BLOCK_STATE_ROOT_GINDEX, stateView.node);
        
        const validatorGindex = concatGindices([
            BEACON_BLOCK_STATE_ROOT_GINDEX,
            BEACON_STATE_VALIDATORS_GINDEX,
            this.calculateValidatorGindex(validatorIndex)
        ]);
        
        const validatorProof = createProof(tree.rootNode, {
            type: ProofType.single,
            gindex: validatorGindex
        });
        
        return {
            // On-chain function inputs
            beaconBlockRoot: toHexString(blockRoot),
            validatorIndex,
            validator: validatorObj,
            stateProof: stateRootProof.witnesses.map(w => toHexString(w)),
            validatorProof: validatorProof.witnesses.map(w => toHexString(w)),
            
            // Additional info
            stateRoot: toHexString(stateRoot),
            pubkeyHash: toHexString(this.sha256(validator.pubkey))
        };
    }

    /**
     * Prepare balance proofs for checkpoint
     * This is the key function for our balance verification testing
     */
    async prepareBalanceProofs(slot, validatorIndices) {
        console.log(`Preparing balance proofs for ${validatorIndices.length} validators at slot ${slot}`);
        
        // Initialize client for proper timestamp calculation
        const client = await this.initClient();
        
        // 1. Fetch block and state
        const blockResponse = await fetch(`${this.beaconNode}/eth/v2/beacon/blocks/${slot}`);
        const blockData = await blockResponse.json();
        const blockView = this.BeaconBlock.toView(this.BeaconBlock.fromJson(blockData.data.message));
        const blockRoot = blockView.hashTreeRoot();
        
        const stateResponse = await fetch(`${this.beaconNode}/eth/v2/debug/beacon/states/${slot}`, {
            headers: { 'Accept': 'application/octet-stream' }
        });
        const stateSsz = await stateResponse.arrayBuffer();
        const stateView = this.BeaconState.deserializeToView(new Uint8Array(stateSsz));
        
        // 2. Setup tree with state
        const tree = blockView.tree.clone();
        tree.setNode(BEACON_BLOCK_STATE_ROOT_GINDEX, stateView.node);
        
        // 3. Generate balance container proof (same for all validators)
        const balanceContainerGindex = concatGindices([
            BEACON_BLOCK_STATE_ROOT_GINDEX,
            BEACON_STATE_BALANCES_GINDEX
        ]);
        
        const balanceContainerProof = createProof(tree.rootNode, {
            type: ProofType.single,
            gindex: balanceContainerGindex
        });
        
        const balanceContainerRoot = stateView.balances.hashTreeRoot();
        
        // 4. Generate individual balance proofs
        const balanceProofs = [];
        const balancesView = stateView.balances;
        
        for (const validatorIndex of validatorIndices) {
            // Get validator data
            const validator = stateView.validators.get(validatorIndex);
            const pubkeyHash = toHexString(this.sha256(validator.pubkey));
            
            // Get balance and calculate leaf position
            const balance = stateView.balances.get(validatorIndex);
            const leafIndex = Math.floor(validatorIndex / 4);
            const positionInLeaf = validatorIndex % 4;
            
            // Get all 4 balances in the leaf
            const leafBalances = [];
            for (let i = 0; i < 4; i++) {
                const idx = leafIndex * 4 + i;
                if (idx < stateView.balances.length) {
                    leafBalances.push(stateView.balances.get(idx));
                } else {
                    leafBalances.push(0n);
                }
            }
            
            // Pack balances into single bytes32 (little-endian)
            const packedBalances = this.packBalances(leafBalances);
            
            // Generate proof for this balance leaf
            const balanceLeafGindex = this.calculateBalanceLeafGindex(leafIndex);
            
            // Create proof from balance container root to the packed leaf
            const balanceProof = createProof(balancesView.node, {
                type: ProofType.single,
                gindex: balanceLeafGindex
            });
            
            balanceProofs.push({
                pubkeyHash,
                currentBalanceGwei: Number(balance),
                packedBalances: toHexString(packedBalances),
                proof: balanceProof.witnesses.map(w => toHexString(w)),
                
                // Additional data for verification
                validatorIndex,
                leafIndex,
                positionInLeaf,
                allBalancesInLeaf: leafBalances.map(b => Number(b))
            });
        }
        
        return {
            beaconBlockRoot: toHexString(blockRoot),
            balanceContainerRoot: toHexString(balanceContainerRoot),
            balanceContainerProof: balanceContainerProof.witnesses.map(w => toHexString(w)),
            balanceProofs,
            slot,
            timestamp: client.slotToTS(slot) // Use client's timestamp calculation
        };
    }

    /**
     * Prepare withdrawal proof
     */
    async prepareWithdrawalProof(slot, withdrawalIndexInBlock) {
        console.log(`Preparing withdrawal proof for withdrawal ${withdrawalIndexInBlock} at slot ${slot}`);
        
        // 1. Fetch block
        const blockResponse = await fetch(`${this.beaconNode}/eth/v2/beacon/blocks/${slot}`);
        const blockData = await blockResponse.json();
        const blockView = this.BeaconBlock.toView(this.BeaconBlock.fromJson(blockData.data.message));
        const blockRoot = blockView.hashTreeRoot();
        
        // 2. Get withdrawal data
        const withdrawals = blockData.data.message.body.execution_payload.withdrawals;
        if (withdrawalIndexInBlock >= withdrawals.length) {
            throw new Error(`No withdrawal at index ${withdrawalIndexInBlock}`);
        }
        
        const withdrawal = withdrawals[withdrawalIndexInBlock];
        
        // 3. Generate withdrawal proof
        const withdrawalPath = ['body', 'executionPayload', 'withdrawals', withdrawalIndexInBlock];
        const withdrawalGindex = blockView.type.getPathInfo(withdrawalPath).gindex;
        
        const withdrawalProof = createProof(blockView.node, {
            type: ProofType.single,
            gindex: withdrawalGindex
        });
        
        return {
            beaconBlockRoot: toHexString(blockRoot),
            withdrawal: {
                index: withdrawal.index,
                validatorIndex: withdrawal.validator_index,
                address: withdrawal.address,
                amount: Number(withdrawal.amount)
            },
            withdrawalProof: withdrawalProof.witnesses.map(w => toHexString(w)),
            withdrawalIndex: withdrawalIndexInBlock,
            
            // Additional info
            slot,
            blockNumber: blockData.data.message.body.execution_payload.block_number,
            timestamp: (await this.initClient()).slotToTS(slot)
        };
    }

    /**
     * Generate balance proof data specifically for our BalanceContainerRootVerifier
     * Now matches the format from testBalanceVerification.js
     */
    async prepareBalanceVerificationData(slot, validatorIndex) {
        console.log(`Preparing balance verification data for validator ${validatorIndex} at slot ${slot}`);
        
        // Get the balance proofs
        const balanceData = await this.prepareBalanceProofs(slot, [validatorIndex]);
        const proof = balanceData.balanceProofs[0];
        
        // Format matching testBalanceVerification.js
        return {
            // Balance container verification
            balanceContainerRoot: balanceData.balanceContainerRoot,
            balanceContainerProof: balanceData.balanceContainerProof,
            
            // Individual balance verification
            validatorIndex: validatorIndex,
            leafIndex: proof.leafIndex,
            packedBalances: proof.packedBalances,
            balanceProof: proof.proof,
            
            // Additional data
            currentBalance: proof.currentBalanceGwei,
            allBalancesInLeaf: proof.allBalancesInLeaf,
            beaconBlockRoot: balanceData.beaconBlockRoot,
            slot: slot,
            timestamp: balanceData.timestamp
        };
    }

    // Helper functions
    
    calculateValidatorGindex(validatorIndex) {
        const depth = this.log2(VALIDATOR_REGISTRY_LIMIT);
        return (1n << depth) + BigInt(validatorIndex);
    }
    
    calculateBalanceLeafGindex(leafIndex) {
        // For SSZ List structure, data is at gindex 2
        const maxLeaves = VALIDATOR_REGISTRY_LIMIT / 4n;
        const depth = this.log2(maxLeaves);
        const leafGindex = (1n << depth) + BigInt(leafIndex);
        
        // Combine with gindex 2 for List data
        return concatGindices([2n, leafGindex]);
    }
    
    packBalances(balances) {
        // Pack 4 uint64 balances into bytes32 (little-endian)
        let packed = Buffer.alloc(32);
        for (let i = 0; i < 4; i++) {
            const balance = BigInt(balances[i] || 0);
            packed.writeBigUInt64LE(balance, i * 8);
        }
        return packed;
    }
    
    log2(n) {
        let result = 0n;
        let value = BigInt(n);
        while (value > 1n) {
            value = value >> 1n;
            result++;
        }
        return result;
    }
    
    sha256(data) {
        return crypto.createHash('sha256').update(data).digest();
    }
    
}

// Usage example
async function main() {
    // Network-specific configuration
    // For mainnet: 'https://beacon-node.example.com'
    // For testnet: 'http://localhost:5052' or public endpoint
    const beaconNodeUrl = 'http://138.201.157.91:4002'; // Example beacon node
    
    const proofGen = new MetalayerProofGenerator(beaconNodeUrl);
    
    try {
        // Example: Generate balance verification data for our contract
        const slot = 207000; // Example slot
        const validatorIndex = 10; // Example validator
        
        const verificationData = await proofGen.prepareBalanceVerificationData(slot, validatorIndex);
        
        // Save to JSON file for use with InteractBalanceContainerRootVerifier
        const fs = await import('fs');
        const filename = `script/balanceVerification_${validatorIndex}_${slot}.json`;
        fs.writeFileSync(filename, JSON.stringify(verificationData, null, 2));
        console.log(`Balance verification data saved to ${filename}`);
        
        // Also demonstrate full checkpoint preparation
        // const validatorIndices = [10, 11, 12]; // Example validators
        // const checkpointData = await proofGen.prepareBalanceProofs(slot, validatorIndices);
        // console.log('Checkpoint data:', checkpointData);
        
    } catch (error) {
        console.error('Error generating proofs:', error);
    }
}

// Export for use in other scripts
export { MetalayerProofGenerator };

// Run if called directly
main().catch(console.error);
// Run with node script/metalayerProofGenerator.js