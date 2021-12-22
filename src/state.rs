use borsh::{BorshDeserialize, BorshSerialize};
use arrayref::{array_mut_ref, array_ref, array_refs, mut_array_refs};
use solana_program::{
    program_error::ProgramError,
    program_pack::{IsInitialized, Pack, Sealed},
    pubkey::Pubkey,
};

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, Default, PartialEq)]
pub struct SolOption {
    pub creator_pubkey: Pubkey,
    pub ownership_nft_token: Pubkey,
    pub collateral_acc_pubkey: Pubkey,
    pub recv_acc_pubkey: Pubkey,
    pub expiry_date: i64,
    pub strike: u64,
    pub multiple: u64,
    pub is_expired: bool,
    pub is_initialized: bool,
    pub kind: u8

}

pub const SOLOPTION_SIZE : usize = 155;

impl Sealed for SolOption {}

impl Pack for SolOption {
    const LEN: usize = SOLOPTION_SIZE;
    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let src = array_ref![src, 0, SOLOPTION_SIZE];
        let (creator_pubkey, ownership_nft_token, collateral_acc_pubkey, recv_acc_pubkey, 
            expiry_date, strike, multiple, is_expired, is_initialized, kind) =
            array_refs![src, 32, 32, 32, 32, 8, 8, 8, 1, 1, 1];
        Ok(SolOption{
            creator_pubkey: Pubkey::new_from_array(*creator_pubkey),
            ownership_nft_token: Pubkey::new_from_array(*ownership_nft_token),
            collateral_acc_pubkey: Pubkey::new_from_array(*collateral_acc_pubkey),
            recv_acc_pubkey: Pubkey::new_from_array(*recv_acc_pubkey),
            expiry_date: i64::from_le_bytes(*expiry_date),
            strike: u64::from_le_bytes(*strike),
            multiple: u64::from_le_bytes(*multiple),
            is_expired: is_expired[0] == 1,
            is_initialized: is_initialized[0] == 1,
            kind: kind[0]
        })
    }

    fn pack_into_slice(&self, dst: &mut [u8]) {
        let dst = array_mut_ref![dst, 0, SOLOPTION_SIZE];
        let (creator_pubkey, ownership_nft_token, collateral_acc_pubkey, recv_acc_pubkey, 
            expiry_date, strike, multiple, is_expired, is_initialized, kind) =
            mut_array_refs![dst, 32, 32, 32, 32, 8, 8, 8, 1, 1, 1];

        creator_pubkey.copy_from_slice(self.creator_pubkey.as_ref());
        ownership_nft_token.copy_from_slice(self.ownership_nft_token.as_ref());
        collateral_acc_pubkey.copy_from_slice(self.collateral_acc_pubkey.as_ref());
        recv_acc_pubkey.copy_from_slice(self.recv_acc_pubkey.as_ref());

        expiry_date.copy_from_slice(&self.expiry_date.to_le_bytes());
        strike.copy_from_slice(&self.strike.to_le_bytes());
        multiple.copy_from_slice(&self.multiple.to_le_bytes());
        let exp = match self.is_expired {
            true => [1 as u8],
            false => [0 as u8]
        };
        is_expired.copy_from_slice(&exp);
        let is_init = match self.is_initialized {
            true => [1 as u8],
            false => [0 as u8]
        };
        is_initialized.copy_from_slice(&is_init);
        kind.copy_from_slice(&self.kind.to_le_bytes());
    }
}

impl IsInitialized for SolOption{
    fn is_initialized(&self)->bool{
        self.is_initialized
    }
}

// unit test
#[cfg(test)]
mod tests {

    use super::*;

    #[test]
    fn test_pack_unpack() {
        let opt = SolOption {
            creator_pubkey: Pubkey::new_unique(),
            ownership_nft_token: Pubkey::new_unique(),
            collateral_acc_pubkey: Pubkey::new_unique(),
            recv_acc_pubkey: Pubkey::new_unique(),
            expiry_date: 69420,
            strike: 420,
            multiple: 69,
            is_expired: false,
            is_initialized:  true,
            kind: 0
        };
        let mut pack : [u8; SOLOPTION_SIZE] = [0;SOLOPTION_SIZE];
        opt.pack_into_slice(&mut pack);

        let opt2 = SolOption::unpack_from_slice(&pack).unwrap();
        assert_eq!(opt, opt2)
    }

}