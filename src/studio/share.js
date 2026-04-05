function bytesToBase64Url(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64url');
  }

  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64url'));
  }

  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function encodeDefinitionToHash(rawGame) {
  const text = JSON.stringify(rawGame);
  const bytes = new TextEncoder().encode(text);
  return `#definition=${bytesToBase64Url(bytes)}`;
}

export function decodeDefinitionFromHash(hash) {
  if (!hash || !hash.startsWith('#definition=')) {
    return null;
  }

  try {
    const encoded = hash.slice('#definition='.length);
    const bytes = base64UrlToBytes(encoded);
    const text = new TextDecoder().decode(bytes);
    return JSON.parse(text);
  } catch (error) {
    console.warn('Failed to decode shared definition', error);
    return null;
  }
}
