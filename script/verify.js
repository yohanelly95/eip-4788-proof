import { sha256 } from 'ethereum-cryptography/sha256';

function verifyBalanceProof(balanceContainerRoot, balanceRoot, proof, leafIndex) {
    // Parse the proof into 32-byte chunks
    const proofElements = [];
    const proofHex = proof.slice(2); // Remove '0x'
    
    for (let i = 0; i < proofHex.length; i += 64) {
      proofElements.push(Buffer.from(proofHex.slice(i, i + 64), 'hex'));
    }
    
    // Start with the leaf (balanceRoot)
    let computedHash = Buffer.from(balanceRoot.slice(2), 'hex');
    let index = leafIndex;
    
    // Process each proof element
    for (const proofElement of proofElements) {
      let combined;
      
      if (index % 2 === 0) {
        // Current node is left child
        combined = Buffer.concat([computedHash, proofElement]);
      } else {
        // Current node is right child
        combined = Buffer.concat([proofElement, computedHash]);
      }
      
      computedHash = sha256(combined);
      index = Math.floor(index / 2);
    }
    
    // Compare with expected root
    const computedRootHex = '0x' + computedHash.toString('hex');
    return computedRootHex === balanceContainerRoot;
  }
  
  // Test with your data
  const result = verifyBalanceProof(
    '0xfacb5771841afb5911049cd2cde7290ef6c93e97b7b220db28a4af360cb1eddd', // balanceContainerRoot
    '0x00000007eaf48b9200000007ebe7d17200000007ebe50b4600000007eb756f45', // balanceRoot
    '0x985e929f70af28d0bdd1a90a808f977f597c7c778c489e98d3bd8910d31ac0f7e554ff4947ebb3677ab9d1763ee486d96e0d11d81b9f1a7fe53e354115f0b57a1c9a7e5ff1cf48b4ad1582d3f4e4a1004f3b20d8c5a2b71387a4254ad933ebc52f075ae229646b6f6aed19a5e372cf295081401eb893ff599b3f9acc0c0d3e7d328921deb59612076801e8cd61592107b5c67c79b846595cc6320c395b46362cbfb909fdb236ad2411b4e4883810a074b840464689986c3f8a8091827e17c32755d8fb3687ba3ba49f342c77f5a1f89bec83d811446e1a467139213d640b6a74ad01000000000000000000000000000000000000000000000000000000000000ad01000000000000000000000000000000000000000000000000000000000000', // proof
    2 // leafIndex (validatorIndex 10 / 4 = 2)
  );

  console.log('Proof is valid:', result);
