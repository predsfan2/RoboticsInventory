'use strict';

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { DATA_DIR } = require('./storage');

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const RECEIPT_MIMES = new Set([...IMAGE_MIMES, 'application/pdf']);
const INVOICE_MIMES = new Set([
  ...RECEIPT_MIMES,
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function ensureUploadsDir() {
  const dir = path.join(DATA_DIR, 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function sniffMime(buf) {
  if (!buf || buf.length < 4) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf.length >= 12 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    return 'image/webp';
  }
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'application/pdf';
  return null;
}

/**
 * Save a base64 upload safely.
 * @returns {{ url: string, filename: string, mimeType: string, size: number }}
 */
function saveBase64Upload({ base64, mimeType, prefix, allowedMimes, maxBytes }) {
  if (!base64) {
    const err = new Error('base64 required');
    err.status = 400;
    throw err;
  }

  const buf = Buffer.from(base64, 'base64');
  if (buf.length > maxBytes) {
    const err = new Error(`File exceeds ${Math.round(maxBytes / (1024 * 1024))} MB`);
    err.status = 400;
    throw err;
  }

  const sniffed = sniffMime(buf);
  const effectiveMime = sniffed || mimeType || '';
  if (!allowedMimes.has(effectiveMime)) {
    const err = new Error('File type not allowed');
    err.status = 400;
    throw err;
  }

  // Reject HTML/SVG disguised as images when sniff fails but client claimed image
  if (!sniffed && IMAGE_MIMES.has(mimeType)) {
    const err = new Error('Could not verify image file type');
    err.status = 400;
    throw err;
  }

  const ext = MIME_TO_EXT[effectiveMime] || 'bin';
  const filename = `${prefix}-${uuidv4()}.${ext}`;
  const dir = ensureUploadsDir();
  fs.writeFileSync(path.join(dir, filename), buf);

  return {
    url: '/uploads/' + filename,
    filename,
    mimeType: effectiveMime,
    size: buf.length,
  };
}

module.exports = {
  saveBase64Upload,
  IMAGE_MIMES,
  RECEIPT_MIMES,
  INVOICE_MIMES,
  ensureUploadsDir,
};
