// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IVerifier.sol";
import "./VoteChainRegistry.sol";

/// @title BallotContract
/// @notice Accepts encrypted ballots with zk-SNARK validity proofs
contract BallotContract {
    IVerifier public verifier;
    VoteChainRegistry public registry;
    address public admin;

    bool public votingOpen;
    uint256 public candidateCount;
    uint256 public electionId;

    // nullifier => used
    mapping(bytes32 => bool) public nullifiers;

    // stores encrypted ballots (Paillier ciphertexts as uint256)
    uint256[] public encryptedBallots;

    uint256 public totalVotesCast;

    event BallotCast(bytes32 indexed nullifier, uint256 encBallot, uint256 timestamp);
    event VotingToggled(bool isOpen);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor(
        address _verifier,
        address _registry,
        uint256 _candidateCount,
        uint256 _electionId
    ) {
        verifier = IVerifier(_verifier);
        registry = VoteChainRegistry(_registry);
        admin = msg.sender;
        candidateCount = _candidateCount;
        electionId = _electionId;
        votingOpen = true;
    }

    function toggleVoting(bool _open) external onlyAdmin {
        votingOpen = _open;
        emit VotingToggled(_open);
    }

    /// @notice Cast an encrypted ballot with a zk-SNARK proof
    /// @param a zk-SNARK proof component A
    /// @param b zk-SNARK proof component B
    /// @param c zk-SNARK proof component C
    /// @param input public inputs: [nullifierHash, encBallotHash]
    /// @param nullifier the voter's nullifier (must match input[0])
    /// @param encBallot the Paillier-encrypted ballot value
    function castBallot(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[2] memory input,
        bytes32 nullifier,
        uint256 encBallot
    ) external {
        require(votingOpen, "Voting is closed");
        require(!nullifiers[nullifier], "Already voted");
        require(
            registry.isRegistered(nullifier),
            "Voter not registered"
        );
        require(
            verifier.verifyProof(a, b, c, input),
            "Invalid zk-SNARK proof"
        );

        nullifiers[nullifier] = true;
        encryptedBallots.push(encBallot);
        totalVotesCast++;

        emit BallotCast(nullifier, encBallot, block.timestamp);
    }

    function getEncryptedBallots() external view returns (uint256[] memory) {
        return encryptedBallots;
    }

    function getBallotCount() external view returns (uint256) {
        return encryptedBallots.length;
    }
}
