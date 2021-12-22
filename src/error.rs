// inside error.rs
use thiserror::Error;

use solana_program::program_error::ProgramError;

#[derive(Error, Debug, Copy, Clone)]
pub enum OptionsError {
    /// Invalid instruction
    #[error("Invalid Instruction")]
    InvalidInstruction,
    #[error("Not rent exempt")]
    NotRentExempt,
    #[error("Expected amount mismatch")]
    ExpectedAmountMismatch,
    #[error("Amount Overflow")]
    AmountOverflow,
    #[error("This contract is expired")]
    ContractExpired,
    #[error("This contract is not expired")]
    ContractNotExpired,
    #[error("This contract is of a different kind")]
    WrongContractType
}

impl From<OptionsError> for ProgramError {
    fn from(e: OptionsError) -> Self {
        ProgramError::Custom(e as u32)
    }
}