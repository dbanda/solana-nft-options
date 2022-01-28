// import './App.css';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import ContractTable from './contracttable';
import CreateOption from './createoption';
import Container from '@mui/material/Container';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import * as React from 'react';
import { Contract, print_contract } from 'solana-options';
import {
  WalletConnectButton as ReactUIWalletConnectButton,
  WalletDisconnectButton as ReactUIWalletDisconnectButton,
  WalletModalButton as ReactUIWalletModalButton,
  WalletMultiButton as ReactUIWalletMultiButton,
} from '@solana/wallet-adapter-react-ui';
import {
  WalletConnectButton as MaterialUIWalletConnectButton,
  WalletDialogButton as MaterialUIWalletDialogButton,
  WalletDisconnectButton as MaterialUIWalletDisconnectButton,
  WalletMultiButton as MaterialUIWalletMultiButton,
} from '@solana/wallet-adapter-material-ui';
import { TableCell, TableRow, ThemeProvider } from '@mui/material';
import { useWallet } from '@solana/wallet-adapter-react';
import theme from './theme';

function App() {
  
  const [network, setNetwork] = React.useState("Testnet");
  const [rows, setRows] = React.useState<any>([]);
  let [query, setQuery] = React.useState<string| null>(null)
  const wallet_ctx = useWallet();

  React.useEffect(()=>{
    let search = window.location.search;
    let params = new URLSearchParams(search);
    if (params){
      setQuery(params.get('nft'))
    }
  
    let selected_network = window.sessionStorage.getItem("network");
    if (selected_network && selected_network !== network){
      setNetwork(selected_network);
    }
  })


  return (
    <div className="App">
      <AppBar color='inherit' enableColorOnDark position="static" sx={{ opacity: .9, backgroundColor: '#282c34' }}>
        <Container maxWidth="xl">
          <Toolbar disableGutters>
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{ mr: 2, display: { xs: 'none', md: 'flex' } }}
            >
              {/* LOGO  */}
              <img src="logo_alpha_512.png" alt='solana nft options logo' style={{ maxHeight: "2.25rem" }}></img>
            </Typography>
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}
            >
              {/* LOGO  */}
              <img src="logo_alpha_512.png" alt='solana nft options logo' style={{ maxHeight: "2.25rem" }}></img>
            </Typography>
            <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }}>
            </Box>

            <div>
              <FormControl sx={{ m: 1, minWidth: 80, opacity: 1 }}>
                <InputLabel id="demo-simple-select-autowidth-label">Network</InputLabel>
                <Select
                  labelId="demo-simple-select-label"
                  id="demo-simple-select"
                  value={network}
                  sx={{ color: 'white' }}
                  label="network"
                  onChange={(event: SelectChangeEvent) => { 
                    setNetwork(event.target.value)
                    window.sessionStorage.setItem("network", event.target.value);
                  }}
                >
                  <MenuItem value={"Localnet"}>Localnet</MenuItem>
                  <MenuItem value={"Devnet"}>Devnet</MenuItem>
                  <MenuItem value={"Testnet"}>Testnet</MenuItem>
                  <MenuItem value={"Mainnet-beta"}>Mainnet</MenuItem>
                </Select>
              </FormControl>
            </div>
          </Toolbar>
        </Container>
      </AppBar>
      <header className="App-header">
        {/* <img src={logo} className="App-logo" alt="logo" /> */}
        {/* <p>
          Edit <code>src/App.js</code> and save to reload.
        </p> */}
        <h1>Solana Options</h1>
        <a
          className="App-link"
          href="https://github.com/dbanda/solana-nft-options"
          target="_blank"
          rel="noopener noreferrer"
        >
          Check out the Source
        </a>
        <a
          className="App-link"
          href="https://www.npmjs.com/package/solana-options"
          target="_blank"
          rel="noopener noreferrer"
        >
          Get it from NPM
        </a>
        {/* <a
          className="App-link"
          href="https://discord.gg/AHtHnZY8"
          target="_blank"
          rel="noopener noreferrer"
        >
          Join the Discord
        </a> */}

        <br></br>
      </header>
      {/* <Toolbar disableGutters></Toolbar> */}
      <Box sx={{ flexGrow: 1, px: 3, my: "20px", textAlign: 'center' }}>
        <CreateOption network={network} handleNewContract={(c: Contract)=>{setRows([print_contract(c)])}} wallet_ctx={wallet_ctx}></CreateOption>
        <MaterialUIWalletMultiButton />
      </Box>
      <br></br>
      <ThemeProvider theme={theme}>
        <ContractTable network={network} newRows={rows} nft={query} wallet_ctx={wallet_ctx}></ContractTable>
      </ThemeProvider>



    </div>
  );
}

export default App;
