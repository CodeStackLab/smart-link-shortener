const QRCode = require('qrcode');

/**
 * Robust Standalone QR Code Data URL Generator (100% Offline & Local)
 */
async function generateQrDataUrl(text = '', size = 300) {
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      width: size,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
    return dataUrl;
  } catch (err) {
    console.error('QR Code Generation Error:', err);
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="%23fff"/><text x="20" y="50" fill="red">QR Error</text></svg>`;
  }
}

module.exports = { generateQrDataUrl };
