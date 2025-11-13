import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

import { HashUtils } from "./hashUtils";

type WithdrawCollateral = {
    amountOfAsset: BN;
    signatureExpirationTime: BN;
    coordinatorSignatureSalt: number[];
}

export class Collateral {
    static encode(): string {
        return HashUtils.encodeBytes(new Uint8Array(Buffer.from('\x19\x01', 'latin1')));
    }
    private static DOMAIN_TYPE_HASH = HashUtils.encodeString('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)');

    static domainSeparatorEncode(
        name: string,
        version: string,
        chainId: bigint,
        verifyingContract: PublicKey,
        salt: Uint8Array,
    ): string {
        // Encode the domain separator message structure
        const encodedStructure = [
            this.DOMAIN_TYPE_HASH,
            HashUtils.encodeString(name),
            HashUtils.encodeString(version),
            HashUtils.encodeUInt64(chainId),
            HashUtils.encodeAddress(verifyingContract),
            HashUtils.encodeBytes(salt),
        ].join('');

        // Hash and return the domain separator message
        return HashUtils.keccak256Hex(encodedStructure);
    }

    private static COLLATERAL_ADMIN_SIGNATURE_SEED = Buffer.from('CollateralAdminSignatures', 'utf-8');
    private static WITHDRAW_TYPE_HASH = HashUtils.encodeString('Withdraw(address user,address asset,uint256 amount,address recipient,uint256 nonce)');

    /**
     * Derivate the account address using the collateral account ID and the Main program ID
     * @param collateral - The collateral account ID
     * @param id - The action message hash as ID
     * @param programId - The Main program ID
     * @returns - The account address
     */
    static generateAdminSignaturePDA(collateral: PublicKey, id: Buffer, programId: PublicKey): PublicKey {
        const [pda] = PublicKey.findProgramAddressSync(
            [
                Collateral.COLLATERAL_ADMIN_SIGNATURE_SEED,
                collateral.toBuffer(),
                id,
            ],
            programId,
        );
        return pda;
    }

    /**
     * Generate the PDA for the WithdrawCollateral action
     * @param collateral - The collateral account
     * @param sender - The sender of the withdrawal
     * @param receiver - The receiver of the withdrawal
     * @param asset - The asset to withdraw
     * @param request - The request to withdraw the collateral
     * @param adminFundsNonce - The nonce for the admin funds
     * @param programId - The Main program ID
     * @returns The PDA for the WithdrawCollateral action
     */
    static generateWithdrawCollateralPDA(
        collateral: PublicKey,
        sender: PublicKey,
        receiver: PublicKey,
        asset: PublicKey,
        request: WithdrawCollateral,
        adminFundsNonce: number,
        programId: PublicKey,
    ): PublicKey {
        const withdrawCollateralMessageEncoded = Collateral.encodeWithdrawMessage(
            collateral,
            sender,
            receiver,
            asset,
            request,
            adminFundsNonce
        );

        const id = Buffer.from(withdrawCollateralMessageEncoded, 'hex');
        return Collateral.generateAdminSignaturePDA(collateral, id, programId);
    }

    /**
     * Gets the withdraw messages
     * @param sender - The account of the tx sender
     * @param receiver - The account of the collateral funds receiver
     * @param asset - The asset to be withdrawn
     * @param withdraw - The withdraw collateral instruction data
     * @param salt - The salt for the collateral admins signatures
     * @returns - The withdraw message as buffer to be signed by the admins
     */
    static getWithdrawMessage(
        collateral: PublicKey,
        sender: PublicKey,
        receiver: PublicKey,
        asset: PublicKey,
        withdraw: WithdrawCollateral,
        salt: number[],
        adminFundsNonce: number,
    ): Buffer {
        const encodedData = [
            this.encode(),
            this.domainSeparatorEncode(
                'Collateral',
                '2',
                900n,
                collateral,
                new Uint8Array(salt),
            ),
            Collateral.encodeWithdrawMessage(collateral, sender, receiver, asset, withdraw, adminFundsNonce),
        ].join('');

        const encodedDataHash = HashUtils.keccak256Hex(encodedData);
        return Buffer.from(encodedDataHash, 'hex');
    }

    /**
     * Encodes the withdraw message
     * @param collateral - The collateral address
     * @param sender - The sender address of the withdrawal
     * @param receiver - The receiver address of the withdrawal
     * @param asset - The asset address to withdraw
     * @param withdraw - The withdraw collateral instruction data
     * @param adminFundsNonce - The nonce for the admin funds
     * @returns The encoded withdraw message
     */
    static encodeWithdrawMessage(
        collateral: PublicKey,
        sender: PublicKey,
        receiver: PublicKey,
        asset: PublicKey,
        withdraw: WithdrawCollateral,
        adminFundsNonce: number,
    ): string {
        const amount = BigInt(withdraw.amountOfAsset.toString());

        // Encode the structure
        const encodedStructure = [
            Collateral.WITHDRAW_TYPE_HASH,
            HashUtils.encodeAddress(sender),
            HashUtils.encodeAddress(collateral),
            HashUtils.encodeAddress(asset),
            HashUtils.encodeUInt64(amount),
            HashUtils.encodeAddress(receiver),
            HashUtils.encodeUInt32(adminFundsNonce),
        ].join('');
        // Hash and return the structure
        const hashedStructure = HashUtils.keccak256Hex(encodedStructure);
        return hashedStructure;
    }
}