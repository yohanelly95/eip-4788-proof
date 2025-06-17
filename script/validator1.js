import fs from 'fs';
import { ssz } from '@lodestar/types';
import { concatGindices, createProof, ProofType } from '@chainsafe/persistent-merkle-tree';

import { createClient } from './client.js';
import { toHex, verifyProof } from './utils.js';

const BeaconState = ssz.electra.BeaconState;
const BeaconBlock = ssz.electra.BeaconBlock;

// * NOTE: gIndex 393625163186355 or 41781442298035

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
    // console.log(
    //     `gen index for validator ${validatorIndex} in state view  : ${
    //         stateView.type.getPathInfo(['validators', validatorIndex]).gindex
    //     }`
    // );
    // console.log(`gen index for validator ${validatorIndex} in combined tree: ${genIndexValidatorInfo}`);

    console.log(`Generating validator info proof`);
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

    // Get balance root
    const balanceRoot = tree.getRoot(genIndexBalanceInBlock);
    console.log(`Balance root: ${toHex(balanceRoot)}`);

    console.log(`Generating balances container proof`);
    const balancesContainerProof = createProof(tree.rootNode, {
        type: ProofType.single,
        gindex: genIndexBalancesContainer,
    });

    console.log(`Generating balance proof`);
    const balanceProof = createProof(tree.rootNode, {
        type: ProofType.single,
        gindex: genIndexBalanceInBlock,
    });

    // // Sanity check: verify gIndex and proof match.
    // console.log(`Verifying proof`);
    // verifyProof(
    //     blockRoot,
    //     genIndexValidatorInfo,
    //     validatorProof.witnesses,
    //     stateView.validators.get(validatorIndex).hashTreeRoot()
    // );

    // // Since EIP-4788 stores parentRoot, we have to find the descendant block of
    // // the block from the state.
    // console.log(`Fetching block header for parentRoot: ${toHex(blockRoot)}`);
    // // FIXME this is not working for some reason. It getting for the latest slot which is the default behavior of the API.
    // const nextBlockHeaderRes = await client.beacon.getBlockHeaders({ parentRoot: blockRoot });
    // console.log(nextBlockHeaderRes);
    // if (!nextBlockHeaderRes.ok) {
    //     throw nextBlockHeaderRes.error;
    // }

    // // /** @type {import('@lodestar/types/lib/phase0/types.js').SignedBeaconBlockHeader} */
    // const nextBlockHeader = nextBlockHeaderRes.value()[0]?.header;
    // console.log(`Parent block slot ${nextBlockHeader.message.slot}`);
    // console.log(`Parent block parent root: ${toHex(nextBlockHeader.message.parentRoot)}`);
    // if (!nextBlockHeader) {
    //     throw new Error('No block to fetch timestamp from');
    // }

    return {
        blockRoot: toHex(blockRoot),
        // proof: validatorProof.witnesses.map(toHex),
        balanceContainerRoot: toHex(balanceContainerRoot),
        balancesContainerProof: balancesContainerProof.witnesses.map(toHex),
        balanceProof: balanceProof.witnesses.map(toHex),
        validatorIndex,
        validatorBalance: validatorBalance,
        validator: stateView.validators.type.elementType.toJson(stateView.validators.get(validatorIndex)),
        // timestamp: client.slotToTS(nextBlockHeader.message.slot),
        // genIndexValidatorInfo,
        genIndexBalancesContainer,
        genIndexBalanceInBlock,
    };
}

main(29300, 0).then(console.log).catch(console.error);
