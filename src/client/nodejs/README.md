# Installation

    npm install sol-options

See code and docs here: https://github.com/dbanda/solana-nft-options

# Examples

Let's show how you can create a call contract to sell 420 units of SOL token for 69 USDC expiring 10 minutes from now

```Javascript
var sol = require("@solana/web3.js");
var sol_options = require("solana-options")

const your_private_key = [45,142,52,139,158,173,187,83,102,42,19,164,139,139,205,
 206,230,214,180,206,143,85,173,181,255,225,10,156,247,8,71,177,181,140,215,
 137,129,185,26,79,119,184,240,246,7,123,174,112,154,172,151,52,204,95,75,118,
 145,69,121,55,243,232,216,63]

// connect to your cluster e.g localhost or devnet
const connection = new sol.Connection("https://api.devnet.solana.com", 'singleGossip');

```

```Javascript
// create a call contract contract

// your account
let creator_acc = sol.Keypair.fromSecretKey(new Uint8Array(your_private_key))

// set strikes and expiry
let strike = 69
let expiry = Date.now()/1000 + 600 //expire in 10 mins
let multiple = 420

// the address or symbol you are selling on this call
let instrument = "SOL"
// alternatively you can use the address of the token
// e.g let instrument = new PublicKey("SOL1111111111111111111111111111111")

// the token address or symbol of the token you recieve if the call is exercised
let strike_instrument = "USDC"


// the address of your accounts that you will send and receive these instruments. 
// for this example your instrument account must hold 420 SOL that will be used as collateral
let creator_instrument_acc = new sol.PublicKey("45AFNwW71KwdSPXGgEJVhKGMHjEDnH4ECVSd59SFJ7R3")
let creator_strike_instrument_acc = new sol.PublicKey('9H39mHQDLNN1crrQFwRu5w8Euje5k3pfzKxkHaD51gXw')

// create the call
create_call(
    connection,strike, expiry, multiple, creator_acc, instrument, strike_instrument, 
    creator_instrument_acc, creator_strike_instrument_acc
).then(([sig, contract])=>{
    console.log(sol_options.print_contract(contract))
})
```

```json
{
    "strike": 69,
    "expiry": 1640148885.292,
    "multiple": 420,
    "instrument": "SOL1111111111111111111111111111111",
    "strike_instrument": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "nft_id": "9dpDMmB9pZk1zvRg8eTkvTrY7krwhG59WJ6UNgUKBYgz",
    "nft_account": "FyMJLrW3jBr4EqSaGuFfX3SWAEM5ZcEjD4xiwF7LqJY8",
    "account_id": "Db7AumhkBYaNkh4QZMPFiGGW8gGFJ4WvTDm8DRPVWFJy",
    "collateral_acc": "5cNgbTSQAdmyJRJLr9bqFTLMSQV1FRKTJoJXMViVr1uR",
    "writer_recv_acc": "9H39mHQDLNN1crrQFwRu5w8Euje5k3pfzKxkHaD51gXw",
    "writer": "DDhMZx3tJLat2Vhx7NEKxRWFT7hg82h8yMeJbSPL3fe6",
    "kind": "call"
}
```

## Publish

You can create an image for your contract too and publish it to http://nftoptions.app

```Javascript
    create_call(
        connection,strike, expiry, multiple, creator_acc, instrument, strike_instrument, 
        creator_instrument_acc, creator_strike_instrument_acc
    ).then(([sig, contract])=>{
        console.log(printed_contract(contract))
        sol_options.create_doc_img(contract).then(async img=>{
            img.write("example.png");
            await sol_options.publish_doc(contract)
        })
    })
```

`example.png`

![sample](https://raw.githubusercontent.com/dbanda/solana-nft-options/master/docs/contract.png)