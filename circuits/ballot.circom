pragma circom 2.0.0;

include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/poseidon.circom";

/*
 * BallotValidity Circuit
 *
 * Public inputs:
 *   - nullifierHash : H(secretKey, electionId)  — prevents double voting
 *   - encBallotHash : H(encBallot)               — links proof to submitted ciphertext
 *
 * Private witness:
 *   - vote          : plaintext vote (0 <= vote < candidateCount)
 *   - secretKey     : voter's secret key
 *   - electionId    : election identifier
 *   - encBallot     : Paillier ciphertext of vote
 *
 * Proves:
 *   1. vote is in range [0, candidateCount)
 *   2. nullifierHash = Poseidon(secretKey, electionId)
 *   3. encBallotHash = Poseidon(encBallot)
 */

template BallotValidity(candidateCount) {
    // Public inputs
    signal input nullifierHash;
    signal input encBallotHash;

    // Private witness
    signal input vote;
    signal input secretKey;
    signal input electionId;
    signal input encBallot;

    // ── Constraint 1: vote in range [0, candidateCount) ──────────────
    component lt = LessThan(32);
    lt.in[0] <== vote;
    lt.in[1] <== candidateCount;
    lt.out === 1;

    component gte = GreaterEqThan(32);
    gte.in[0] <== vote;
    gte.in[1] <== 0;
    gte.out === 1;

    // ── Constraint 2: nullifierHash = Poseidon(secretKey, electionId) ─
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== secretKey;
    nullifierHasher.inputs[1] <== electionId;
    nullifierHash === nullifierHasher.out;

    // ── Constraint 3: encBallotHash = Poseidon(encBallot) ─────────────
    component encHasher = Poseidon(1);
    encHasher.inputs[0] <== encBallot;
    encBallotHash === encHasher.out;
}

component main {public [nullifierHash, encBallotHash]} = BallotValidity(5);
