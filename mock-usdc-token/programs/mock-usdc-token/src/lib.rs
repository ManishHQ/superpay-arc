use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo, Transfer};

declare_id!("3XDGbzBFhxCvwg89j6ZQ6B2KHgRXDmEFtZvf8x2cxnq2");

#[program]
pub mod mock_usdc_token {
    use super::*;

    /// Initialize the USDC mock token mint
    pub fn initialize_mint(ctx: Context<InitializeMint>) -> Result<()> {
        msg!("Initializing Mock USDC Token");
        Ok(())
    }

    /// Mint tokens to a specified account (admin only)
    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.mint.mint_authority.unwrap(),
            MockUsdcError::UnauthorizedMint
        );

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.to.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token::mint_to(cpi_ctx, amount)?;

        msg!("Minted {} Mock USDC tokens", amount);
        Ok(())
    }

    /// Transfer tokens between accounts
    pub fn transfer_tokens(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: ctx.accounts.from.to_account_info(),
            to: ctx.accounts.to.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token::transfer(cpi_ctx, amount)?;

        msg!("Transferred {} Mock USDC tokens", amount);
        Ok(())
    }

    /// Burn tokens from an account
    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        let cpi_accounts = token::Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.from.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token::burn(cpi_ctx, amount)?;

        msg!("Burned {} Mock USDC tokens", amount);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMint<'info> {
    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = authority,
        mint::freeze_authority = authority,
    )]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub to: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct TransferTokens<'info> {
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,

    #[account(mut)]
    pub to: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub from: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum MockUsdcError {
    #[msg("Unauthorized mint operation")]
    UnauthorizedMint,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Invalid token account")]
    InvalidTokenAccount,
}