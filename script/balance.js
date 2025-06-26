import { Tree } from "@chainsafe/persistent-merkle-tree";
import { toHexString } from "@chainsafe/ssz";
import { ssz } from "@lodestar/types";

async function getBalanceProofData(beaconNodeUrl, slot, validatorIndex) {
  // 1. Get beacon block header to find state root
  const headerResponse = await fetch(
    `${beaconNodeUrl}/eth/v1/beacon/headers/${slot}`
  );
  const headerData = await headerResponse.json();
  console.log(headerData);
  const beaconBlockRoot = headerData.data.root;
  const stateRoot = headerData.data.header.message.state_root;
  console.log(beaconBlockRoot, stateRoot);

  // 2. Get full beacon state
  const stateResponse = await fetch(
    `${beaconNodeUrl}/eth/v2/debug/beacon/states/${slot}`
  );
  const stateData = await stateResponse.json();
  
  // 3. Parse state and get balances
  const state = ssz.electra.BeaconState.fromJson(stateData.data);
  const balances = state.balances;
  
  // 4. Create the balance container root
  const balanceContainerRoot = ssz.phase0.Balances.hashTreeRoot(balances);
  console.log("balanceContainerRoot");
  console.log(toHexString(balanceContainerRoot));
  // 5. Group balances by 4 (as the contract expects)
  const balanceIndex = Math.floor(validatorIndex / 4);
  const balancePosition = validatorIndex % 4;
  console.log("balanceIndex, balancePosition");
  console.log(balanceIndex, balancePosition);
  // 6. Create the balance root for this group of 4
  const startIdx = balanceIndex * 4;
  const balanceGroup = [
    balances[startIdx] || 0n,
    balances[startIdx + 1] || 0n,
    balances[startIdx + 2] || 0n,
    balances[startIdx + 3] || 0n
  ];
  console.log("balanceGroup");
  console.log(balanceGroup);
  // Pack into single bytes32 (little-endian)
  const balanceRoot = packBalances(balanceGroup);
  console.log("balanceRoot");
  console.log(balanceRoot);
  // 7. Generate merkle proof
  const proof = generateBalanceProof(state, validatorIndex);
  console.log("proof");
  console.log(proof);
  return {
    balanceContainerRoot: toHexString(balanceContainerRoot),
    balanceProof: {
      pubkeyHash: "0x...", // You need to calculate this separately
      balanceRoot: balanceRoot,
      proof: proof
    },
    validatorBalance: balances[validatorIndex]
  };
}

// Helper function to pack 4 balances into a single bytes32
function packBalances(balances) {
  let packed = 0n;
  for (let i = 0; i < 4; i++) {
    packed |= BigInt(balances[i]) << BigInt(i * 64);
  }
  return '0x' + packed.toString(16).padStart(64, '0');
}

function generateBalanceProof(beaconState, validatorIndex) {
    // Calculate which leaf this validator belongs to
    const leafIndex = Math.floor(validatorIndex / 4);
    
    // Create the SSZ tree view
    const balancesView = ssz.phase0.Balances.toView(beaconState.balances);
    
    // For SSZ List[uint64], the tree structure includes length mixing
    // The actual balance leaves start at a specific depth
    const balanceCount = beaconState.balances.length;
    const leavesCount = Math.ceil(balanceCount / 4); // 4 balances per leaf
    
    // Calculate the correct gindex for the packed balance leaf
    // In SSZ, List types have the length mixed at the root, so we need to
    // navigate to the actual data subtree
    const treeDepth = Math.ceil(Math.log2(leavesCount));
    const subtreeGindex = 2; // List data is at gindex 2 (left child of root)
    const leafGindexInSubtree = (1 << treeDepth) + leafIndex;
    const leafGindex = subtreeGindex * (1 << treeDepth) + leafIndex;
    
    // Generate the proof using the tree
    const tree = new Tree(balancesView.node);
    const proof = tree.getSingleProof(leafGindex);
    
    // The proof should include witnesses up to but not including the root
    // since we're proving against balanceContainerRoot
    const witnessHashes = proof.map(witness => 
      '0x' + Buffer.from(witness).toString('hex')
    );
    
    // Add the length node at the end (SSZ list length mixing)
    const lengthNode = Buffer.alloc(32);
    lengthNode.writeUInt32LE(balanceCount, 0);
    witnessHashes.push('0x' + lengthNode.toString('hex'));
    
    // Format as concatenated hex string
    const formattedProof = '0x' + witnessHashes.map(h => h.slice(2)).join('');
    
    return formattedProof;
  }



getBalanceProofData('http://138.201.157.91:4002', 113809, 10).then(console.log);