import type { NextPage } from 'next'
// import Head from 'next/head'
// import Image from 'next/image'
// import styles from '../styles/Home.module.css'
import theme from '../src/theme';
import App from '../src/App'
import { useAutoConnect } from '../components/AutoConnectProvider'
import { ThemeProvider } from '@mui/material';

const Home: NextPage = () => {
  const { autoConnect, setAutoConnect } = useAutoConnect();
  setAutoConnect(false)
  return (
    <ThemeProvider theme={theme}>
      <App></App>
    </ThemeProvider>

  )
}

export default Home
