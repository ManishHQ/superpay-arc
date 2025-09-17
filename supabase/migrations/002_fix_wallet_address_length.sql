-- Fix wallet_address column to support Solana addresses
-- Solana addresses are ~44 characters (Base58), longer than Ethereum's 42 chars

ALTER TABLE user_profiles
ALTER COLUMN wallet_address TYPE VARCHAR(255);

-- Update the comment to reflect multi-chain support
COMMENT ON COLUMN user_profiles.wallet_address IS 'Multi-chain wallet address (Ethereum: 42 chars, Solana: ~44 chars, etc.)';