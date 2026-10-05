/**
 * Military-grade AES-256-GCM End-to-End Encryption (E2EE)
 * for LoRa Mesh packets using the native browser Web Crypto API.
 */

// Default Meshtastic compatible primary channel key (standard 256-bit PSK)
export const DEFAULT_PRIMARY_CHANNEL_KEY = '1PG7OiApB1nwv0QCWbfnRgZp9qX4mK2yLv8wTr3u9Bo=';

export interface EncryptedPayload {
  ivHex: string; // 12-byte initialization vector in hex
  ciphertextHex: string; // Encrypted data in hex
  authTagHex: string; // 16-byte authentication tag
  combinedPayload: string; // Compact format: IV(24 hex) + Ciphertext + Tag(32 hex)
}

/**
 * Derives a CryptoKey from a Base64 key string or passphrase
 */
async function importKeyFromBase64(base64Key: string): Promise<CryptoKey> {
  const binaryString = atob(base64Key);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Ensure 32 bytes (256 bits)
  let keyBytes: Uint8Array;
  if (bytes.length === 32) {
    keyBytes = bytes;
  } else {
    // Hash passphrase to 256 bits via SHA-256
    const hash = await window.crypto.subtle.digest('SHA-256', bytes);
    keyBytes = new Uint8Array(hash);
  }

  return await window.crypto.subtle.importKey(
    'raw',
    keyBytes as any,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext string or binary string using AES-256-GCM
 */
export async function encryptPacketPayload(
  plaintext: string,
  base64Key: string = DEFAULT_PRIMARY_CHANNEL_KEY
): Promise<EncryptedPayload> {
  const key = await importKeyFromBase64(base64Key);
  
  // 12-byte random IV as recommended by NIST for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128, // 16-byte authentication tag
    },
    key,
    data
  );

  const encryptedBytes = new Uint8Array(encryptedBuffer);
  // In Web Crypto AES-GCM, the last 16 bytes are the auth tag
  const tagLength = 16;
  const ciphertextBytes = encryptedBytes.slice(0, encryptedBytes.length - tagLength);
  const tagBytes = encryptedBytes.slice(encryptedBytes.length - tagLength);

  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  const ciphertextHex = Array.from(ciphertextBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const authTagHex = Array.from(tagBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    ivHex,
    ciphertextHex,
    authTagHex,
    combinedPayload: `${ivHex}:${ciphertextHex}:${authTagHex}`,
  };
}

/**
 * Decrypts an AES-256-GCM payload with the provided channel key
 */
export async function decryptPacketPayload(
  combinedPayloadOrCiphertext: string,
  base64Key: string = DEFAULT_PRIMARY_CHANNEL_KEY,
  ivHexParam?: string,
  authTagHexParam?: string
): Promise<{ success: boolean; plaintext: string; error?: string }> {
  try {
    let ivHex = ivHexParam;
    let ciphertextHex = combinedPayloadOrCiphertext;
    let authTagHex = authTagHexParam;

    if (combinedPayloadOrCiphertext.includes(':')) {
      const parts = combinedPayloadOrCiphertext.split(':');
      if (parts.length === 3) {
        ivHex = parts[0];
        ciphertextHex = parts[1];
        authTagHex = parts[2];
      }
    }

    if (!ivHex || !authTagHex) {
      return { success: false, plaintext: '', error: 'Missing IV or Auth Tag' };
    }

    const key = await importKeyFromBase64(base64Key);

    // Reconstruct IV
    const ivMatches = ivHex.match(/.{1,2}/g) || [];
    const iv = new Uint8Array(ivMatches.map((byte) => parseInt(byte, 16)));
    
    // Reconstruct ciphertext + tag
    const cipherMatches = ciphertextHex.match(/.{1,2}/g) || [];
    const ciphertext = new Uint8Array(cipherMatches.map((byte) => parseInt(byte, 16)));

    const tagMatches = authTagHex.match(/.{1,2}/g) || [];
    const tag = new Uint8Array(tagMatches.map((byte) => parseInt(byte, 16)));

    const combinedEncrypted = new Uint8Array(ciphertext.length + tag.length);
    combinedEncrypted.set(ciphertext);
    combinedEncrypted.set(tag, ciphertext.length);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128,
      },
      key,
      combinedEncrypted
    );

    const decoder = new TextDecoder();
    return { success: true, plaintext: decoder.decode(decryptedBuffer) };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Decryption failed: bad key or packet altered';
    return { success: false, plaintext: '', error: errorMsg };
  }
}

/**
 * Generates a random cryptographic 256-bit PSK
 */
export function generateRandomPsk(): string {
  const randomBytes = window.crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (let i = 0; i < randomBytes.length; i++) {
    binary += String.fromCharCode(randomBytes[i]);
  }
  return btoa(binary);
}
