import '../styles/globals.css'
import { AppProps } from 'next/app';
import Head from 'next/head';
import { FC } from 'react';
import { ContextProvider } from '../components/ContextProvider';
import '../src/App.css';
import '../src/index.css'
import theme from '../src/theme';
import Script from 'next/script';
import { ThemeProvider } from '@emotion/react';

// Use require instead of import since order matters
// require('antd/dist/antd.dark.less');
// require('@solana/wallet-adapter-ant-design/styles.css');
// require('@solana/wallet-adapter-react-ui/styles.css');
// require('../styles/globals.css');

const App: FC<AppProps> = ({ Component, pageProps }) => {
    return (
        <>
            <Head>
              <meta charSet="utf-8" />
              <link rel="icon" href="favicon.ico" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <meta name="theme-color" content="#000000" />
              <meta
                name="Solana NFT options homepage"
                content="The solana options package allows you to write token or nft options contracts on the solana blockchain"
              />
              <link rel="apple-touch-icon" href="logo192.png" />
              <link rel="manifest" href="manifest.json" />
              <title>Solana Options</title>
              <Script
                src="https://www.googletagmanager.com/gtag/js?id=G-02VM8B3QBE"
                strategy="afterInteractive"
              />
              <Script id="google-analytics" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
    
                    gtag('config', 'G-02VM8B3QBE');
                `}
              </Script>

            </Head>
            <ThemeProvider theme={theme}>
              <ContextProvider>
                  <Component {...pageProps} />
              </ContextProvider>
            </ThemeProvider>
        </>
    );
};

export default App;
