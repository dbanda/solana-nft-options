
import { AccountLayout, Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
// import { SystemProgram } from "@solana/web3.js";
import { AccountInfo, Keypair } from "@solana/web3.js";
import { Account, Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY,  Transaction, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import Jimp from "jimp/*";
import { close_option, create_call, create_put, exercise_call, exercise_put, get_contract_from_blockchain } from "..";
import { create_doc_img, publish_doc } from "../doc";
import { OPTION_ACCOUNT_DATA_LAYOUT, OptionLayout } from "../layout";
import { print_contract, verify_contract } from "../utils";
import assert from "assert";
import { AssertionError, expect, should } from "chai";
import fs from "fs";

function get_private_key(filename){
  let rawdata = fs.readFileSync(filename);
  return JSON.parse(rawdata.toString());
}

const connection = new Connection("http://localhost:8899", 'singleGossip');

const programId = "4ktt843KtvduVq7yDdSXoTpt8uev4tBFue2pot7NdiRR"

const bob_private_key = get_private_key("src/e2e_live_tests/keypairs/bob.json")
const alice_private_key = get_private_key("src/e2e_live_tests/keypairs/alice.json")

const [,toka, tokb, alice_a, alice_b] = fs.readFileSync("src/e2e_live_tests/alice.txt").toString().split("\n")
const [toka_key, tokb_key, alice_a_key, alice_b_key] =  [new PublicKey(toka), new PublicKey(tokb), new PublicKey(alice_a), new PublicKey(alice_b)]
const [, , , bob_a, bob_b] = fs.readFileSync("src/e2e_live_tests/bob.txt").toString().split("\n")
const [bob_a_key, bob_b_key] = [new PublicKey(bob_a), new PublicKey(bob_b)]

let alice_acc = Keypair.fromSecretKey(new Uint8Array(alice_private_key))
let bob_acc = Keypair.fromSecretKey(new Uint8Array(bob_private_key))


describe("create option then exercise",  function(){
  this.timeout(600_000); // tests can take up to 10 mins
  
  it("creating an nft contract and buying it back should not change balance", async function(){
    
    let strike = 5
    let expiry = Date.now()/1000 + 600
    let multiple = 5

    return create_call(
      connection,strike, expiry, multiple, alice_acc, null, tokb_key, null, alice_b_key
    ).then(async ([s,contract])=>{
      console.log(contract, print_contract(contract))
    
        await connection.confirmTransaction(s, "finalized") // wait a while to confirm the transactions
        let option_layout = await get_contract_from_blockchain(connection, contract.account_id)
        console.log(option_layout)
        verify_contract(contract, option_layout) // verify the contract matches what is on the blockchain
    
        // try to exercise the contract
        // for this test, the buyer is the same as creator
        let buyer_acc = alice_acc
    
        let buyer_send_acc = alice_b_key
        const [buyer_nft_acc, ] = await PublicKey.findProgramAddress(
          [
            buyer_acc.publicKey.toBytes(),
            // ASSOCIATED_TOKEN_PROGRAM_ID.toBuffer(),
            TOKEN_PROGRAM_ID.toBytes(),
            contract.nft_id.toBytes()
          ], ASSOCIATED_TOKEN_PROGRAM_ID);
    
        // because we supplied instrument = null in the create call, a new mint is made
        // we find its address to receive
        const [buyer_receive_acc, ] = await PublicKey.findProgramAddress(
          [
            buyer_acc.publicKey.toBytes(),
            // ASSOCIATED_TOKEN_PROGRAM_ID.toBuffer(),
            TOKEN_PROGRAM_ID.toBytes(),
            contract.instrument.toBytes()
          ], ASSOCIATED_TOKEN_PROGRAM_ID);
    
        // confirm the nft ownership token was received
        let nft_bal = await connection.getTokenAccountBalance(buyer_nft_acc, "finalized")
        console.log("nft token balance", nft_bal.value)
        assert.equal(nft_bal.value.amount, "1")
        
        return exercise_call(connection, contract, buyer_acc, buyer_nft_acc, buyer_receive_acc, buyer_send_acc).then(async sig=>{
          console.log("tx signature", sig)
          await connection.confirmTransaction(sig, "finalized")
          // let option_layout = await get_contract_from_blockchain(connection, contract.account_id)
          // Token.getAssociatedTokenAddress()
    
          // check that the ownership nft is burned
          let nft_bal = await connection.getTokenAccountBalance(buyer_nft_acc, "finalized")
          console.log("nft token balance", nft_bal.value)
          assert.equal(nft_bal.value.amount, "0")
        }).catch()
    }).catch()
  })

  it("alice creates call then bob buys and exercises", async function(){
    
    let strike = 2
    let expiry = Date.now()/1000 + 600
    let multiple = 5

    let [s, contract] = await create_call(
      connection,strike, expiry, multiple, alice_acc, toka_key, tokb_key, alice_a_key, alice_b_key
    )
    
    console.log(contract, print_contract(contract))
  
    await connection.confirmTransaction(s, "finalized") // wait a while to confirm the transactions
    let option_layout = await get_contract_from_blockchain(connection, contract.account_id)
    console.log(option_layout)
    verify_contract(contract, option_layout) // verify the contract matches what is on the blockchain
    
    // try to exercise the contract
    // for this test, the buyer is the same as creator
    let buyer_acc = bob_acc

    let buyer_send_acc = bob_b_key
    let buyer_receive_acc = bob_a_key

    // find the address for the ownership nft
    const buyer_nft_acc = await Token.getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID, contract.nft_id, buyer_acc.publicKey)
    
    let create_acc_ix = await Token.createAssociatedTokenAccountInstruction(ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID, contract.nft_id, buyer_nft_acc, buyer_acc.publicKey, buyer_acc.publicKey)
  
    // send the ownership token to bob
    console.log("transfering ownership to bob")
    let sell_ix = Token.createTransferInstruction(TOKEN_PROGRAM_ID,new PublicKey(contract.nft_account), 
        buyer_nft_acc, alice_acc.publicKey, [alice_acc], 1 )

    var tx = new Transaction();
    tx.add(create_acc_ix, sell_ix)
    let sig_sell = await connection.sendTransaction(tx, [alice_acc, bob_acc], {skipPreflight: false, preflightCommitment: 'finalized'});
    await connection.confirmTransaction(sig_sell, "finalized");

  
    // confirm the nft ownership token was received
    let nft_bal_before = await connection.getTokenAccountBalance(buyer_nft_acc, "finalized")
    assert.equal(nft_bal_before.value.amount, "1")

    let send_bal_before = await connection.getTokenAccountBalance(buyer_send_acc, "finalized")
    let recv_bal_before = await connection.getTokenAccountBalance(buyer_receive_acc, "finalized")
        
    console.log("exercising call")
    let sig = await exercise_call(connection, contract, buyer_acc, buyer_nft_acc, buyer_receive_acc, buyer_send_acc)
    await connection.confirmTransaction(sig, "finalized")
    
    // check that the ownership nft is burned
    let nft_bal_after = await connection.getTokenAccountBalance(buyer_nft_acc, "finalized")
    assert.equal(nft_bal_after.value.amount, "0")
    
    // check amounts are correct after exercise
    let send_bal_after = await connection.getTokenAccountBalance(buyer_send_acc, "finalized")
    let recv_bal_after = await connection.getTokenAccountBalance(buyer_receive_acc, "finalized")

    assert.equal(send_bal_after.value.uiAmount, send_bal_before.value.uiAmount-(strike*multiple))
    assert.equal(recv_bal_after.value.uiAmount, recv_bal_before.value.uiAmount+multiple)

  })

  it("alice creates put then bob buys and exercises", async function(){
    
    let strike = 2
    let expiry = Date.now()/1000 + 600
    let multiple = 5

    let [s, contract] = await create_put(
      connection,strike, expiry, multiple, alice_acc, toka_key, tokb_key, alice_a_key, alice_b_key
    )
    
    console.log(contract, print_contract(contract))
  
    await connection.confirmTransaction(s, "finalized") // wait a while to confirm the transactions
    let option_layout = await get_contract_from_blockchain(connection, contract.account_id)
    console.log(option_layout)
    verify_contract(contract, option_layout) // verify the contract matches what is on the blockchain
    
    // try to exercise the contract
    let buyer_acc = bob_acc

    let buyer_send_acc = bob_a_key
    let buyer_receive_acc = bob_b_key

    // find the address for the ownership nft
    const buyer_nft_acc = await Token.getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID, contract.nft_id, buyer_acc.publicKey)
    
    let create_acc_ix = await Token.createAssociatedTokenAccountInstruction(ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID, contract.nft_id, buyer_nft_acc, buyer_acc.publicKey, buyer_acc.publicKey)
  
    // send the ownership token to bob
    console.log("transfering ownership to bob")
    let sell_ix = Token.createTransferInstruction(TOKEN_PROGRAM_ID,new PublicKey(contract.nft_account), 
        buyer_nft_acc, alice_acc.publicKey, [alice_acc], 1 )

    var tx = new Transaction();
    tx.add(create_acc_ix, sell_ix)
    let sig_sell = await connection.sendTransaction(tx, [alice_acc, bob_acc], {skipPreflight: false, preflightCommitment: 'finalized'});
    await connection.confirmTransaction(sig_sell, "finalized");

  
    // confirm the nft ownership token
    let nft_bal_before = await connection.getTokenAccountBalance(buyer_nft_acc, "finalized")
    assert.equal(nft_bal_before.value.amount, "1")

    let send_bal_before = await connection.getTokenAccountBalance(buyer_send_acc, "finalized")
    let recv_bal_before = await connection.getTokenAccountBalance(buyer_receive_acc, "finalized")
        
    console.log("exercising call")
    let sig = await exercise_put(connection, contract, buyer_acc, buyer_nft_acc, buyer_receive_acc, buyer_send_acc)
    await connection.confirmTransaction(sig, "finalized")
    
    // check that the ownership nft is burned
    let nft_bal_after = await connection.getTokenAccountBalance(buyer_nft_acc, "finalized")
    assert.equal(nft_bal_after.value.amount, "0")
    
    // check amounts are correct after exercise
    let send_bal_after = await connection.getTokenAccountBalance(buyer_send_acc, "finalized")
    let recv_bal_after = await connection.getTokenAccountBalance(buyer_receive_acc, "finalized")

    assert.equal(send_bal_after.value.uiAmount, send_bal_before.value.uiAmount-multiple)
    assert.equal(recv_bal_after.value.uiAmount, recv_bal_before.value.uiAmount+(strike*multiple))

  })

  it("bob tries to exercise a contract he doesnt own", async function(){
    
    let strike = 2
    let expiry = Date.now()/1000 + 600
    let multiple = 5

    let [s, contract] = await create_call(
      connection,strike, expiry, multiple, alice_acc, toka_key, tokb_key, alice_a_key, alice_b_key
    )
    
    console.log(contract, print_contract(contract))
  
    await connection.confirmTransaction(s, "finalized") // wait a while to confirm the transactions
    let option_layout = await get_contract_from_blockchain(connection, contract.account_id)
    console.log(option_layout)
    verify_contract(contract, option_layout) // verify the contract matches what is on the blockchain
    
    // try to exercise the contract
    let buyer_acc = bob_acc

    let buyer_send_acc = bob_b_key
    let buyer_receive_acc = bob_a_key

    // find the address for the ownership nft
    const buyer_nft_acc = await Token.getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID, contract.nft_id, buyer_acc.publicKey)
    
    let create_acc_ix = await Token.createAssociatedTokenAccountInstruction(ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID, contract.nft_id, buyer_nft_acc, buyer_acc.publicKey, buyer_acc.publicKey)
  
    var tx = new Transaction();
    tx.add(create_acc_ix)
    let sig_sell = await connection.sendTransaction(tx, [alice_acc, bob_acc], {skipPreflight: false, preflightCommitment: 'finalized'});
    await connection.confirmTransaction(sig_sell, "finalized");

  
    // confirm the nft ownership token wasn't received
    let nft_bal_before = await connection.getTokenAccountBalance(buyer_nft_acc, "finalized")
    assert.equal(nft_bal_before.value.amount, "0")

    let send_bal_before = await connection.getTokenAccountBalance(buyer_send_acc, "finalized")
    let recv_bal_before = await connection.getTokenAccountBalance(buyer_receive_acc, "finalized")
        
    console.log("exercising call")
    // expect(await exercise_call(connection, contract, buyer_acc, buyer_nft_acc, buyer_receive_acc, buyer_send_acc)).to.throw()
    await assert.rejects(exercise_call(connection, contract, buyer_acc, buyer_nft_acc, buyer_receive_acc, buyer_send_acc))
    
    // check amounts are correct after exercise
    let send_bal_after = await connection.getTokenAccountBalance(buyer_send_acc, "finalized")
    let recv_bal_after = await connection.getTokenAccountBalance(buyer_receive_acc, "finalized")

    // confirm bobs account is left untouched
    assert.equal(send_bal_after.value.uiAmount, send_bal_before.value.uiAmount)
    assert.equal(recv_bal_after.value.uiAmount, recv_bal_before.value.uiAmount)

  })
})

describe("create option then close",  function(){
  this.timeout(600_000); // tests can take up to 10 mins
  it("alice creates call then closes", async function(){
    
    let strike = 2
    let expiry = Date.now()/1000
    let multiple = 5

    let [s, contract] = await create_call(
      connection,strike, expiry, multiple, alice_acc, toka_key, tokb_key, alice_a_key, alice_b_key
    )
    
    console.log(contract, print_contract(contract))
  
    await connection.confirmTransaction(s, "finalized") // wait a while to confirm the transactions
    let option_layout = await get_contract_from_blockchain(connection, contract.account_id)
    console.log(option_layout)
    verify_contract(contract, option_layout) // verify the contract matches what is on the blockchain
    console.log("waiting 180s for contract to expire. Test will fail if validators are not current")
    await new Promise(resolve => setTimeout(resolve, 180_000)); // wait for contract to expire
    console.log("close call")
    let sig = await close_option(connection, contract, alice_acc, alice_a_key)
    await connection.confirmTransaction(sig, "finalized")
  })


  it("alice creates call then tries to close before expiry", async function(){
    
    let strike = 2
    let expiry = Date.now()/1000+600
    let multiple = 5

    let [s, contract] = await create_call(
      connection,strike, expiry, multiple, alice_acc, toka_key, tokb_key, alice_a_key, alice_b_key
    )
    
    console.log(contract, print_contract(contract))
  
    await connection.confirmTransaction(s, "finalized") // wait a while to confirm the transactions
    let option_layout = await get_contract_from_blockchain(connection, contract.account_id)
    console.log(option_layout)
    verify_contract(contract, option_layout) // verify the contract matches what is on the blockchain

    console.log("close call")
    await assert.rejects(close_option(connection, contract, alice_acc, alice_a_key))
  })
})

async function create_and_init_token_acc(mint: PublicKey, acc: PublicKey, owner: PublicKey, tx: Transaction): Promise<Transaction>{
  let create_acc_ix = SystemProgram.createAccount(  {
    programId: TOKEN_PROGRAM_ID,
    space: AccountLayout.span,
    lamports: await connection.getMinimumBalanceForRentExemption(AccountLayout.span, 'confirmed'),
    fromPubkey: owner,
    newAccountPubkey: acc
  })

  let init_acc_ix = Token.createInitAccountInstruction(TOKEN_PROGRAM_ID, mint, acc, owner)

  tx.add(create_acc_ix, init_acc_ix);
  return tx
}