// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title VoteChainRegistry
/// @notice Handles voter registration and nullifier commitment storage
contract VoteChainRegistry {
    address public admin;
    bool public registrationOpen;

    // nullifierHash => registered
    mapping(bytes32 => bool) public registeredVoters;
    uint256 public totalRegistered;

    event VoterRegistered(bytes32 indexed nullifierHash, uint256 timestamp);
    event RegistrationToggled(bool isOpen);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
        registrationOpen = true;
    }

    function toggleRegistration(bool _open) external onlyAdmin {
        registrationOpen = _open;
        emit RegistrationToggled(_open);
    }

    /// @notice Register a voter by committing their nullifier hash
    function registerVoter(bytes32 nullifierHash) external {
        require(registrationOpen, "Registration closed");
        require(!registeredVoters[nullifierHash], "Already registered");
        registeredVoters[nullifierHash] = true;
        totalRegistered++;
        emit VoterRegistered(nullifierHash, block.timestamp);
    }

    function isRegistered(bytes32 nullifierHash) external view returns (bool) {
        return registeredVoters[nullifierHash];
    }
}
