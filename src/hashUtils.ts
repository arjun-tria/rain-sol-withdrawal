import { PublicKey } from "@solana/web3.js";
import crypto from 'crypto-js';

export class HashUtils {
  /**
   * Hashes the given data using the Keccak-256 algorithm and returns the result as a hex string
   * @param data - The data to hash
   * @returns The hash of the data as a hex string
   */
  static keccak256Hex(data: string): string {
    const wordArray = crypto.enc.Hex.parse(data);
    const hash = crypto.SHA3(wordArray, { outputLength: 256 });
    return hash.toString();
  }

  /**
   * Hashes the given data using the SHA3 hashing algorithm and returns the result as a hex string
   * @param data - The data to hash
   * @returns The hash of the data as a hex string
   */
  static keccak256(data: string): string {
    // Hash the data using the SHA3 hashing algorithm
    const hash = crypto.SHA3(data, { outputLength: 256 });
    // Return the hash as a hex string
    return hash.toString();
  }

  /**
   * Encodes the given string using the Keccak-256 algorithm and returns the result as a hex string
   * @param value - The string to encode
   * @returns The encoded string as a hex string
   */
  static encodeString(value: string): string {
    return HashUtils.keccak256(value);
  }

  /**
   * Encodes the given address as a hex string
   * @param value - The address to encode
   * @returns The encoded address as a hex string
   */
  static encodeAddress(value: PublicKey): string {
    return value.toBuffer().toString('hex');
  }

  /**
   * Encodes the given unsigned integer as a hex string
   * @param value - The unsigned integer to encode
   * @returns The encoded unsigned integer as a hex string
   */
  static encodeUInt32(value: bigint | number): string {
    return value.toString(16).padStart(8, '0');
  }

  /**
   * Encodes the given unsigned integer as a hex string
   * @param value - The unsigned integer to encode
   * @returns The encoded unsigned integer as a hex string
   */
  static encodeUInt64(value: bigint): string {
    return value.toString(16).padStart(16, '0');
  }

  /**
   * Encodes the given bytes as a hex string
   * @param value - The bytes to encode
   * @returns The encoded bytes as a hex string
   */
  static encodeBytes(value: Uint8Array): string {
    return Array.from(value).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}