use borsh::{BorshDeserialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    system_instruction::{create_account},
    program_pack::{Pack, IsInitialized},
    sysvar::{clock::Clock, rent::Rent, Sysvar},
    program::{invoke, invoke_signed},

};
use crate::state::SolOption;
use crate::error;

use spl_token::instruction::{initialize_mint, mint_to, burn}; 
// use spl_token::id;
use spl_token;
use spl_token::state::{Mint};
use spl_associated_token_account::{
    get_associated_token_address,
    create_associated_token_account
};

use solana_program::native_token::LAMPORTS_PER_SOL;

// check that account is expired
pub fn is_expired(expiry_date: i64)-> Result<bool, ProgramError>{
    let clock_via_sysvar = Clock::get()?;
    return Ok(clock_via_sysvar.unix_timestamp > expiry_date)
}

#[derive(Copy, Clone, Eq, PartialEq)]
pub enum OptionType {
    Call = 0,
    Put = 1
}
pub fn create_new_nft_mint(
    accounts: &[AccountInfo],
    program_id: &Pubkey,
    multiple: u64
) -> ProgramResult{

    let account_info_iter = &mut accounts.iter();
    let creator_acc = next_account_info(account_info_iter)?;
    let instrument_acc = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let sys_var_program = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let associate_token_account_program = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;
    let instrument_mint_acc = next_account_info(account_info_iter)?;

    if !creator_acc.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // initialize mint for the token
    msg!("initializing the instrument mint acc {}", instrument_mint_acc.key);

    let (pda, bump_seed) = Pubkey::find_program_address(&[b"optionsnft"], program_id);
    assert_eq!(pda, *pda_account.key);

    let init_mint_ix = initialize_mint(    
        token_program.key,
        instrument_mint_acc.key,
        &pda,
        Some(&pda),
        0)?;
    invoke(
        &init_mint_ix,
        &[
            creator_acc.clone(),
            instrument_mint_acc.clone(),
            token_program.clone(),
            sys_var_program.clone()
        ]
    )?;

    msg!("create associated token address");
    let create_ass_ix = create_associated_token_account(
        creator_acc.key, 
        creator_acc.key, 
        instrument_mint_acc.key
    );
    invoke(
        &create_ass_ix,
        &[
            associate_token_account_program.clone(),
            instrument_acc.clone(),
            instrument_mint_acc.clone(),
            creator_acc.clone(),
            token_program.clone(),
            sys_var_program.clone(),
            system_program.clone()
        ]
    )?;

    let pstr = pda.to_string();
    msg!("minting {} token {} to account -> {}", multiple,instrument_mint_acc.key, instrument_acc.key);
    msg!(&pstr);
    let mint_token_ix = mint_to(&spl_token::id(), 
            instrument_mint_acc.key, 
            instrument_acc.key, 
            &pda, 
            &[&pda],
            multiple)?;

    invoke_signed(
        &mint_token_ix, 
        &[            
            instrument_mint_acc.clone(),
            instrument_acc.clone(),
            pda_account.clone(),
            token_program.clone()
        ],
        &[&[&b"optionsnft"[..], &[bump_seed]]],
    )?;

    // _create(&accounts, program_id, strike, multiple, expiry, kind, pda, bump_seed)?;
    Ok(())
}

pub fn create(
    accounts: &[AccountInfo],
    program_id: &Pubkey,
    strike: u64,
    multiple: u64,
    expiry: i64,
    kind: OptionType,
)-> ProgramResult{
    let (pda, bump_seed) = Pubkey::find_program_address(&[b"optionsnft"], program_id);
    return _create(accounts, program_id, strike, multiple, expiry, kind, pda, bump_seed)
}

// creaete a call
// V1 accounts already created
fn _create(
    accounts: &[AccountInfo],
    program_id: &Pubkey,
    strike: u64,
    multiple: u64,
    expiry: i64,
    kind: OptionType,
    pda: Pubkey,
    bump_seed: u8
) -> ProgramResult{

    let account_info_iter = &mut accounts.iter();
    let creator_acc = next_account_info(account_info_iter)?;
    let collateral_acc = next_account_info(account_info_iter)?;
    let instrument_acc = next_account_info(account_info_iter)?;
    let strike_instrument_acc = next_account_info(account_info_iter)?;
    let nft_token_acc = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let _sys_var_program = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let _nft_associated_account = next_account_info(account_info_iter)?;
    let _associate_token_account_program = next_account_info(account_info_iter)?;
    let options_program_account = next_account_info(account_info_iter)?;
    
    if !creator_acc.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    msg!("loading the options program account");

    let option_info = SolOption::try_from_slice(&options_program_account.try_borrow_data()?)?;
    if option_info.is_initialized() {
        return Err(ProgramError::AccountAlreadyInitialized);
    }


    msg!("program is owning collateral acc");
    take_collateral_ownership(token_program, collateral_acc, creator_acc, pda)?;

    msg!("transer to collateral acc");
    

    let collateral_acc_data = spl_token::state::Account::unpack_from_slice(&collateral_acc.try_borrow_data()?)?;
    
    if collateral_acc_data.mint == spl_token::native_mint::id(){
        msg!("transfer native to collateral acc {}", multiple*LAMPORTS_PER_SOL);
        match kind{
            OptionType::Call =>{
                let native_transfer_ix = solana_program::system_instruction::transfer(creator_acc.key , collateral_acc.key, multiple*LAMPORTS_PER_SOL);
                invoke(
                    &native_transfer_ix,
                    &[
                        collateral_acc.clone(),
                        creator_acc.clone(),
                        system_program.clone()
                    ],
                )?;
            }
            OptionType::Put => {
                let native_transfer_ix = solana_program::system_instruction::transfer(creator_acc.key , collateral_acc.key, strike*multiple*LAMPORTS_PER_SOL);
                invoke(
                    &native_transfer_ix,
                    &[
                        collateral_acc.clone(),
                        creator_acc.clone(),
                        system_program.clone()
                    ],
                )?;
            }
        }
    } else {
        // for the native mint just initialze, otherwise
        let transfer_to_collateral_ix: solana_program::instruction::Instruction;
        match kind{
            OptionType::Call =>{
                transfer_to_collateral_ix = spl_token::instruction::transfer(
                    token_program.key,
                    instrument_acc.key,
                    collateral_acc.key,
                    creator_acc.key,
                    &[&creator_acc.key],
                    multiple,
                )?;
            }
    
            OptionType::Put => {
                transfer_to_collateral_ix = spl_token::instruction::transfer(
                    &spl_token::id(),
                    strike_instrument_acc.key,
                    collateral_acc.key,
                    creator_acc.key,
                    &[&creator_acc.key],
                    strike*multiple,
                )?; 
            }
        }
    
        msg!("Calling the token program to transfer to collateral acc");
        let _res = invoke(
            &transfer_to_collateral_ix,
            &[
                instrument_acc.clone(),
                strike_instrument_acc.clone(),
                collateral_acc.clone(),
                creator_acc.clone(),
                token_program.clone()
                
            ],
        )?;
    } 




    

    // let transferCollateralIx = transfer(from_pubkey: &Pubkey, to_pubkey: &Pubkey, lamports: u64)
    msg!("creating nft token");
    create_nft(accounts, program_id, pda, bump_seed)?;

    msg!("saving program state to {}", options_program_account.key);

    // TODO switch recv account for puts
    match kind{
        OptionType::Call =>{
            save_state(option_info, options_program_account, *creator_acc.key, *nft_token_acc.key, *collateral_acc.key, 
                *strike_instrument_acc.key, expiry, strike, multiple, false, kind)?;
            }
        OptionType::Put =>{
            // in a put, writer expect to receive the instrument and give the strike_instrument
            save_state(option_info, options_program_account, *creator_acc.key, *nft_token_acc.key, 
                *collateral_acc.key, *instrument_acc.key, expiry, strike, multiple, false, kind)?;
            }
        }
    Ok(())
}

pub fn create_nft(accounts: &[AccountInfo], _program_id: &Pubkey, pda: Pubkey, bump_seed: u8)-> Result<(), ProgramError>{
    //https://github.com/solana-labs/solana-program-library/blob/master/token/cli/src/main.rs
    // let (token_signer, token) = new_throwaway_signer;
    let account_info_iter = &mut accounts.iter();
    let creator_acc = next_account_info(account_info_iter)?;
    let _collateral_acc = next_account_info(account_info_iter)?;
    let _sell_token_acc = next_account_info(account_info_iter)?;
    let _buy_token_acc = next_account_info(account_info_iter)?;
    let nft_token_acc = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let sys_var_program = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let nft_associated_account = next_account_info(account_info_iter)?;
    let associat_token_account_program = next_account_info(account_info_iter)?;
    let _options_program_account = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;


    let rent = &Rent::from_account_info(sys_var_program)?;
    let min_bal = rent.minimum_balance(Mint::LEN);
 
    msg!("creating mint account {}", nft_token_acc.key);
    msg!("Transfer {} lamports to the new account", min_bal);
    let create_ix = create_account(
        creator_acc.key, 
        nft_token_acc.key, 
        min_bal, 
        Mint::LEN as u64, 
        &spl_token::id());
    invoke(
        &create_ix,
        &[
            creator_acc.clone(),
            nft_token_acc.clone(),
            system_program.clone()
        ],
    )?;
 
    msg!("fetching associated token address");
    let ass_token_pda_address = get_associated_token_address(&creator_acc.key, &nft_token_acc.key);
    msg!("associated token address {}", ass_token_pda_address);

    // sanity check that these are equal
    assert_eq!(ass_token_pda_address, *nft_associated_account.key);

    // initialize mint for the token
    msg!("initializing the mint acc {}", nft_token_acc.key);

    // let (pda, bump_seed) = Pubkey::find_program_address(&[b"optionsnft"], program_id);
    assert_eq!(pda, *pda_account.key);

    let init_mint_ix = initialize_mint(    
        token_program.key,
        nft_token_acc.key,
        &pda,
        Some(&pda),
        0)?;
    invoke(
        &init_mint_ix,
        &[
            creator_acc.clone(),
            nft_token_acc.clone(),
            token_program.clone(),
            sys_var_program.clone()
        ]
    )?;

    msg!("create associated token address");
    let create_ass_ix = create_associated_token_account(
        creator_acc.key, 
        creator_acc.key, 
        nft_token_acc.key
    );
    invoke(
        &create_ass_ix,
        &[
            associat_token_account_program.clone(),
            nft_associated_account.clone(),
            nft_token_acc.clone(),
            creator_acc.clone(),
            token_program.clone(),
            sys_var_program.clone(),
            system_program.clone()
        ]
    )?;

    msg!("nft token {} for account: {} owner: {}", nft_token_acc.key, nft_associated_account.key, creator_acc.key);
    msg!("miniting!");
    msg!("miniting receiver account {}", nft_associated_account.key);
    let mint_token_ix = mint_to(&spl_token::id(), 
            nft_token_acc.key, 
            nft_associated_account.key, 
            &pda, 
            &[&pda],
            1)?;

    invoke_signed(
        &mint_token_ix, 
        &[            
            nft_token_acc.clone(),
            creator_acc.clone(),
            nft_associated_account.clone(),
            pda_account.clone(),
            token_program.clone()
        ],
        &[&[&b"optionsnft"[..], &[bump_seed]]],
    )?;

    // msg!("freezing the associated mint acc");
    // let freeze_ix = freeze_account(
    //     token_program.key, 
    //     nft_associated_account.key, 
    //     nft_token_acc.key, 
    //     creator_acc.key, 
    //     &[]
    // )?;
    // invoke(
    //     &freeze_ix, 
    //     &[
    //         nft_associated_account.clone(),
    //         nft_token_acc.clone(),
    //         creator_acc.clone()
    //     ],
    // )?;
    return Ok(());
}

pub fn exercise(accounts: &[AccountInfo], program_id: &Pubkey, strike: u64, multiple:u64, kind:OptionType)-> ProgramResult{
    let account_info_iter = &mut accounts.iter();
    let buyer_acc = next_account_info(account_info_iter)?;
    let buyer_nft_acc = next_account_info(account_info_iter)?;
    let buyer_nft_token_mint = next_account_info(account_info_iter)?;
    let buyer_send_token_acc = next_account_info(account_info_iter)?;
    let buyer_recv_token_acc = next_account_info(account_info_iter)?;
    let collateral_acc = next_account_info(account_info_iter)?;
    let writer_recv_acc = next_account_info(account_info_iter)?;
    let creator_acc = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let options_program_account = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    msg!("reading account data from {}", options_program_account.key);
    let options_info = SolOption::try_from_slice(&options_program_account.try_borrow_data()?)?;
    let nft_token_mint = options_info.ownership_nft_token;

    // check that contract is not expired
    if is_expired(options_info.expiry_date).unwrap(){
        return Err(ProgramError::from(error::OptionsError::ContractExpired))
    }

    if !options_info.is_initialized() {
        return Err(ProgramError::UninitializedAccount);
    }

    // check that correct type
    if kind as u8 != options_info.kind {
        return Err(ProgramError::from(error::OptionsError::WrongContractType)) 
    }

    // check buyer has correct nft
    assert_eq!(*buyer_nft_token_mint.key, nft_token_mint);

    // attempt to burn the token to prove the buyer owns the contract
    let burn_ix = burn(
        token_program.key, 
        buyer_nft_acc.key, 
        buyer_nft_token_mint.key, 
        buyer_acc.key, 
        &[], 
        1
    )?;
    invoke(
        &burn_ix,
        &[
            buyer_nft_acc.clone(),
            buyer_nft_token_mint.clone(),
            buyer_acc.clone()
        ]
    )?;

    // check the right strike is supplied
    assert_eq!(multiple, options_info.multiple);
    assert_eq!(strike, options_info.strike);

    // check collateral acc is correct
    assert_eq!(*collateral_acc.key, options_info.collateral_acc_pubkey);
    assert_eq!(*writer_recv_acc.key, options_info.recv_acc_pubkey);

    // check creator account
    assert_eq!(*creator_acc.key, options_info.creator_pubkey);

    // transfer tokens to seller
    msg!("transferring tokens to seller {} => {}", buyer_send_token_acc.key, options_info.recv_acc_pubkey);

    let writer_recv_acc_data = spl_token::state::Account::unpack_from_slice(&writer_recv_acc.try_borrow_data()?)?;
    
    if writer_recv_acc_data.mint == spl_token::native_mint::id(){
        // writer is receiving native so send native from buyer
        let send_tok_ix = match kind{
            OptionType::Call =>{
                solana_program::system_instruction::transfer(buyer_acc.key, &options_info.creator_pubkey, multiple*strike*LAMPORTS_PER_SOL)
            },
            OptionType::Put =>{
                solana_program::system_instruction::transfer(buyer_acc.key, &options_info.creator_pubkey, multiple*LAMPORTS_PER_SOL)
            }
        };
        invoke(
            &send_tok_ix, 
            &[
                buyer_acc.clone(),
                creator_acc.clone(),
                system_program.clone()
            ]
        )?;
    }else{
        // non native tokens
        let send_tok_ix = match kind{
            OptionType::Call =>{
                spl_token::instruction::transfer(
                    token_program.key, 
                    buyer_send_token_acc.key, 
                    &options_info.recv_acc_pubkey, 
                    buyer_acc.key, 
                    &[], 
                    multiple * strike
                )
            },
    
            OptionType::Put => {
                spl_token::instruction::transfer(
                    token_program.key, 
                    buyer_send_token_acc.key, 
                    &options_info.recv_acc_pubkey, 
                    buyer_acc.key, 
                    &[], 
                    multiple
                )
            }
        }?;
    
        invoke(
            &send_tok_ix, 
            &[
                buyer_acc.clone(),
                writer_recv_acc.clone(),
                buyer_send_token_acc.clone()
            ]
        )?;
    }


    let (pda, bump_seed) = Pubkey::find_program_address(&[b"optionsnft"], program_id);
    assert_eq!(pda, *pda_account.key);
    msg!("transferring tokens to buyer {} => {} pda {}",options_info.collateral_acc_pubkey, buyer_recv_token_acc.key, pda);
    let collateral_acc_data = spl_token::state::Account::unpack_from_slice(&collateral_acc.try_borrow_data()?)?;
    
    if collateral_acc_data.mint == spl_token::native_mint::id(){
        // close then transfer lamports
        
        msg!("Closing the collateral account");
        let close_pdas_collateral_acc_ix = spl_token::instruction::close_account(
            token_program.key,
            collateral_acc.key,
            &pda,
            &pda,
            &[&pda]
        )?;
        msg!("Calling the token program to close pda's temp account...");
        invoke_signed(
            &close_pdas_collateral_acc_ix,
            &[
                collateral_acc.clone(),
                pda_account.clone(),
                token_program.clone(),
            ],
            &[&[&b"optionsnft"[..], &[bump_seed]]],
        )?;
        msg!("transerfing sol from pda to buyer");
        let recv_tok_ix = match kind{
            OptionType::Call =>{
                solana_program::system_instruction::transfer(&pda, buyer_acc.key, multiple*LAMPORTS_PER_SOL)
            },
            OptionType::Put =>{
                solana_program::system_instruction::transfer(&pda, buyer_acc.key, strike*multiple*LAMPORTS_PER_SOL)
            }
        };
        invoke_signed(
            &recv_tok_ix, 
            &[
                collateral_acc.clone(),
                buyer_acc.clone(),
                pda_account.clone(),
                system_program.clone()
            ],
            &[&[&b"optionsnft"[..], &[bump_seed]]],
        )?;
    }else{
        let recv_tok_ix = match kind{
            OptionType::Call =>{
                spl_token::instruction::transfer(
                    token_program.key, 
                    &options_info.collateral_acc_pubkey, 
                    buyer_recv_token_acc.key, 
                    &pda, 
                    &[&pda], 
                    multiple
                )
            }
            OptionType::Put =>{
                spl_token::instruction::transfer(
                    token_program.key, 
                    &options_info.collateral_acc_pubkey, 
                    buyer_recv_token_acc.key, 
                    &pda, 
                    &[&pda], 
                    multiple*strike
                )
            }
        }?;
        invoke_signed(
            &recv_tok_ix, 
            &[
                collateral_acc.clone(),
                buyer_recv_token_acc.clone(),
                pda_account.clone(),
                token_program.clone()
            ],
            &[&[&b"optionsnft"[..], &[bump_seed]]],
        )?;
    }


    msg!("closing collateral accounts");
    close_accounts(accounts, pda, bump_seed)?;

    Ok(())
}

fn close_accounts(accounts: &[AccountInfo], pda: Pubkey, bump_seed: u8) -> ProgramResult{
    let account_info_iter = &mut accounts.iter();
    let _buyer_acc = next_account_info(account_info_iter)?;
    let _buyer_nft_acc = next_account_info(account_info_iter)?;
    let _buyer_nft_token_mint = next_account_info(account_info_iter)?;
    let _buyer_send_token_acc = next_account_info(account_info_iter)?;
    let _buyer_recv_token_acc = next_account_info(account_info_iter)?;
    let collateral_acc = next_account_info(account_info_iter)?;
    let _writer_recv_acc = next_account_info(account_info_iter)?;
    let creator_acc = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let options_program_account = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;

    msg!("reading account data from {}", options_program_account.key);
    let options_info = SolOption::try_from_slice(&options_program_account.try_borrow_data()?)?;
    assert_eq!(options_info.creator_pubkey, *creator_acc.key);

    _close(creator_acc, collateral_acc, token_program, options_program_account, pda_account, &pda, bump_seed)?;
    Ok(())
}

fn save_state(mut option_info: SolOption, 
    options_program_account: &AccountInfo,
    writer_pubkey: Pubkey,
    ownership_nft_token: Pubkey,
    collateral_acc_pubkey: Pubkey,
    recv_acc_pubkey: Pubkey,
    expiry_date: i64,
    strike: u64,
    multiple: u64,
    is_expired: bool,
    kind: OptionType
) -> Result<(), ProgramError>{
    option_info.is_initialized = true;
    option_info.expiry_date = expiry_date;
    option_info.creator_pubkey = writer_pubkey;
    option_info.ownership_nft_token = ownership_nft_token;
    option_info.collateral_acc_pubkey = collateral_acc_pubkey;
    option_info.recv_acc_pubkey = recv_acc_pubkey;
    option_info.expiry_date = expiry_date;
    option_info.strike = strike;
    option_info.multiple = multiple;
    option_info.is_expired = is_expired;
    option_info.kind = kind as u8;

    let packed = SolOption::pack(option_info, &mut options_program_account.try_borrow_mut_data()?);
    return packed
}

fn take_collateral_ownership<'a>(token_program: &AccountInfo<'a>, collateral_acc: &AccountInfo<'a>,
    creator_acc: &AccountInfo<'a>, pda: Pubkey
)-> Result<(), ProgramError>{
    msg!("program is owning collateral acc");
    // let (pda, bump_seed) = Pubkey::find_program_address(&[b"optionsnft"], program_id);
    let owner_change_ix = spl_token::instruction::set_authority(
        token_program.key,
        collateral_acc.key,
        Some(&pda),
        spl_token::instruction::AuthorityType::AccountOwner,
        &creator_acc.key,
        &[&creator_acc.key],
    )?;
    
    msg!("Calling the token program to transfer token account ownership...");
    invoke(
        &owner_change_ix,
        &[
            collateral_acc.clone(),
            creator_acc.clone(),
            token_program.clone(),
        ],
    )?;
    Ok(())
}

pub fn close(accounts: &[AccountInfo], program_id: &Pubkey)-> ProgramResult{
    let account_info_iter = &mut accounts.iter();
    let creator_acc = next_account_info(account_info_iter)?;
    let collateral_acc = next_account_info(account_info_iter)?;
    let creator_recv_acc = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let options_program_account = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;
    
    if !creator_acc.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    msg!("reading account data from {}", options_program_account.key);
    let options_info = SolOption::try_from_slice(&options_program_account.try_borrow_data()?)?;

    // check initialized and owner
    if !options_info.is_initialized() || options_info.creator_pubkey != *creator_acc.key {
        return Err(ProgramError::UninitializedAccount);
    }

    // check that contract is expired
    if !is_expired(options_info.expiry_date).unwrap(){
        msg!("error: contract is not yet expired. cannot close {}", options_info.expiry_date);
        return Err(ProgramError::from(error::OptionsError::ContractNotExpired))
    }
    let (pda, bump_seed) = Pubkey::find_program_address(&[b"optionsnft"], program_id);
    let collateral_acc_data = spl_token::state::Account::unpack_from_slice(&collateral_acc.try_borrow_data()?)?;
    
    // native account do the transfer on close
    if collateral_acc_data.mint != spl_token::native_mint::id(){    
        msg!("returning collateral to creator and closing option");
        let ret_tok_ix = match options_info.kind{
            0 =>{
                spl_token::instruction::transfer(
                    token_program.key, 
                    &options_info.collateral_acc_pubkey, 
                    creator_recv_acc.key, 
                    &pda, 
                    &[&pda], 
                    options_info.multiple
                )
            }
            1 =>{
                spl_token::instruction::transfer(
                    token_program.key, 
                    &options_info.collateral_acc_pubkey, 
                    creator_recv_acc.key, 
                    &pda, 
                    &[&pda], 
                    options_info.multiple*options_info.strike
                )
            }
            _ => { Err(ProgramError::from(error::OptionsError::WrongContractType)) }
        }?;
        invoke_signed(
            &ret_tok_ix, 
            &[
                collateral_acc.clone(),
                creator_recv_acc.clone(),
                pda_account.clone(),
                token_program.clone()
            ],
            &[&[&b"optionsnft"[..], &[bump_seed]]],
        )?;
    }


    // check collateral acc is correct
    assert_eq!(*collateral_acc.key, options_info.collateral_acc_pubkey);
    
    assert_eq!(pda, *pda_account.key);
    msg!("closing collateral accounts");
    _close(creator_acc, collateral_acc, token_program, options_program_account, pda_account, &pda, bump_seed)?;

    Ok(())
}

fn _close<'a>(creator_acc: &AccountInfo<'a>, collateral_acc: &AccountInfo<'a>, token_program: &AccountInfo<'a>,
    options_program_account: &AccountInfo<'a>, pda_account: &AccountInfo<'a>, pda: &Pubkey, bump_seed: u8 )-> ProgramResult {
    msg!("reading account data from {}", options_program_account.key);
    let options_info = SolOption::try_from_slice(&options_program_account.try_borrow_data()?)?;
    assert_eq!(options_info.creator_pubkey, *creator_acc.key);

    msg!("Closing the collateral account");
    let close_pdas_collateral_acc_ix = spl_token::instruction::close_account(
        token_program.key,
        collateral_acc.key,
        creator_acc.key,
        &pda,
        &[&pda]
    )?;
    msg!("Calling the token program to close pda's temp account...");
    invoke_signed(
        &close_pdas_collateral_acc_ix,
        &[
            collateral_acc.clone(),
            creator_acc.clone(),
            pda_account.clone(),
            token_program.clone(),
        ],
        &[&[&b"optionsnft"[..], &[bump_seed]]],
    )?;

    **creator_acc.lamports.borrow_mut() = creator_acc.lamports()
        .checked_add(options_program_account.lamports())
        .ok_or(error::OptionsError::AmountOverflow)?;
    **options_program_account.lamports.borrow_mut() = 0;
    *options_program_account.try_borrow_mut_data()? = &mut [];
    Ok(())
}