import { ssz } from '@lodestar/types';
import fs from 'fs';
import { createClient } from './client.js';
import { toHex } from './utils.js';
import { generateValidatorProof } from './validator.js';

const BeaconState = ssz.electra.BeaconState;
const BeaconBlock = ssz.electra.BeaconBlock;


const convertBigIntToString = (obj) => {
    if (typeof obj === "bigint") {
      return obj.toString();
    }
  
    if (Array.isArray(obj)) {
      return obj.map(convertBigIntToString);
    }
  
    if (typeof obj === "object" && obj !== null) {
      const newObj = {};
      for (const key in obj) {
        newObj[key] = convertBigIntToString(obj[key]);
      }
      return newObj;
    }
  
    return obj;
  };
/**
 * Transform validator data for API response
 * @param {any} validatorProof 
 * @param {any} stateView 
 * @param {number} validatorIndex 
 * @param {string|number} slot 
 * @param {any} client 
 */
function transformValidatorDataForAPI(validatorProof, stateView, validatorIndex, slot, client, blockRoot) {
    const validator = stateView.validators.type.elementType.toJson(stateView.validators.get(validatorIndex));
    const transformedData = {
        blockRoot: blockRoot,
        proof: validatorProof.witnesses,
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
    }
    return convertBigIntToString(transformedData);
}

// /**
//  * Generate proof for a single validator - API wrapper
//  * @param {string|number} slot 
//  * @param {number} validatorIndex 
//  */
// export async function generateValidatorProofWrapper(slot, validatorIndex) {
//     const client = await createClient();

//     const blockRes = await client.beacon.getBlockV2({ blockId: slot });
//     if (!blockRes.ok) {
//         throw blockRes.error;
//     }
//     const blockView = BeaconBlock.toView(blockRes.value().message);
//     const blockRoot = blockView.hashTreeRoot();
//     console.log(`Beacon block root: ${toHex(blockRoot)}`);

//     // Read the state from a local file or fetch it from the beacon node.
//     let stateSsz;
//     const stateFilename = `state/beaconstate_${slot}.ssz`;
//     if (fs.existsSync(stateFilename)) {
//         console.log(`Loading state from file ${stateFilename}`);
//         stateSsz = fs.readFileSync(stateFilename);
//     } else {
//         console.log(`Fetching state for slot ${slot} from the beacon node`);
//         const stateRes = await client.debug.getStateV2({ stateId: slot }, 'ssz');
//         if (!stateRes.ok) {
//             throw stateRes.error;
//         }

//         // Ensure state directory exists
//         if (!fs.existsSync('state')) {
//             fs.mkdirSync('state');
//         }
        
//         fs.writeFileSync(stateFilename, stateRes.ssz());
//         stateSsz = stateRes.ssz();
//     }

//     const stateView = BeaconState.deserializeToView(stateSsz);
//     const stateRoot = stateView.hashTreeRoot();
//     console.log(`State root: ${toHex(stateRoot)}`);

//     const tree = blockView.tree.clone();
//     const stateRootGIndex = blockView.type.getPropertyGindex('stateRoot');
    
//     // Patching the tree by attaching the state in the `stateRoot` field of the block.
//     tree.setNode(stateRootGIndex, stateView.node);

//     // Generate the proof
//     const proofData = generateValidatorProof(tree, blockView, stateView, validatorIndex, slot, client);
//     // Transform for API response (ensure all BigInt values are converted to strings)
//     const data =  transformValidatorDataForAPI(
//         { witnesses: proofData.proof },
//         stateView,
//         validatorIndex,
//         slot,
//         client,
//         proofData.blockRoot,
//     );
//     return convertBigIntToString(data);
// }

/**
 * Generate proofs for multiple validators - API wrapper
 * @param {string|number} slot 
 * @param {number[]} validatorIndexes 
 */
export async function generateMultipleValidatorProofsWrapper(slot, validatorIndexes) {
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

        // Ensure state directory exists
        if (!fs.existsSync('state')) {
            fs.mkdirSync('state');
        }
        
        fs.writeFileSync(stateFilename, stateRes.ssz());
        stateSsz = stateRes.ssz();
    }

    const stateView = BeaconState.deserializeToView(stateSsz);
    const stateRoot = stateView.hashTreeRoot();
    console.log(`State root: ${toHex(stateRoot)}`);

    const tree = blockView.tree.clone();
    const stateRootGIndex = blockView.type.getPropertyGindex('stateRoot');
    
    // Patching the tree by attaching the state in the `stateRoot` field of the block.
    tree.setNode(stateRootGIndex, stateView.node);

    // Process each validator index
    const proofs = [];
    const validators = [];
    const validatorIndices = [];
    let timestamp = null;
    
    for (const validatorIndex of validatorIndexes) {
        console.log(`\nProcessing validator ${validatorIndex}...`);
        const proofData = generateValidatorProof(tree, blockView, stateView, validatorIndex, slot, client);
        
        // Set common fields from first validator
        timestamp = client.slotToTS(slot + 1);
        
        // Collect individual arrays
        proofs.push(proofData.proof);
        
        const validator = stateView.validators.type.elementType.toJson(stateView.validators.get(validatorIndex));
        validators.push({
            pubkey: validator.pubkey,
            withdrawal_credentials: validator.withdrawal_credentials,
            effective_balance: Number(validator.effective_balance),
            slashed: validator.slashed,
            activation_eligibility_epoch: Number(validator.activation_eligibility_epoch),
            activation_epoch: Number(validator.activation_epoch),
            exit_epoch: validator.exit_epoch,
            withdrawable_epoch: validator.withdrawable_epoch,
        });
        
        validatorIndices.push(validatorIndex);
    }
    
    // Return consolidated format
    const consolidatedResult = {
        blockRoot: toHex(blockRoot),
        timestamp: timestamp,
        proofs: proofs,
        validators: validators,
        validatorIndices: validatorIndices
    };
    
    return convertBigIntToString(consolidatedResult);
}