import { AccountLayout, Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
// import { SystemProgram } from "@solana/web3.js";
import { AccountInfo, Keypair } from "@solana/web3.js";
import { Account, Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY,  Transaction, TransactionInstruction } from "@solana/web3.js";
// import PrintClass from "jimp"
import { assert } from "chai";
// const expect = require('chai').expect;
import { AssertionError, expect, should } from "chai";
// var sinon = require("sinon");
// import {sinon} from "sinon"
import sinon from "sinon";
import rewire from "rewire";
let [sol_key, usd_key] = [new Keypair().publicKey.toString(), new Keypair().publicKey.toString()]
let sol_options = rewire("./");

import { close_option, create_call, create_put, exercise_call, OptionType } from ".";
import { create_doc_img } from "./doc";
import { print_contract } from "./utils";
import Jimp from "jimp";
import QRCode from "easyqrcodejs-nodejs";
// import { create_call, excercise_call, OptionType } from pack;
// pack.cre
// let [create_call, excercise_call, OptionType] = [sol_options.create_call, sol_options.exercise_call,sol_options.OptionType]


const programId = "4ktt843KtvduVq7yDdSXoTpt8uev4tBFue2pot7NdiRR"

const bob_private_key = [58,61,83,12,252,164,114,167,16,61,196,241,213,70,111,76,253,145,3,249,205,251,23,52,
    237,158,140,188,84,202,116,216,78,242,2,9,33,177,53,200,7,221,76,53,149,13,243,125,153,187,239,178,76,
    197,203,88,218,186,174,108,71,19,254,203]

let creator_strike_instrument_acc = new PublicKey('8Tv1h2eNjhfQJXyNR3Ey8WwoHAF1qZW7s7aNH49oCMBP')
let creator_instrument_acc = new PublicKey("GsnpfUQTFnQBuokhttUajopkEeg4YNgwf7j2SSKhRigJ")

let creator_acc = Keypair.fromSecretKey(new Uint8Array(bob_private_key))

const connection = new Connection("http://localhost:8899", 'singleGossip');

// setup some stubs
let get_rent = sinon.fake()
sinon.replace(connection, "getMinimumBalanceForRentExemption", get_rent);
let confirm_tx = sinon.fake()
sinon.replace(connection, "confirmTransaction", confirm_tx);
let send_tx = sinon.fake()
sinon.replace(connection, "sendTransaction", send_tx);
const mocked_keypair = new Keypair()
let find_address_stub = sinon.stub()
sinon.replace(PublicKey, "findProgramAddress", find_address_stub)
find_address_stub.returns([mocked_keypair.publicKey, 42])

afterEach(function () {
    sinon.resetHistory();
});

describe('create call', function() {
    it('create call contract using existing public keys without error', async function() {

        let strike =100
        let expiry = Date.now()/1000 + 600
        let multiple = 1000000000
        let instrument = new PublicKey('D3KCKMTY8rgWtVmxKdCeugKEFbJMjSHk7iWiLMAKrrMf')
        let strike_instrument = new PublicKey('6Uhbk6FwCLLQfsKJ8kn8uCsiF5iZNVQDw5QxMNJh9XiJ')

        return create_call(
            connection,strike, expiry, multiple, creator_acc, instrument, strike_instrument, creator_instrument_acc, creator_strike_instrument_acc
        ).then(([sig, contract])=>{
        
            expect(contract.strike).to.equal(strike, "strike value")
            expect(contract.expiry).to.equal(expiry)
            expect(contract.multiple).to.equal(multiple)

            expect(contract.instrument.toString()).to.equal(instrument.toString(), "inst value")
            expect(contract.strike_instrument.toString()).to.equal(strike_instrument.toString(), "strike instr value")

            // expect(contract.nft_id.toString()).to.equal(mocked_keypair.publicKey.toString(), "nft id")
            expect(contract.nft_account.toString()).to.equal(mocked_keypair.publicKey.toString(), "nft account")
            // expect(contract.account_id.toString()).to.equal(mocked_keypair.publicKey.toString(), "account id")

            expect(contract.writer_recv_acc).to.equal(creator_strike_instrument_acc, "receiving acc")
            expect(contract.kind).to.equal(OptionType.call)

            expect(send_tx.callCount).to.equal(1, "tx sent only once")
            expect(find_address_stub.callCount).to.equal(2, "find address used twice")
        }).catch()
    });

    it('create call contract using minted nft instrument without error', async function() {

        let strike = 101
        let expiry = Date.now()/1000 + 600
        let multiple = 1000000000
        // let instrument = new PublicKey('D3KCKMTY8rgWtVmxKdCeugKEFbJMjSHk7iWiLMAKrrMf')
        let strike_instrument = new PublicKey('6Uhbk6FwCLLQfsKJ8kn8uCsiF5iZNVQDw5QxMNJh9XiJ')
        return create_call(
            connection,strike, expiry, multiple, creator_acc, null, strike_instrument, null, creator_strike_instrument_acc
        ).then(([sig, contract])=>{
        
            expect(contract.strike).to.equal(strike, "strike value")
            expect(contract.expiry).to.equal(expiry)
            expect(contract.multiple).to.equal(multiple)

            // expect(contract.instrument.toString()).to.equal(instrument.toString(), "inst value")
            expect(contract.instrument).to.be.a("object")
            expect(contract.instrument).to.be.ok;

            expect(contract.strike_instrument.toString()).to.equal(strike_instrument.toString(), "strike instr value")
            expect(contract.nft_account.toString()).to.equal(mocked_keypair.publicKey.toString(), "nft account")

            expect(contract.writer_recv_acc).to.equal(creator_strike_instrument_acc, "receiving acc")
            expect(contract.kind).to.equal(OptionType.call)

            expect(send_tx.callCount).to.equal(2, "tx sent only once")
            expect(confirm_tx.callCount).to.equal(1, "nft mint confirmed")
            expect(find_address_stub.callCount).to.equal(4, "find address used twice")
        }).catch()
    });

    it('create call contract using symbols without error', async function() {

        let strike = 101
        let expiry = Date.now()/1000 + 600
        let multiple = 1000000000
        // let instrument = new PublicKey('D3KCKMTY8rgWtVmxKdCeugKEFbJMjSHk7iWiLMAKrrMf')
        // let strike_instrument = new PublicKey('6Uhbk6FwCLLQfsKJ8kn8uCsiF5iZNVQDw5QxMNJh9XiJ')

        let fake_tok_list = [{symbol: "SOL", address: sol_key},  {symbol: "USDC", address: usd_key }]
        sol_options.__set__("TOKEN_LIST", fake_tok_list )
        console.log("using token list", fake_tok_list)

        let [create_call, excercise_call, OptionType] = [sol_options.create_call, sol_options.exercise_call,sol_options.OptionType]
        return create_call(
            connection,strike, expiry, multiple, creator_acc, "USDC", "SOL", creator_instrument_acc, creator_strike_instrument_acc
        ).then(([sig, contract])=>{
            expect(contract.instrument.toString()).to.be.equal(usd_key, "use USD token")
            expect(contract.strike_instrument.toString()).to.equal(sol_key, "use SOL strike instr value")
            expect(contract.nft_account.toString()).to.equal(mocked_keypair.publicKey.toString(), "nft account")
            expect(contract.kind).to.equal(OptionType.call)
            expect(send_tx.callCount).to.equal(1, "tx sent only once")
            expect(confirm_tx.callCount).to.equal(0, "nft mint confirmed")
            expect(find_address_stub.callCount).to.equal(2, "find address used twice")
        }).catch()
    });

    it('create call contract using minted nft instrument and symbol strike instrument without error', async function() {

        let strike = 101
        let expiry = Date.now()/1000 + 600
        let multiple = 1000000000

        let fake_tok_list = [{symbol: "SOL", address: sol_key},  {symbol: "USDC", address: usd_key }]
        sol_options.__set__("TOKEN_LIST", fake_tok_list )
        console.log("using token list", fake_tok_list)

        let [create_call, excercise_call, OptionType] = [sol_options.create_call, sol_options.exercise_call,sol_options.OptionType]
        return create_call(
            connection,strike, expiry, multiple, creator_acc, null, "SOL", null, creator_strike_instrument_acc
        ).then(([sig, contract])=>{
        
            expect(contract.strike).to.equal(strike, "strike value")
            expect(contract.expiry).to.equal(expiry)
            expect(contract.multiple).to.equal(multiple)

            // expect(contract.instrument.toString()).to.equal(instrument.toString(), "inst value")
            expect(contract.instrument).to.be.a("object")
            expect(contract.instrument).to.be.ok;

            expect(contract.strike_instrument.toString()).to.equal(sol_key.toString(), "strike instr value")
            expect(contract.nft_account.toString()).to.equal(mocked_keypair.publicKey.toString(), "nft account")

            expect(contract.writer_recv_acc).to.equal(creator_strike_instrument_acc, "receiving acc")
            expect(contract.kind).to.equal(OptionType.call)

            expect(send_tx.callCount).to.equal(2, "tx sent only once")
            expect(confirm_tx.callCount).to.equal(1, "nft mint confirmed")
            expect(find_address_stub.callCount).to.equal(4, "find address used twice")
        }).catch()
    });

    it('create call contract then close it without error', async function() {

        let strike =100
        let expiry = Date.now()/1000 + 600
        let multiple = 1000000000
        let instrument = new PublicKey('D3KCKMTY8rgWtVmxKdCeugKEFbJMjSHk7iWiLMAKrrMf')
        let strike_instrument = new PublicKey('6Uhbk6FwCLLQfsKJ8kn8uCsiF5iZNVQDw5QxMNJh9XiJ')

        return create_call(
            connection,strike, expiry, multiple, creator_acc, instrument, strike_instrument, creator_instrument_acc, creator_strike_instrument_acc
        ).then(([sig, contract])=>{
            return close_option(connection, contract, creator_acc, creator_instrument_acc).then(sig=>{
                expect(send_tx.callCount).to.equal(2, "tx sent only once")
                expect(find_address_stub.callCount).to.equal(3, "find address used twice")
            })
 
        }).catch()
    });
});

describe("create put", function(){
    it('create put contract has correct receiving address', async function() {

        let strike =100
        let expiry = Date.now()/1000 + 600
        let multiple = 1000000000
        let instrument = new PublicKey('D3KCKMTY8rgWtVmxKdCeugKEFbJMjSHk7iWiLMAKrrMf')
        let strike_instrument = new PublicKey('6Uhbk6FwCLLQfsKJ8kn8uCsiF5iZNVQDw5QxMNJh9XiJ')

        return create_put(
            connection,strike, expiry, multiple, creator_acc, instrument, strike_instrument, creator_instrument_acc, creator_strike_instrument_acc
        ).then(([sig, contract])=>{
        
            expect(contract.strike).to.equal(strike, "strike value")
            expect(contract.expiry).to.equal(expiry)
            expect(contract.multiple).to.equal(multiple)

            expect(contract.instrument.toString()).to.equal(instrument.toString(), "inst value")
            expect(contract.strike_instrument.toString()).to.equal(strike_instrument.toString(), "strike instr value")

            // expect(contract.nft_id.toString()).to.equal(mocked_keypair.publicKey.toString(), "nft id")
            expect(contract.nft_account.toString()).to.equal(mocked_keypair.publicKey.toString(), "nft account")
            // expect(contract.account_id.toString()).to.equal(mocked_keypair.publicKey.toString(), "account id")

            expect(contract.writer_recv_acc).to.equal(creator_instrument_acc, "receiving acc")
            expect(contract.kind).to.equal(OptionType.put, "contract type")

            expect(send_tx.callCount).to.equal(1, "tx sent only once")
            expect(find_address_stub.callCount).to.equal(2, "find address used twice")
        }).catch()
    });
})

describe("exercise contract", function(){
    it('exercising a call contract ', async function() {

        let strike = 100
        let expiry = Date.now()/1000 + 600
        let multiple = 1000000000
        let instrument = new PublicKey('D3KCKMTY8rgWtVmxKdCeugKEFbJMjSHk7iWiLMAKrrMf')
        let strike_instrument = new PublicKey('6Uhbk6FwCLLQfsKJ8kn8uCsiF5iZNVQDw5QxMNJh9XiJ')

        return create_call(
            connection,strike, expiry, multiple, creator_acc, instrument, strike_instrument, creator_instrument_acc, creator_strike_instrument_acc
        ).then(([sig, contract])=>{
        
            expect(contract.strike).to.equal(strike, "strike value")
            expect(contract.expiry).to.equal(expiry)
            expect(contract.multiple).to.equal(multiple)

            expect(contract.instrument.toString()).to.equal(instrument.toString(), "inst value")
            expect(contract.strike_instrument.toString()).to.equal(strike_instrument.toString(), "strike instr value")

            // expect(contract.nft_id.toString()).to.equal(mocked_keypair.publicKey.toString(), "nft id")
            expect(contract.nft_account.toString()).to.equal(mocked_keypair.publicKey.toString(), "nft account")
            // expect(contract.account_id.toString()).to.equal(mocked_keypair.publicKey.toString(), "account id")

            expect(contract.writer_recv_acc).to.equal(creator_strike_instrument_acc, "receiving acc")
            expect(contract.kind).to.equal(OptionType.call, "contract type")

            expect(send_tx.callCount).to.equal(1, "tx sent only once")
            expect(find_address_stub.callCount).to.equal(2, "find address used twice")

            let buyer_nft_acc = new Keypair().publicKey
            let buyer_send_acc= new Keypair().publicKey
            let buyer_receive_acc = new Keypair().publicKey
            let buyer_acc = creator_acc
            return exercise_call(connection, contract, buyer_acc, buyer_nft_acc, buyer_receive_acc, buyer_send_acc).then(sig=>{
                expect(send_tx.callCount).to.equal(2, "tx sent only once")
                expect(find_address_stub.callCount).to.equal(3, "find address used twice")
            })
        }).catch()
    });

    it('exercising an expired contract should fail ', async function() {

        let strike =100
        let expiry = Date.now()/1000 - 600
        let multiple = 1000000000
        let instrument = new PublicKey('D3KCKMTY8rgWtVmxKdCeugKEFbJMjSHk7iWiLMAKrrMf')
        let strike_instrument = new PublicKey('6Uhbk6FwCLLQfsKJ8kn8uCsiF5iZNVQDw5QxMNJh9XiJ')
        
        return create_call(
            connection,strike, expiry, multiple, creator_acc, instrument, strike_instrument, creator_instrument_acc, creator_strike_instrument_acc
        ).then(async ([sig, contract])=>{
            
            expect(contract.strike).to.equal(strike, "strike value")
            expect(contract.expiry).to.equal(expiry)
            expect(contract.multiple).to.equal(multiple)

            expect(contract.instrument.toString()).to.equal(instrument.toString(), "inst value")
            expect(contract.strike_instrument.toString()).to.equal(strike_instrument.toString(), "strike instr value")

            // expect(contract.nft_id.toString()).to.equal(mocked_keypair.publicKey.toString(), "nft id")
            expect(contract.nft_account.toString()).to.equal(mocked_keypair.publicKey.toString(), "nft account")
            // expect(contract.account_id.toString()).to.equal(mocked_keypair.publicKey.toString(), "account id")

            expect(contract.writer_recv_acc).to.equal(creator_strike_instrument_acc, "receiving acc")
            expect(contract.kind).to.equal(OptionType.call, "contract type")

            expect(send_tx.callCount).to.equal(1, "tx sent only once")
            expect(find_address_stub.callCount).to.equal(2, "find address used twice")

            let buyer_nft_acc = new Keypair().publicKey
            let buyer_send_acc= new Keypair().publicKey
            let buyer_receive_acc = new Keypair().publicKey
            let buyer_acc = creator_acc
            return exercise_call(connection, contract, buyer_acc, buyer_nft_acc, buyer_receive_acc, buyer_send_acc).then(async sig=>{
                assert.fail("expire contract should not be exercised")
            }).catch(err=>{
                expect(err).to.be.equal("contract has exipired")
            })
        }).catch(err=>{
            assert.fail(err)
        })
    });
})


describe("create contract doc", function(){
    this.timeout(20_000);
    it('create put contract doc', function() {

        let strike =100
        let expiry = Date.now()/1000 + 600
        let multiple = 1000000000
        let instrument = new PublicKey('D3KCKMTY8rgWtVmxKdCeugKEFbJMjSHk7iWiLMAKrrMf')
        let strike_instrument = new PublicKey('6Uhbk6FwCLLQfsKJ8kn8uCsiF5iZNVQDw5QxMNJh9XiJ')
        
        let font_spy = sinon.spy(Jimp, "loadFont")
        let qrcode_spy = sinon.spy(QRCode.prototype, "toDataURL")

        return create_put(
            connection,strike, expiry, multiple, creator_acc, instrument, strike_instrument, creator_instrument_acc, creator_strike_instrument_acc
        ).then(([sig,contract])=>{
            return create_doc_img(contract).then(img=>{
                console.log("calling cb", !!img)
                expect(font_spy.callCount).to.equal(3)
                expect(qrcode_spy.callCount).to.equal(1)
            })
        }).catch()   
    });
})