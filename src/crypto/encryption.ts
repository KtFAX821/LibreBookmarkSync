// SPDX-License-Identifier: Apache-2.0

export interface EncryptedTextDocument {
  schemaVersion: 1;
  app: 'LibreBookmarkSync';
  updatedAt: number;
  encrypted: true;
  encryption: {
    algorithm: 'AES-GCM';
    kdf: 'PBKDF2-SHA-256';
    iterations: number;
    salt: string;
    iv: string;
  };
  payload: string;
}

const ITERATIONS = 210000;

export async function encryptText(plaintext: string, password: string): Promise<EncryptedTextDocument> {
  if (!password) {
    throw new Error('Encryption password is required');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  return {
    schemaVersion: 1,
    app: 'LibreBookmarkSync',
    updatedAt: Date.now(),
    encrypted: true,
    encryption: {
      algorithm: 'AES-GCM',
      kdf: 'PBKDF2-SHA-256',
      iterations: ITERATIONS,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
    },
    payload: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptText(document: EncryptedTextDocument, password: string) {
  if (!password) {
    throw new Error('Encryption password is required');
  }

  const salt = base64ToBytes(document.encryption.salt);
  const iv = base64ToBytes(document.encryption.iv);
  const encrypted = base64ToBytes(document.payload);
  const key = await deriveAesKey(password, salt, document.encryption.iterations);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted,
  );

  return new TextDecoder().decode(decrypted);
}

export function isEncryptedTextDocument(value: unknown): value is EncryptedTextDocument {
  const document = value as Partial<EncryptedTextDocument>;
  return document?.app === 'LibreBookmarkSync'
    && document.schemaVersion === 1
    && document.encrypted === true
    && typeof document.updatedAt === 'number'
    && typeof document.payload === 'string'
    && document.payload.length > 0
    && document.encryption?.algorithm === 'AES-GCM'
    && document.encryption.kdf === 'PBKDF2-SHA-256'
    && Number.isFinite(document.encryption.iterations)
    && document.encryption.iterations > 0
    && typeof document.encryption.salt === 'string'
    && document.encryption.salt.length > 0
    && typeof document.encryption.iv === 'string'
    && document.encryption.iv.length > 0;
}

async function deriveAesKey(password: string, salt: Uint8Array, iterations = ITERATIONS) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
