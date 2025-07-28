import { concatGindices, createProof, ProofType } from '@chainsafe/persistent-merkle-tree';
import { ssz } from '@lodestar/types';
import fs from 'fs';

import { createClient } from './client.js';
import { toHex } from './utils.js';

const BeaconState = ssz.electra.BeaconState;
const BeaconBlock = ssz.electra.BeaconBlock;

/**
 * Generate proof for a single validator
 * @param {import('@chainsafe/persistent-merkle-tree').Tree} tree
 * @param {any} blockView
 * @param {any} stateView
 * @param {number} validatorIndex
 * @param {string|number} slot
 * @param {any} client
 */
export function generateValidatorProof(tree, blockView, stateView, validatorIndex, slot, client) {
    // Read the validator's balance from the state
    const validatorBalance = stateView.balances.get(validatorIndex);
    console.log(`Validator ${validatorIndex} balance: ${validatorBalance}`);

    // Create a proof for the state of the validator against the block.
    const genIndexValidatorInfo = concatGindices([
        blockView.type.getPathInfo(['stateRoot']).gindex,
        stateView.type.getPathInfo(['validators', validatorIndex]).gindex,
    ]);
    console.log({ GEN_INDEX_VALIDATOR_INFO: genIndexValidatorInfo.toString() });

    const validatorProof = createProof(tree.rootNode, { type: ProofType.single, gindex: genIndexValidatorInfo });

    // Get the balance container root from the state view.
    const balanceContainerRoot = stateView.balances.hashTreeRoot();

    const genIndexBalancesContainer = concatGindices([
        blockView.type.getPathInfo(['stateRoot']).gindex,
        stateView.type.getPathInfo(['balances']).gindex,
    ]);

    const genIndexBalanceInBlock = concatGindices([
        blockView.type.getPathInfo(['stateRoot']).gindex,
        stateView.type.getPathInfo(['balances', validatorIndex]).gindex,
    ]);

    // Save data to json file
    // let data = transformValidatorData(validatorProof, stateView, validatorIndex, slot, client);
    // let json = JSON.stringify(data, null, 2);
    // // Remove the quote from the value corresponding to exit_epoch and withdrawable_epoch
    // json = json
    //     .replace(/"exit_epoch":\s*"(\d{20})"/, '"exit_epoch": $1')
    //     .replace(/"withdrawable_epoch":\s*"(\d{20})"/, '"withdrawable_epoch": $1');
    // fs.writeFileSync(`validator_${validatorIndex}_${slot}.json`, json);

    return {
        blockRoot: toHex(tree.rootNode.root),
        proof: validatorProof.witnesses.map(toHex),
        balanceContainerRoot: toHex(balanceContainerRoot),
        validatorIndex,
        validatorBalance: validatorBalance,
        validator: stateView.validators.type.elementType.toJson(stateView.validators.get(validatorIndex)),
        genIndexBalancesContainer,
        genIndexBalanceInBlock,
        timestamp: client.slotToTS(slot + 1),
    };
}

/**
 * @param {string|number} slot
 * @param {number[]} validatorIndexes
 */
export async function main(slot = 'finalized', validatorIndexes = [0]) {
    const client = await createClient();

    // Get the beacon block for the slot from the beacon node.
    console.log(`Fetching block for slot ${slot} from the beacon node`);
    const blockRes = await client.beacon.getBlockV2({ blockId: slot });
    if (!blockRes.ok) {
        throw blockRes.error;
    }
    const blockView = BeaconBlock.toView(blockRes.value().message);
    const blockRoot = blockView.hashTreeRoot();
    console.log(`Beacon block root: ${toHex(blockRoot)}`);

    // Read the state from a local file or fetch it from the beacon node.
    let stateSsz;
    const stateFilename = `state/beaconstate_${slot}.ssz`;
    if (fs.existsSync(stateFilename)) {
        console.log(`Loading state from file ${stateFilename}`);
        stateSsz = fs.readFileSync(stateFilename);
    } else {
        console.log(`Fetching state for slot ${slot} from the beacon node`);
        const stateRes = await client.debug.getStateV2({ stateId: slot }, 'ssz');
        if (!stateRes.ok) {
            throw stateRes.error;
        }

        fs.writeFileSync(stateFilename, stateRes.ssz());
        stateSsz = stateRes.ssz();
    }

    const stateView = BeaconState.deserializeToView(stateSsz);
    const stateRoot = stateView.hashTreeRoot();
    console.log(`State root: ${toHex(stateRoot)}`);

    /** @type {import('@chainsafe/persistent-merkle-tree').Tree} */
    const tree = blockView.tree.clone();
    const stateRootGIndex = blockView.type.getPropertyGindex('stateRoot');
    console.log({ stateRootGIndex });
    console.log(`State root gen index in block view: ${stateRootGIndex}`);

    // Patching the tree by attaching the state in the `stateRoot` field of the block.
    tree.setNode(stateRootGIndex, stateView.node);

    console.log(`gen index for state root: ${blockView.type.getPathInfo(['stateRoot']).gindex}`);
    console.log(`gen index for balances container in state: ${stateView.type.getPathInfo(['balances']).gindex}`);

    // Process each validator index
    const results = [];
    for (const validatorIndex of validatorIndexes) {
        console.log(`\nProcessing validator ${validatorIndex}...`);
        const result = generateValidatorProof(tree, blockView, stateView, validatorIndex, slot, client);
        results.push(result);
    }

    return results;
}

function transformValidatorData(validatorProof, stateView, validatorIndex, slot, client) {
    const validator = stateView.validators.type.elementType.toJson(stateView.validators.get(validatorIndex));

    return {
        proof: validatorProof.witnesses.map(toHex),
        validator: {
            pubkey: validator.pubkey,
            withdrawal_credentials: validator.withdrawal_credentials,
            effective_balance: Number(validator.effective_balance),
            slashed: validator.slashed,
            activation_eligibility_epoch: Number(validator.activation_eligibility_epoch),
            activation_epoch: Number(validator.activation_epoch),
            exit_epoch: validator.exit_epoch,
            withdrawable_epoch: validator.withdrawable_epoch,
        },
        validatorIndex,
        timestamp: client.slotToTS(slot + 1),
    };
}

// // Example usage with multiple validator indexes
// main(302437, [419,420,421,422,423,424,425,426,427,428,429])
//     .then((results) => {
//         console.log(`\nGenerated proofs for ${results.length} validators`);
//         results.forEach((result, index) => {
//             console.log(`\nValidator ${result.validatorIndex}:`);
//             console.log(`- Balance: ${result.validatorBalance}`);
//             console.log(`- Proof witnesses: ${result.proof.length}`);
//         });
//     })
//     .catch(console.error);
