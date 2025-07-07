// import { createProof, ProofType } from "@chainsafe/persistent-merkle-tree";
// import { toHexString } from "@chainsafe/ssz";
// import { ssz } from "@lodestar/types";
// import fs from 'fs';
// import { createClient } from "./client.js";

// async function getBalanceProofData(beaconNodeUrl, slot, validatorIndex) {
//   // 1. Get beacon block header to find state root
//   const headerResponse = await fetch(
//     `${beaconNodeUrl}/eth/v1/beacon/headers/${slot}`
//   );
//   const headerData = await headerResponse.json();
//   console.log(headerData);
//   const beaconBlockRoot = headerData.data.root;
//   const stateRoot = headerData.data.header.message.state_root;
//   console.log(beaconBlockRoot, stateRoot);

//   // 2. Get full beacon state
//   const stateResponse = await fetch(
//     `${beaconNodeUrl}/eth/v2/debug/beacon/states/${slot}`
//   );
//   const stateData = await stateResponse.json();
  
//   // 3. Parse state and get balances
//   const state = ssz.electra.BeaconState.fromJson(stateData.data);
//   const balances = state.balances;
//   const validator = state.validators[validatorIndex];
//   const pubkey = toHexString(validator.pubkey);
  
//   // 4. Create the balance container root
//   const balanceContainerRoot = ssz.phase0.Balances.hashTreeRoot(balances);
//   console.log("balanceContainerRoot");
//   console.log(toHexString(balanceContainerRoot));
//   // 5. Group balances by 4 (as the contract expects)
//   const balanceIndex = Math.floor(validatorIndex / 4);
//   const balancePosition = validatorIndex % 4;
//   console.log("balanceIndex, balancePosition");
//   console.log(balanceIndex, balancePosition);
//   // 6. Create the balance root for this group of 4
//   const startIdx = balanceIndex * 4;
//   const balanceGroup = [
//     balances[startIdx] || 0n,
//     balances[startIdx + 1] || 0n,
//     balances[startIdx + 2] || 0n,
//     balances[startIdx + 3] || 0n
//   ];
//   console.log("balanceGroup");
//   console.log(balanceGroup);
//   // Pack into single bytes32 (little-endian)
//   const balanceRoot = packBalances(balanceGroup);
//   console.log("balanceRoot");
//   console.log(balanceRoot);
//   // 7. Generate merkle proof
//   const proof = generateBalanceProof(state, validatorIndex);
//   console.log("proof");
//   console.log(proof);
//   return {
//     balanceContainerRoot: toHexString(balanceContainerRoot),
//     balanceProof: {
//       pubkeyHash: pubkey,
//       balanceRoot: balanceRoot,
//       proof: proof
//     },
//     validatorBalance: balances[validatorIndex]
//   };
// }

// // Helper function to pack 4 balances into a single bytes32
// function packBalances(balances) {
//   let packed = 0n;
//   for (let i = 0; i < 4; i++) {
//     packed |= BigInt(balances[i]) << BigInt(i * 64);
//   }
//   return '0x' + packed.toString(16).padStart(64, '0');
// }

// function generateBalanceProof(beaconState, validatorIndex) {
//     // Calculate which leaf this validator belongs to (4 balances per leaf)
//     const leafIndex = Math.floor(validatorIndex / 4);
    
//     // Create the SSZ tree view for balances
//     const balancesView = ssz.phase0.Balances.toView(beaconState.balances);
    
//     // Get the gindex for the balance leaf in the balance container
//     // In SSZ, balances are in a List[uint64, 2**40] which has a specific structure
//     // The balance container has BALANCE_TREE_HEIGHT = 38, plus 1 for length = 39 levels
//     const balanceTreeHeight = 38;
//     const expectedProofLength = balanceTreeHeight + 1; // 39 levels
    
//     // Generate proof from the balances container root to the specific balance leaf
//     // We need to get the proof that shows this packed balance exists in the container
//     const pathInfo = balancesView.type.getPathInfo([leafIndex * 4]);
//     console.log("Path info for balance leaf:", pathInfo);
//     console.log("Expected gindex depth:", expectedProofLength);
    
//     // Generate the proof from the balances root
//     const proof = createProof(balancesView.node, {
//       type: ProofType.single,
//       gindex: pathInfo.gindex
//     });
    
//     console.log("Generated proof witnesses:", proof.witnesses.length);
//     console.log("Expected proof length:", expectedProofLength);
    
//     // The proof should be exactly 39 witnesses for BALANCE_TREE_HEIGHT + 1
//     // If not, we need to adjust or pad the proof
//     let witnesses = proof.witnesses;
    
//     // Convert witnesses to hex strings
//     const witnessHashes = witnesses.map(witness => 
//       toHexString(witness)
//     );
    
//     console.log("witnessHashes length:", witnessHashes.length);
//     console.log("witnessHashes");
//     console.log(witnessHashes);
    
//     // Ensure we have exactly the expected number of witnesses
//     if (witnessHashes.length !== expectedProofLength) {
//       console.warn(`Warning: Proof length mismatch. Expected ${expectedProofLength}, got ${witnessHashes.length}`);
      
//       // Truncate or pad as needed
//       if (witnessHashes.length > expectedProofLength) {
//         witnesses = witnesses.slice(0, expectedProofLength);
//         console.log("Truncated proof to expected length");
//       } else {
//         // Pad with zeros if needed (though this shouldn't normally happen)
//         while (witnessHashes.length < expectedProofLength) {
//           witnessHashes.push('0x0000000000000000000000000000000000000000000000000000000000000000');
//         }
//         console.log("Padded proof to expected length");
//       }
//     }
    
//     // Format as concatenated hex string for the contract (each witness is 32 bytes)
//     const formattedProof = '0x' + witnessHashes.slice(0, expectedProofLength).map(hash => 
//       hash.slice(2) // Remove '0x' prefix
//     ).join('');
    
//     // Verify the final proof length is correct (should be 32 * 39 = 1248 bytes + 2 for '0x')
//     const expectedBytes = expectedProofLength * 32 * 2 + 2; // 32 bytes * 2 hex chars per byte + '0x'
//     console.log(`Final proof length: ${formattedProof.length} characters (expected: ${expectedBytes})`);
    
//     return formattedProof;
//   }



// // Main function to get balance proof data and save to JSON
// async function main(slot, validatorIndex) {
//     const data = await getBalanceProofData('http://138.201.157.91:4002', slot, validatorIndex);
//     const client = await createClient();
//     // Transform data for JSON output similar to validator.js
//     const jsonData = {
//         $0__proof: data.balanceProof.proof,
//         $1__balanceContainerRoot: data.balanceContainerRoot,
//         $2__balanceProof: {
//             $0__pubkeyHash: data.balanceProof.pubkeyHash,
//             $1__balanceRoot: data.balanceProof.balanceRoot,
//             $2__proof: data.balanceProof.proof
//         },
//         $3__validatorIndex: validatorIndex,
//         $4__validatorBalance: Number(data.validatorBalance),
//         $5__slot: slot,
//         $6__ts: client.slotToTS(slot + 1)
//     };
    
//     // Write to JSON file
//     const filename = `balanceContainerRoot_${validatorIndex}_${slot}.json`;
//     fs.writeFileSync(filename, JSON.stringify(jsonData, null, 2));
//     console.log(`Balance proof data saved to ${filename}`);
    
//     return data;
// }

// main(114999, 10).then(console.log).catch(console.error);