// #![cfg(feature = "test-bpf")]
// integration tests 
use solana_options::entrypoint::{process_instruction};
use solana_options::state::{SOLOPTION_SIZE};
use solana_program::{
    pubkey::Pubkey,
    system_instruction::{create_account},
    system_program,
    program_pack::{Pack},
    sysvar,
};
use std::time::SystemTime;
use solana_program_test::*;
use solana_sdk::{
    hash::Hash,
    instruction::{AccountMeta, Instruction},
    signature::{Keypair, Signer},
    transaction::Transaction,
    account::Account,
    system_instruction
};
mod token_actions;
use spl_token;
use spl_associated_token_account::{
    get_associated_token_address,
    create_associated_token_account
};
use solana_program::native_token::LAMPORTS_PER_SOL;


pub struct TestOptions {
    alice_acc : Keypair,
    bob_acc : Keypair,
    tok_a: Keypair,
    tok_a_key: Pubkey,
    tok_b: Keypair,
    tok_b_key: Pubkey,
    alice_a: Keypair,
    alice_a_key: Pubkey,
    alice_b: Keypair,
    alice_b_key: Pubkey,
    bob_a: Keypair,
    bob_a_key: Pubkey,
    bob_b: Keypair,
    bob_b_key: Pubkey,
    collateral_acc: Keypair,
    nft_token_acc: Keypair,
    nft_associated_token_acc: Pubkey,
    program_id : Pubkey,
    options_acc: Keypair,
}

fn init_test(program_id: Pubkey)->TestOptions{

    // let ass_token_acc = get_associated_token_address(&test_options.alice_acc.pubkey(), &test_options.nft_token_acc);

    return TestOptions{
        alice_acc : Keypair::new(),
        bob_acc : Keypair::new(),
        tok_a: Keypair::new(),
        tok_a_key: Pubkey::new_unique(),
        tok_b: Keypair::new(),
        tok_b_key: Pubkey::new_unique(),
        alice_a: Keypair::new(),
        alice_a_key: Pubkey::new_unique(),
        alice_b: Keypair::new(),
        alice_b_key: Pubkey::new_unique(),
        bob_a: Keypair::new(),
        bob_a_key: Pubkey::new_unique(),
        bob_b: Keypair::new(),
        bob_b_key: Pubkey::new_unique(),
        collateral_acc: Keypair::new(),
        nft_token_acc: Keypair::new(),
        nft_associated_token_acc: Pubkey::new_unique(),
        options_acc: Keypair::new(),
        program_id: program_id,
    }

}
#[tokio::test]
async fn test_create_minted_nft_call() {
    let current_time: i64 = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs().try_into().unwrap();
    let strike : u64 = 69;
    let multiple : u64 = 420;
    let expiry : i64 = current_time + 600; // expire 10 mins from now
    let kind : u8 = 0; //call

    let (mut banks_client, recent_blockhash, mut test_options) = start_test().await;
    create_nft_option(multiple, &mut test_options, &mut banks_client, recent_blockhash).await;

    let alice_a_acc = banks_client.get_account(test_options.alice_a_key).await.unwrap().unwrap();
    let alice_a_bal = spl_token::state::Account::unpack_from_slice(&alice_a_acc.data).unwrap();
    assert_eq!(alice_a_bal.amount, multiple);  // check that tokens are minted

    create_option(strike, multiple, expiry, kind, &mut test_options, &mut banks_client, recent_blockhash).await;

       // alice transfers token to bob
    alice_sends_nft_to_bob(&mut banks_client, &test_options, recent_blockhash).await;
    let (_, _, _, _, alice_nft_after) = get_balances(&mut banks_client, &test_options).await;
    assert_eq!(alice_nft_after,0);

    // bob sends an exercise instruction
    exercise_option(strike, multiple, kind, &test_options, &mut banks_client, recent_blockhash).await;
    let (alice_a_after, _, _, _, _) = get_balances(&mut banks_client, &test_options).await;
    assert_eq!(alice_a_after, 0) // exercising the call transfers all minted nft tokens
}

#[tokio::test]
async fn test_create_call() {
    let strike : u64 = 69;
    let multiple : u64 = 420;
    let expiry : i64 = 123; 
    let kind : u8 = 0; //call

    let (mut banks_client, recent_blockhash, mut test_options) = start_test().await;
    create_option(strike, multiple, expiry, kind, &mut test_options, &mut banks_client, recent_blockhash).await;
}

#[tokio::test]
async fn test_create_call_native() {
    let strike : u64 = 69;
    let multiple : u64 = 420;
    let expiry : i64 = 123; 
    let kind : u8 = 0; //call

    let (mut banks_client, recent_blockhash, mut test_options) = start_test().await;
    test_options.alice_a = Keypair::new();
    test_options.alice_a_key = test_options.alice_a.pubkey();
    test_options.tok_a_key = spl_token::native_mint::id();
    token_actions::create_account(&mut banks_client, &test_options.alice_acc, recent_blockhash, &test_options.alice_a, 
        &spl_token::native_mint::id(), &test_options.alice_acc.pubkey()).await.unwrap();
    create_option(strike, multiple, expiry, kind, &mut test_options, &mut banks_client, recent_blockhash).await;
}

#[tokio::test]
async fn test_create_put() {
    let strike : u64 = 69;
    let multiple : u64 = 420;
    let expiry : i64 = 1223;
    let kind : u8 = 1; //call

    let (mut banks_client, recent_blockhash, mut test_options) = start_test().await;
    create_option(strike, multiple, expiry, kind, &mut test_options, &mut banks_client, recent_blockhash).await;
}

#[tokio::test]
async fn test_create_put_native() {
    let strike : u64 = 69;
    let multiple : u64 = 420;
    let expiry : i64 = 1223;
    let kind : u8 = 1; //call

    let (mut banks_client, recent_blockhash, mut test_options) = start_test().await;
    test_options.alice_b = Keypair::new();
    test_options.alice_b_key = test_options.alice_a.pubkey();
    test_options.tok_b_key = spl_token::native_mint::id();
    token_actions::create_account(&mut banks_client, &test_options.alice_acc, recent_blockhash, &test_options.alice_b, 
        &spl_token::native_mint::id(), &test_options.alice_acc.pubkey()).await.unwrap();
    create_option(strike, multiple, expiry, kind, &mut test_options, &mut banks_client, recent_blockhash).await;
}


#[tokio::test]
async fn test_create_then_exercise_call() {
    let current_time: i64 = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs().try_into().unwrap();

    let strike : u64 = 69;
    let multiple : u64 = 420;
    let expiry : i64 = current_time + 600; // expire 10 mins from now
    let kind : u8 = 0; //call

    let (mut banks_client, recent_blockhash, mut test_options) = start_test().await;
    let (alice_a_before, alice_b_before, bob_a_before, bob_b_before, _) = get_balances(&mut banks_client, &test_options).await;
    create_option(strike, multiple, expiry, kind, &mut test_options, &mut banks_client, recent_blockhash).await;

    // check collateral transfered
    let (alice_a_after, alice_b_after, _, _, alice_nft_after) = get_balances(&mut banks_client, &test_options).await;
    assert_eq!(alice_a_before-multiple, alice_a_after);
    assert_eq!(alice_b_before, alice_b_after);
    assert_eq!(alice_nft_after, 1);
   
    // alice transfers token to bob
    alice_sends_nft_to_bob(&mut banks_client, &test_options, recent_blockhash).await;
    let (_, _, _, _, alice_nft_after) = get_balances(&mut banks_client, &test_options).await;
    assert_eq!(alice_nft_after,0);

    // bob sends an exercise instruction
    exercise_option(strike, multiple, kind, &test_options, &mut banks_client, recent_blockhash).await;

    // check final balances
    let (alice_a_final, alice_b_final, bob_a_final, bob_b_final, _) = get_balances(&mut banks_client, &test_options).await;
    assert_eq!(alice_a_before-multiple, alice_a_final);
    assert_eq!(alice_b_before+strike*multiple, alice_b_final);
    assert_eq!(bob_a_before+multiple, bob_a_final);
    assert_eq!(bob_b_before-strike*multiple, bob_b_final);
    check_closed(&test_options, &mut banks_client).await;
}

#[tokio::test]
async fn test_create_then_exercise_call_native() {
    let current_time: i64 = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs().try_into().unwrap();

    let strike : u64 = 69;
    let multiple : u64 = 420;
    let expiry : i64 = current_time + 600; // expire 10 mins from now
    let kind : u8 = 0; //call

    let (mut banks_client, recent_blockhash, mut test_options) = start_test().await;
    test_options.alice_a = Keypair::new();
    test_options.alice_a_key = test_options.alice_a.pubkey();
    test_options.tok_a_key = spl_token::native_mint::id();
    token_actions::create_account(&mut banks_client, &test_options.alice_acc, recent_blockhash, &test_options.alice_a, 
        &spl_token::native_mint::id(), &test_options.alice_acc.pubkey()).await.unwrap();
    let (alice_a_before, alice_b_before, bob_a_before, bob_b_before, _) = get_balances(&mut banks_client, &test_options).await;
    create_option(strike, multiple, expiry, kind, &mut test_options, &mut banks_client, recent_blockhash).await;

    // check collateral transfered
    let (alice_a_after, alice_b_after, _, _, alice_nft_after) = get_balances(&mut banks_client, &test_options).await;
    let collateral_acc = banks_client.get_account(test_options.collateral_acc.pubkey()).await.unwrap().unwrap();
    let rent = banks_client.get_rent().await.unwrap();
    let account_rent = rent.minimum_balance(spl_token::state::Account::LEN);
    assert_eq!(collateral_acc.lamports, multiple*LAMPORTS_PER_SOL+account_rent);
    // assert_eq!(alice_a_before-multiple, alice_a_after);
    assert_eq!(alice_b_before, alice_b_after);
    assert_eq!(alice_nft_after, 1);
   
    // alice transfers token to bob
    alice_sends_nft_to_bob(&mut banks_client, &test_options, recent_blockhash).await;
    let (_, _, _, _, alice_nft_after) = get_balances(&mut banks_client, &test_options).await;
    assert_eq!(alice_nft_after,0);

    // bob sends an exercise instruction
    let bob_acc_before = banks_client.get_balance(test_options.bob_acc.pubkey()).await.unwrap();
    exercise_option(strike, multiple, kind, &test_options, &mut banks_client, recent_blockhash).await;

    // // check final balances
    let (alice_a_final, alice_b_final, bob_a_final, bob_b_final, _) = get_balances(&mut banks_client, &test_options).await;
    // assert_eq!(alice_a_before-multiple, alice_a_final);
    assert_eq!(alice_b_before+strike*multiple, alice_b_final);
    let bob_acc_after = banks_client.get_account(test_options.bob_acc.pubkey()).await.unwrap().unwrap().lamports;
    assert_eq!(bob_acc_before+multiple*LAMPORTS_PER_SOL, bob_acc_after);
    assert_eq!(bob_b_before-strike*multiple, bob_b_final);
    check_closed(&test_options, &mut banks_client).await;
}


#[tokio::test]
async fn test_create_then_exercise_put() {
    let current_time: i64 = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs().try_into().unwrap();

    let strike : u64 = 69;
    let multiple : u64 = 420;
    let expiry : i64 = current_time + 600; // expire 10 mins from now
    let kind : u8 = 1; //put

    let (mut banks_client, recent_blockhash, mut test_options) = start_test().await;
    let (alice_a_before, alice_b_before, bob_a_before, bob_b_before, alice_nft_before) = get_balances(&mut banks_client, &test_options).await;
    assert_eq!(alice_nft_before, 0);
    create_option(strike, multiple, expiry, kind, &mut test_options, &mut banks_client, recent_blockhash).await;

    // check collateral moved
    let (alice_a_after, alice_b_after, _, _, alice_nft_after) = get_balances(&mut banks_client, &test_options).await;
    assert_eq!(alice_a_before, alice_a_after);
    assert_eq!(alice_b_before-strike*multiple, alice_b_after);
    assert_eq!(alice_nft_after, 1);
   
    // alice transfers token to bob
    alice_sends_nft_to_bob(&mut banks_client, &test_options, recent_blockhash).await;
    let (_, _, _, _, alice_nft_after_send) = get_balances(&mut banks_client, &test_options).await;
    assert_eq!(alice_nft_after_send, 0); //sent to bob

    // bob sends an exercise instruction
    exercise_option(strike, multiple, kind, &test_options, &mut banks_client, recent_blockhash).await;
    let (alice_a_final, alice_b_final, bob_a_final, bob_b_final, alice_nft_final) = get_balances(&mut banks_client, &test_options).await;
    
    // check final balances
    assert_eq!(alice_nft_final, 0);
    assert_eq!(alice_a_before+multiple, alice_a_final);
    assert_eq!(alice_b_before-strike*multiple, alice_b_final);
    assert_eq!(bob_a_before-multiple, bob_a_final);
    assert_eq!(bob_b_before+strike*multiple, bob_b_final);
    check_closed(&test_options, &mut banks_client).await;
}

#[tokio::test]
async fn test_create_then_exercise_put_native() {
    let current_time: i64 = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs().try_into().unwrap();

    let strike : u64 = 69;
    let multiple : u64 = 420;
    let expiry : i64 = current_time + 600; // expire 10 mins from now
    let kind : u8 = 1; //put

    let (mut banks_client, recent_blockhash, mut test_options) = start_test().await;
    let (alice_a_before, alice_b_before, bob_a_before, bob_b_before, alice_nft_before) = get_balances(&mut banks_client, &test_options).await;
    assert_eq!(alice_nft_before, 0);
    // let alice_acc_before = banks_client.get_balance(test_options.alice_acc.pubkey()).await.unwrap();
    test_options.alice_b = Keypair::new();
    test_options.alice_b_key = test_options.alice_a.pubkey();
    test_options.tok_b_key = spl_token::native_mint::id();
    token_actions::create_account(&mut banks_client, &test_options.alice_acc, recent_blockhash, &test_options.alice_b, 
        &spl_token::native_mint::id(), &test_options.alice_acc.pubkey()).await.unwrap();
    create_option(strike, multiple, expiry, kind, &mut test_options, &mut banks_client, recent_blockhash).await;

    // check collateral moved
    // let alice_acc_after = banks_client.get_balance(test_options.alice_acc.pubkey()).await.unwrap();
    let (alice_a_after, alice_b_after, _, _, alice_nft_after) = get_balances(&mut banks_client, &test_options).await;
    let collateral_acc = banks_client.get_account(test_options.collateral_acc.pubkey()).await.unwrap().unwrap();
    let rent = banks_client.get_rent().await.unwrap();
    let account_rent = rent.minimum_balance(spl_token::state::Account::LEN);
    assert_eq!(collateral_acc.lamports, strike*multiple*LAMPORTS_PER_SOL+account_rent);
    assert_eq!(alice_nft_after, 1);
   
    // alice transfers token to bob
    alice_sends_nft_to_bob(&mut banks_client, &test_options, recent_blockhash).await;
    let (_, _, _, _, alice_nft_after_send) = get_balances(&mut banks_client, &test_options).await;
    assert_eq!(alice_nft_after_send, 0); //sent to bob

    // bob sends an exercise instruction
    let bob_acc_before = banks_client.get_balance(test_options.bob_acc.pubkey()).await.unwrap();
    exercise_option(strike, multiple, kind, &test_options, &mut banks_client, recent_blockhash).await;
    let (alice_a_final, alice_b_final, bob_a_final, bob_b_final, alice_nft_final) = get_balances(&mut banks_client, &test_options).await;
    let bob_acc_after = banks_client.get_balance(test_options.bob_acc.pubkey()).await.unwrap();
    
    // check final balances
    assert_eq!(alice_nft_final, 0);
    assert_eq!(alice_a_before+multiple, alice_a_final);
    // assert_eq!(alice_b_before-strike*multiple, alice_b_final);
    assert_eq!(bob_a_before-multiple, bob_a_final);
    assert_eq!(bob_acc_before+strike*multiple*LAMPORTS_PER_SOL, bob_acc_after);
    check_closed(&test_options, &mut banks_client).await;
}

#[tokio::test]
#[should_panic]
async fn test_create_then_exercise_wrong_strike() {
    let current_time: i64 = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs().try_into().unwrap();
    let strike : u64 = 69;
    let multiple : u64 = 420;
    let expiry : i64 = current_time + 600; // expire 10 mins from now
    let kind : u8 = 1; //put
    let (mut banks_client, recent_blockhash, mut test_options) = start_test().await;
    create_option(strike, multiple, expiry, kind, &mut test_options, &mut banks_client, recent_blockhash).await;
    alice_sends_nft_to_bob(&mut banks_client, &test_options, recent_blockhash).await;
    exercise_option(strike+1, multiple, kind, &test_options, &mut banks_client, recent_blockhash).await;
}

#[tokio::test]
#[should_panic]
async fn test_create_then_exercise_expired() {
    let current_time: i64 = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs().try_into().unwrap();
    let strike : u64 = 69;
    let multiple : u64 = 420;
    let expiry : i64 = current_time - 1; // expired 1 sec ago
    let kind : u8 = 1; //put
    let (mut banks_client, recent_blockhash, mut test_options) = start_test().await;
    create_option(strike, multiple, expiry, kind, &mut test_options, &mut banks_client, recent_blockhash).await;
    alice_sends_nft_to_bob(&mut banks_client, &test_options, recent_blockhash).await;
    exercise_option(strike+1, multiple, kind, &test_options, &mut banks_client, recent_blockhash).await;
}

#[tokio::test]
async fn test_create_then_close_expired() {
    let current_time: i64 = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs().try_into().unwrap();
    let strike : u64 = 69;
    let multiple : u64 = 420;
    let expiry : i64 = current_time - 1; // expired 1 sec ago
    let kind : u8 = 1; //put
    let (mut banks_client, recent_blockhash, mut test_options) = start_test().await;
    let (alice_a_before, alice_b_before, bob_a_before, bob_b_before, _) = get_balances(&mut banks_client, &test_options).await;
    create_option(strike, multiple, expiry, kind, &mut test_options, &mut banks_client, recent_blockhash).await;
    alice_sends_nft_to_bob(&mut banks_client, &test_options, recent_blockhash).await;
    close_option(kind, &test_options, &mut banks_client, recent_blockhash).await;
    // everything as before
    let (alice_a_after, alice_b_after, bob_a_after, bob_b_after, _) = get_balances(&mut banks_client, &test_options).await;
    assert_eq!(alice_a_before, alice_a_after);
    assert_eq!(alice_b_before, alice_b_after);
    assert_eq!(bob_a_before, bob_a_after);
    assert_eq!(bob_b_before, bob_b_after);
    check_closed(&test_options, &mut banks_client).await;
}

#[tokio::test]
#[should_panic]
async fn test_create_then_close_active() {
    let current_time: i64 = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs().try_into().unwrap();
    let strike : u64 = 69;
    let multiple : u64 = 420;
    let expiry : i64 = current_time + 600; // expires in 10 mins
    let kind : u8 = 0; //call
    let (mut banks_client, recent_blockhash, mut test_options) = start_test().await;
    create_option(strike, multiple, expiry, kind, &mut test_options, &mut banks_client, recent_blockhash).await;
    alice_sends_nft_to_bob(&mut banks_client, &test_options, recent_blockhash).await;
    close_option(kind, &test_options, &mut banks_client, recent_blockhash).await;
}

#[tokio::test]
#[should_panic]
async fn test_create_then_exercise_twice() {
    let current_time: i64 = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs().try_into().unwrap();

    let strike : u64 = 69;
    let multiple : u64 = 420;
    let expiry : i64 = current_time + 600; // expire 10 mins from now
    let kind : u8 = 1; //put

    let (mut banks_client, recent_blockhash, mut test_options) = start_test().await;
    create_option(strike, multiple, expiry, kind, &mut test_options, &mut banks_client, recent_blockhash).await;
   
    // alice transfers token to bob
    alice_sends_nft_to_bob(&mut banks_client, &test_options, recent_blockhash).await;

    // bob sends an exercise instruction
    exercise_option(strike, multiple, kind, &test_options, &mut banks_client, recent_blockhash).await;
    let (next_hash, _fee_calc) = banks_client.get_new_blockhash(&recent_blockhash).await.unwrap();
    exercise_option(strike, multiple, kind, &test_options, &mut banks_client, next_hash).await;
}

async fn start_test()-> (BanksClient, Hash, TestOptions){
    let program_id =  Pubkey::new_unique();
    let mut program_test = ProgramTest::new(
        "solana_options", // Run the BPF version with `cargo test-bpf`
        program_id,
        processor!(process_instruction), // Run the native version with `cargo test`
    );
    let mut test_options = init_test(program_id);
    program_test.add_builtin_program("spl_token", spl_token::id(), processor!(spl_token::processor::Processor::process).unwrap());


    let (mut banks_client, payer, recent_blockhash) = program_test.start().await;
    test_options.alice_acc = payer;
    setup(&mut banks_client, recent_blockhash, &mut test_options).await;
    return (banks_client, recent_blockhash, test_options)
}

async fn create_option(strike: u64, multiple: u64, expiry: i64, kind: u8,
     test_options: &mut TestOptions, banks_client: &mut BanksClient, recent_blockhash: Hash){
    test_options.nft_associated_token_acc = get_associated_token_address(&test_options.alice_acc.pubkey(), &test_options.nft_token_acc.pubkey());
    let (pda, _bump_seed) = Pubkey::find_program_address(&[b"optionsnft"], &test_options.program_id);
    let accounts = vec![
        AccountMeta::new(test_options.alice_acc.pubkey(), true),
        AccountMeta::new(test_options.collateral_acc.pubkey(), false),
        AccountMeta::new(test_options.alice_a_key, false),
        AccountMeta::new(test_options.alice_b_key, false),
        AccountMeta::new(test_options.nft_token_acc.pubkey(), true),
        AccountMeta::new_readonly(spl_token::id(), false),
        AccountMeta::new_readonly(sysvar::rent::id(), false),
        AccountMeta::new_readonly(system_program::id(), false),
        AccountMeta::new(test_options.nft_associated_token_acc, false),
        AccountMeta::new_readonly(spl_associated_token_account::id(), false),
        AccountMeta::new(test_options.options_acc.pubkey(), false),
        AccountMeta::new(pda, false),
    ];

    let mut buf = Vec::<u8>::with_capacity(25);
    buf.push(0);
    buf.extend_from_slice(&strike.to_le_bytes());
    buf.extend_from_slice(&multiple.to_le_bytes());
    buf.extend_from_slice(&expiry.to_le_bytes());
    buf.push(kind);

    // create collateral acc

    if kind == 0 {
        token_actions::create_account(banks_client, &test_options.alice_acc, recent_blockhash, &test_options.collateral_acc, 
            &test_options.tok_a_key, &test_options.alice_acc.pubkey()).await.unwrap();
    }else {
        token_actions::create_account(banks_client, &test_options.alice_acc, recent_blockhash, &test_options.collateral_acc, 
            &test_options.tok_b_key, &test_options.alice_acc.pubkey()).await.unwrap();
    }


    let create_tx = Transaction::new_signed_with_payer(
        &[
            Instruction {
                program_id: test_options.program_id,
                accounts : accounts ,
                data : buf

            }
        ],
        Some(&test_options.alice_acc.pubkey()),
        &[&test_options.alice_acc, &test_options.nft_token_acc],
        recent_blockhash,
    );
    banks_client.process_transaction(create_tx).await.unwrap();
}

async fn create_nft_option(multiple: u64, test_options: &mut TestOptions, banks_client: &mut BanksClient, recent_blockhash: Hash){
    test_options.nft_associated_token_acc = get_associated_token_address(&test_options.alice_acc.pubkey(), &test_options.nft_token_acc.pubkey());
    let (pda, _bump_seed) = Pubkey::find_program_address(&[b"optionsnft"], &test_options.program_id);
    let instrument_mint_acc = Keypair::new();
    test_options.alice_a_key = get_associated_token_address(&test_options.alice_acc.pubkey(), &instrument_mint_acc.pubkey());
    test_options.bob_a_key = get_associated_token_address(&test_options.bob_acc.pubkey(), &instrument_mint_acc.pubkey());
    test_options.tok_a_key = instrument_mint_acc.pubkey();
    test_options.tok_a = instrument_mint_acc;

    let create_bob_a_ix = create_associated_token_account(&test_options.alice_acc.pubkey(), 
                        &test_options.bob_acc.pubkey(), &test_options.tok_a.pubkey());

    let rent = banks_client.get_rent().await.unwrap();
    let mint_acc_rent = rent.minimum_balance(spl_token::state::Mint::LEN);
    let create_mint_acc_ix = create_account(
        &test_options.alice_acc.pubkey(),
        &test_options.tok_a.pubkey(),
        mint_acc_rent,
        spl_token::state::Mint::LEN as u64,
        &spl_token::id(),
    );

    let accounts = vec![
        AccountMeta::new(test_options.alice_acc.pubkey(), true),
        AccountMeta::new(test_options.alice_a_key, false),
        AccountMeta::new_readonly(spl_token::id(), false),
        AccountMeta::new_readonly(sysvar::rent::id(), false),
        AccountMeta::new_readonly(system_program::id(), false),
        AccountMeta::new_readonly(spl_associated_token_account::id(), false),
        AccountMeta::new(pda, false),
        AccountMeta::new(test_options.tok_a.pubkey(), false),
    ];

    let mut buf = Vec::<u8>::with_capacity(9);
    buf.push(2);
    buf.extend_from_slice(&multiple.to_le_bytes());

    // create collateral acc
    let create_mint_tx = Transaction::new_signed_with_payer(
        &[
            create_mint_acc_ix,            
            Instruction {
                program_id: test_options.program_id,
                accounts : accounts ,
                data : buf

            },
            create_bob_a_ix,
        ],
        Some(&test_options.alice_acc.pubkey()),
        &[&test_options.tok_a, &test_options.alice_acc],
        recent_blockhash,
    );
    banks_client.process_transaction(create_mint_tx).await.unwrap();
}

async fn exercise_option(strike: u64, multiple: u64, kind: u8,
    test_options: &TestOptions, banks_client: &mut BanksClient, recent_blockhash: Hash){
    print!("exercising option");
    // bob sends an exercise instruction
    let bob_nft_acc = get_associated_token_address(&test_options.bob_acc.pubkey(), &test_options.nft_token_acc.pubkey());

    let mut buf2 = Vec::<u8>::with_capacity(18);
    buf2.push(1);
    buf2.extend_from_slice(&strike.to_le_bytes());
    buf2.extend_from_slice(&multiple.to_le_bytes());
    buf2.push(kind);
    let (pda, _bump_seed) = Pubkey::find_program_address(&[b"optionsnft"], &test_options.program_id); 
    let accounts2 = vec![
        AccountMeta::new(test_options.bob_acc.pubkey(), true),
        AccountMeta::new(bob_nft_acc, false),
        AccountMeta::new(test_options.nft_token_acc.pubkey(), false),
        AccountMeta::new(if kind==0 {test_options.bob_b_key} else {test_options.bob_a_key}, false),
        AccountMeta::new(if kind==0 {test_options.bob_a_key} else {test_options.bob_b_key}, false),
        AccountMeta::new(test_options.collateral_acc.pubkey(), false),
        AccountMeta::new( if kind==0 {test_options.alice_b_key} else {test_options.alice_a_key} , false),
        AccountMeta::new(test_options.alice_acc.pubkey(), false),
        AccountMeta::new_readonly(spl_token::id(), false),
        AccountMeta::new(test_options.options_acc.pubkey(), false),
        AccountMeta::new(pda, false),
        AccountMeta::new_readonly(system_program::id(), false),
    ];

    let exercise_tx = Transaction::new_signed_with_payer(
        &[
            Instruction {
                program_id: test_options.program_id,
                accounts : accounts2 ,
                data : buf2
            }
        ],
        Some(&test_options.alice_acc.pubkey()),
        &[&test_options.alice_acc, &test_options.bob_acc],
        recent_blockhash,
    );
    banks_client.process_transaction(exercise_tx).await.unwrap();
}

async fn close_option(kind: u8 , test_options: &TestOptions, banks_client: &mut BanksClient, recent_blockhash: Hash){
    let mut buf = Vec::<u8>::with_capacity(18);
    buf.push(3);
    let (pda, _bump_seed) = Pubkey::find_program_address(&[b"optionsnft"], &test_options.program_id); 
    let accounts = vec![
        AccountMeta::new(test_options.alice_acc.pubkey(), true),
        AccountMeta::new(test_options.collateral_acc.pubkey(), false),
        AccountMeta::new( if kind==0 {test_options.alice_a_key} else {test_options.alice_b_key} , false),
        AccountMeta::new_readonly(spl_token::id(), false),
        AccountMeta::new(test_options.options_acc.pubkey(), false),
        AccountMeta::new(pda, false),
    ];

    let close_tx = Transaction::new_signed_with_payer(
        &[
            Instruction {
                program_id: test_options.program_id,
                accounts : accounts ,
                data : buf
            }
        ],
        Some(&test_options.alice_acc.pubkey()),
        &[&test_options.alice_acc],
        recent_blockhash,
    );
    banks_client.process_transaction(close_tx).await.unwrap();
}

async fn check_closed(test_options: &TestOptions, banks_client: &mut BanksClient){
    let options_acc = banks_client.get_account(test_options.options_acc.pubkey()).await.unwrap();
    match options_acc {
        Some(acc) => {
            assert_eq!(acc.lamports, 0);
            assert_eq!(acc.data.len(), 0);
        },
        _ => {}
    };


}

async fn alice_sends_nft_to_bob(banks_client: &mut BanksClient, test_options: &TestOptions, recent_blockhash: Hash){
    let bob_nft_acc = get_associated_token_address(&test_options.bob_acc.pubkey(), &test_options.nft_token_acc.pubkey());
    let create_nft_acc_ix = create_associated_token_account(&test_options.alice_acc.pubkey(), &test_options.bob_acc.pubkey(), &test_options.nft_token_acc.pubkey());

    let create_nft_acc_tx = Transaction::new_signed_with_payer(
        &[
            create_nft_acc_ix
        ],
        Some(&test_options.alice_acc.pubkey()),
        &[&test_options.alice_acc],
        recent_blockhash,
    );
    banks_client.process_transaction(create_nft_acc_tx).await.unwrap();
    token_actions::transfer(banks_client, &test_options.alice_acc, recent_blockhash, 
        &test_options.nft_associated_token_acc , &bob_nft_acc, &test_options.alice_acc, 1).await.unwrap();
}

async fn setup(
    banks_client: &mut BanksClient,
    recent_blockhash: Hash,
    test_options: &mut TestOptions
){
    // create options program acc
    let rent = banks_client.get_rent().await.unwrap();
    let options_acc_rent = rent.minimum_balance(SOLOPTION_SIZE);
  
    // create options program account
    let transaction = Transaction::new_signed_with_payer(
        &[
            create_account(
                &test_options.alice_acc.pubkey(),
                &test_options.options_acc.pubkey(),
                options_acc_rent,
                SOLOPTION_SIZE as u64,
                &test_options.program_id,
            )
        ],
        Some(&test_options.alice_acc.pubkey()),
        &[&test_options.alice_acc, &test_options.options_acc],
        recent_blockhash,
    );
    banks_client.process_transaction(transaction).await.unwrap();

    // create tok a & b
    token_actions::create_mint(banks_client, &test_options.alice_acc, recent_blockhash, &test_options.tok_a, &test_options.alice_acc.pubkey(), 0).await.unwrap();
    token_actions::create_mint(banks_client, &test_options.alice_acc, recent_blockhash, &test_options.tok_b, &test_options.bob_acc.pubkey(), 0).await.unwrap();
    test_options.tok_a_key = test_options.tok_a.pubkey();
    test_options.tok_b_key = test_options.tok_b.pubkey();

    // create alice tok accounts
    token_actions::create_account(banks_client, &test_options.alice_acc, recent_blockhash, &test_options.alice_a, 
        &test_options.tok_a.pubkey(), &test_options.alice_acc.pubkey()).await.unwrap();
    token_actions::create_account(banks_client, &test_options.alice_acc, recent_blockhash, &test_options.alice_b, 
        &test_options.tok_b.pubkey(), &test_options.alice_acc.pubkey()).await.unwrap();
    test_options.alice_a_key = test_options.alice_a.pubkey();
    test_options.alice_b_key = test_options.alice_b.pubkey();

    
    // create bob tok accounts
    token_actions::create_account(banks_client, &test_options.alice_acc, recent_blockhash, &test_options.bob_a, 
        &test_options.tok_a.pubkey(), &test_options.bob_acc.pubkey()).await.unwrap();
    token_actions::create_account(banks_client, &test_options.alice_acc, recent_blockhash, &test_options.bob_b, 
        &test_options.tok_b.pubkey(), &test_options.bob_acc.pubkey()).await.unwrap();
    test_options.bob_a_key = test_options.bob_a.pubkey();
    test_options.bob_b_key = test_options.bob_b.pubkey();

    // mint to token a
    token_actions::mint_to(banks_client, &test_options.alice_acc, recent_blockhash, &test_options.tok_a.pubkey(),
         &test_options.alice_a_key, &test_options.alice_acc, 420_000).await.unwrap();
    token_actions::mint_to(banks_client, &test_options.alice_acc, recent_blockhash, &test_options.tok_a.pubkey(),
         &test_options.bob_a_key, &test_options.alice_acc, 69_000).await.unwrap();

    // mint token b
    token_actions::mint_to(banks_client, &test_options.alice_acc, recent_blockhash, &test_options.tok_b.pubkey(),
         &test_options.alice_b_key, &test_options.bob_acc, 69_000).await.unwrap();
    token_actions::mint_to(banks_client, &test_options.alice_acc, recent_blockhash, &test_options.tok_b.pubkey(),
         &test_options.bob_b_key, &test_options.bob_acc, 420_000).await.unwrap();

}

async fn get_balances(banks_client:&mut BanksClient, test_options: &TestOptions) -> (u64, u64, u64, u64, u64){
    
    let alice_a_acc = banks_client.get_account(test_options.alice_a_key).await.unwrap().unwrap();
    let alice_b_acc = banks_client.get_account(test_options.alice_b_key).await.unwrap().unwrap();
    let bob_a_acc = banks_client.get_account(test_options.bob_a_key).await.unwrap().unwrap();
    let bob_b_acc = banks_client.get_account(test_options.bob_b_key).await.unwrap().unwrap();
    let alice_nft_acc = banks_client.get_account(test_options.nft_associated_token_acc).await.unwrap();

    let alice_a_bal = spl_token::state::Account::unpack_from_slice(&alice_a_acc.data).unwrap();
    let alice_b_bal = spl_token::state::Account::unpack_from_slice(&alice_b_acc.data).unwrap();
    let bob_a_bal = spl_token::state::Account::unpack_from_slice(&bob_a_acc.data).unwrap();
    let bob_b_bal = spl_token::state::Account::unpack_from_slice(&bob_b_acc.data).unwrap();
    let alice_nft_bal = match alice_nft_acc {
        Some(acc) => spl_token::state::Account::unpack_from_slice(&acc.data).unwrap().amount, //this is not available if nft hasnt been minted
        None => 0,
    };

    return (alice_a_bal.amount, alice_b_bal.amount, bob_a_bal.amount, bob_b_bal.amount, alice_nft_bal)
}