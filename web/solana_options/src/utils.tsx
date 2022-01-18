import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey, SendOptions, Signer, Transaction } from "@solana/web3.js";
declare const window: any;

export const NETWORK_TO_URI: Record<string, string> = {
    'mainet-beta': "https://api.mainnet-beta.solana.com",
    'devnet': "https://api.devnet.solana.com",
    'testnet': " wget http://api.testnet.solana.com/",
    'localnet': " http://localhost:8899"
}

export async function isTokenAccountAvailable(conn: Connection, addr: string, owner: Signer) {
    let tok_acc_addr = await Token.getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID, new PublicKey(addr), owner.publicKey)
    let tok = new Token(conn, new PublicKey(addr), TOKEN_PROGRAM_ID, owner);
    try {
        // check if account exists
        let ac = await tok.getAccountInfo(tok_acc_addr);
        console.log("tok ac", ac, ac.amount);
        return [tok_acc_addr, ac.amount]
    } catch (err) {
        return [null, 0]
    }
}


export async function patchConnection(conn: Connection, fee_payer: Signer) {
    var originalSend = conn.sendTransaction;
    originalSend = originalSend.bind(conn)
    const patchedSend = async (transaction: Transaction,
        signers: Array<Signer>,
        options?: SendOptions): Promise<any> => {
        // transaction = new Transaction()
        let { blockhash } = await conn.getRecentBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fee_payer.publicKey;
        if (signers.length > 1) transaction.partialSign(...signers.slice(1));
        let signed = await window.solana.signTransaction(transaction);
        let r = signed.serialize({ verifySignatures: false })
        return conn.sendRawTransaction(r, options);
    }
    conn.sendTransaction = patchedSend
}

export async function isOwned(conn: Connection, nft_mint: PublicKey, nft_account: PublicKey, owner: Signer) {
    let nft_tok = new Token(conn, new PublicKey(nft_mint), TOKEN_PROGRAM_ID, owner);
    try {
        // check if account exists
        let ac = await nft_tok.getAccountInfo(nft_account);
        return ac.amount
    }catch(e){
        return -1
    }
}

export async function transferNFT(conn:Connection, nft_account: PublicKey,  receiver: PublicKey, owner: Signer) {
    console.log("transfering ownership of nft", nft_account.toString(), "to", receiver.toString())
    let sell_ix = Token.createTransferInstruction(TOKEN_PROGRAM_ID, nft_account, 
        receiver, owner.publicKey, [owner], 1 )

    var tx = new Transaction();
    tx.add( sell_ix)
    try{
        let sig_sell = await conn.sendTransaction(tx, [owner], {skipPreflight: false, preflightCommitment: 'finalized'});
        console.log("sending", tx)
        return await conn.confirmTransaction(sig_sell, "finalized");
    }catch(e){
        throw e
    }
    
}

export async function getOrCreateAccounts(conn: Connection, instrument: String, strike_instrument: String, owner: Signer) {
    let instr_acc_addr = await Token.getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID, new PublicKey(instrument), owner.publicKey)
    let strike_instr_acc_addr = await Token.getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID, new PublicKey(strike_instrument), owner.publicKey)

    let inst_tok = new Token(conn, new PublicKey(instrument), TOKEN_PROGRAM_ID, owner);
    let strike_inst_tok = new Token(conn, new PublicKey(strike_instrument), TOKEN_PROGRAM_ID, owner);


    try {
        // check if account exists
        let ac = await inst_tok.getAccountInfo(instr_acc_addr);
        console.log("inst ac", ac, ac.amount);
    } catch (err) {
        const tx = new Transaction()
        console.log(err);
        alert("Instrument account not found. Will attempt to create");
        let create_ix = Token.createAssociatedTokenAccountInstruction(ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID,
            new PublicKey(instrument), instr_acc_addr, owner.publicKey, owner.publicKey)
        let blockhash = await conn.getRecentBlockhash();
        tx.recentBlockhash = blockhash.blockhash;
        tx.feePayer = owner.publicKey;
        tx.add(create_ix)
        const signature2 = await window.solana.signAndSendTransaction(tx);
        console.log("sent tx", signature2)
        await conn.confirmTransaction(signature2.signature);
        console.log("account created!")
    }

    try {
        // check if account exists
        let ac = await strike_inst_tok.getAccountInfo(strike_instr_acc_addr);
        console.log("strike ac", ac, ac.amount);
    } catch (err) {
        alert("Strike instrument account not found. Will attempt to create")
        const tx = new Transaction()
        let create_ix = Token.createAssociatedTokenAccountInstruction(ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID,
            new PublicKey(strike_instrument), strike_instr_acc_addr, owner.publicKey, owner.publicKey)
        let { blockhash } = await conn.getRecentBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = owner.publicKey;
        tx.add(create_ix)
        const { signature } = await window.solana.signAndSendTransaction(tx);
        await conn.confirmTransaction(signature);
        console.log("account created!")
    }

    return [instr_acc_addr, strike_instr_acc_addr]
}