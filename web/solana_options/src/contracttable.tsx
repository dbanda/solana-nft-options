import * as React from 'react';
import * as util from "util";
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';
import { TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import dayjs, { OptionType } from 'dayjs';
import { getOrCreateAccounts, isOwned, isTokenAccountAvailable, NETWORK_TO_URI, patchConnection, transferNFT } from './utils';
import { Connection, PublicKey } from '@solana/web3.js';
import { Alert, FormControlLabel, FormGroup, Switch } from '@mui/material';
import { close_option, Contract, exercise_call, exercise_put, get_contract_from_blockchain, print_contract } from 'solana-options';
import { TryRounded } from '@mui/icons-material';

const SERVER = "http://localhost:3000/"
const INTERVAL = 30_000
var NETWORK = ""
declare const window: any;

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 600,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

enum ContractAction {
  exercise = 0,
  close
}

enum Kind {
  call = "call",
  put = "put"
}


const columns = [
  { id: 'nft_id', label: 'nft id' },
  { id: 'instrument', label: 'instrument' },
  { id: 'instrument_symbol', label: 'instrument symbol' },
  { id: 'multiple', label: 'multiple' },
  { id: 'expiry', label: 'expiry', format: (x: number) => dayjs(x * 1000).format("DD/MM/YY HH:mm:ssZ"), minWidth: "50px" },
  { id: 'strike', label: 'strike' },
  { id: 'strike_instrument', label: 'strike instrument' },
  { id: 'strike_instrument_symbol', label: 'strike instrument symbol' },
  { id: 'writer_recv_acc', label: 'receive account' },
]

export type tableProps = { network?: string, newRows?: any[], nft?: string | null  };
const ROW_CACHE: any = {}

export default class ContractTable extends React.Component<tableProps>{
  TOKEN_MAP?: Map<string, TokenInfo>
  cursor = 0
  fetch_interval?: NodeJS.Timer
  state: any
  network?: string

  constructor(props: any) {
    super(props);
    this.network = props.network;
    this.state = {
      page: 0,
      rowsPerPage: 10,
      row: {},
      open_row: false,
      open_transfer: false,
      network: this.network,
      row_busy: false,
      row_show_alert: null,
      row_show_msg: null,
      show_closed: false,
      loading_rows: true,
      receiver: ""
    }
    this.state.rows = [this.getExample()[0]]
    this.cursor = 0
  }

  getExample() {
    let uri = (this.network as string).toLowerCase()
    return [
      {

        "strike": 69,
        "expiry": 1640151575.636,
        "multiple": 420,
        "nft_account": "F84JfmRJqSVYELfekEJQaU2uYp3B9ZXuNDJAbtgw4whp",
        "account_id": "6ry2hqXGbWUQMQATwVsgffGAkqbByNNuHVjJ6v6pgBxk",
        "collateral_acc": "4bYy3LvNvUQL9voyC3Z9CeRHTcrdoU6WBc4ywyPdtniF",
        "timestamp": 1640150977480,
        "strike_instrument": <a href={"https://explorer.solana.com/address/Ddo2RvG6GJ8S1GDaaiym9fuLUsyFyLvbiy8mHtJ2qZnU?cluster=" + uri}>{"Ddo2RvG6GJ8S1GDaaiym9fuLUsyFyLvbiy8mHtJ2qZnU"}</a>,
        "instrument": <a href={"https://explorer.solana.com/address/Ddo2RvG6GJ8S1GDaaiym9fuLUsyFyLvbiy8mHtJ2qZnU?cluster=" + uri}>{"Ddo2RvG6GJ8S1GDaaiym9fuLUsyFyLvbiy8mHtJ2qZnU"}</a>,
        "nft_id": <a href={"https://explorer.solana.com/address/Ddo2RvG6GJ8S1GDaaiym9fuLUsyFyLvbiy8mHtJ2qZnU?cluster=" + uri}>{"Ddo2RvG6GJ8S1GDaaiym9fuLUsyFyLvbiy8mHtJ2qZnU"}</a>,
        "nft_id_key": "Ddo2RvG6GJ8S1GDaaiym9fuLUsyFyLvbiy8mHtJ2qZnU",
        "writer_recv_acc": <a href={"https://explorer.solana.com/address/Ddo2RvG6GJ8S1GDaaiym9fuLUsyFyLvbiy8mHtJ2qZnU?cluster=" + uri}>{"Ddo2RvG6GJ8S1GDaaiym9fuLUsyFyLvbiy8mHtJ2qZnU"}</a>,
        "creator": "Ddo2RvG6GJ8S1GDaaiym9fuLUsyFyLvbiy8mHtJ2qZnU",
        "kind": "call"
      }
    ]
  }

  componentDidUpdate(prevProps: any) {
    this.network = this.props.network
    console.log("contract table update ", this.network)
    if (this.props.network !== prevProps.network) {
      console.log("update state", this.props.network)
      this.setState({ network: this.props.network, rows: [this.getExample()[0]] })
      this.getData()
    }
    if (this.props.newRows != prevProps.newRows) {
      this.setState({ network: this.props.network, rows: prevProps.newRows })
      this.getData()
    }
  }

  componentDidMount() {
    console.log("mounts ", this.network)
    this.getData()
    // get data every 3 secs
    this.fetch_interval = setInterval(() => { this.getNewData() }, INTERVAL)

  }

  componentWillUnmout() {
    clearInterval(this.fetch_interval! as unknown as number)
  }

  getToken(cb: { (token_map: any): void; (arg0: null): void; }) {
    if (this.TOKEN_MAP) {
      cb(this.TOKEN_MAP)

    } else {
      new TokenListProvider().resolve().then((tokens) => {
        const tokenList = tokens.filterByClusterSlug(
          (this.state.network as string).toLowerCase() == "localnet"?  'mainnet-beta': (this.state.network as string).toLowerCase()
        ).getList();
        console.log("tokenlist", tokenList);
        this.TOKEN_MAP = new Map(tokenList.map(t => [t.address, t]));
        cb(this.TOKEN_MAP)
      });
    }
  }

  getNewData() {
    fetch("contracts/count/")
      .then(response => response.json())
      .then(data => {
        console.log(this, data.count, this.state)
        if (data.count > this.state.rows.length) {
          this.getData()
        }
      })
  }

  async isLiveAccount(account_id: string, conn: Connection) {
    try {
      console.log("filter", account_id)
      return await get_contract_from_blockchain(conn, new PublicKey(account_id))
      // return false
    } catch {
      return false
    }
  }

  isExpired(row: any) {
    let today = dayjs();
    if (today > dayjs(row.expiry * 1000)) {
      return util.format("This contract expired on %s , today is %s", dayjs(row.expiry * 1000).format(), today.format())
    }
    return false
  }

  isNotExpired(row: any){
    let today = dayjs();
    if (today <= dayjs(row.expiry * 1000)) {
      return util.format("You can only close expired contracts. This contract expires on %s , today is %s", dayjs(row.expiry * 1000).format(), today.format())
    }
    return false
  }

  getData() {
    fetch("https://nftoptions.app/contracts/getall/")
      .then(response => response.json())
      .then(data => {

        // this.cursor = data.cursor ? data.cursor : this.state.rows.length-1
        let uri = NETWORK_TO_URI[(this.state.network as string).toLowerCase()]
        let conn = new Connection(uri);
        // this.setState({row_busy: true})

        let vals = Object.values(data)
        if (vals.length < this.state.rows.length + 1) return;
        console.log("vals", vals)
        let rows = vals.map(x => JSON.parse(x as string))
          .sort((a, b) => b.timestamp - a.timestamp)

        const filter = async (rows: any[]) => {
          if (this.props.nft){
            rows = rows.filter(x=>x.nft_id==this.props.nft?.trim())
          }

          if (!this.state.show_closed) { // if showing everythig this is a no-op
            var counter = rows.length
            for (let i = 0; i < rows.length; i++) {
              if (rows[i].account_id in ROW_CACHE){
                rows[i].show = ROW_CACHE[rows[i].account_id].show
                counter -= 1
                this.setState({ rows: this.state.rows, loading_rows: (counter <= 0)? false : true }) // refresh state
              }else {
                // asynchronously update the live property
                this.isLiveAccount(rows[i].account_id, conn).then(ac =>{
                  rows[i].show = ac
                  ROW_CACHE[rows[i].account_id] = rows[i]
                  console.log("isliveaccount", rows[i], ac)
                  counter -= 1
                  this.setState({ rows: this.state.rows, loading_rows: (counter <= 0)? false : true }) // refresh state
                })
              }
            }
          }
          return rows
        }

        filter(rows).then((data) => {
          var rows = data
          // if (!this.state.show_closed) {
          //   rows = data.filter((r) => r.show);
          // }

          console.log("filterd rows", rows)
          console.log("show closed", this.state.show_closed)
          console.log("rows", this.state.rows.length - 1)
          this.getToken((token_map) => {
            console.log("tokenmap", token_map)
            let new_rows = rows.map((row) => {
              console.log("row", row, token_map.get(row.strike_instrument))
              if (token_map.has(row.instrument)) {
                row.instrument_symbol = token_map.get(row.instrument).symbol
              }
              if (token_map.has(row.strike_instrument)) {
                row.strike_instrument_symbol = token_map.get(row.strike_instrument).symbol
              }
              let uri = (this.state.network as string).toLowerCase()

              row.nft_id_key = row.nft_id
              row.strike_instrument_key = row.strike_instrument
              row.instrument_key = row.instrument
              row.writer_recv_acc_key = row.writer_recv_acc

              row.strike_instrument = <a href={'https://explorer.solana.com/address/' + row.strike_instrument + "?cluster=" + uri}>{row.strike_instrument}</a>
              row.instrument = <a href={'https://explorer.solana.com/address/' + row.instrument + "?cluster=" + uri}>{row.instrument}</a>
              row.nft_id = <a href={'https://explorer.solana.com/address/' + row.nft_id + "?cluster="+ uri}>{row.nft_id}</a>
              row.writer_recv_acc = <a href={'https://explorer.solana.com/address/' + row.writer_recv_acc + "?cluster=" + uri}>{row.writer_recv_acc}</a>
              return row
            })

            // this.setState({ rows: new_rows, loading_rows: false })
            this.setState({ rows: new_rows })
          })
        })


      })
  }

  handleChangePage = (event: any, newPage: any) => {
    this.setState({ page: newPage })
  };

  handleChangeRowsPerPage = (event: { target: { value: string | number; }; }) => {
    this.setState({ rows: 0, rowsPerPage: +event.target.value })
  };

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

  async exerciseOrClose(row: any, action: ContractAction) {
    let uri = NETWORK_TO_URI[(this.state.network as string).toLowerCase()]
    console.log("connecting to", this.state.network, uri)
    let conn = new Connection(uri);

    if (!await this.isLiveAccount(row.account_id, conn)) {
      return this.setState({ row_show_alert: "This contract is already closed, exercised, or expired", row_busy: false })
    }

    if (action == ContractAction.exercise && this.isExpired(row)) {
      return this.setState({ row_show_alert: this.isExpired(row), row_busy: false })
    }

    if (action == ContractAction.close && this.isNotExpired(row)) {
      return this.setState({ row_show_alert: this.isNotExpired(row), row_busy: false })
    }

    await patchConnection(conn, this.state.user)
    let [nft_tok_acc, amnt] = await isTokenAccountAvailable(conn, row.nft_id_key, this.state.user)
    if (!nft_tok_acc) {
      this.setState({ row_show_alert: "An account for this NFT couldn't be found. Check that you own the nft for this contract" })
    }
    else if (amnt! < 1) {
      this.setState({ row_show_alert: "Failed to verify ownership of the NFT for this contract. Please check your wallet." })
    } else {
      let contract: Contract = {
        strike: row.strike,
        expiry: row.expiry,
        multiple: row.multiple,
        nft_id: new PublicKey(row.nft_id_key),
        nft_account: new PublicKey(row.nft_account),
        collateral_acc: new PublicKey(row.collateral_acc),
        account_id: new PublicKey(row.account_id),
        instrument: new PublicKey(row.instrument_key),
        strike_instrument: new PublicKey(row.strike_instrument_key),
        writer_recv_acc: new PublicKey(row.writer_recv_acc_key),
        writer: new PublicKey(row.writer),
        kind: row.kind
      }

      var inst_acc: PublicKey
      var strike_inst_acc: PublicKey
      try{
        [inst_acc, strike_inst_acc] = await getOrCreateAccounts(conn, contract.instrument.toString(), contract.strike_instrument.toString(), this.state.user)
      }catch(e){
        console.error("could not get or create", contract.instrument.toString(), contract.strike_instrument.toString() )
        this.setState({
          row_show_alert: util.format("Could not get or create accounts for one of mints %s, %s", contract.instrument.toString(), contract.strike_instrument.toString() ),
          row_busy: false 
        })
        throw "could not get or create accounts for mints"
      }

      if (action == ContractAction.exercise) {
        console.log("exercising", print_contract(contract))
        try {
          this.setState({row_show_msg: "Exercising option contract on blockchain... This may take a while."})
          if (contract.kind as OptionType == Kind.call) {
            let sig = await exercise_call(conn, contract, this.state.user, nft_tok_acc as PublicKey, inst_acc, strike_inst_acc)
            await conn.confirmTransaction(sig as string, "finalized")
          } else {
            let sig = await exercise_put(conn, contract, this.state.user, nft_tok_acc as PublicKey, strike_inst_acc, inst_acc)
            await conn.confirmTransaction(sig as string, "finalized")
          }

        }catch(e){
          this.setState({row_show_alert: util.format ("Error exercising contract: %s", e), row_busy: false })
          throw "error exercising contract"
        }

      } else {
        console.log("closing", print_contract(contract))
        // let [inst_acc, strike_inst_acc] = await getOrCreateAccounts(conn, contract.instrument.toString(), contract.strike_instrument.toString(), this.state.user)
        try{
          this.setState({row_show_msg: "Closing option contract on blockchain... This may take a while."})
          if (contract.kind as OptionType == Kind.call) {
            
            let sig = await close_option(conn, contract, this.state.user, inst_acc)
            await conn.confirmTransaction(sig as string, "finalized")
          } else {
            let sig = await close_option(conn, contract, this.state.user, strike_inst_acc)
            await conn.confirmTransaction(sig as string, "finalized")
          }
        }catch(e){
          this.setState({row_show_alert: util.format ("Error exercising contract: %s", e), row_busy: false })
          throw "error exercising contract"
        }


      }

      // exercise_put()
      this.setState({row_busy: false, row_show_msg: "Done!" })
      this.getData()
    }

  }

  async login() {
    let phantom = this.getProvider()
    let resp = await phantom.connect()
    return resp
  }

  async sendNFT(conn: Connection, nft_account: PublicKey, receiver:PublicKey){
    await patchConnection(conn, this.state.user)
    this.setState({row_show_alert: null, row_show_msg: "Sending ..."});
    return transferNFT(conn, nft_account, receiver, this.state.user)
  }

  send_evt(e: any, row: any) {
    e.preventDefault();
    console.log("clicked send", row, this, e)
    this.setState({ row_busy: true, row_show_alert: null })
    var receiver: PublicKey;
    try {
      receiver = new PublicKey(this.state.receiver)
    }catch {
      return this.setState({row_show_alert: "Invalid receiver address: '"+ this.state.receiver+"'", row_busy: false,  row_show_msg: null})
    }
    
    let uri = NETWORK_TO_URI[(this.state.network as string).toLowerCase()]
    console.log("connecting to", this.state.network, uri)
    let conn = new Connection(uri);
    

    let nft_account = new PublicKey(row.nft_account)
    this.login().then((resp: { publicKey: { toString: () => any; }; }) => {
      console.log("pubkey", resp, resp.publicKey.toString())
      this.setState({ user: resp })
      this.sendNFT(conn, nft_account, receiver).then((s)=>{
        console.log("confirmation", s)
        this.setState({row_busy: false, row_show_alert: null, row_show_msg: "Done!"});
      }).catch(e=>{
        this.setState({row_busy: false, row_show_msg: null, row_show_alert: "Error sending NFT: " + JSON.stringify(e)})
      })
    }).catch(e=>{
      this.setState({row_busy: false,  row_show_msg: null, row_show_alert: "Phantom wallet login failed: " + JSON.stringify(e)})
    })


  }

  async checkOwnership(conn: Connection, row: any) {
    let owned =  await isOwned(conn, new PublicKey(row.nft_id_key), new PublicKey(row.nft_account), this.state.user)
    console.log("owned", owned, owned<0)
    if (owned < 0){
      return this.setState({row_show_alert: "Did not find an account holding this NFT in your wallet", row_busy: false}) 
    } else if (owned == 0){
      return this.setState({row_show_alert: "You already sent this NFT", row_busy:false})
    }
    
  
    this.setState({ row_busy: false, open_transfer: true, open_row: false })
  }
  
  transfer_evt(e: any, row: any, action: ContractAction) {
    e.preventDefault();
    console.log("clicked transfer", row, this, e)
    this.setState({ row_busy: true })
    let uri = NETWORK_TO_URI[(this.state.network as string).toLowerCase()]
    console.log("connecting to", this.state.network, uri)
    let conn = new Connection(uri);

    console.log("transfering ownership to bob")
    this.checkOwnership(conn, row).then(()=>{
      console.log("ownership confirmed for", this.state.user)
    }).catch(e=>{
      this.setState({ row_busy: false, row_show_alert: "Error " + e })
    })


  }

  contract_action_evt(e: any, row: any, action: ContractAction) {
    e.preventDefault();
    console.log("clicked exercise", this, e)

    this.setState({ row_busy: true, row_show_msg: null, row_show_alert: null})

    this.login().then((resp: { publicKey: { toString: () => any; }; }) => {
      console.log("pubkey", resp, resp.publicKey.toString())
      this.setState({ user: resp })
      this.exerciseOrClose(row, action)
      // this.create().then(done=>console.log("done"))
    })

  }

  getRowOnClick(row: any) {
    return (e: any) => {
      console.log(e.target.tagName)
      if (e.target.tagName == "TD") {
        this.setState({ open_row: true, row: row })
      }

    }
  }

  render() {
    let className = 'contracttable';
    return (
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <FormGroup sx={{ m: "15px" }}>
          <FormControlLabel control={<Switch
            checked={this.state.show_closed}
            onChange={(e, checked) => {
              console.log("changing checked", checked)
              this.setState({ show_closed: checked, rows: [] })
              this.getData()
            }
            }
          />} label="Show closed" />
        </FormGroup>

        <TableContainer sx={{ maxHeight: 440, align: "center", margin: "10px", fontSize: 12 } as any}>
          {this.state.loading_rows && <LinearProgress></LinearProgress>}
          <Table stickyHeader aria-label="sticky table">
            <TableHead>
              <TableRow>
                {columns.map((column: any) => (
                  <TableCell
                    key={column.id}
                    align={column.align}
                    style={{ minWidth: column.minWidth, fontSize: 12, maxWidth: column.maxWidth || "100%" }}
                  >
                    {column.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {this.state.rows
                .slice(this.state.page * this.state.rowsPerPage, this.state.page * this.state.rowsPerPage + this.state.rowsPerPage)
                .filter((r:any) => this.state.show_closed || r.show)
                .map((row: { [x: string]: any; }, ir: string) => {
                  return (
                    <TableRow sx={{ cursor: "pointer" }} hover role="checkbox" tabIndex={-1} key={"" + ir} onClick={this.getRowOnClick(row)}>
                      {columns.map((column: any, ic) => {
                        const value = row[column.id];
                        return (
                          <TableCell key={"" + ir + "-" + ic} align={column.align} sx={{ fontSize: 10, m: 1, p: 1 }}>
                            {column.format && typeof value === 'number'
                              ? column.format(value)
                              : value}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 100]}
          component="div"
          count={this.state.rows.length}
          rowsPerPage={this.state.rowsPerPage}
          page={this.state.page}
          onPageChange={this.handleChangePage}
          onRowsPerPageChange={this.handleChangeRowsPerPage}
        />

        <Modal
          open={this.state.open_row}
          onClose={() => { this.setState({ open_row: false, row_show_alert: null, row_busy: false }) }}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
        >
          <Box sx={style as any}>
            <Typography id="modal-modal-title" variant="h6" component="h2">
              Contract
            </Typography>
            {/* <br></br> */}
            {/* Network: {this.state.network} */}
            <br></br>
            {
              this.state.row_show_msg && !this.state.row_show_alert && (
                <Alert severity="info">
                  {this.state.row_show_msg}
                </Alert>
              )
            }
            {this.state.row_busy && <LinearProgress></LinearProgress>}
            {
              this.state.row_show_alert && (
                <Alert severity="error">
                  {this.state.row_show_alert}
                </Alert>
              )
            }
            <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 3 }}>
              <Grid item xs={2}>
                strike:
              </Grid>
              <Grid item xs={10}>
                {this.state.row.strike}
              </Grid>
              <Grid item xs={2}>
                expiry:
              </Grid>
              <Grid item xs={10}>
                {dayjs(this.state.row.expiry * 1000).format("DD/MM/YY HH:mm:ss")} &emsp; {dayjs(this.state.row.expiry * 1000).format("Z")}
              </Grid>
              <Grid item xs={2}>
                multiple:
              </Grid>
              <Grid item xs={10}>
                {this.state.row.multiple}
              </Grid>
              <Grid item xs={2}>
                created on:
              </Grid>
              <Grid item xs={10}>
                {dayjs(this.state.row.timestamp).format("DD/MM/YY HH:mm:ss")} &emsp; {dayjs(this.state.row.timestamp).format("Z")}
              </Grid>


              <Grid item xs={3}>
                nft_id:
              </Grid>
              <Grid item xs={9}>
                {this.state.row.nft_id}
              </Grid>
              <Grid item xs={3}>
                instrument:
              </Grid>
              <Grid item xs={9}>
                {this.state.row.instrument} {this.state.row.instrument_symbol}
              </Grid>
              <Grid item xs={3}>
                strike instrument:
              </Grid>
              <Grid item xs={9}>
                {this.state.row.strike_instrument} {this.state.row.strike_instrument_symbol}
              </Grid>
              <Grid item xs={3}>
                receiving account:
              </Grid>
              <Grid item xs={9}>
                {this.state.row.writer_recv_acc}
              </Grid>
            </Grid>
            <br></br>
            <br></br>
            <br></br>
            <Box >
              {/* Actions (if owned): <br></br> */}
              <Box sx={{ flexGrow: 1, px: 3, my: "20px", textAlign: 'center' }}>
                <Button sx={{ mx: "7px" }} variant='outlined' onClick={
                  (() => {
                    let row = this.state.row;
                    return (e: any) => { this.contract_action_evt(e, row, ContractAction.exercise) };
                  })()
                }
                >Exercise</Button>

                <Button sx={{ mx: "7px" }} variant='outlined' onClick={
                  (() => {
                    let row = this.state.row;
                    return (e: any) => { this.contract_action_evt(e, row, ContractAction.close) };
                  })()
                }>Close</Button>

                <Button sx={{ mx: "7px" }} variant='outlined' onClick={
                  (() => {
                    let row = this.state.row;
                    return (e: any) => { this.transfer_evt(e, row, ContractAction.close) };
                  })()
                }>Transfer</Button>
              </Box>
            </Box>

          </Box>
        </Modal>

        <Modal
          open={this.state.open_transfer}
          onClose={() => { this.setState({ open_transfer: false, row_show_alert: null, row_busy: false }) }}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
        >
          <Box sx={style as any}>
            <Typography id="modal-modal-title" variant="h6" component="h2">
              Transfer NFT
            </Typography>
            {/* <br></br> */}
            {/* Network: {this.state.network} */}
            <br></br>
            {
              this.state.row_show_msg && !this.state.row_show_alert && (
                <Alert severity="info">
                  {this.state.row_show_msg}
                </Alert>
              )
            }
            {this.state.row_busy && <LinearProgress></LinearProgress>}
            {
              this.state.row_show_alert && (
                <Alert severity="error">
                  {this.state.row_show_alert}
                </Alert>
              )
            }
            <Typography  sx={{ mt: 2 }}>
                This will transfer the NFT {this.state.row.nft_id} to the receipient 
            </Typography>
            <br></br>
            <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 3 }}>
              <Grid item xs={4}>
                Receiver's address:
              </Grid>
              <Grid item xs={8}>
                <input type={"text"} placeholder='Receivers public key' onChange={e=>{this.setState({receiver: e.target.value})}}></input>
              </Grid>
            </Grid>
            <br></br>
            <br></br>
            <br></br>
            <Box >
              {/* Actions (if owned): <br></br> */}
              <Box sx={{ flexGrow: 1, px: 3, my: "20px", textAlign: 'center' }}>
                <Button sx={{ mx: "7px" }} variant='outlined' onClick={
                  (() => {
                    let row = this.state.row;
                    return (e: any) => { this.send_evt(e, row) };
                  })()
                }
                >Send</Button>
              </Box>
            </Box>

          </Box>
        </Modal>
      </Paper>
    );
  }

}
