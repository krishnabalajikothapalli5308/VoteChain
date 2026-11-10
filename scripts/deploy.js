const hre = require("hardhat");
const fs = require("fs");

// Paillier n^2 placeholder — replace with your actual generated value
// Use: python3 scripts/gen_paillier.py  to generate
const PAILLIER_N_SQUARED = BigInt(
  "0x" + "f".repeat(128) // placeholder — replace with real value
);
const CANDIDATE_COUNT = 5;
const ELECTION_ID = 1001n;

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("\n=== VoteChain Deployment ===");
  console.log("Deployer:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH\n");

  const results = { network: hre.network.name, deployer: deployer.address, contracts: {}, gas: {} };

  // ── 1. Deploy a mock verifier for benchmarking (replace with real Groth16 verifier)
  console.log("1. Deploying MockVerifier...");
  const MockVerifier = await hre.ethers.getContractFactory("MockVerifier");
  const t0 = Date.now();
  const mockVerifier = await MockVerifier.deploy();
  await mockVerifier.waitForDeployment();
  const verifierAddr = await mockVerifier.getAddress();
  const verifierReceipt = await hre.ethers.provider.getTransactionReceipt(mockVerifier.deploymentTransaction().hash);
  console.log("   Address:", verifierAddr);
  console.log("   Gas used:", verifierReceipt.gasUsed.toString());
  results.contracts.verifier = verifierAddr;
  results.gas.verifierDeploy = verifierReceipt.gasUsed.toString();

  // ── 2. Deploy VoteChainRegistry
  console.log("\n2. Deploying VoteChainRegistry...");
  const Registry = await hre.ethers.getContractFactory("VoteChainRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  const registryReceipt = await hre.ethers.provider.getTransactionReceipt(registry.deploymentTransaction().hash);
  console.log("   Address:", registryAddr);
  console.log("   Gas used:", registryReceipt.gasUsed.toString());
  results.contracts.registry = registryAddr;
  results.gas.registryDeploy = registryReceipt.gasUsed.toString();

  // ── 3. Deploy BallotContract
  console.log("\n3. Deploying BallotContract...");
  const Ballot = await hre.ethers.getContractFactory("BallotContract");
  const ballot = await Ballot.deploy(verifierAddr, registryAddr, CANDIDATE_COUNT, ELECTION_ID);
  await ballot.waitForDeployment();
  const ballotAddr = await ballot.getAddress();
  const ballotReceipt = await hre.ethers.provider.getTransactionReceipt(ballot.deploymentTransaction().hash);
  console.log("   Address:", ballotAddr);
  console.log("   Gas used:", ballotReceipt.gasUsed.toString());
  results.contracts.ballot = ballotAddr;
  results.gas.ballotDeploy = ballotReceipt.gasUsed.toString();

  // ── 4. Deploy TallyContract
  console.log("\n4. Deploying TallyContract...");
  const Tally = await hre.ethers.getContractFactory("TallyContract");
  const tally = await Tally.deploy(ballotAddr, CANDIDATE_COUNT, PAILLIER_N_SQUARED);
  await tally.waitForDeployment();
  const tallyAddr = await tally.getAddress();
  const tallyReceipt = await hre.ethers.provider.getTransactionReceipt(tally.deploymentTransaction().hash);
  console.log("   Address:", tallyAddr);
  console.log("   Gas used:", tallyReceipt.gasUsed.toString());
  results.contracts.tally = tallyAddr;
  results.gas.tallyDeploy = tallyReceipt.gasUsed.toString();

  // ── Save deployment info
  fs.writeFileSync("deployment.json", JSON.stringify(results, null, 2));
  console.log("\n✅ All contracts deployed. Saved to deployment.json");
  console.log("\nNow run: npx hardhat run scripts/benchmark.js --network sepolia");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
