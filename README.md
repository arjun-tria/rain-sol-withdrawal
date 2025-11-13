# Rain Solana Withdrawal

A Solana program client for executing withdrawals from the Rain protocol.

## Entrypoint

The main entrypoint for this application is located in **`src/index.ts`**.

The entry function is `main()`, which:
- Loads withdrawal parameters from a withdrawal signature API response
- Initializes the Solana program connection
- Executes the withdrawal transaction using the `executeWithdrawal` function

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - Create a `.env` file in the root directory
   - Add your Solana RPC URL:
     ```
     SOLANA_RPC_URL=your_rpc_url_here
     ```

## Usage

The `main()` function expects a signer (Keypair) and processes withdrawal transactions based on:
- Withdrawal signature API response (`/withdrawal-signature`)
- Withdrawable balances API response (`/withdrawable-balances`)

## Project Structure

- `src/index.ts` - Main entrypoint and program initialization
- `src/withdraw.ts` - Withdrawal execution logic
- `src/collateral.ts` - Collateral management utilities
- `src/coordinator.ts` - Coordinator interaction utilities
- `src/hashUtils.ts` - Hash utility functions
- `src/utils/ed25519.program.ts` - Ed25519 signature program utilities
- `src/types/main.ts` - TypeScript types generated from the program IDL
- `src/idl/main.json` - Program Interface Description Language (IDL)

## Dependencies

- `@coral-xyz/anchor` - Anchor framework for Solana program interaction
- `@solana/web3.js` - Solana web3.js library
- `@solana/spl-token` - SPL token utilities
- `dotenv` - Environment variable management
- `tweetnacl` - Cryptographic signing utilities

