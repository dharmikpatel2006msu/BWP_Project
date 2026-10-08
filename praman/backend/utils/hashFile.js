const crypto = require('crypto');
const fs = require('fs');

/**
 * Calculates SHA-256 hash of a file using streams.
 * Avoids loading large files entirely into RAM.
 * @param {string} filePath - Absolute or relative path to file
 * @returns {Promise<string>} 64-character hexadecimal SHA-256 hash
 */
const calculateFileHash = (filePath) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found at path: ${filePath}`));
    }

    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => {
      hash.update(chunk);
    });

    stream.on('end', () => {
      const hexHash = hash.digest('hex');
      resolve(hexHash);
    });

    stream.on('error', (err) => {
      reject(err);
    });
  });
};

module.exports = { calculateFileHash };
