import { ssz } from '@lodestar/types';

import { createProof, ProofType } from '@chainsafe/persistent-merkle-tree';
import { createClient } from './client.js';
import { toHex, verifyProof } from './utils.js';

const BeaconBlock = ssz.electra.BeaconBlock;

/**
 * @param {string|number} slot
 * @param {number} validatorIndex
 */
async function main(slot = 'finalized', withdrawalIndex = 0) {
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
    const nav = blockView.type.getPathInfo(['body', 'executionPayload', 'withdrawals', withdrawalIndex]);
    const p = createProof(blockView.node, { type: ProofType.single, gindex: nav.gindex });

    // // Sanity check: verify gIndex and proof match.
    verifyProof(blockRoot, nav.gindex, p.witnesses, p.leaf);

    // Since EIP-4788 stores parentRoot, we have to find the descendant block of
    // the block from the state.
    const blockHeader = await client.beacon.getBlockHeaders({slot, parentRoot: blockRoot.toString() });
    if (!blockHeader.ok) {
        throw blockHeader.error;
    }
    console.log(blockHeader.value());
    
    // Create output for the Verifier contract.
    return {
        blockRoot: toHex(blockRoot),
        proof: p.witnesses.map(toHex),
        withdrawal: nav.type.toJson(blockView.body.executionPayload.withdrawals.get(withdrawalIndex)),
        withdrawalIndex: withdrawalIndex,
        ts: client.slotToTS(slot + 1),
        gI: nav.gindex,
    };
}

main(42600, 0).then(console.log).catch(console.error);
//            ^_ withdrawal index in withdrawals array
