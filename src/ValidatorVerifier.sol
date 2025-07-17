// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {SSZ} from "./SSZ.sol";

contract ValidatorVerifier {
    address public constant BEACON_ROOTS =
        0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02;

    event ValidatorProven(
        uint256 gIndex,
        uint256 validatorIndex,
        bytes32 blockRoot,
        bytes32 validatorRoot,
        bool isValid
    );

    uint64 constant VALIDATOR_REGISTRY_LIMIT = 2 ** 40;

    /// @dev Generalized index of the first validator struct root in the
    /// registry.
    uint256 public immutable gIndex;

    event Accepted(uint64 indexed validatorIndex);

    error RootNotFound();

    constructor(uint256 _gIndex) {
        gIndex = _gIndex;
    }

    function proveValidator(
        bytes32[] calldata validatorProof,
        SSZ.Validator calldata validator,
        uint64 validatorIndex,
        uint64 ts
    ) public view returns (bool) {
        require(
            validatorIndex < VALIDATOR_REGISTRY_LIMIT,
            "validator index out of range"
        );

        uint256 gI = gIndex + validatorIndex;
        bytes32 validatorRoot = SSZ.validatorHashTreeRoot(validator);
        bytes32 blockRoot = getParentBlockRoot(ts);
        return SSZ.verifyProof(validatorProof, blockRoot, validatorRoot, gI);
    }

    function proveValidators(
        bytes32[][] calldata validatorProofs,
        SSZ.Validator[] calldata validators,
        uint64[] calldata validatorIndices,
        uint64 ts
    ) public view returns (bool[] memory results) {
        require(
            validatorProofs.length == validators.length &&
                validators.length == validatorIndices.length,
            "Length mismatch"
        );

        bytes32 blockRoot = getParentBlockRoot(ts);
        results = new bool[](validators.length);

        for (uint256 i = 0; i < validators.length; i++) {
            require(
                validatorIndices[i] < VALIDATOR_REGISTRY_LIMIT,
                "validator index out of range"
            );

            uint256 gI = gIndex + validatorIndices[i];
            bytes32 validatorRoot = SSZ.validatorHashTreeRoot(validators[i]);
            results[i] = SSZ.verifyProof(
                validatorProofs[i],
                blockRoot,
                validatorRoot,
                gI
            );
        }

        return results;
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
