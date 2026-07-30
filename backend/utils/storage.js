'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const TMP_FILE = path.join(DATA_DIR, 'data.json.tmp');
const BAK_FILE = path.join(DATA_DIR, 'data.json.bak');

// Mutex: single promise chain to serialise all read-modify-write cycles
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
    if (fs.existsSync(BAK_FILE)) {
      try {
        const raw = fs.readFileSync(BAK_FILE, 'utf8');
        return JSON.parse(raw);
      } catch (_) {}
    }
    throw new Error('Failed to read data file: ' + err.message);
  }
}

function _doWrite(data) {
  return new Promise((resolve, reject) => {
    ensureDataDir();
    try {
      const json = JSON.stringify(data, null, 2) + '\n';
      fs.writeFileSync(TMP_FILE, json, 'utf8');
      if (fs.existsSync(DATA_FILE)) {
        fs.copyFileSync(DATA_FILE, BAK_FILE);
      }
      fs.renameSync(TMP_FILE, DATA_FILE);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

/** Queue a full-file write. Always await this. */
function writeData(data) {
  writeChain = writeChain.then(() => _doWrite(data));
  return writeChain;
}

/**
 * Serialised read-modify-write of the whole DB.
 * fn receives the data object, mutates it, and may return a response value.
 */
function withData(fn) {
  let result;
  writeChain = writeChain.then(async () => {
    const data = readData();
    if (!data) throw new Error('No data loaded');
    result = await fn(data);
    await _doWrite(data);
    return result;
  });
  return writeChain.then(() => result);
}

/**
 * updateKey(key, fn) – read -> mutate one key -> write atomically.
 */
async function updateKey(key, fn) {
  return withData(async (data) => {
    const current = data[key] !== undefined ? data[key] : [];
    data[key] = await fn(current);
    return data[key];
  });
}

module.exports = { readData, writeData, withData, updateKey, DATA_FILE, DATA_DIR };
