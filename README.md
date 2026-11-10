# VoteChain

End-to-end verifiable blockchain voting using zk-SNARKs (Groth16), Paillier homomorphic tallying, and on-chain nullifiers, implemented in Solidity and benchmarked on Ethereum Sepolia.

**Status:** research prototype; manuscript in preparation.
**Note:** `MockVerifier.sol` simulates verifier cost for benchmarking. Replace it with the snarkjs-generated Groth16 verifier before any real use.

## Measured results (Sepolia, mean of 10 transactions)

| Operation | Gas |
|---|---|
| Voter registration | 52,858 |
| Ballot submission | 151,416 |
| Homomorphic tally (10 ballots) | 88,838 |
| Result publication | 147,461 |

Confirmation latency averaged about 12.9 s (one Sepolia slot). Throughput estimate: 30M gas / 151,416 = 198 ballots per block, about 16.5 per second.

## Layout

- `contracts/` VoteChainRegistry, BallotContract, TallyContract, IVerifier, MockVerifier
- `circuits/ballot.circom` ballot validity circuit
- `scripts/` deploy.js, benchmark.js
- `paper/` anonymized manuscript PDF
- `results/` put `deployment.json` and `benchmark_results.json` here (generated on your machine)

## Run

```bash
npm install
cp .env.example .env   # add SEPOLIA_RPC_URL and PRIVATE_KEY (never commit .env)
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
npx hardhat run scripts/benchmark.js --network sepolia
```

## License

MIT
