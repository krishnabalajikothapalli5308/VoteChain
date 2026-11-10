const hre = require("hardhat");
const fs = require("fs");
const { ethers } = hre;

// ── Helpers ────────────────────────────────────────────────
function randomBytes32() {
  return ethers.hexlify(ethers.randomBytes(32));
}

function mockProof() {
  return {
    a: [ethers.toBigInt(ethers.randomBytes(32)), ethers.toBigInt(ethers.randomBytes(32))],
    b: [
      [ethers.toBigInt(ethers.randomBytes(32)), ethers.toBigInt(ethers.randomBytes(32))],
      [ethers.toBigInt(ethers.randomBytes(32)), ethers.toBigInt(ethers.randomBytes(32))]
    ],
    c: [ethers.toBigInt(ethers.randomBytes(32)), ethers.toBigInt(ethers.randomBytes(32))],
    input: [ethers.toBigInt(ethers.randomBytes(32)), ethers.toBigInt(ethers.randomBytes(32))]
  };
}

async function getGasPrice() {
  const feeData = await hre.ethers.provider.getFeeData();
  return feeData.gasPrice;
}

async function measureTx(txPromise) {
  const start = Date.now();
  const tx = await txPromise;
  const receipt = await tx.wait();
  const latencyMs = Date.now() - start;
  return { gasUsed: receipt.gasUsed, latencyMs, receipt };
}

async function main() {
  const deployment = JSON.parse(fs.readFileSync("deployment.json"));
  const [signer] = await ethers.getSigners();

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║     VoteChain Benchmark — Sepolia         ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("Network:", hre.network.name);
  console.log("Signer:", signer.address);

  const gasPrice = await getGasPrice();
  const gasPriceGwei = Number(ethers.formatUnits(gasPrice, "gwei")).toFixed(1);
  console.log("Current gas price:", gasPriceGwei, "Gwei\n");

  const registry = await ethers.getContractAt("VoteChainRegistry", deployment.contracts.registry);
  const ballot = await ethers.getContractAt("BallotContract", deployment.contracts.ballot);
  const tally = await ethers.getContractAt("TallyContract", deployment.contracts.tally);

  const results = {
    timestamp: new Date().toISOString(),
    network: hre.network.name,
    gasPriceGwei,
    operations: {},
    throughput: {},
    proofGeneration: {}
  };

  // ── 1. Voter Registration Gas ──────────────────────────────
  console.log("── 1. Measuring voter registration gas ──");
  const regGasSamples = [];
  const regLatencies = [];
  const SAMPLE_VOTERS = 10;

  for (let i = 0; i < SAMPLE_VOTERS; i++) {
    const nullifier = randomBytes32();
    const { gasUsed, latencyMs } = await measureTx(registry.registerVoter(nullifier));
    regGasSamples.push(Number(gasUsed));
    regLatencies.push(latencyMs);
    process.stdout.write(`   Voter ${i + 1}/${SAMPLE_VOTERS}: ${gasUsed} gas\r`);
  }
  const avgRegGas = Math.round(regGasSamples.reduce((a, b) => a + b) / regGasSamples.length);
  const avgRegLatency = Math.round(regLatencies.reduce((a, b) => a + b) / regLatencies.length);
  console.log(`\n   ✓ Avg registration gas: ${avgRegGas}`);
  console.log(`   ✓ Avg confirmation latency: ${avgRegLatency}ms`);
  results.operations.voterRegistration = { avgGas: avgRegGas, avgLatencyMs: avgRegLatency };

  // ── 2. Ballot Submission Gas (zk-SNARK verify + nullifier + store) ──
  console.log("\n── 2. Measuring ballot submission gas ──");

  // Re-register fresh voters for ballot test
  const ballotNullifiers = [];
  for (let i = 0; i < SAMPLE_VOTERS; i++) {
    const n = randomBytes32();
    await (await registry.registerVoter(n)).wait();
    ballotNullifiers.push(n);
  }

  const ballotGasSamples = [];
  const ballotLatencies = [];

  for (let i = 0; i < SAMPLE_VOTERS; i++) {
    const proof = mockProof();
    const encBallot = ethers.toBigInt(ethers.randomBytes(32));
    const { gasUsed, latencyMs } = await measureTx(
      ballot.castBallot(
        proof.a, proof.b, proof.c, proof.input,
        ballotNullifiers[i],
        encBallot
      )
    );
    ballotGasSamples.push(Number(gasUsed));
    ballotLatencies.push(latencyMs);
    process.stdout.write(`   Ballot ${i + 1}/${SAMPLE_VOTERS}: ${gasUsed} gas\r`);
  }
  const avgBallotGas = Math.round(ballotGasSamples.reduce((a, b) => a + b) / ballotGasSamples.length);
  const avgBallotLatency = Math.round(ballotLatencies.reduce((a, b) => a + b) / ballotLatencies.length);
  console.log(`\n   ✓ Avg ballot submission gas: ${avgBallotGas}`);
  console.log(`   ✓ Avg confirmation latency: ${avgBallotLatency}ms`);
  results.operations.ballotSubmission = { avgGas: avgBallotGas, avgLatencyMs: avgBallotLatency };

  // ── 3. Homomorphic Tally Gas ───────────────────────────────
  console.log("\n── 3. Measuring homomorphic tally gas ──");
  const { gasUsed: tallyGas, latencyMs: tallyLatency } = await measureTx(tally.computeTally());
  console.log(`   ✓ Tally gas (${SAMPLE_VOTERS} ballots): ${tallyGas}`);
  console.log(`   ✓ Tally latency: ${tallyLatency}ms`);
  results.operations.homomorphicTally = {
    gasUsed: Number(tallyGas),
    ballotCount: SAMPLE_VOTERS,
    latencyMs: tallyLatency
  };

  // ── 4. Result Publication Gas ──────────────────────────────
  console.log("\n── 4. Measuring result publication gas ──");
  const fakeResults = [4n, 3n, 1n, 1n, 1n]; // 5 candidates
  const { gasUsed: pubGas, latencyMs: pubLatency } = await measureTx(tally.publishResult(fakeResults));
  console.log(`   ✓ Result publication gas: ${pubGas}`);
  results.operations.resultPublication = { gasUsed: Number(pubGas), latencyMs: pubLatency };

  // ── 5. Throughput Estimate ─────────────────────────────────
  console.log("\n── 5. Computing throughput estimates ──");
  const BLOCK_GAS_LIMIT = 30_000_000;
  const BLOCK_TIME_S = 12;
  const txPerBlock = Math.floor(BLOCK_GAS_LIMIT / avgBallotGas);
  const throughputTps = (txPerBlock / BLOCK_TIME_S).toFixed(1);
  console.log(`   Block gas limit: ${BLOCK_GAS_LIMIT.toLocaleString()}`);
  console.log(`   Ballots per block: ${txPerBlock}`);
  console.log(`   Throughput: ${throughputTps} ballots/second`);
  results.throughput = { txPerBlock, throughputTps: parseFloat(throughputTps), blockGasLimit: BLOCK_GAS_LIMIT, blockTimeSec: BLOCK_TIME_S };

  // ── 6. USD Cost Estimates ──────────────────────────────────
  const ethPriceUSD = 3200; // update with current ETH price
  const gasPriceWei = Number(gasPrice);
  function toUSD(gas) {
    return ((gas * gasPriceWei) / 1e18 * ethPriceUSD).toFixed(4);
  }
  results.usdCosts = {
    note: `Calculated at ${gasPriceGwei} Gwei, ETH = $${ethPriceUSD}. Update ETH price in script.`,
    voterRegistration: `$${toUSD(avgRegGas)}`,
    ballotSubmission: `$${toUSD(avgBallotGas)}`,
    homomorphicTally: `$${toUSD(Number(tallyGas))}`,
    resultPublication: `$${toUSD(Number(pubGas))}`
  };

  // ── 7. Save results ────────────────────────────────────────
  fs.writeFileSync("benchmark_results.json", JSON.stringify(results, null, 2));

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║          BENCHMARK SUMMARY                ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`Gas Price:              ${gasPriceGwei} Gwei`);
  console.log(`Voter Registration:     ${avgRegGas} gas  (${results.usdCosts.voterRegistration})`);
  console.log(`Ballot Submission:      ${avgBallotGas} gas  (${results.usdCosts.ballotSubmission})`);
  console.log(`Homomorphic Tally:      ${tallyGas} gas  (${results.usdCosts.homomorphicTally})`);
  console.log(`Result Publication:     ${pubGas} gas  (${results.usdCosts.resultPublication})`);
  console.log(`Throughput:             ${throughputTps} ballots/sec`);
  console.log("\n✅ Full results saved to benchmark_results.json");
  console.log("   Use these numbers to update VoteChain_IEEE_Full.docx\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
