import { BN, Program } from "@coral-xyz/anchor";
import {
    Keypair,
    PublicKey,
    Transaction,
    sendAndConfirmTransaction
} from "@solana/web3.js";
import {
    getOrCreateAssociatedTokenAccount,
    getAssociatedTokenAddress,
    TOKEN_PROGRAM_ID,
    Account
} from "@solana/spl-token";
import { randomBytes } from "crypto";
import nacl from "tweetnacl";

import { Main } from "./types/main";
import { Collateral } from "./collateral";
import { Ed25519ExtendedProgram } from "./utils/ed25519.program";
import { Coordinator } from "./coordinator";

type WithdrawCollateral = {
    amountOfAsset: BN;
    signatureExpirationTime: BN;
    coordinatorSignatureSalt: number[];
}

async function submitCollateralSignature(
    sender: Keypair,
    recipientAddress: PublicKey,
    mintAddress: PublicKey,
    withdrawRequest: WithdrawCollateral,
    adminFundsNonce: number,
    program: Program<Main>,
    collateralAddress: PublicKey
) {
    // Generate the collateral admin signature
    const collateralMessageSalt: number[] = Array.from(randomBytes(32)).map(Number)
    const collateralMessage = Collateral.getWithdrawMessage(
        collateralAddress,
        sender.publicKey,
        recipientAddress,
        mintAddress,
        withdrawRequest,
        collateralMessageSalt,
        adminFundsNonce
    )

    const collateralSignature = nacl.sign.detached(Uint8Array.from(collateralMessage), sender.secretKey)

    const collateralSignatureAddress = Collateral.generateWithdrawCollateralPDA(
        collateralAddress,
        sender.publicKey,
        recipientAddress,
        mintAddress,
        withdrawRequest,
        adminFundsNonce,
        program.programId
    );

    const collateralSignatureAccount = await program.account.collateralAdminSignatures.fetchNullable(collateralSignatureAddress);
    if (!collateralSignatureAccount || collateralSignatureAccount.signers.every(signer => !signer.equals(sender.publicKey))) {
        // Create the instruction to submit the admin signature to the signatures account 
        const signatureVereficationInstruction = Ed25519ExtendedProgram.createSignatureVerificationInstruction([{
            signer: sender.publicKey,
            signature: Buffer.from(collateralSignature),
            message: collateralMessage,
        }]);

        // Submit the admin signature to the signatures account 
        const transaction = await program.methods.submitSignatures({
            salts: [collateralMessageSalt],
            targetNonce: adminFundsNonce,
            signatureSubmissionType: {
                withdrawCollateralAsset: {
                    sender: sender.publicKey,
                    receiver: recipientAddress,
                    asset: mintAddress,
                    withdrawRequest,
                }
            },
        }).accounts({
            collateral: collateralAddress,
            collateralAdminSignatures: collateralSignatureAddress,
            rentPayer: sender.publicKey,
        }).preInstructions([
            signatureVereficationInstruction
        ]).transaction();

        // Send and confirm the transaction
        const submitSignaturesHash = await sendAndConfirmTransaction(
            program.provider.connection,
            transaction,
            [sender],
            { commitment: 'confirmed' }
        );

        console.log("Collateral admin signature submitted");
        console.log(submitSignaturesHash);
    }
    return collateralSignatureAddress;
}

export async function executeWithdrawal(
    program: Program<Main>,
    collateral: PublicKey,
    depositAddress: PublicKey,
    sender: Keypair,
    recipientAddress: PublicKey,
    mintAddress: PublicKey,
    expiration: number,
    amountInCents: number,
    signatureSalt: Buffer,
    signatureData: Buffer
) {
    // Load withdraw parameters from the given signature
    const coordinatorMessageSalt: number[] = Array.from(signatureSalt).map(Number)
    const coordinatorSignature: number[] = Array.from(signatureData).map(Number)
    const expiresAt = new BN(expiration)
    const amountOfAsset = new BN(amountInCents)

    // The withdraw request is the same for both coordinator and collateral admin
    const withdrawRequest: WithdrawCollateral = {
        amountOfAsset,
        signatureExpirationTime: expiresAt,
        coordinatorSignatureSalt: coordinatorMessageSalt,
    };

    const collateralAccount = await program.account.collateral.fetch(collateral)

    // Get the source token account for the collateral to withdraw from
    const collateralTokenAccount = await getAssociatedTokenAddress(mintAddress, depositAddress, true);
    console.log("Source token account", collateralTokenAccount.toBase58())

    // Get or create the associated token account for the recipient to receive 
    // the withdrawn tokens
    const destinationTokenAccount = await getOrCreateAssociatedTokenAccount(
        program.provider.connection,
        sender,
        mintAddress,
        recipientAddress,
        false,
        'confirmed',
        { commitment: 'confirmed' },
        TOKEN_PROGRAM_ID
    );
    console.log("Destination token account", destinationTokenAccount.address.toBase58())

    // Submit the collateral admin signature to the blockchain for withdrawal verification
    const collateralSignatureAddress = await submitCollateralSignature(
        sender,
        recipientAddress,
        mintAddress,
        withdrawRequest,
        collateralAccount.adminFundsNonce,
        program,
        collateral
    );

    const coordinator = await program.account.coordinator.fetch(collateralAccount.coordinator)
    if (!coordinator.executors || coordinator.executors.length === 0) {
        throw new Error('Not executors found in the given coordinator')
    }

    const transaction = await sendAndConfirmTransaction(
        program.provider.connection,
        new Transaction().add(
            // Verify the coordinator signature instruction
            Ed25519ExtendedProgram.createSignatureVerificationInstruction([
                {
                    signer: coordinator.executors.find(c => c)!,
                    signature: Buffer.from(coordinatorSignature),
                    message: Coordinator.getWithdrawMessage(
                        collateral,
                        collateralAccount.coordinator,
                        sender.publicKey,
                        recipientAddress,
                        mintAddress,
                        withdrawRequest,
                        collateralAccount.adminFundsNonce,

                    )
                }
            ]),
            // Withdraw the collateral asset instruction
            await program.methods.withdrawCollateralAsset(withdrawRequest)
                .accounts({
                    sender: sender.publicKey,
                    receiver: recipientAddress,
                    asset: mintAddress,
                    collateralTokenAccount: collateralTokenAccount,
                    receiverTokenAccount: destinationTokenAccount.address,
                    coordinator: collateralAccount.coordinator,
                    collateral: collateral,
                    collateralAdminSignatures: collateralSignatureAddress,
                })
                .instruction()
        ),
        [sender],
        { commitment: 'confirmed' }
    );

    console.log("Withdrawal successful")
    return transaction;
}