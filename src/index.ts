/**
 * Main entrypoint for the Rain Solana withdrawal application.
 * 
 * This module initializes the Solana program connection and executes withdrawal
 * transactions based on withdrawal signature API responses.
 */

import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import dotenv from "dotenv";

import MainIdl from "./idl/main.json";
import { Main } from "./types/main";

import { executeWithdrawal } from "./withdraw";

// Load environment variables from .env file
dotenv.config();

/**
 * Initializes and returns a Program instance for interacting with the Rain Solana program.
 * 
 * @param programAddress - The public key address of the deployed Solana program
 * @param signer - The Keypair used to sign transactions
 * @returns A Program instance configured with the IDL and provider
 * 
 * @throws Error if SOLANA_RPC_URL is not set in environment variables
 */
function getProgram(programAddress: string, signer: Keypair): Program<Main> {
  // Retrieve RPC URL from environment variables
  const rpcUrl = process.env.SOLANA_RPC_URL
  if (!rpcUrl) {
    throw new Error("No RPC URL provided");
  }

  // Create a connection to the Solana network with 'confirmed' commitment level
  // This ensures we wait for transaction confirmation before proceeding
  const connection = new Connection(rpcUrl, { commitment: 'confirmed' })

  // Load the program's Interface Description Language (IDL) which defines 
  // the program's account structures and instruction interfaces
  // Assign the program address to the IDL for proper program identification
  const idl: any = Object.assign(MainIdl, { address: programAddress })

  // Create an AnchorProvider instance to interact with the Solana network 
  // using the specified RPC endpoint and signer
  // The provider handles transaction signing and submission
  const opts = AnchorProvider.defaultOptions()
  const provider = new AnchorProvider(
    connection,
    new Wallet(signer),
    opts
  )

  // Create and return a Program instance that provides an interface to interact
  // with the on-chain program using the IDL definition and provider connection
  return new Program<Main>(idl, provider)
}

/**
 * Main entrypoint function for executing a withdrawal transaction.
 * 
 * This function:
 * 1. Parses withdrawal parameters from the withdrawal signature API response
 * 2. Initializes the Solana program connection
 * 3. Executes the withdrawal transaction
 * 
 * @param signer - The Keypair used to sign and execute the withdrawal transaction
 * @returns The executed transaction result
 * 
 * @example
 * ```typescript
 * const signer = Keypair.fromSecretKey(secretKey);
 * const result = await main({ signer });
 * ```
 */
const main = async ({ signer }: { signer: any }) => {
  // TODO: Replace the below response with the actual response from /withdrawal-signature API
  // Expected response structure:
  // - expiresAt: ISO timestamp string indicating when the withdrawal signature expires
  // - parameters: Array containing withdrawal parameters:
  //   [0] collateralProxy: Public key of the collateral proxy account
  //   [1] assetAddress: Public key of the SPL token mint address
  //   [2] amountInCents: Withdrawal amount in cents (as string)
  //   [3] recipient: Public key of the withdrawal recipient
  //   [4] timestamp: Unix timestamp (number)
  //   [5] executorPublisherSalt: Base64 encoded salt for executor publisher signature
  //   [6] executorPublisherSig: Base64 encoded executor publisher signature
  const response = {
    expiresAt: "2025-11-13T20:39:31.000Z",
    parameters: [
        "3eZDvw9tgCEPqprPWH5PCM47dQ1yvVTECQkzdqnCZv16",
        "CcuoBwMZJgupcdx81m3vYqBongw2PhhZ4yiYA2jo3K5",
        "1000000",
        "4iu37ZckR6MvJhYF7jbAcva3e6io29ABP1b3F7FpBbcT",
        1763066371,
        [
            233,
            173,
            254,
            8,
            92,
            182,
            238,
            44,
            197,
            203,
            46,
            217,
            52,
            2,
            101,
            34,
            53,
            98,
            96,
            114,
            235,
            77,
            203,
            151,
            182,
            120,
            234,
            66,
            7,
            21,
            52,
            21
        ],
        "PXJVrYqp6PxC/L0YC/0DDI6X4axX2nQpjx/abbGvkQy150kFcMFq5pNQF551/YjJn8TP4KM9NTOGvx5MkTPlDg=="
    ]
  }
  
  // Extract and parse withdrawal parameters from the API response
  const collateralProxy = response.parameters[0];  // Collateral proxy account address
  const assetAddress = response.parameters[1];     // SPL token mint address
  const amountInCents = Number(response.parameters[2]);  // Withdrawal amount in cents
  const recipient = response.parameters[3];        // Recipient account address
  const expiresAt = new Date(response.expiresAt).getTime();  // Convert expiration to timestamp
  const executorPublisherSalt = Buffer.from(response.parameters[5] as string, "base64");  // Decode salt
  const executorPublisherSig = Buffer.from(response.parameters[6] as string, "base64");   // Decode signature

  // TODO: Replace the below contract with the actual contract from the /withdrawable-balances API
  // Expected contract structure:
  // - programAddress: Public key of the deployed Rain program
  // - depositAddress: Public key of the deposit account
  const contract = {
    programAddress: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    depositAddress: "3eZDvw9tgCEPqprPWH5PCM47dQ1yvVTECQkzdqnCZv16",
  }
  
  // Initialize the Solana program connection using the contract's program address
  const program = getProgram(contract.programAddress, signer);

  // Execute the withdrawal transaction
  // This function handles:
  // - Creating the withdrawal instruction
  // - Signing the transaction with the collateral signature
  // - Submitting the transaction to the Solana network
  const transaction = await executeWithdrawal(
    program,
    new PublicKey(collateralProxy),
    new PublicKey(contract.depositAddress),
    signer,
    new PublicKey(recipient),
    new PublicKey(assetAddress),
    expiresAt,
    amountInCents,
    executorPublisherSalt,
    executorPublisherSig
  )

  console.log("Transaction", transaction);
  return transaction;
};
