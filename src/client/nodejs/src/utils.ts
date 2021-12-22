import { Connection, PublicKey } from "@solana/web3.js";
import {Contract, OptionType} from ".";
import { OptionLayout, OPTION_ACCOUNT_DATA_LAYOUT } from "./layout";
import assert from "assert";
import dayjs from "dayjs";
import Buffer from "buffer";

export function print_contract(contract: Contract){
    return {
      strike: contract.strike,
      expiry: contract.expiry,
      multiple: contract.multiple,
      instrument: contract.instrument.toString(),
      strike_instrument: contract.strike_instrument.toString(),
      nft_id: contract.nft_id.toString(),
      nft_account: contract.nft_account.toString(),
      account_id: contract.account_id.toString(),
      collateral_acc: contract.collateral_acc.toString(),
      writer_recv_acc: contract.writer_recv_acc.toString(),
      writer: contract.writer.toString(),
      kind: (contract.kind == OptionType.call) ? "call" : "put"
    }
  }

export async function get_contract_from_blockchain(connection: Connection, account_id: PublicKey): Promise<OptionLayout>{
  let account = await connection.getAccountInfo(account_id, "finalized")
  let data = account.data
  if (data.length != OPTION_ACCOUNT_DATA_LAYOUT.span) throw "invalid account"
  const decodedOptionsLayout = OPTION_ACCOUNT_DATA_LAYOUT.decode(account.data) as OptionLayout;
  return decodedOptionsLayout;
}

export async function verify_contract(contract: Contract, option_layout: OptionLayout): Promise<boolean> {
  assert.equal(contract.writer.toString(), new PublicKey(option_layout.writer_pubkey).toString(), "wrong writer")
  assert.equal(contract.nft_id.toString(), new PublicKey(option_layout.ownership_nft_token).toString(), "wrong nft id")
  assert.equal(contract.collateral_acc.toString(), new PublicKey(option_layout.collateral_acc_pubkey).toString(), "wrong collateral account")
  assert.equal(contract.writer_recv_acc.toString(), new PublicKey(option_layout.recv_acc_pubkey).toString(), "wrong receiving address")

  assert.equal(contract.strike, Number(option_layout.strike.readBigInt64LE()), "wrong strike")
  assert.equal(contract.multiple, Number(option_layout.multiple.readBigInt64LE()), "wrong multiple")
  assert.ok(Math.floor(contract.expiry) == Number(option_layout.expiry_date.readBigInt64LE()), "wrong date")

  assert.equal(contract.kind, option_layout.kind, "wrong kind")
  assert.equal(1, option_layout.is_initialized, "not initialized")

  let today = dayjs();
  let expiry = Number(option_layout.expiry_date.readBigInt64LE())
  if (today > dayjs(expiry*1000)){
    console.error("This contract details are correct but it expired on %s , today is %s", 
      dayjs(expiry).format(), today.format())
    throw "contract has exipired"
  }
  return true
}