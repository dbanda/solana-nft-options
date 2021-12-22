#!/bin/bash
set -e

# create tokens A and B for Alice and Bob
echo > alice.txt
echo > bob.txt
TOKA=$(spl-token create-token --decimals 0  --mint-authority src/client/nodejs/src/e2e_live_tests/keypairs/alice.json | grep "Creating" | sed s/Creating\ token//g)
TOKB=$(spl-token create-token --decimals 0 --mint-authority src/client/nodejs/src/e2e_live_tests/keypairs/bob.json | grep "Creating" | sed s/Creating\ token//g)

echo $TOKA >> alice.txt
echo $TOKB >> alice.txt
echo $TOKA >> bob.txt
echo $TOKB >> bob.txt

echo "created tokens" $TOKA $TOKB
# accounts A and B for alice

ACCA=$(spl-token create-account $TOKA  --owner src/client/nodejs/src/e2e_live_tests/keypairs/alice.json | grep "Creating" | sed s/Creating\ account//g)
ACCB=$(spl-token create-account $TOKB  --owner src/client/nodejs/src/e2e_live_tests/keypairs/alice.json | grep "Creating" | sed s/Creating\ account//g)
echo $ACCA >> alice.txt
echo $ACCB >> alice.txt
echo "created alice accounts" $ACCA $ACCB

# alice mints 69000 of TOKA 420000 of TOKB
spl-token mint --mint-authority src/client/nodejs/src/e2e_live_tests/keypairs/alice.json $TOKA 69000 $ACCA
spl-token mint --mint-authority src/client/nodejs/src/e2e_live_tests/keypairs/bob.json $TOKB 420000 $ACCB
echo "minted alice token"


# account A and B for bob
ACCA=$(spl-token create-account $TOKA  --owner src/client/nodejs/src/e2e_live_tests/keypairs/bob.json | grep "Creating" | sed s/Creating\ account//g)
ACCB=$(spl-token create-account $TOKB  --owner src/client/nodejs/src/e2e_live_tests/keypairs/bob.json | grep "Creating" | sed s/Creating\ account//g)
echo $ACCA >> bob.txt
echo $ACCB >> bob.txt
echo "created bob accounts" $ACCA $ACCB

# bob mint 69 of TOKB, 420 of TOKA
spl-token mint --mint-authority src/client/nodejs/src/e2e_live_tests/keypairs/bob.json $TOKB 69000 $ACCB
spl-token mint --mint-authority src/client/nodejs/src/e2e_live_tests/keypairs/alice.json $TOKA 420000 $ACCA
echo "minted bob token"


#top up accounts
solana airdrop 1000 src/client/nodejs/src/e2e_live_tests/keypairs/alice.json
solana airdrop 1000 src/client/nodejs/src/e2e_live_tests/keypairs/bob.json
echo "toped up accounts"

mv alice.txt src/client/nodejs/src/e2e_live_tests
mv bob.txt src/client/nodejs/src/e2e_live_tests


