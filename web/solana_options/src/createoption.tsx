import * as React from 'react';
import * as util from "util";
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';

import Jimp from 'jimp';
import { Contract, create_call, create_doc_img, create_put, print_contract, publish_doc } from "solana-options";
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { PublicKey, Connection, Transaction, SendOptions, Signer } from '@solana/web3.js';
import { Alert, Grid } from '@mui/material';
import { NETWORK_TO_URI } from './utils';

declare const window: any;

enum Kind {
    call = "call",
    put = "put"
}

const style = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 400,
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
};

export type createProps = { network?: string, handleNewContract: (c: Contract) => void };

export default class CreateOption extends React.Component<createProps>{
    TOKEN_LIST?: TokenInfo[] = undefined
    state: any
    network?: string


    constructor(props: any) {
        super(props)
        this.network = props.network;
        this.state = {
            user: null,
            open: false,
            progress: false,
            network: this.network,
            show_alert: null,
            show_msg: null
        }
        this.getTokenList().then()
        this.create_evt = this.create_evt.bind(this);
    }

    async isTokenAccountAvailable(conn: Connection, addr: string) {
        let tok_acc_addr = await Token.getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID, new PublicKey(addr), this.state.user.publicKey)
        let tok = new Token(conn, new PublicKey(addr), TOKEN_PROGRAM_ID, this.state.user);
        try {
            // check if account exists
            let ac = await tok.getAccountInfo(tok_acc_addr);
            console.log("tok ac", ac, ac.amount);
            return [true, ac.amount]
        } catch (err) {
            return [false, 0]
        }
    }

    async getOrCreateAccounts(conn: Connection, instrument: String, strike_instrument: String) {
        let instr_acc_addr = await Token.getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID, new PublicKey(instrument), this.state.user.publicKey)
        let strike_instr_acc_addr = await Token.getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID, new PublicKey(strike_instrument), this.state.user.publicKey)

        let inst_tok = new Token(conn, new PublicKey(instrument), TOKEN_PROGRAM_ID, this.state.user);
        let strike_inst_tok = new Token(conn, new PublicKey(strike_instrument), TOKEN_PROGRAM_ID, this.state.user);


        try {
            // check if account exists
            let ac = await inst_tok.getAccountInfo(instr_acc_addr);
            console.log("inst ac", ac, ac.amount);
        } catch (err) {
            const tx = new Transaction()
            console.error(err);
            alert("Instrument account not found. Will attempt to create");
            let create_ix = Token.createAssociatedTokenAccountInstruction(ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID,
                new PublicKey(instrument), instr_acc_addr, this.state.user.publicKey, this.state.user.publicKey)
            let blockhash = await conn.getRecentBlockhash();
            tx.recentBlockhash = blockhash.blockhash;
            tx.feePayer = this.state.user.publicKey;
            tx.add(create_ix)
            console.log("sending tx", tx)
            const { signature } = await window.solana.signAndSendTransaction(tx);
            console.log("sent tx", signature)
            await conn.confirmTransaction(signature);
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
                new PublicKey(strike_instrument), strike_instr_acc_addr, this.state.user.publicKey, this.state.user.publicKey)
            let { blockhash } = await conn.getRecentBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = this.state.user.publicKey;
            tx.add(create_ix)
            console.log("sending tx", tx)
            const { signature } = await window.solana.signAndSendTransaction(tx);
            console.log("sent tx", signature)
            await conn.confirmTransaction(signature);
            console.log("account created!")
        }

        return [instr_acc_addr, strike_instr_acc_addr]
    }

    async getTokenList(): Promise<Map<String, String>> {
        if (this.TOKEN_LIST) {
            let symbol_to_address_map = new Map(this.TOKEN_LIST.map(t => [t.symbol.toUpperCase(), t.address]))
            return symbol_to_address_map
        }
        let tokens = await new TokenListProvider().resolve()
        const tokenList = tokens.filterByClusterSlug(
            (this.state.network as string).toLowerCase() === "localnet" ? 'devnet' : (this.state.network as string).toLowerCase()
        ).getList();
        this.TOKEN_LIST = tokenList;
        return this.getTokenList()
    }
    async create(instrument: string, strike_instrument: string, strike: number, multiple: number, expiry: number, kind: Kind) {
        let uri = NETWORK_TO_URI[(this.state.network as string).toLowerCase()]
        let conn = new Connection(uri);
        // patch conn to use phantom

        let originalSend = conn.sendTransaction;
        originalSend.bind(conn)
        const patchedSend = async (transaction: Transaction,
            signers: Array<Signer>,
            options?: SendOptions): Promise<any> => {
            let { blockhash } = await conn.getRecentBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = this.state.user.publicKey;
            transaction.partialSign(...signers.slice(1))
            let signed = await window.solana.signTransaction(transaction);
            let r = signed.serialize({ verifySignatures: false })
            return conn.sendRawTransaction(r, options);
        }



        let tok_map = await this.getTokenList();

        instrument = (tok_map.has(instrument.toUpperCase())) ? tok_map.get(instrument.toUpperCase()) as string : instrument
        strike_instrument = (tok_map.has(strike_instrument.toUpperCase())) ? tok_map.get(strike_instrument.toUpperCase()) as string : strike_instrument
        console.log("mints", instrument, strike_instrument)
        try {
            new PublicKey(instrument)
            new PublicKey(strike_instrument)
        } catch {
            console.error("could not find keys for mints", instrument, strike_instrument)
            this.setState({ show_alert: util.format("Could not find keys for one of mints %s, %s", instrument, strike_instrument), progress: false })
            throw util.format("Could not find keys for one of mints %s, %s", instrument, strike_instrument)
        }

        var instr_acc: PublicKey
        var stike_instr_acc: PublicKey
        try {
            this.setState({ show_msg: "Getting accounts. This may take a sec" });
            [instr_acc, stike_instr_acc] = await this.getOrCreateAccounts(conn, instrument, strike_instrument)
        } catch (e) {
            console.error("could not get or create", instrument, strike_instrument, e)
            this.setState({
                show_alert: util.format("Could not get or create accounts for one of mints %s, %s. err %s", instrument, strike_instrument, e),
                progress: false, show_msg: null
            })
            throw util.format("Could not get or create accounts for one of mints %s, %s. err %s", instrument, strike_instrument, e)
        }


        console.log("mint accounts", instr_acc, stike_instr_acc)

        // await sendAndConfirmTransaction('CreateAssociatedTokenAccount', this.connection, new web3_js.Transaction().add(), this.payer);


        // console.log("ass addr", addr)
        conn.sendTransaction = patchedSend
        var sig: string
        var contract: Contract
        try {
            if (kind === Kind.call) {
                this.setState({ show_msg: "Creating call contract on blockchain... This may take a sec after approving" });
                [sig, contract] = await create_call(
                    conn, strike, expiry, multiple, this.state.user, new PublicKey(instrument), new PublicKey(strike_instrument),
                    instr_acc, stike_instr_acc
                )
            } else {
                this.setState({ show_msg: "Creating put contract on blockchain ... This may take a sec after approving" });
                [sig, contract] = await create_put(
                    conn, strike, expiry, multiple, this.state.user, new PublicKey(instrument), new PublicKey(strike_instrument),
                    instr_acc, stike_instr_acc
                )
            }
            this.setState({ show_msg: null })

        } catch (e) {
            console.error("transaction error", e)
            this.setState({ show_alert: util.format("Transaction error: %s", e), progress: false })
            throw e
        }

        console.log("created", sig, contract)
        return [sig, contract]

    }

    create_evt(e: any) {
        e.preventDefault();
        console.log("clicked create", this, e)
        let form: HTMLFormElement = e.target
        form.checkValidity()

        if (form.checkValidity()) {
            this.setState({ progress: true, show_alert: null })
            let elements = form.elements as any
            let instrument: string = elements["instrument"].value
            let strike_instrument: string = elements["strike_instrument"].value
            let strike: number = elements["strike"].value
            let multiple: number = elements["multiple"].value
            let expiry: number = Date.parse(elements["expiry"].value) / 1000
            let kind: Kind = elements["kind"].value
            console.log("creating contract with vals: ", instrument, strike_instrument, strike, expiry, kind)

            this.login().then((resp: { publicKey: { toString: () => any; }; }) => {
                console.log("pubkey", resp, resp.publicKey.toString())
                this.setState({ user: resp })
                this.create(instrument, strike_instrument, strike, multiple, expiry, kind).then(
                    async ([sig, contract]) => {
                        console.log("created contract:", sig, print_contract(contract as Contract))
                        let uri = NETWORK_TO_URI[(this.state.network as string).toLowerCase()]
                        let conn = new Connection(uri);
                        try {
                            this.setState({ show_msg: "Confirming ..." });
                            await conn.confirmTransaction(sig as string, "finalized")
                            this.setState({ show_msg: "Confirmed!" });

                        } catch (e) {
                            this.setState({ show_alert: util.format("Error confirming transaction: %s", e), progress: false })
                        }

                        try {

                            // download contract

                            let a: any = document.createElement("a");
                            a.style = "display: none";
                            document.body.appendChild(a);
                            let data_str = "data:text/json;charset=utf-8," +
                                encodeURIComponent(JSON.stringify(print_contract(contract as Contract), null, 4));
                            a.href = data_str;
                            a.download = "contact_" + Math.floor(10_000 * Math.random()) + ".json";
                            this.setState({ show_msg: "Downloading and sharing contract" });
                            a.click();

                            await publish_doc(contract as Contract)
                            this.props.handleNewContract(contract as Contract)
                            const img = await create_doc_img(contract as Contract);

                            console.log("calling cb", !!img);
                            img.getBase64Async(Jimp.MIME_PNG).then(b64 => {
                                a.href = b64;
                                a.download = "contact_" + Math.floor(10_000 * Math.random()) + ".png";;
                                a.click();
                                window.URL.revokeObjectURL(b64);
                            });
                            this.setState({ progress: false, show_msg: "Done!" });
                            // window.location.reload(false);
                        } catch (e) {
                            this.props.handleNewContract(contract as Contract)
                            this.setState({ show_alert: util.format("Error publishing or creating doc %s", e), progress: false, show_msg: null })
                        }
                    }).catch((e) => {
                        this.setState({ show_alert: util.format("Transaction error: %s", e), progress: false })
                    })
            })
        }
    }

    async login() {
        let phantom = this.getProvider()
        if (phantom) {
            let resp = await phantom.connect()
            return resp
        } else {
            throw new Error("not logged in");
        }
    }

    componentDidMount() {
        // this.login()
    }

    componentDidUpdate(prevProps: any) {
        this.network = this.props.network
        console.log("update ", this.network)
        if (this.props.network !== prevProps.network) {
            console.log("update state", this.props.network)
            this.setState({ network: this.props.network })
        }
    }

    getProvider = () => {
        if ("solana" in window) {
            const provider = window.solana;
            if (provider.isPhantom) {
                return provider;
            }
        }
        alert("please login with phantom wallet. https://phantom.app/")
        window.open("https://phantom.app/", "_blank");
    };

    render() {
        return (
            <div>
                <Button variant="contained" onClick={() => { this.setState({ open: true }) }} sx={{ m: 2 }}>Create Contract</Button>
                <Modal
                    open={this.state.open}
                    onClose={() => { this.setState({ open: false, progress: false, show_alert: null }) }}
                    aria-labelledby="modal-modal-title"
                    aria-describedby="modal-modal-description"
                >
                    <Box sx={style as any}>
                        <Typography id="modal-modal-title" variant="h6" component="h2">
                            Create Contract
                        </Typography>
                        <Typography id="modal-modal-description" sx={{ mt: 2 }}>
                            Create a contract with phantom wallet
                        </Typography>
                        <br></br>
                        <form onSubmit={this.create_evt}>
                            {this.state.show_msg && !this.state.show_alert && (
                                <Alert severity="info">
                                    {this.state.show_msg}
                                </Alert>
                            )}
                            {this.state.progress && <LinearProgress />}
                            {this.state.show_alert && (
                                <Alert severity="error">
                                    {this.state.show_alert}
                                </Alert>
                            )}
                            <br></br>

                            <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 3 }} sx={{ p: "4px" }}>
                                <Grid item xs={5}>
                                    instrument:
                                </Grid>
                                <Grid item xs={7}>
                                    <input name="instrument" required placeholder="instrument symbol or address" defaultValue="wSOL"></input>
                                </Grid>
                                <Grid item xs={5}>
                                    strike instrument:
                                </Grid>
                                <Grid item xs={7}>
                                    <input name="strike_instrument" required placeholder="strike symbol or address" defaultValue="USDC" ></input>
                                </Grid>
                                <Grid item xs={5}>
                                    strike:
                                </Grid>
                                <Grid item xs={7}>
                                    <input name="strike" type="number" min="1" required placeholder="1" defaultValue="140"></input>
                                </Grid>
                                <Grid item xs={5}>
                                    multiple:
                                </Grid>
                                <Grid item xs={7}>
                                    <input name='multiple' type="number" min="1" required placeholder="1" defaultValue="1"></input>
                                </Grid>
                                <Grid item xs={5}>
                                    expiry:
                                </Grid>
                                <Grid item xs={7}>
                                    <input name='expiry' type="datetime-local" required></input>
                                </Grid>

                                <Grid item xs={5}>
                                    kind:
                                </Grid>
                                <Grid item xs={7}>
                                    <label htmlFor="call">call </label>
                                    <input required type="radio" id="call" name="kind" value="call" defaultChecked></input>
                                    &emsp; <label htmlFor="put">put </label>
                                    <input required type="radio" id="put" name="kind" value="put"></input><br></br>
                                </Grid>
                            </Grid>

                            <br></br>
                            <br></br>
                            <Box sx={{ flexGrow: 1, alignContent: 'center', textAlign: 'center' }}>
                                <Button variant='outlined' type='submit'>Create with Phantom</Button><br></br>
                            </Box>
                        </form>
                    </Box>
                </Modal>
            </div>
        )
    }
}