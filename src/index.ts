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

// Load environment variables
dotenv.config();

type FetchV2SignatureOpts = {
  userId: string;
  token: string;
  amount: string;
  adminAddress: string;
  recipientAddress: string;
  chainId: string;
  signer: any;
};

function getProgram(programAddress: string, signer: Keypair): Program<Main> {
  const rpcUrl = process.env.SOLANA_RPC_URL
  if (!rpcUrl) {
    throw new Error("No RPC URL provided");
  }

  const connection = new Connection(rpcUrl, { commitment: 'confirmed' })

  // Load the program's Interface Description Language (IDL) which defines 
  // the program's account structures and instruction interfaces
  const idl: any = Object.assign(MainIdl, { address: programAddress })

  // Create an AnchorProvider instance to interact with the Solana network 
  // using the specified RPC endpoint and signer
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

const main = async ({
  userId,
  token,
  amount,
  adminAddress,
  recipientAddress,
  chainId,
  signer,
}: FetchV2SignatureOpts) => {
  // replace the below response with the actual response from /withdrawal-signature api below
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
  const collateralProxy = response.parameters[0];
  const assetAddress = response.parameters[1];
  const amountInCents = Number(response.parameters[2]);
  const recipient = response.parameters[3];
  const expiresAt = new Date(response.expiresAt).getTime();
  const executorPublisherSalt = Buffer.from(response.parameters[5] as string, "base64");
  const executorPublisherSig = Buffer.from(response.parameters[6] as string, "base64");

  // replace the below contract with the actual contract from the /withdrawable-balances api below
  const contract = {
    programAddress: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    depositAddress: "3eZDvw9tgCEPqprPWH5PCM47dQ1yvVTECQkzdqnCZv16",
  }
  // Load needed accounts
  const program = getProgram(contract.programAddress, signer);

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
