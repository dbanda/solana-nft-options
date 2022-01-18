var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var redis = require('redis');
var solana = require("@solana/web3.js");
var cors = require('cors')

// var indexRouter = require('./routes/index');
// var usersRouter = require('./routes/users');

var app = express();
const corsOpts = {
  origin: '*',

  methods: [
    'GET',
    'POST',
  ],

  allowedHeaders: [
    'Content-Type',
  ],
};

app.use(cors(corsOpts))
var cursor = 0

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// app.use('/', indexRouter);
// app.use('/users', usersRouter);
console.log("starting server")
const client = redis.createClient();
client.on('error', (err) => console.log('Redis Client Error', err));
(async ()=>{await client.connect()})();

app.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});


app.get('/contracts/getall', function(req, res, next) {
  client.HGETALL('nft_contracts').then(contracts=>{
    //res.header('Access-Control-Allow-Origin', '*');
    res.json(contracts)
  })
});

app.get('/contracts/count', function(req, res, next) {
  client.HLEN('nft_contracts').then(size=>{
    res.json({count: size})
  })
});

function sanitize(r){
  console.log("sanitizing", r)
  if (r.kind != "call" && r.kind != "put"){
    console.log("invalid option kind")
    throw "invalid option kind"
  }
  let contract = {
    strike: Number(r.strike),
    expiry: Number(r.expiry),
    multiple: Number(r.multiple),
    instrument: new solana.PublicKey(r.instrument).toString(),
    strike_instrument: new solana.PublicKey(r.strike_instrument).toString(),
    nft_id: new solana.PublicKey(r.nft_id).toString(),
    nft_account: new solana.PublicKey(r.nft_account).toString(),
    account_id: new solana.PublicKey(r.account_id).toString(),
    collateral_acc: new solana.PublicKey(r.collateral_acc).toString(),
    writer_recv_acc: new solana.PublicKey(r.writer_recv_acc).toString(),
    writer: new solana.PublicKey(r.writer).toString(),
    timestamp : new Date().getTime(),
    kind: r.kind
  }
  console.log("created contract", contract)
  if (!contract.nft_id) {

	  throw 'contract has no nft id';
  }
  return contract
}
app.get('/contracts/getnext/:cursor-:count', function(req, res, next) {
  console.log("using cursor", cursor )
  client.HSCAN('nft_contracts', req.params.cursor, {COUNT:req.params.count}).then((data)=>{
    cursor = data.cursor
    console.log(cursor)
    res.json(data)
  })
});

app.post('/contract', function(req, res, next) {
  console.log("contract body", req.body)
  //res.header('Access-Control-Allow-Origin', '*');
  let contract = sanitize(req.body)
  console.log("posting contract", contract)
  client.HSET('nft_contracts', contract.nft_id, JSON.stringify(contract)).then(
    ()=> res.json(contract)
  );
});




// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  console.error(err)
  res.status(err.status || 500);
  res.json(err);
});

module.exports = app;
