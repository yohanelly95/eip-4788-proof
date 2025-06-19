## EIP-4788 proofs verification

A set of scripts and on-chain code to use EIP-4788 block root to prove specific
properties of CL blocks.

## Setup for validator script to generate proof:

1. In `validator.js` update slot and validator index.
1. export `BEACON_NODE_URL=http://127.0.0.1:5052`
1. Run `node validator.js`. This will generate a JSON file with the proof with filename `validator_<validator_index>_<slot>.json`.

## Onchain verification

1. Update gIndex in `script/DeployValidatorVerifier.s.sol`. This can be found using `node validator.js` and looking at the `GEN_INDEX_VALIDATOR_INFO` output by passing the slot and validator index as 0.

1. Deploy the contract:
   `forge script script/DeployValidatorVerifier.s.sol --broadcast --rpc-url <rpc-url> --private-key <private-key>`

1. Update the address of the deployed contract and proof file name in `script/InteractValidatorVerifier.s.sol`.
1. Run `forge script script/InteractValidatorVerifier.s.sol --rpc-url <rpc-url>`

### Tests

Foundry tests read JSON files fixtures and use the contracts from the repository
to accepts proofs.

```bash
forge test
```

To run forked tests, provide `FORK_URL` environment variable. Currently, the
Goerli is the only public network supporting EIP-4788.

```bash
FORK_URL=http://127.0.0.1:8545 forge test --mt Fork
```

### Gas Snapshots

```bash
$ forge snapshot
```
