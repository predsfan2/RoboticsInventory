const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const TMP_FILE = path.join(DATA_DIR, 'data.json.tmp');
const BAK_FILE = path.join(DATA_DIR, 'data.json.bak');

// Mutex: single promise chain to serialise all writes
let writeChain = Promise.resolve();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readData() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    // Try backup
    if (fs.existsSync(BAK_FILE)) {
      try {
        const raw = fs.readFileSync(BAK_FILE, 'utf8');
        return JSON.parse(raw);
      } catch (_) {}
    }
    throw new Error('Failed to read data file: ' + err.message);
  }
}

function writeData(data) {
  // Queue the write so concurrent calls never corrupt the file
  writeChain = writeChain.then(() => _doWrite(data));
  return writeChain;
}

function _doWrite(data) {
  return new Promise((resolve, reject) => {
    ensureDataDir();
    try {
      const json = JSON.stringify(data, null, 2) + '\n';
      // Write to .tmp first
      fs.writeFileSync(TMP_FILE, json, 'utf8');
      // Back up current file
      if (fs.existsSync(DATA_FILE)) {
        fs.copyFileSync(DATA_FILE, BAK_FILE);
      }
      // Atomic rename
      fs.renameSync(TMP_FILE, DATA_FILE);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * updateKey(key, fn) – read -> mutate one key -> write atomically.
 * fn receives the current array/object for that key and should return the new value.
 */
async function updateKey(key, fn) {
  const data = readData();
  if (!data) throw new Error('No data loaded');
  const current = data[key] !== undefined ? data[key] : (Array.isArray(fn([])) ? [] : {});
  data[key] = await fn(current);
  await writeData(data);
  return data[key];
}

module.exports = { readData, writeData, updateKey, DATA_FILE, DATA_DIR };
