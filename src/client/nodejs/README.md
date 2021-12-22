# Installation

    npm install sol-options

See code and docs here: https://github.com/dbanda/solana-nft-options

# Examples

Let's show how you can create a call contract to sell 1000000 units of SOL token for 100 USDC expiring 10 minutes from now

```Javascript
import { AccountInfo, Keypair } from "@solana/web3.js";
import { Connection, PublicKey} from "@solana/web3.js";
import { create_call, create_put, exercise_call, OptionType } from ".";
import { create_doc_img } from "./doc";

const your_private_key = [58,61,83,12,252,164,114,167,16,61,196,241,213,70,111,76,253,145,3,249,205,251,23,52,
    237,158,140,188,84,202,116,216,78,242,2,9,33,177,53,200,7,221,76,53,149,13,243,125,153,187,239,178,76,
    197,203,88,218,186,174,108,71,19,254,203]

// connect to your cluster e.g localhost or devnet
const connection = new Connection("https://api.devnet.solana.com", 'singleGossip');

```

```Javascript
// create a call contract contract

// your account
let creator_acc = Keypair.fromSecretKey(new Uint8Array(your_private_key))

// set strikes and expiry
let strike = 100
let expiry = Date.now()/1000 + 600 //expire in 10 mins
let multiple = 1000000000

// the address or symbol you are selling on this call
let instrument = "SOL"
// alternatively you can use the address of the token
// e.g let instrument = new PublicKey("SOL1111111111111111111111111111111")

// the token address or symbol of the token you recieve if the call is exercised
let strike_instrument = "USDC"


// the address of your accounts that you will send and receive these instruments. 
// for this example your instrument account must hold 1000000000 SOL that will be used as collateral
let creator_instrument_acc = new PublicKey("GsnpfUQTFnQBuokhttUajopkEeg4YNgwf7j2SSKhRigJ")
let creator_strike_instrument_acc = new PublicKey('8Tv1h2eNjhfQJXyNR3Ey8WwoHAF1qZW7s7aNH49oCMBP')

// create the call
create_call(
    connection,strike, expiry, multiple, creator_acc, instrument, strike_instrument, creator_instrument_acc, creator_strike_instrument_acc
).then(([sig, contract])=>{
    console.log(printed_contract(contract))
})
```

```json
{
    "strike": 100,
    "expiry": 1639040144.763,
    "multiple": 1000000000,
    "instrument": "D3KCKMTY8rgWtVmxKdCeugKEFbJMjSHk7iWiLMAKrrMf",
    "strike_instrument": "6Uhbk6FwCLLQfsKJ8kn8uCsiF5iZNVQDw5QxMNJh9XiJ",
    "nft_id": "4q3E9ZxG6VFhQUL45AC3qmVpv1aEzr5dXRUo1h9Ceqaj",
    "nft_account": "HyhK3xraTRGXPbwow5PY7Z7yhMTQuPDme13rdngYFQfU",
    "account_id": "7dsBkXTW1cdmN6bFENampDLkQsk63TZimsduUwCB8aWr",
    "collateral_acc": "GGDmFyQbHRSxpL8AikpLSArQc9EA5CJNvwkALohCJ5An",
    "writer_recv_acc": "GsnpfUQTFnQBuokhttUajopkEeg4YNgwf7j2SSKhRigJ",
    "writer": "6KAqLqtYj5d31Am1pQDYqPSUWyKFkqh3q7iayNvmUMox",
    "kind": "put"
}
```

## Publish

You can create an image for your contract too and publish it to http://nftoptions.app

```Javascript
    create_call(
        connection,strike, expiry, multiple, creator_acc, instrument, strike_instrument, creator_instrument_acc, creator_strike_instrument_acc
    ).then(([sig, contract])=>{
        console.log(printed_contract(contract))
            create_doc_img(contract, (err, img, cb)=>{
            img.write("example.png");
            await publish_doc(contract)
        })
    })
```

`example.png`

![sample](https://raw.githubusercontent.com/dbanda/solana-nft-options/master/docs/contract.png)