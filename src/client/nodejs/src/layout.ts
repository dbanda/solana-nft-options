import * as BufferLayout from "buffer-layout";
import borsh from 'borsh';

/**
 * Layout for a public key
 */
const publicKey = (property = "publicKey") => {
  return BufferLayout.blob(32, property);
};

/**
 * Layout for a 64bit unsigned value
 */
const uint64 = (property = "uint64") => {
  return BufferLayout.blob(8, property);
};

const int64 = uint64;

export const OPTION_ACCOUNT_DATA_LAYOUT = BufferLayout.struct([
  publicKey("writer_pubkey"),
  publicKey("ownership_nft_token"),
  publicKey("collateral_acc_pubkey"),
  publicKey("recv_acc_pubkey"),

  int64("expiry_date"),
  uint64("strike"),
  uint64("multiple"),

  BufferLayout.u8("is_expired"),
  BufferLayout.u8("is_initialized"),
  BufferLayout.u8("kind"),
]);

export interface OptionLayout {
  writer_pubkey: Uint8Array,
  ownership_nft_token: Uint8Array,
  collateral_acc_pubkey: Uint8Array,
  recv_acc_pubkey: Uint8Array,

  expiry_date: Buffer,
  strike: Buffer,
  multiple: Buffer,
  is_expired: boolean,
  is_initialized: boolean,
  kind: number
}

console.log(OPTION_ACCOUNT_DATA_LAYOUT.span)

// /**
//  * The state of a greeting account managed by the hello world program
//  */
//  class GreetingAccount {
//   counter = 0;
//   constructor(fields: {counter: number} | undefined = undefined) {
//     if (fields) {
//       this.counter = fields.counter;
//     }
//   }
// }


// /**
//  * Borsh schema definition for greeting accounts
//  */
//  const GreetingSchema = new Map([
//   [GreetingAccount, {kind: 'struct', fields: [['counter', 'u32']]}],
// ]);

// /**
//  * The expected size of each greeting account.
//  */
//  const GREETING_SIZE = borsh.serialize(
//   GreetingSchema,
//   new GreetingAccount(),
// ).length;