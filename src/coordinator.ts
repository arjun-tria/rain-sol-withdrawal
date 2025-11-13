import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

import { HashUtils } from "./hashUtils";

type WithdrawCollateral = {
    amountOfAsset: BN;
    signatureExpirationTime: BN;
    coordinatorSignatureSalt: number[];
}

export class Coordinator {
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
    private static WITHDRAW_TYPE_HASH = HashUtils.encodeString('Withdraw(address user,address collateral,address asset,uint256 amount,address recipient,uint256 nonce,uint256 expiresAt)');

    /**
     * Encodes the coordinator withdraw message
     * @param collateral - The collateral address
     * @param sender - The sender address of the withdrawal
     * @param receiver - The receiver address of the withdrawal
     * @param asset - The asset address to withdraw
     * @param withdrawRequest - The withdraw collateral instruction data
     * @param adminFundsNonce - The nonce for the admin funds
     * @returns The encoded withdraw message
     */
    static encodeWithdrawMessage(
        collateral: PublicKey,
        sender: PublicKey,
        receiver: PublicKey,
        asset: PublicKey,
        withdrawRequest: WithdrawCollateral,
        adminFundsNonce: number,
    ): string {
        const amount = BigInt(withdrawRequest.amountOfAsset.toString());
        const nonce = adminFundsNonce;
        const expiresAt = BigInt(withdrawRequest.signatureExpirationTime.toString());
        // Encode the structure
        const encodedStructure = [
            Coordinator.WITHDRAW_TYPE_HASH,
            HashUtils.encodeAddress(sender),
            HashUtils.encodeAddress(collateral),
            HashUtils.encodeAddress(asset),
            HashUtils.encodeUInt64(amount),
            HashUtils.encodeAddress(receiver),
            HashUtils.encodeUInt32(nonce),
            HashUtils.encodeUInt64(expiresAt),
        ].join('');

        // Hash and return the structure
        return HashUtils.keccak256Hex(encodedStructure);
    }

    /**
     * Gets the coordinator withdraw message
     * @param collateral - The collateral address
     * @param coordinator - The coordinator address
     * @param sender - The sender address of the withdrawal
     * @param receiver - The receiver address of the withdrawal
     * @param asset - The asset address to withdraw
     * @param withdrawRequest - The withdraw collateral instruction data
     * @param adminFundsNonce - The nonce for the admin funds
     * @returns The coordinator withdraw message
     */
    static getWithdrawMessage(
        collateral: PublicKey,
        coordinator: PublicKey,
        sender: PublicKey,
        receiver: PublicKey,
        asset: PublicKey,
        withdraw: WithdrawCollateral,
        adminFundsNonce: number,
    ): Buffer {
        const encodedData = [
            this.encode(),
            this.domainSeparatorEncode(
                'Coordinator',
                '2',
                900n,
                coordinator,
                new Uint8Array(withdraw.coordinatorSignatureSalt),
            ),
            Coordinator.encodeWithdrawMessage(collateral, sender, receiver, asset, withdraw, adminFundsNonce),
        ].join('');

        const encodedDataHash = HashUtils.keccak256Hex(encodedData);
        return Buffer.from(encodedDataHash, 'hex');
    }
}