import fs from 'fs';
import { ssz } from '@lodestar/types';
import { concatGindices, createProof, ProofType } from '@chainsafe/persistent-merkle-tree';

import { createClient } from './client.js';
import { toHex, verifyProof } from './utils.js';

const BeaconState = ssz.electra.BeaconState;
const BeaconBlock = ssz.electra.BeaconBlock;

/**
 * @param {string|number} slot
 * @param {number} validatorIndex
 */
async function main(slot = 'finalized', validatorIndex = 0) {
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
    const stateFilename = `beaconstate_${slot}.ssz`;
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

    // Read the validator's balance from the state
    const validatorBalance = stateView.balances.get(validatorIndex);
    console.log(`Validator ${validatorIndex} balance: ${validatorBalance}`);

    /** @type {import('@chainsafe/persistent-merkle-tree').Tree} */
    const tree = blockView.tree.clone();
    const stateRootGIndex = blockView.type.getPropertyGindex('stateRoot');
    console.log({ stateRootGIndex });
    // Patching the tree by attaching the state in the `stateRoot` field of the block.
    tree.setNode(stateRootGIndex, stateView.node);

    // Create a proof for the state of the validator against the block.
    const genIndexValidatorInfo = concatGindices([
        blockView.type.getPathInfo(['stateRoot']).gindex,
        stateView.type.getPathInfo(['validators', validatorIndex]).gindex,
    ]);
    console.log(`State root gen index in block view: ${stateRootGIndex}`);
    console.log({ genIndexValidatorInfo });

    const validatorProof = createProof(tree.rootNode, { type: ProofType.single, gindex: genIndexValidatorInfo });
    console.log(validatorProof.witnesses.map(toHex));

    // Get the balance container root from the state view.
    const balanceContainerRoot = stateView.balances.hashTreeRoot();
    console.log(`Balance container root: ${toHex(balanceContainerRoot)}`);

    console.log(`gen index for state root: ${blockView.type.getPathInfo(['stateRoot']).gindex}`);
    console.log(`gen index for balances container in state: ${stateView.type.getPathInfo(['balances']).gindex}`);
    const genIndexBalancesContainer = concatGindices([
        blockView.type.getPathInfo(['stateRoot']).gindex,
        stateView.type.getPathInfo(['balances']).gindex,
    ]);
    console.log(`gen index for balances container in block: ${genIndexBalancesContainer}`);

    console.log(
        `gen index for validator ${validatorIndex} balance in state: ${
            stateView.type.getPathInfo(['balances', validatorIndex]).gindex
        }`
    );
    const genIndexBalanceInBlock = concatGindices([
        blockView.type.getPathInfo(['stateRoot']).gindex,
        stateView.type.getPathInfo(['balances', validatorIndex]).gindex,
    ]);
    console.log(`gen index for validator ${validatorIndex} balance in block: ${genIndexBalanceInBlock}`);
    const balancesTree = tree.getSubtree(genIndexBalancesContainer);
    console.log(`Balances sub tree root: ${toHex(balancesTree.root)}`);

    // * save data to json file
    let data = transformValidatorData(validatorProof, stateView, validatorIndex, slot, client);
    let json = JSON.stringify(data, null, 2);
    // * remove the quote from the value corresponding to 6__exit_epoch and 7__withdrawable_epoch
    json = json
        .replace(/"\$6__exit_epoch":\s*"(\d{20})"/, '"$6__exit_epoch": $1')
        .replace(/"\$7__withdrawable_epoch":\s*"(\d{20})"/, '"$7__withdrawable_epoch": $1');
    fs.writeFileSync(`validator_${validatorIndex}_${slot}.json`, json);

    return {
        blockRoot: toHex(blockRoot),
        proof: validatorProof.witnesses.map(toHex),
        balanceContainerRoot: toHex(balanceContainerRoot),
        // balancesContainerProof: balancesContainerProof.witnesses.map(toHex),
        // balanceProof: balanceProof.witnesses.map(toHex),
        validatorIndex,
        validatorBalance: validatorBalance,
        validator: stateView.validators.type.elementType.toJson(stateView.validators.get(validatorIndex)),
        // timestamp: client.slotToTS(nextBlockHeader.message.slot),
        // genIndexValidatorInfo,
        genIndexBalancesContainer,
        genIndexBalanceInBlock,
        timestamp: client.slotToTS(slot + 1),
    };
}

function transformValidatorData(validatorProof, stateView, validatorIndex, slot, client) {
    const validator = stateView.validators.type.elementType.toJson(stateView.validators.get(validatorIndex));

    return {
        $0__proof: validatorProof.witnesses.map(toHex),
        $1__validator: {
            $0__pubkey: validator.pubkey,
            $1__withdrawal_credentials: validator.withdrawal_credentials,
            $2__effective_balance: Number(validator.effective_balance),
            $3__slashed: validator.slashed,
            $4__activation_eligibility_epoch: Number(validator.activation_eligibility_epoch),
            $5__activation_epoch: Number(validator.activation_epoch),
            $6__exit_epoch: validator.exit_epoch,
            $7__withdrawable_epoch: validator.withdrawable_epoch,
        },
        $2__validatorIndex: validatorIndex,
        $3__timestamp: client.slotToTS(slot + 1),
    };
}

main(42600, 2).then(console.log).catch(console.error);
