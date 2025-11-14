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
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { mnemonicToSeedSync } from "@scure/bip39";
import { derivePath } from "ed25519-hd-key";

// Load environment variables from .env file
dotenv.config();

/**
 * Creates a Solana Keypair from either a base58-encoded secret key or a mnemonic phrase.
 * 
 * @param input - Either a base58-encoded secret key string or a mnemonic phrase
 * @returns A Solana Keypair instance
 * 
 * @throws Error if the input format is invalid or cannot be decoded
 */
function createKeypairFromInput(input: string): Keypair {
  let keypair: Keypair;
  
  // Check if input contains spaces (indicating it's a mnemonic phrase)
  if (input.includes(" ")) {
    // Handle mnemonic phrase: use BIP39 to convert mnemonic to seed, then derive using BIP-44
    // Solana uses derivation path: m/44'/501'/0'/0'
    try {
      // Convert mnemonic phrase to seed using BIP39 PBKDF2
      const seed = mnemonicToSeedSync(input);
      
      // Convert seed Uint8Array to hex string for derivation
      const seedHex = Buffer.from(seed).toString("hex");
      
      // Derive the keypair using Solana's BIP-44 derivation path: m/44'/501'/0'/0'
      // 44' = BIP-44 standard
      // 501' = Solana's coin type
      // 0' = account index
      // 0' = change index (0 for external addresses)
      const derivedSeed = derivePath("m/44'/501'/0'/0'", seedHex).key;
      
      // Generate keypair from the derived 32-byte seed
      keypair = Keypair.fromSeed(derivedSeed);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to derive keypair from mnemonic: ${error.message}`);
      }
      throw error;
    }
  } else {
    // Handle base58-encoded secret key
    try {
      const decoded = bs58.decode(input);
      // Solana secret keys can be either:
      // - 64 bytes: full secret key (32 bytes secret + 32 bytes public key)
      // - 32 bytes: seed that can be used with Keypair.fromSeed()
      if (decoded.length === 64) {
        // Full 64-byte secret key
        keypair = Keypair.fromSecretKey(Uint8Array.from(decoded));
      } else if (decoded.length === 32) {
        // 32-byte seed
        keypair = Keypair.fromSeed(Uint8Array.from(decoded));
      } else {
        throw new Error(`Invalid secret key length: expected 32 or 64 bytes, got ${decoded.length}. If this is a mnemonic, ensure it contains spaces.`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Non-base58")) {
        throw new Error(`Invalid input format. Expected either:\n1. A base58-encoded 32-byte seed or 64-byte secret key\n2. A BIP39 mnemonic phrase (with spaces)\n\nReceived: ${input.substring(0, 20)}...`);
      }
      throw error;
    }
  }
  
  // Log the wallet address (public key)
  console.log("Wallet address:", keypair.publicKey.toBase58());
  // get secret key from keypair
  const secretKey = keypair.secretKey;
  // convert secret key to base58
  const secretKeyBase58 = bs58.encode(secretKey);
  console.log("Secret key base58:", secretKeyBase58);
  return keypair;
}

type MainParams = {
  signer: Keypair;
  parameters: any;
  programAddress: string;
  depositAddress: string;
}

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
const main = async ({
  signer,
  parameters,
  programAddress,
  depositAddress,
}: MainParams) => {
  // Extract and parse withdrawal parameters from the API response
  const collateralProxy = parameters[0];  // Collateral proxy account address
  const assetAddress = parameters[1];     // SPL token mint address
  const amountInCents = Number(parameters[2]);  // Withdrawal amount in cents
  const recipient = parameters[3];        // Recipient account address
  const expiresAt = Number(parameters[4]);  // Convert expiration to timestamp
  const executorPublisherSalt = Buffer.from(parameters[5] as string, "base64");  // Decode salt
  const executorPublisherSig = Buffer.from(parameters[6] as string, "base64");   // Decode signature

  // Initialize the Solana program connection using the contract's program address
  const program = getProgram(programAddress, signer);

  // Execute the withdrawal transaction
  // This function handles:
  // - Creating the withdrawal instruction
  // - Signing the transaction with the collateral signature
  // - Submitting the transaction to the Solana network
  const transaction = await executeWithdrawal(
    program,
    new PublicKey(collateralProxy),
    new PublicKey(depositAddress),
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

const mnemonicOrSecretKey = process.env.MNEMONIC;
if (!mnemonicOrSecretKey) {
  throw new Error("No MNEMONIC provided");
}
// Generate solana signer from mnemonic phrase or base58-encoded secret key
const signer = createKeypairFromInput(mnemonicOrSecretKey);

// add the parameters array from the withdrawal/signature API response
const parameters = [
  "3eZDvw9tgCEPqprPWH5PCM47dQ1yvVTECQkzdqnCZv16",
  "CcuoBwMZJgupcdx81m3vYqBongw2PhhZ4yiYA2jo3K5",
  "1000000",
  "4iu37ZckR6MvJhYF7jbAcva3e6io29ABP1b3F7FpBbcT",
  1763139648,
  [
      217,
      57,
      13,
      173,
      112,
      120,
      168,
      106,
      255,
      107,
      186,
      199,
      78,
      226,
      55,
      168,
      111,
      92,
      97,
      68,
      145,
      22,
      78,
      235,
      186,
      34,
      173,
      108,
      214,
      241,
      183,
      78
  ],
  "ogpY+Z61B3abr2PKqagyPvC9K1qUQDh0sAu/ZWiaqa1jqcBkFevIGlqCcCLPQ8MakVkrmANeKCcFbEVRd41/Cg=="
]

// add the program address and deposit address from the withdrawal/balances API response
const programAddress = "9xRSrfcnoucYYrWuoyZKLVPXrysdFQZhhAsAnejrzv9V";
const depositAddress = "93hth1t2454nChiFUqWogkyqpPAXYh5tqHfPFTFBDVSA";

const params: MainParams = {
  signer,
  parameters,
  programAddress,
  depositAddress,
}

main(params);
