// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BallotContract.sol";

/// @title TallyContract
/// @notice Performs on-chain homomorphic aggregation of encrypted ballots
///         and publishes the final result after decryption by tally authority
contract TallyContract {
    BallotContract public ballotContract;
    address public tallyAuthority;

    bool public tallied;
    bool public resultPublished;

    // Homomorphically aggregated ciphertext (product of all Paillier ciphertexts)
    uint256 public aggregateCiphertext;

    // Final result per candidate (published by tally authority after decryption)
    uint256[] public results;
    uint256 public candidateCount;

    // Paillier public key modulus (n^2 used for multiplication mod n^2)
    uint256 public paillierNSquared;

    event TallyComputed(uint256 aggregateCiphertext, uint256 ballotCount);
    event ResultPublished(uint256[] results, uint256 timestamp);

    modifier onlyTallyAuthority() {
        require(msg.sender == tallyAuthority, "Not tally authority");
        _;
    }

    constructor(
        address _ballotContract,
        uint256 _candidateCount,
        uint256 _paillierNSquared
    ) {
        ballotContract = BallotContract(_ballotContract);
        tallyAuthority = msg.sender;
        candidateCount = _candidateCount;
        paillierNSquared = _paillierNSquared;
        results = new uint256[](_candidateCount);
    }

    /// @notice Homomorphically aggregate all encrypted ballots
    ///         Under Paillier: product of ciphertexts = encryption of sum of plaintexts
    function computeTally() external {
        require(!tallied, "Already tallied");

        uint256[] memory ballots = ballotContract.getEncryptedBallots();
        require(ballots.length > 0, "No ballots to tally");

        uint256 aggregate = 1;
        for (uint256 i = 0; i < ballots.length; i++) {
            // Paillier homomorphic addition = multiplication mod n^2
            aggregate = mulmod(aggregate, ballots[i], paillierNSquared);
        }

        aggregateCiphertext = aggregate;
        tallied = true;

        emit TallyComputed(aggregate, ballots.length);
    }

    /// @notice Tally authority publishes decrypted results after off-chain decryption
    function publishResult(uint256[] calldata _results) external onlyTallyAuthority {
        require(tallied, "Tally not computed yet");
        require(!resultPublished, "Result already published");
        require(_results.length == candidateCount, "Wrong candidate count");

        for (uint256 i = 0; i < _results.length; i++) {
            results[i] = _results[i];
        }
        resultPublished = true;

        emit ResultPublished(_results, block.timestamp);
    }

    function getResults() external view returns (uint256[] memory) {
        return results;
    }
}
