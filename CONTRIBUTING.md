# Contributing

## Building & Deploying the Options Program

First install the Solana dev tools and add them to path. Install Rust and Cargo

```bash
cargo test-bpf # to run integration test
cargo build-bpf
solana program deploy target/deploy/solana_options.so
```

## Building the NodeJS client

```bash
cd src/client/nodejs
npm install .
npm run build
npm test # to run unit tests
```

##### live testing

The `src/client/nodejs/src/e2etests/tests.js` file has a series of test against the blockchain.

To run this test first start your validator locally in a seperate window (`solana-test-validator`) then call the `setup.sh` to create accounts for alice and bob and tokens that will be used in the tests.

Warning: these tests take several minutes to complete

```bash
solana-test-validator &  # start validator node running on localhost
sh src/client/nodejs/src/e2e_live_tests/setup.sh
cd src/client/nodejs
npm run livetest
```