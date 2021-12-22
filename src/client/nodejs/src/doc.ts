import Jimp from 'jimp';
import util from 'util';
import dayjs from 'dayjs';
import QRCode from 'easyqrcodejs-nodejs';
import { TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { Contract } from '.';
import axios from 'axios';
import { print_contract } from './utils';

const HEIGHT = 700;
const WIDTH = 600;

const CALL_CONTRACT = "This contract gives holder of this token the right but not obligation to buy %d units of %s tokens"
+ " at a price of %d %s tokens per unit at or before %s"
const PUT_CONTRACT = "This contract gives holder of this token the right but not obligation to sell %d units of %s tokens"
+ " at a price of %d %s tokens per unit at or before %s"

let TOKEN_LIST: TokenInfo[] = null;
const ENDPOINT: string = "http://localhost:3000/contract"

function write_doc_img(contract, image: Jimp){

  return new Promise<Jimp>(async (resolve, reject)=>{
      // console.log("writing to img", contract)
    // console.log("exp", Math.round(contract.expiry))
    let font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK)
    let logo = null
    let line = 0

    function load_logo(url,cb,xx,yy){
      function load_logo_cb (err, image:Jimp, {x,y}){
        if (y&&y>line){ line = y}
        Jimp.read(url).then(logo_img =>{
          logo_img.resize(18,18,(e,l)=>{
            console.log("blizing",e)
            image.blit(l, xx||x, yy||y, cb)
            
          })
        })
      }
      return load_logo_cb
    }

    function contract_txt(err, image:Jimp, coord){
      if (err) return reject(err);
      let pos = coord || {x:0,y:0}
      if (pos.y&&pos.y>line){ line = pos.y}
      var msg = ""

      get_token(contract.instrument, (instr_tok: TokenInfo)=>{
        get_token(contract.strike_instrument, (strike_tok: TokenInfo)=>{
          var inst_sym = contract.instrument
          var strike_sym = contract.strike_instrument
          if (instr_tok){
            console.log("instr tok", instr_tok)
            inst_sym = instr_tok.symbol || inst_sym
          }
          if (strike_tok){
            strike_sym = strike_tok.symbol || strike_sym
          }
          if (contract.kind == "call"){
            msg = util.format(CALL_CONTRACT, contract.multiple, inst_sym, 
              contract.strike, strike_sym, dayjs(Math.round(contract.expiry*1000)).format("DD MMM, YYYY"))
          }else{
            // put
            msg = util.format(PUT_CONTRACT, contract.multiple, inst_sym, 
              contract.strike, strike_sym, dayjs(Math.round(contract.expiry*1000)).format("DD MMM, YYYY HH:mm:ss Z"))
          }
          image.print(font,30, line+30,
            {
              text: msg ,
              alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
              alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
            }
            ,WIDTH-40,(err, img)=>{
              if (err) return reject(err)
              resolve(img)
            })
        })
      })
    }

    function qqrcode(err, image:Jimp, coord){
      if (err) return reject(err);
      let pos = coord || {x:0,y:0}
      if (pos.y&&pos.y>line){ line = pos.y}

      // New instance with options
      let qrcode = new QRCode({text: "nftoption.app?nft=" + contract.nft_id + "?account=" + contract.account_id});
      let data_url = qrcode.toDataURL()
      data_url.then(url=>{
        // console.log(url)
        const [, data] = url.split(',');
        Jimp.read(Buffer.from(data,'base64')).then(qrimg =>{
          let [w,h] = [200,200]
          let margin = 60
          line = line + margin + h
          qrimg.resize(w,h,(e,qrimg)=>{
            image.blit(qrimg, 300-w/2, line-h, contract_txt)
          })
        })
      })
    }

    function nft_token_id(err, image:Jimp, coord){
      if (err) return reject(err);
      let pos = coord || {x:0,y:0}
      if (pos.y&&pos.y>line){ line = pos.y}

        image.print(font,30, line+10,
          {
            text: 'NFT ID: ' + contract.nft_id,
            alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
            alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
          }
          ,WIDTH,qqrcode)

    }

    function account(err, image:Jimp, coord){
      if (err) return reject(err);
      let pos = coord || {x:0,y:0}
      if (pos.y&&pos.y>line){ line = pos.y}
      image.print(font,30, line+50,
        {
          text: 'ACCOUNT ID: ' + contract.account_id,
          alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
          alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
        }
        ,WIDTH,nft_token_id)

    }

    function expiry(err, image:Jimp, coord){
      if (err) return reject(err);
      let pos = coord || {x:0,y:0}
      if (pos.y&&pos.y>line){ line = pos.y}
   
      image.print(font,30, line+10,
        {
          text: 'EXPIRY: ' + dayjs(Math.round(contract.expiry*1000)).format("DD MMM, YYYY HH:mm:ss Z"),
          alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
          alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
        }
        ,WIDTH,account)
    }

    function multiple_fn(err, image:Jimp, coord){
      if (err) return reject(err);
      let pos = coord || {x:0,y:0}
      if (pos.y&&pos.y>line){ line = pos.y}

      image.print(font,30, line+10,
        {
          text: 'MULTIPLE: ' + contract.multiple,
          alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
          alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
        }
        ,WIDTH,expiry)
    }

    function strike_token(err, image:Jimp, coord){
      let pos = coord || {x:0,y:0}
      if (pos.y&&pos.y>line){ line = pos.y}
      get_token(contract.strike_instrument, (tokl: TokenInfo)=>{
        if (tokl){
          let tok = tokl
          logo = tok.logoURI

          image.print(font,30, line+10,
            {
              text: 'STRIKE: '+ contract.strike + ' ' + tok.symbol ,
              alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
              alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
            }
            ,WIDTH,load_logo(logo, expiry,null,line+10))
        }else {
          Jimp.loadFont(Jimp.FONT_SANS_16_BLACK).then(font=>{
            image.print(font,30, line+10,
              {
                text: 'STRIKE: ' + contract.strike + ' ' + contract.strike_instrument ,
                alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
                alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
              }
              ,WIDTH,multiple_fn)
            })
        }
      })
    }


    function instrument(err, image: Jimp, {x,y}){
      console.log("writing instruments")
      get_token(contract.instrument, (tokl: TokenInfo)=>{
        if (tokl){
          let tok = tokl
          logo = tok.logoURI
          image.print(font, 30, 60,
            {
              text: 'INSTRUMENT: ' + tok.symbol,
              alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
              alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
            }
            ,WIDTH,load_logo(logo,strike_token,null, 60))
        }else{
          Jimp.loadFont(Jimp.FONT_SANS_16_BLACK).then(font=>{
            image.print(font, 30, 60,
              {
                text: 'INSTRUMENT: ' + contract.instrument,
                alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
                alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
              }
              ,WIDTH-30,strike_token)
          })
        }
      })
    }

    function title(header: string){
      console.log("writing title")
      image.print(font,0, 20,          
        {
          text: header,
          alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
          alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
        }
        ,WIDTH,instrument)
    }

    if (contract.kind == "call"){
      title('CALL OPTION CONTRACT')
    }else{
      title('PUT OPTION CONTRACT')
    }

  })
}

export function create_doc_img(contract: Contract): Promise<Jimp>{
  return new Promise<Jimp>((resolve)=>{
    new Jimp(WIDTH, HEIGHT, "#eeeee4", async (err, image) => {  
      write_doc_img(print_contract(contract), image).then(img =>{
        resolve(img)
      })
    })  
  })
}


function get_token(mint, cb){
  if (TOKEN_LIST){
    let res = TOKEN_LIST.filter(t => t.address==mint)
    // console.log("fetched tokens", res)
    if (res.length > 0) return cb(res[0]);
    cb(null)
      
  }else{
    new TokenListProvider().resolve().then((tokens) => {
      const tokenList = tokens.filterByClusterSlug('mainnet-beta').getList();
      // console.log(tokenList);
      TOKEN_LIST = tokenList;
      get_token(mint, cb)
    });
  }



  // const Icon = (props: { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" }) => {
  //   const [tokenMap, setTokenMap] = useState<Map<string, TokenInfo>>(new Map());
  
  //   useEffect(() => {
  //     new TokenListProvider().resolve().then(tokens => {
  //       const tokenList = tokens.filterByChainId(ENV.MainnetBeta).getList();
  
  //       setTokenMap(tokenList.reduce((map, item) => {
  //         map.set(item.address, item);
  //         return map;
  //       },new Map()));
  //     });
  //   }, [setTokenMap]);
  
  //   const token = tokenMap.get(props.mint);
  //   if (!token || !token.logoURI) return null;
  //   return token
  // }
}

export async function publish_doc(contract: Contract, url: string = ENDPOINT){
  let contract_json = print_contract(contract)
  let res = await axios
    .post(ENDPOINT, contract_json)
  return res
}