use solana_program::program_error::ProgramError;
use arrayref::{array_ref, array_refs};
use crate::error::OptionsError::InvalidInstruction;
use crate::processor::OptionType;

pub struct Create {
    pub strike: u64,
    pub multiple : u64,
    pub expiry : i64,
    pub kind : OptionType
}

pub struct CreateNewNFTMint {
    pub multiple : u64
}

pub struct Exercise {
    /// the amount the taker expects to be paid in the other token, as a u64 because that's the max possible supply of a token
    pub strike: u64,
    pub multiple : u64,
    pub kind : OptionType
}

pub enum OptionInstruction {
    Create(Create),
    CreateNewNFTMint(CreateNewNFTMint),
    Exercise(Exercise),
    Close()
}

impl OptionInstruction {
    /// Unpacks a byte buffer into a [EscrowInstruction](enum.EscrowInstruction.html).
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (tag, rest) = input.split_first().ok_or(InvalidInstruction)?;
    
        // inside unpack
        Ok(match tag {
            0 => OptionInstruction::Create(Self::unpack_create(rest)?),
            1 => OptionInstruction::Exercise(Self::unpack_exercise(rest)?),
            2 => OptionInstruction::CreateNewNFTMint(Self::unpack_create_new_nft(rest)?),
            3 => OptionInstruction::Close(),
            _ => return Err(InvalidInstruction.into()),
        })
    }

    fn unpack_create(src: &[u8]) -> Result<Create, ProgramError> {
        let size = src.len();
        assert_eq!(size, 25);
        let src = array_ref![src, 0, 25];
        let (strike, multiple, expiry, kind) =
            array_refs![src, 8, 8, 8,1];
        Ok(
            Create {
                strike: u64::from_le_bytes(*strike),
                multiple: u64::from_le_bytes(*multiple),
                expiry: i64::from_le_bytes(*expiry),
                kind : match u8::from_le_bytes(*kind) {
                    0 => OptionType::Call,
                    1 => OptionType::Put,
                    _ => panic!("invalid kind")
                }
            }
        )
    }

    fn unpack_exercise(src: &[u8]) -> Result<Exercise, ProgramError> {
        let size = src.len();
        assert_eq!(size, 17);
        let src = array_ref![src, 0, 17];
        let (strike, multiple, kind) =
            array_refs![src, 8, 8, 1];
        Ok(
            Exercise {
                strike: u64::from_le_bytes(*strike),
                multiple: u64::from_le_bytes(*multiple),
                kind: match u8::from_le_bytes(*kind) {
                    0 => OptionType::Call,
                    1 => OptionType::Put,
                    _ => panic!("invalid kind")
                }
            }
        )
    }

    fn unpack_create_new_nft(src: &[u8]) -> Result<CreateNewNFTMint, ProgramError> {
        let size = src.len();
        assert_eq!(size, 8);
        let src = array_ref![src, 0, 8];
        Ok(
            CreateNewNFTMint {
                multiple: u64::from_le_bytes(*src),
            }
        )
    }
}