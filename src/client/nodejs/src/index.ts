
import { AccountLayout, MintLayout,  Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, Signer } from "@solana/web3.js";
import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY,  Transaction, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import dayjs from "dayjs";
import { OPTION_ACCOUNT_DATA_LAYOUT } from "./layout";
import {print_contract, get_contract_from_blockchain, verify_contract} from "./utils";
export {get_contract_from_blockchain, verify_contract, print_contract};
import { publish_doc, create_doc_img } from "./doc";
export {publish_doc, create_doc_img};
import { TokenListProvider, TokenInfo } from '@solana/spl-token-registry';

const OPTIONS_PROGRAM_ID = process.env.OPTIONS_PROGRAM_ID || process.env.REACT_APP_OPTIONS_PROGRAM_ID || "DV4NugS55eXXposgxLnLr7WxySCTpaDd3cQPegFenHaj"
const SEED = "optionsnft";
let TOKEN_LIST : TokenInfo[] = null
const CLUSTER_SLUG = "mainnet-beta"


export interface Contract {
    strike: number
    expiry: number
    multiple: number
    instrument: PublicKey
    strike_instrument: PublicKey
    nft_id?: PublicKey
    nft_account?: PublicKey
    account_id?: PublicKey
    collateral_acc?: PublicKey
    writer_recv_acc: PublicKey
    writer: PublicKey,
    kind: OptionType

}

export enum OptionType{
  call = 0,
  put = 1
}

enum Instruction{
  create = 0,
  exercise = 1,
  create_new_nft_mint =2,
}

async function get_token_map(): Promise<Map<string,string>>{
  if (TOKEN_LIST){
    
    let symbol_to_address_map = new Map(TOKEN_LIST.map(t=>[t.symbol, t.address]))
    return symbol_to_address_map
      
  }else{
    let tokens = await new TokenListProvider().resolve()
    const tokenList = tokens.filterByClusterSlug(CLUSTER_SLUG).getList();
    TOKEN_LIST = tokenList;
    return get_token_map()
  }
}
/**
 * 
 * @param connection connection to 
 * @param strike 
 * @param expiry 
 * @param multiple 
 * @param creator_account 
 * @param instrument 
 * @param strike_instrument 
 * @param creator_instrument_acc 
 * @param creator_strike_instrument_acc 
 * @returns 
 */
export async function create_call(connection: Connection, strike: number, expiry: number, multiple: number, creator_account: Signer, 
    instrument: PublicKey | string | null, strike_instrument: PublicKey | string | null, creator_instrument_acc: PublicKey | null, 
    creator_strike_instrument_acc: PublicKey | null)  : Promise<[string, Contract]>{
      console.log("creating call contract")

      return create_option(connection, strike, expiry, multiple, creator_account, instrument, 
        strike_instrument , creator_instrument_acc, creator_strike_instrument_acc, OptionType.call)
      
}

/**
 * 
 * @param connection 
 * @param strike 
 * @param expiry 
 * @param multiple 
 * @param creator_account 
 * @param instrument 
 * @param strike_instrument 
 * @param creator_instrument_acc 
 * @param creator_strike_instrument_acc 
 * @returns 
 */
export async function create_put(connection: Connection, strike: number, expiry: number, multiple: number, creator_account: Keypair, 
  instrument: PublicKey | string | null, strike_instrument: PublicKey| string | null, creator_instrument_acc: PublicKey | null, 
  creator_strike_instrument_acc: PublicKey | null)  : Promise<[string, Contract]>{
    console.log("creating put contract")

    return create_option(connection, strike, expiry, multiple, creator_account, instrument, 
      strike_instrument, creator_instrument_acc, creator_strike_instrument_acc, OptionType.put)
}

export async function create_new_nft_mint(connection: Connection, multiple: number, creator_account: Signer) {
    const instrument_mint_acc = new Keypair();
    console.log("instrument mint account key: ", instrument_mint_acc.publicKey.toString())
    const mint_rent = await connection.getMinimumBalanceForRentExemption(MintLayout.span, 'confirmed')
    console.log("using %s lamports to create the instrument mint account", mint_rent)
    const createInstrumentMintIx = SystemProgram.createAccount({
        programId: TOKEN_PROGRAM_ID,
        space: MintLayout.span,
        lamports: await connection.getMinimumBalanceForRentExemption(MintLayout.span, 'confirmed'),
        fromPubkey: creator_account.publicKey,
        newAccountPubkey: instrument_mint_acc.publicKey
    });
    // const instrument = instrument_mint_acc.publicKey

    // get the address for the account that will be associated with the NFT
    // this code is from the associated token program 
    const [creator_instrument_acc, _] = await PublicKey.findProgramAddress(
      [
        creator_account.publicKey.toBytes(),
        TOKEN_PROGRAM_ID.toBytes(),
        instrument_mint_acc.publicKey.toBytes()
      ], ASSOCIATED_TOKEN_PROGRAM_ID);
    
    console.log("instrument account key: ", creator_instrument_acc.toString())
    const optionsProgramId = new PublicKey(OPTIONS_PROGRAM_ID);
    // call the program to initialize this mint. the program will be the mint authority for this mint
    const [pda, _bump_seed] = await PublicKey.findProgramAddress([Buffer.from(SEED)], optionsProgramId)
    let pda_account = new PublicKey(pda);

    const createNewNFTMintIx = new TransactionInstruction({
        programId: optionsProgramId,
        keys: [{
          pubkey: creator_account.publicKey,
          isSigner: true,
          isWritable: true
        }, {
          pubkey: creator_instrument_acc,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: TOKEN_PROGRAM_ID,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: SYSVAR_RENT_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: pda_account,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: instrument_mint_acc.publicKey,
          isSigner: false,
          isWritable: true
        }
      ],
        data: Buffer.from(Uint8Array.of(Instruction.create_new_nft_mint,...new BN(multiple).toArray("le", 8)))
      });
    
    console.log("sending the instructions ...")
    const tx = new Transaction()
            .add(createInstrumentMintIx, createNewNFTMintIx);
    let sig = await connection.sendTransaction(tx, [creator_account, instrument_mint_acc], {skipPreflight: false, preflightCommitment: 'finalized'});
    return [sig, instrument_mint_acc, creator_instrument_acc]
}

export async function create_option(connection: Connection, strike: number, expiry: number, multiple: number, creator_account: Signer, 
  instrument: PublicKey | string | null, strike_instrument: PublicKey | string | null, creator_instrument_acc: PublicKey | null, creator_strike_instrument_acc: PublicKey, kind: OptionType) : Promise<[string, Contract]>{
    
    // check if the either instrument or strike_instrument is a symbol or address(public); assume symbol if string
    if (typeof instrument == "string" || typeof strike_instrument == "string"){
      let symbol_to_address_map = await get_token_map()
      instrument = typeof instrument == "string" ? new PublicKey(symbol_to_address_map.get(instrument)) : instrument
      strike_instrument = typeof strike_instrument == "string" ? new PublicKey(symbol_to_address_map.get(strike_instrument)) : strike_instrument
      if (!strike_instrument) throw "invalid strike instrument symbol"
    }

    console.log("bob initiating contract")
    if (instrument == null){
      // In this case, create a new NFT mint then assign it as the instrument
      if (creator_instrument_acc != null) throw "when instrument is null, the creator_instrument_acc must be null"
      //create a mint address for the new instrument
      console.log("creating new nft mint ...");
      const [sig, instrument_mint_acc, new_creator_instrument_acc] = await create_new_nft_mint(connection, multiple, creator_account)
      creator_instrument_acc = new_creator_instrument_acc as PublicKey
      instrument = (instrument_mint_acc as Keypair).publicKey
      let res = await connection.confirmTransaction(sig as string, "finalized")
      console.log("new nft mint result", res)
      console.log("done creating new nft mint")
    }

    // create collateral account
    console.log("creating collateral acc")
    const collateralAccount = new Keypair();
    console.log("collateral account key: ", collateralAccount.publicKey.toString())
    const createCollateralAccIx = SystemProgram.createAccount({
        programId: TOKEN_PROGRAM_ID,
        space: AccountLayout.span,
        lamports: await connection.getMinimumBalanceForRentExemption(AccountLayout.span, 'confirmed'),
        fromPubkey: creator_account.publicKey,
        newAccountPubkey: collateralAccount.publicKey
    });

    // init collateral account
    let initCollateralAccountIx;
    if (kind == OptionType.call){
      console.log("creating init call collateral acc instruction with instrument", instrument.toString())
      initCollateralAccountIx = Token.createInitAccountInstruction(TOKEN_PROGRAM_ID, 
        instrument, collateralAccount.publicKey, creator_account.publicKey);
    } else{
      console.log("creating init put collateral acc instruction")
      initCollateralAccountIx = Token.createInitAccountInstruction(TOKEN_PROGRAM_ID, 
        strike_instrument, collateralAccount.publicKey, creator_account.publicKey);
    }

    // create options trading account (it is a program account not token account)
    console.log("creationg options program account create instruction")
    const optionsAccount = new Keypair();
    const optionsProgramId = new PublicKey(OPTIONS_PROGRAM_ID);

    const createOptionsAccountIx = SystemProgram.createAccount({
        space: OPTION_ACCOUNT_DATA_LAYOUT.span,
        lamports: await connection.getMinimumBalanceForRentExemption(OPTION_ACCOUNT_DATA_LAYOUT.span, 'singleGossip'),
        fromPubkey: creator_account.publicKey,
        newAccountPubkey: optionsAccount.publicKey,
        programId: optionsProgramId
    });

    // Create a mint address that will hold the NFT attached to this contract
    let nftTokenAccount = new Keypair();
    // let nft_pda_acc = new Keypair();
    
    // get the address for the account that will be associated with the NFT
    // this code is from the associated token program 
    const [nft_associated_account, _] = await PublicKey.findProgramAddress(
      [
        creator_account.publicKey.toBytes(),
        TOKEN_PROGRAM_ID.toBytes(),
        nftTokenAccount.publicKey.toBytes()
      ], ASSOCIATED_TOKEN_PROGRAM_ID);

    console.log("nft token: ", nftTokenAccount.publicKey.toString())
    console.log("nft associated account: ", nft_associated_account.toString())

    const [pda, _bump_seed] = await PublicKey.findProgramAddress([Buffer.from(SEED)], optionsProgramId)
    let pda_account = new PublicKey(pda);

    const createOptionsIx = new TransactionInstruction({
        programId: optionsProgramId,
        keys: [{
          pubkey: creator_account.publicKey,
          isSigner: true,
          isWritable: true
        }, {
          pubkey: collateralAccount.publicKey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: creator_instrument_acc,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: creator_strike_instrument_acc,
          isSigner: false,
          isWritable: true
        }, {
            pubkey: nftTokenAccount.publicKey,
            isSigner: true,
            isWritable: true
        }, {
          pubkey: TOKEN_PROGRAM_ID,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: SYSVAR_RENT_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: nft_associated_account,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: optionsAccount.publicKey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: pda_account,
          isSigner: false,
          isWritable: true
        }
      ],
        data: Buffer.from(Uint8Array.of(0, ...new BN(strike).toArray("le", 8), 
          ...new BN(multiple).toArray("le", 8), ...new BN(expiry).toArray("le", 8), kind  ))
      });

    let contract: Contract = {
      strike: strike,
      expiry: expiry,
      multiple: multiple,

      instrument: instrument,
      strike_instrument: strike_instrument,

      nft_id : nftTokenAccount.publicKey,
      nft_account: nft_associated_account,
      account_id: optionsAccount.publicKey,

      collateral_acc : collateralAccount.publicKey,      
      // a call means writer receives strike_instrument in exchange for instrument
      // a put means writer receives the instrument and send out the strike instrument
      writer_recv_acc: (kind == OptionType.call)? creator_strike_instrument_acc : creator_instrument_acc,

      writer: creator_account.publicKey,
      kind: kind
    }

    // transfer tokens to temp and then get escrow info
    console.log("generated contract", print_contract(contract))
    console.log("sending the instructions ...")
    const tx = new Transaction()
            .add(createCollateralAccIx, initCollateralAccountIx, createOptionsAccountIx, createOptionsIx);
    // const tx = new Transaction()
    //   .add(createOptionsAccountIx, createOptionsIx);
    let sig = await connection.sendTransaction(tx, [creator_account, collateralAccount, optionsAccount, nftTokenAccount], {skipPreflight: false, preflightCommitment: 'finalized'});
    console.log("done")
    return [sig, contract]

}

export async function exercise_call(connection: Connection, contract: Contract, buyer_acc: Signer, buyer_nft_acc: PublicKey,
  buyer_receive_acc: PublicKey, buyer_send_acc: PublicKey){
    return exercise_option(connection, contract, buyer_acc, buyer_nft_acc,
      buyer_receive_acc, buyer_send_acc, OptionType.call)
}

export async function exercise_put(connection: Connection, contract: Contract, buyer_acc: Signer, buyer_nft_acc: PublicKey,
  buyer_receive_acc: PublicKey, buyer_send_acc: PublicKey){
    return exercise_option(connection, contract, buyer_acc, buyer_nft_acc,
      buyer_receive_acc, buyer_send_acc, OptionType.put)
}

/**
 * Exercises the options contract
 * @param connection connection to the cluster
 * @param contract the Contract 
 * @param buyer_acc buyer's account
 * @param buyer_nft_acc the buyer's account that holds the ownership nft. This get burned by the exercise instruction
 * @param buyer_receive_acc account the buyers expects to receive the options collateral 
 * @param buyer_send_acc the account holding the tokens the buyer is sending to exercise this contract
 * @param kind call or put
 * @returns signature
 */
export async function exercise_option(connection: Connection, contract: Contract, buyer_acc: Signer, buyer_nft_acc: PublicKey,
   buyer_receive_acc: PublicKey, buyer_send_acc: PublicKey, kind: OptionType) : Promise<string> {
  
    let strike = contract.strike;
    let expiry = contract.expiry;
    let multiple = contract.multiple;

    let today = dayjs();
    if (today > dayjs(expiry*1000)){
      console.error("This contract exipred on %s , today is %s", dayjs(expiry).format(), today.format())
      throw "contract has exipired"
    }

    const optionsProgramId = new PublicKey(OPTIONS_PROGRAM_ID);


    let nft_token_mint = new PublicKey(contract.nft_id)
    let collateral_acc = new PublicKey(contract.collateral_acc)
    let writer_recv_acc = new PublicKey(contract.writer_recv_acc)
    let options_program_account = new PublicKey(contract.account_id)
    
    const [pda, bump_seed] = await PublicKey.findProgramAddress([Buffer.from(SEED)], optionsProgramId)
    let pda_account = new PublicKey(pda);
    console.log("exercising contract", contract)
    const exerciseIx = new TransactionInstruction({
      programId: optionsProgramId,
      keys: [{
        pubkey: buyer_acc.publicKey,
        isSigner: true,
        isWritable: true
      }, {
        pubkey: buyer_nft_acc,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: nft_token_mint,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: buyer_send_acc,
        isSigner: false,
        isWritable: true
      }, {
          pubkey: buyer_receive_acc,
          isSigner: false,
          isWritable: true
      }, {
        pubkey: collateral_acc,
        isSigner: false,
        isWritable: true
      },{
        pubkey: writer_recv_acc,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: contract.writer,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false
      }, {
        pubkey: options_program_account,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: pda_account,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false
      }
    ],
      data: Buffer.from(Uint8Array.of(1, ...new BN(strike).toArray("le", 8), 
        ...new BN(multiple).toArray("le", 8), kind ))
    });

    console.log("sending the exercise instructions ...")
    const tx = new Transaction()
            .add(exerciseIx);
    return connection.sendTransaction(tx, [buyer_acc], {skipPreflight: false, preflightCommitment: 'confirmed'});
}

/**
 * Creators call this to close expired contracts. This instruction returns the collateral to the creator if the contract is expired and 
 * hasn't been exercised yet, and returns any lamport used to create the options program account back to the creator and cleans out its data.
 * Exercised contracts are automatically closed
 * @param connection Connection to cluster
 * @param contract Contract 
 * @param creator_acc The creators keypair
 * @param creator_receive_acc the receiving account where the released collateral will be sent back
 * @returns signature 
 */
export async function close_option(connection: Connection, contract: Contract, creator_acc: Keypair, creator_receive_acc: PublicKey) : Promise<string> {

   const optionsProgramId = new PublicKey(OPTIONS_PROGRAM_ID);

   let collateral_acc = new PublicKey(contract.collateral_acc)
   let options_program_account = new PublicKey(contract.account_id)
   
   const [pda, _] = await PublicKey.findProgramAddress([Buffer.from(SEED)], optionsProgramId)
   console.log("exercising contract", contract)
   const exerciseIx = new TransactionInstruction({
     programId: optionsProgramId,
     keys: [{
       pubkey: creator_acc.publicKey,
       isSigner: true,
       isWritable: true
     }, {
       pubkey: collateral_acc,
       isSigner: false,
       isWritable: true
     }, {
       pubkey: creator_receive_acc,
       isSigner: false,
       isWritable: true
     }, {
       pubkey: TOKEN_PROGRAM_ID,
       isSigner: false,
       isWritable: false
     }, {
       pubkey: options_program_account,
       isSigner: false,
       isWritable: true
     }, {
       pubkey: pda,
       isSigner: false,
       isWritable: true
     }
   ],
     data: Buffer.from(Uint8Array.of(3))
   });

   console.log("sending the close instructions ...")
   const tx = new Transaction()
           .add(exerciseIx);
   return connection.sendTransaction(tx, [creator_acc], {skipPreflight: false, preflightCommitment: 'confirmed'});
}