import { AccountInfo, AccountLayout, ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SignerWalletAdapter } from "@solana/wallet-adapter-base";
import { Connection, PublicKey, SendOptions, Signer, Transaction } from "@solana/web3.js";
declare const window: any;

export const NETWORK_TO_URI: Record<string, string> = {
    'mainnet-beta': "https://api.mainnet-beta.solana.com",
    'devnet': "https://api.devnet.solana.com",
    'testnet': "https://api.testnet.solana.com/",
    'localnet': "http://localhost:8899"
}

export const NETWORK_DEFAULTS: Record<string, any> = {
    'mainnet-beta': {inst: "wSOL", strike_inst: "USDC", strike: 140},
    'testnet': {inst: "wSOL", strike_inst: "USDC", strike: 140},
    'devnet': {inst: "SOL", strike_inst: "USDT_ILT", strike: 140},
    'localnet': {inst: "SOL", strike_inst: "USDT_ILT", strike: 140},
}

export async function isTokenAccountAvailable(conn: Connection, addr: string, wallet: SignerWalletAdapter) {
    let tok_acc_addr = await Token.getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID, new PublicKey(addr), wallet.publicKey!)

    try {
        // check if account exists
        const info = await conn.getAccountInfo(new PublicKey(tok_acc_addr));
        if (!info!.owner.equals(TOKEN_PROGRAM_ID)) {
            throw new Error("not owned by token prog");
        }
        const data = Buffer.from(info!.data);
        let ac : AccountInfo = AccountLayout.decode(data);

        console.log("tok ac", ac, ac.amount);
        return [tok_acc_addr, ac.amount]
    } catch (err) {
        return [null, 0]
    }
}

export async function isOwned(conn: Connection, nft_mint: PublicKey, nft_account: PublicKey, wallet: SignerWalletAdapter) {
    try {
        // check if account exists
        const info = await conn.getAccountInfo(new PublicKey(nft_mint));
        if (!info!.owner.equals(TOKEN_PROGRAM_ID)) {
            throw new Error("not owned by token prog");
        }
        const data = Buffer.from(info!.data);
        let ac : AccountInfo = AccountLayout.decode(data);
        if (ac.owner != wallet.publicKey){
            throw new Error("not owned by " + wallet.publicKey)
        }
        return ac.amount
    }catch(e){
        return -1
    }
}

export async function transferNFT(conn: Connection, wallet: SignerWalletAdapter,  nft_account: PublicKey,  receiver: PublicKey) {
    console.log("transfering ownership of nft", nft_account.toString(), "to", receiver.toString())
    let sell_ix = Token.createTransferInstruction(TOKEN_PROGRAM_ID, nft_account, 
        receiver, wallet.publicKey!, [], 1 )

    var tx = new Transaction();
    tx.add( sell_ix)
    try{
        let sig_sell = await wallet.sendTransaction(tx, conn, {skipPreflight: false, preflightCommitment: 'finalized'});
        console.log("sending", tx)
        return await conn.confirmTransaction(sig_sell, "finalized");
    }catch(e){
        throw e
    }
    
}

export async function getOrCreateAccounts(conn: Connection, wallet: SignerWalletAdapter, instrument: String | null, strike_instrument: String | null) {
    var instr_acc_addr: PublicKey | null = null;
    var strike_instr_acc_addr: PublicKey | null = null;

    if (instrument){
        instr_acc_addr = await Token.getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID, new PublicKey(instrument), wallet.publicKey!)
        try {
            // check if account exists
            const info = await conn.getAccountInfo(new PublicKey(instr_acc_addr));
            if (!info!.owner.equals(TOKEN_PROGRAM_ID)) {
                throw new Error("not owned by token prog");
            }
            const data = Buffer.from(info!.data);
            let ac = AccountLayout.decode(data);
            console.log("inst ac", ac, ac.amount);
        } catch (err) {
            const tx = new Transaction()
            console.error(err);
            alert("Instrument account not found. Will attempt to create");
            let create_ix = Token.createAssociatedTokenAccountInstruction(ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID,
                new PublicKey(instrument as string), instr_acc_addr, wallet.publicKey!, wallet.publicKey!)
            let blockhash = await conn.getRecentBlockhash();
            tx.recentBlockhash = blockhash.blockhash;
            tx.feePayer = wallet.publicKey!;
            tx.add(create_ix)
            console.log("sending tx", tx)
            const signature = await wallet.sendTransaction(tx, conn)
            console.log("sent tx", signature)
            await conn.confirmTransaction(signature);
            console.log("account created!")
        }
    }

    if (strike_instrument){
        strike_instr_acc_addr = await Token.getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID, new PublicKey(strike_instrument), wallet.publicKey!)

        try {
            // check if account exists
            const info = await conn.getAccountInfo(new PublicKey(strike_instr_acc_addr));
            if (!info!.owner.equals(TOKEN_PROGRAM_ID)) {
                throw new Error("not owned by token prog");
            }
            const data = Buffer.from(info!.data);
            let ac = AccountLayout.decode(data);
            console.log("strike ac", ac, ac.amount);
        } catch (err) {
            alert("Strike instrument account not found. Will attempt to create")
            const tx = new Transaction()
            let create_ix = Token.createAssociatedTokenAccountInstruction(ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID,
                new PublicKey(strike_instrument), strike_instr_acc_addr, wallet.publicKey!, wallet.publicKey!)
            let { blockhash } = await conn.getRecentBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = wallet.publicKey!;
            tx.add(create_ix)
            console.log("sending tx", tx)
            const signature = await wallet.sendTransaction(tx, conn)
            console.log("sent tx", signature)
            await conn.confirmTransaction(signature);
            console.log("account created!")
        }    
    }
    return [instr_acc_addr, strike_instr_acc_addr]
}

export function pprint(str: string){
    if (str.length > 15){
        return str.substring(0,5) + "..." + str.substring(str.length-5)
    }
    return str
}