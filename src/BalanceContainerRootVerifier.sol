// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {SSZ} from "./SSZ.sol";

contract BalanceContainerRootVerifier {
    address public constant BEACON_ROOTS =
        0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02;

    uint64 constant VALIDATOR_REGISTRY_LIMIT = 2 ** 40;

    /// @dev Generalized index of the balance container in the beacon state
    uint256 public immutable gIndexBalanceContainer;

    /// @notice Emitted when a balance container root is verified
    event BalanceContainerVerified(
        bytes32 indexed blockRoot,
        bytes32 indexed balanceContainerRoot,
        uint64 timestamp
    );

    error RootNotFound();

    constructor(uint256 _gIndexBalanceContainer) {
        gIndexBalanceContainer = _gIndexBalanceContainer;
    }

    /// @notice Verifies the balance container root against a beacon block root
    /// @param balanceContainerProof Merkle proof from block root to balance container
    /// @param balanceContainerRoot The balance container root to verify
    /// @param ts Timestamp to get the beacon block root
    function verifyBalanceContainer(
        bytes32[] calldata balanceContainerProof,
        bytes32 balanceContainerRoot,
        uint64 ts
    ) public view returns (bool) {
        bytes32 blockRoot = getParentBlockRoot(ts);
        
        bool isValid = SSZ.verifyProof(
            balanceContainerProof,
            blockRoot,
            balanceContainerRoot,
            gIndexBalanceContainer
        );

        if (isValid) {
            emit BalanceContainerVerified(blockRoot, balanceContainerRoot, ts);
        }

        return isValid;
    }

    /// @notice Verifies a specific validator's balance within a balance container
    /// @param balanceProof Merkle proof from balance container root to packed balance leaf
    /// @param packedBalances The packed 4 balances in the leaf (32 bytes)
    /// @param balanceContainerRoot The balance container root
    /// @param leafIndex Which leaf contains the validator's balance (validatorIndex / 4)
    function verifyBalance(
        bytes32[] calldata balanceProof,
        bytes32 packedBalances,
        bytes32 balanceContainerRoot,
        uint256 leafIndex
    ) public pure returns (bool) {
        // For SSZ List[uint64], the data is at gindex 2 (left child)
        // Then we need to navigate to the specific leaf
        // The depth depends on the maximum number of validators
        uint256 balanceTreeDepth = SSZ.log2((VALIDATOR_REGISTRY_LIMIT + 3) / 4); // ceil(limit/4)
        uint256 leafGindex = (1 << balanceTreeDepth) + leafIndex;
        
        // SSZ List has length mixed at root, so actual data is at gindex 2
        uint256 gIndex = SSZ.concatGindices(2, uint64(leafGindex));
        
        return SSZ.verifyProof(
            balanceProof,
            balanceContainerRoot,
            packedBalances,
            gIndex
        );
    }

    /// @notice Verifies both the balance container and a specific balance in one call
    /// @param balanceContainerProof Proof from block root to balance container
    /// @param balanceProof Proof from balance container to packed balance leaf
    /// @param packedBalances The packed 4 balances
    /// @param balanceContainerRoot The balance container root
    /// @param leafIndex Which leaf contains the validator's balance
    /// @param ts Timestamp for beacon block root
    function verifyBalanceComplete(
        bytes32[] calldata balanceContainerProof,
        bytes32[] calldata balanceProof,
        bytes32 packedBalances,
        bytes32 balanceContainerRoot,
        uint256 leafIndex,
        uint64 ts
    ) external view returns (bool) {
        // First verify the balance container root
        if (!verifyBalanceContainer(balanceContainerProof, balanceContainerRoot, ts)) {
            return false;
        }
        
        // Then verify the specific balance
        return verifyBalance(balanceProof, packedBalances, balanceContainerRoot, leafIndex);
    }

    /// @notice Extracts a specific validator's balance from packed balances
    /// @param packedBalances The packed 4 balances (32 bytes)
    /// @param position Position within the packed balances (0-3)
    function extractBalance(
        bytes32 packedBalances,
        uint8 position
    ) public pure returns (uint64) {
        require(position < 4, "Position must be 0-3");
        
        // Each balance is 8 bytes (64 bits)
        // Extract the specific balance using bit shifting
        uint256 shift = position * 64;
        uint256 mask = 0xFFFFFFFFFFFFFFFF; // 64 bits of 1s
        
        return uint64((uint256(packedBalances) >> shift) & mask);
    }

    function getParentBlockRoot(
        uint64 ts
    ) internal view returns (bytes32 root) {
        (bool success, bytes memory data) = BEACON_ROOTS.staticcall(
            abi.encode(ts)
        );

        if (!success || data.length == 0) {
            revert RootNotFound();
        }

        root = abi.decode(data, (bytes32));
    }
}