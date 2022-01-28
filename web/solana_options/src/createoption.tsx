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
import { Alert, FormControlLabel, Grid, Switch, ThemeProvider } from '@mui/material';
import { getOrCreateAccounts, NETWORK_DEFAULTS, NETWORK_TO_URI } from './utils';
import { WalletContext, WalletContextState } from '@solana/wallet-adapter-react';
import { SignerWalletAdapter, WalletAdapter } from '@solana/wallet-adapter-base';
import theme from './theme';

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
    // width: 400,
    [theme.breakpoints.down('sm')]: {
        width: '95%'
    },
    bgcolor: 'background.paper',
    color: 'white',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
};

export type createProps = { network?: string, handleNewContract: (c: Contract) => void, wallet_ctx: WalletContextState };

export default class CreateOption extends React.Component<createProps>{
    TOKEN_LIST?: TokenInfo[] = undefined
    wallet_ctx: WalletContextState
    state: any
    network?: string


    constructor(props: any) {
        super(props)
        this.network = props.network;
        this.wallet_ctx = props.wallet_ctx
        this.state = {
            user: null,
            open: false,
            mint_new: false,
            mint_type: "call",
            progress: false,
            network: this.network,
            show_alert: null,
            show_msg: null
        }
        this.getTokenList().then()
        this.create_evt = this.create_evt.bind(this);
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

    async create(wallet: SignerWalletAdapter, instrument: string | null, strike_instrument: string | null, strike: number, multiple: number, expiry: number, kind: Kind) {
        let uri = NETWORK_TO_URI[(this.state.network as string).toLowerCase()]
        let conn = new Connection(uri);
        let tok_map = await this.getTokenList();

        instrument = (instrument== null)? null : (tok_map.has(instrument.toUpperCase())) ? tok_map.get(instrument.toUpperCase()) as string : instrument
        strike_instrument = (strike_instrument== null)? null : (tok_map.has(strike_instrument.toUpperCase())) ? tok_map.get(strike_instrument.toUpperCase()) as string : strike_instrument
        console.log("mints", instrument, strike_instrument)
        try {
            (instrument && new PublicKey(instrument as string));
            (strike_instrument && new PublicKey(strike_instrument as string));
        } catch {
            console.error("could not find keys for mints", instrument, strike_instrument, this.state.network)
            this.setState({ show_alert: util.format("Could not find keys for one of mints %s, %s", instrument, strike_instrument), progress: false })
            throw util.format("Could not find keys for one of mints %s, %s", instrument, strike_instrument)
        }

        var instr_acc: PublicKey | null
        var stike_instr_acc: PublicKey | null
        try {
            this.setState({ show_msg: "Getting accounts. This may take a sec" });
            [instr_acc, stike_instr_acc] = await getOrCreateAccounts(conn, wallet, instrument, strike_instrument)
        } catch (e) {
            console.error("could not get or create", instrument, strike_instrument, e)
            this.setState({
                show_alert: util.format("Could not get or create accounts for one of mints %s, %s. err %s", instrument, strike_instrument, JSON.stringify(e)),
                progress: false, show_msg: null
            })
            throw util.format("Could not get or create accounts for one of mints %s, %s. err %s", instrument, strike_instrument, JSON.stringify(e))
        }


        console.log("mint accounts", instr_acc, stike_instr_acc)

        var sig: string
        var contract: Contract
        try {
            if (kind === Kind.call) {
                this.setState({ show_msg: "Creating call contract on blockchain... This may take a sec after approving" });
                [sig, contract] = await create_call(
                    conn, strike, expiry, multiple, wallet, 
                    (instrument === null)? null : new PublicKey(instrument as string),
                    (strike_instrument === null)? null : new PublicKey(strike_instrument as string),
                    instr_acc, stike_instr_acc
                )
            } else {
                this.setState({ show_msg: "Creating put contract on blockchain ... This may take a sec after approving" });
                [sig, contract] = await create_put(
                    conn, strike, expiry, multiple, wallet, 
                    (instrument === null)? null : new PublicKey(instrument as string), 
                    (strike_instrument === null)? null : new PublicKey(strike_instrument as string),
                    instr_acc, stike_instr_acc
                )
            }
            this.setState({ show_msg: null })

        } catch (e: any) {
            console.error("transaction error creating option", e, e.error)
            var msg = util.format("Error creating option: %s %s", e.message, e.error.logs)
            if (e.error.logs && (msg.indexOf("insufficient funds")>-1 || msg.indexOf("insufficient lamports")>-1)){
                msg = "insufficient funds in accounts"
                console.error(msg)
              }
            // this.setState({ show_alert: util.format("Transaction error: %s", JSON.stringify(e)), progress: false })
            this.setState({ row_show_alert: msg, progress: false })

            throw new Error(msg)
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
            let kind: Kind = elements["kind"].value
            let instrument: string = elements["instrument"]? elements["instrument"].value : null;
            let strike_instrument: string = elements["strike_instrument"]? elements["strike_instrument"].value : null;
            let strike: number = elements["strike"].value
            let multiple: number = elements["multiple"].value
            let expiry: number = Date.parse(elements["expiry"].value) / 1000
            console.log("creating contract with vals: ", instrument, strike_instrument, strike, expiry, kind)

            let self = this
            this.login().then((wallet_ctx : WalletContextState) => {
                console.log("using wallet",wallet_ctx, wallet_ctx.wallet?.adapter as SignerWalletAdapter)
                this.create(wallet_ctx.wallet?.adapter as SignerWalletAdapter, instrument, strike_instrument, strike, multiple, expiry, kind).then(
                    async ([sig, contract]) => {
                        console.log("created contract:",self, sig, print_contract(contract as Contract))
                        let uri = NETWORK_TO_URI[(self.state.network as string).toLowerCase()]
                        let conn = new Connection(uri);
                        try {
                            self.setState({ show_msg: "Confirming ..." });
                            await conn.confirmTransaction(sig as string, "finalized")
                            self.setState({ show_msg: "Confirmed!" });

                        } catch (e) {
                            self.setState({ show_alert: util.format("Error confirming transaction: %s", e), progress: false })
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
                            self.setState({ show_msg: "Downloading and sharing contract" });
                            a.click();

                            await publish_doc(contract as Contract)
                            self.props.handleNewContract(contract as Contract)
                            const img = await create_doc_img(contract as Contract);

                            console.log("calling cb", !!img);
                            img.getBase64Async(Jimp.MIME_PNG).then(b64 => {
                                a.href = b64;
                                a.download = "contact_" + Math.floor(10_000 * Math.random()) + ".png";;
                                a.click();
                                window.URL.revokeObjectURL(b64);
                            });
                            self.setState({ progress: false, show_msg: "Done!" });
                            // window.location.reload(false);
                        } catch (e) {
                            self.props.handleNewContract(contract as Contract)
                            self.setState({ show_alert: util.format("Error publishing or creating doc %s", e), progress: false, show_msg: null })
                        }
                    }
                ).catch((e) => {
                    console.error("create error", e )
                    this.setState({ show_alert: util.format("Transaction error: %s",e), progress: false })
                })
            }).catch((e) => {
                console.error("login err",e)
                this.setState({ show_alert: util.format("Select your wallet first: %s", JSON.stringify(e)), progress: false })
            })
        }
    }

    async login() {
 
        if (this.wallet_ctx.wallet){
          if (!this.wallet_ctx.connected) await this.wallet_ctx.connect();
          return this.wallet_ctx
        } else{
          alert("First connect your wallet!")
          throw Error("wallet not connected")
        }
    }

    componentDidMount() {
        // this.login()
    }

    componentDidUpdate(prevProps: any) {
        this.network = this.props.network
        console.log("update ", this.network)
        if (this.props.network !== prevProps.network) {
            this.TOKEN_LIST = undefined
            console.log("create option update state", this.props.network)
            this.setState({ network: this.props.network })
        }

        if (this.props.wallet_ctx !== prevProps.wallet_ctx){
            this.wallet_ctx = this.props.wallet_ctx
        }
    }

    render() {
        return (
            <span>
                <Button variant="contained" onClick={() => { this.setState({ open: true }) }} sx={{ m: 2 }}>Create Contract</Button>
                <Modal
                    open={this.state.open}
                    onClose={() => { this.setState({ open: false, progress: false, show_alert: null, show_msg: null }) }}
                    aria-labelledby="modal-modal-title"
                    aria-describedby="modal-modal-description"
                >
                    <Box sx={style as any}>
                        <ThemeProvider theme={theme}>
                            <Typography id="modal-modal-title" variant="h6" component="h2">
                                Create Contract
                            </Typography>
                            <Typography id="modal-modal-description" sx={{ mt: 2 }}>
                                Create a contract 
                            </Typography>
                        </ThemeProvider>
       
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
                     
                            <FormControlLabel control={<Switch
                                checked={this.state.mint_new}
                                onChange={(e, checked) => {
                                        console.log("changing mint", checked)
                                        this.setState({ mint_new: checked})
                                    }
                                }
                            />} label="Mint new" />

                            <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 3 }} sx={{ p: "4px" }}>
                                {(!this.state.mint_new || (this.state.mint_type !== "call")) && 
                                (<Grid item xs={5}>
                                    instrument:
                                </Grid>)
                                }
                                {(!this.state.mint_new || (this.state.mint_type !== "call")) &&
                                (<Grid item xs={7}>
                                    <input style={{maxWidth: "100%"}} name="instrument" required placeholder="instrument symbol or address"
                                         defaultValue={NETWORK_DEFAULTS[(this.state.network as String).toLowerCase()].inst}></input>
                                </Grid>)
                                }
                                {(!this.state.mint_new || (this.state.mint_type !== "put")) &&
                                (<Grid item xs={5}>
                                    strike instrument:
                                </Grid>)
                                }
                                {(!this.state.mint_new || (this.state.mint_type !== "put")) &&
                                (<Grid item xs={7}>
                                    <input style={{maxWidth: "100%"}} name="strike_instrument" required placeholder="strike symbol or address" 
                                        defaultValue={NETWORK_DEFAULTS[(this.state.network as String).toLowerCase()].strike_inst} ></input>
                                </Grid>)
                                }
                                <Grid item xs={5}>
                                    strike:
                                </Grid>
                                <Grid item xs={7}>
                                    <input style={{maxWidth: "100%"}} name="strike" type="number" min="1" required placeholder="1" 
                                        defaultValue={NETWORK_DEFAULTS[(this.state.network as String).toLowerCase()].strike}></input>
                                </Grid>
                                <Grid item xs={5}>
                                    multiple:
                                </Grid>
                                <Grid item xs={7}>
                                    <input style={{maxWidth: "100%"}} name='multiple' type="number" min="1" required placeholder="1" defaultValue="1"></input>
                                </Grid>
                                <Grid item xs={5}>
                                    expiry:
                                </Grid>
                                <Grid item xs={7}>
                                    <input style={{maxWidth: "100%"}} name='expiry' type="datetime-local" required></input>
                                </Grid>

                                <Grid item xs={5}>
                                    kind:
                                </Grid>
                                <Grid item xs={7}>
                                    <label htmlFor="call">call </label>
                                    <input style={{maxWidth: "100%"}} required type="radio" id="call" name="kind" value="call" defaultChecked onChange={e=>{
                                        console.log("radio",e.target.value)
                                        this.setState({mint_type: e.target.value})
                                        }}></input>
                                    &emsp; <label htmlFor="put">put </label>
                                    <input style={{maxWidth: "100%"}} required type="radio" id="put" name="kind" value="put" onChange={e=>{
                                        console.log("radio",e.target.value)
                                        this.setState({mint_type: e.target.value})
                                        }}></input><br></br>
                                </Grid>
                            </Grid>

                            <br></br>
                            <br></br>
                            <Box sx={{ flexGrow: 1, alignContent: 'center', textAlign: 'center' }}>
                                <Button variant='outlined' type='submit'>Create</Button><br></br>
                            </Box>
                        </form>
                    </Box>
                </Modal>
            </span>
        )
    }
}


