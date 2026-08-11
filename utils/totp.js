const crypto = require('crypto');
const QRCode = require('qrcode');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encodes a Buffer to a Base32 string.
 */
function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decodes a Base32 string to a Buffer.
 */
function base32Decode(base32Str) {
  const cleaned = base32Str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generates a random Base32 TOTP secret key (16 bytes = 26 base32 chars).
 */
function generateSecret() {
  const randomBytes = crypto.randomBytes(16);
  return base32Encode(randomBytes);
}

/**
 * Calculates 6-digit TOTP code for a given secret at a specific counter step.
 */
function generateTOTP(base32Secret, timeStep) {
  const key = base32Decode(base32Secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(timeStep), 0);

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(buffer);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = (binary % 1000000).toString().padStart(6, '0');
  return otp;
}

/**
 * Verifies a 6-digit TOTP code against a secret key within a given window (default ±1 step = ±30s).
 */
function verifyTOTP(token, base32Secret, window = 1) {
  if (!token || !base32Secret) return false;
  const cleanedToken = token.toString().trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanedToken)) return false;

  const currentStep = Math.floor(Date.now() / 1000 / 30);

  for (let i = -window; i <= window; i++) {
    const validOtp = generateTOTP(base32Secret, currentStep + i);
    if (validOtp === cleanedToken) {
      return true;
    }
  }

  return false;
}

/**
 * Generates OTP Auth URI (otpauth://totp/...) for scanning with Google Authenticator.
 */
function getOtpauthUrl(issuer, accountName, base32Secret) {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${base32Secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generates Data URL for QR Code image from otpauth URI.
 */
async function generateQRCodeDataUrl(otpauthUrl) {
  return await QRCode.toDataURL(otpauthUrl, {
    margin: 2,
    width: 200,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });
}

module.exports = {
  generateSecret,
  generateTOTP,
  verifyTOTP,
  getOtpauthUrl,
  generateQRCodeDataUrl
};
