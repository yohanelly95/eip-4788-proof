import { createProof, ProofType } from '@chainsafe/persistent-merkle-tree';
import { ssz } from '@lodestar/types';
import fs from 'fs';
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
    const hexBlockRoot = toHex(blockRoot);
    console.log(`Beacon block root: ${hexBlockRoot}`);
    const nav = blockView.type.getPathInfo(['body', 'executionPayload', 'withdrawals', withdrawalIndex]);
    const p = createProof(blockView.node, { type: ProofType.single, gindex: nav.gindex });
    const withdrawal = nav.type.toJson(blockView.body.executionPayload.withdrawals.get(withdrawalIndex));
    // // Sanity check: verify gIndex and proof match.
    verifyProof(blockRoot, nav.gindex, p.witnesses, p.leaf);

    const data = transformWithdrawalData(hexBlockRoot, p.witnesses.map(toHex), withdrawalIndex, slot, client, withdrawal, nav.gindex);
    let json = JSON.stringify(data, null, 2);

    fs.writeFileSync(`withdrawal_${withdrawalIndex}_${slot}.json`, json);
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

function transformWithdrawalData(blockRoot, p, withdrawalIndex, slot, client, withdrawal, gIndex) {
    return {
        $0__blockRoot: blockRoot,
        $1__proof: p,
        $2__withdrawal: {
            $0__index: withdrawal.index,
            $1__validatorIndex: withdrawal.validator_index,
            $2__address: withdrawal.address,
            $3__amount: Number(withdrawal.amount),
        },
        $3__withdrawalIndex: withdrawalIndex,
        $4__ts: client.slotToTS(slot + 1),
        $5__gI: Number(gIndex),
    };
}

main(12001010, 0).then(console.log).catch(console.error);
//            ^_ withdrawal index in withdrawals array
