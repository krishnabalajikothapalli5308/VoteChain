// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title MockVerifier
/// @notice Simulates the gas cost of Groth16 proof verification
///         Replace with real snarkjs-generated verifier for production
contract MockVerifier {
    // Simulates Groth16 pairing check gas cost (~220,000 gas)
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[2] memory input
    ) external view returns (bool) {
        // Perform a heavy computation to simulate pairing check cost
        // In production: replace entire contract with snarkjs output
        uint256 acc = 0;
        for (uint256 i = 0; i < 100; i++) {
            acc = uint256(keccak256(abi.encode(a[0], a[1], b[0][0], c[0], input[0], i, acc)));
        }
        // Always returns true for benchmarking purposes
        return acc != type(uint256).max;
    }
}
