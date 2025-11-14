#!/usr/bin/env node

/**
 * PII Encryption and Data Protection Utility
 * Encrypts sensitive data at rest and manages encryption keys
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PIIEncryption {
  constructor(keyFile = './config/encryption.key') {
    this.keyFile = keyFile;
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16;   // 128 bits
    this.tagLength = 16;  // 128 bits

    this.ensureKeyFile();
  }

  ensureKeyFile() {
    const keyDir = path.dirname(this.keyFile);

    if (!fs.existsSync(keyDir)) {
      fs.mkdirSync(keyDir, { recursive: true, mode: 0o700 });
    }

    if (!fs.existsSync(this.keyFile)) {
      console.log('🔑 Generating new encryption key...');
      const key = crypto.randomBytes(this.keyLength);
      fs.writeFileSync(this.keyFile, key, { mode: 0o600 });
      console.log(`✅ Encryption key generated: ${this.keyFile}`);
    }
  }

  getEncryptionKey() {
    const key = fs.readFileSync(this.keyFile);
    return key;
  }

  encrypt(text, additionalData = null) {
    if (!text) return text;

    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(this.ivLength);

    const cipher = crypto.createCipher(this.algorithm, key);
    cipher.setAAD(Buffer.from(additionalData || ''));

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      encrypted: true,
      data: encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      algorithm: this.algorithm,
      additionalData: additionalData
    };
  }

  decrypt(encryptedData) {
    if (!encryptedData || !encryptedData.encrypted) {
      return encryptedData;
    }

    try {
      const key = this.getEncryptionKey();
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');

      const decipher = crypto.createDecipher(encryptedData.algorithm, key);
      decipher.setAuthTag(tag);

      if (encryptedData.additionalData) {
        decipher.setAAD(Buffer.from(encryptedData.additionalData));
      }

      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('❌ Decryption failed:', error.message);
      throw new Error('Failed to decrypt sensitive data');
    }
  }

  encryptField(obj, fieldPath, additionalData = null) {
    const keys = fieldPath.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) return obj;
      current = current[keys[i]];
    }

    const lastKey = keys[keys.length - 1];
    if (current[lastKey]) {
      current[lastKey] = this.encrypt(current[lastKey], additionalData);
    }

    return obj;
  }

  decryptField(obj, fieldPath) {
    const keys = fieldPath.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) return obj;
      current = current[keys[i]];
    }

    const lastKey = keys[keys.length - 1];
    if (current[lastKey] && current[lastKey].encrypted) {
      current[lastKey] = this.decrypt(current[lastKey]);
    }

    return obj;
  }

  encryptMultipleFields(obj, fieldMappings) {
    fieldMappings.forEach(({ field, additionalData }) => {
      this.encryptField(obj, field, additionalData);
    });
    return obj;
  }

  decryptMultipleFields(obj, fieldPaths) {
    fieldPaths.forEach(fieldPath => {
      this.decryptField(obj, fieldPath);
    });
    return obj;
  }

  generateDataEncryptionKey() {
    return crypto.randomBytes(this.keyLength).toString('hex');
  }

  hashPII(data, salt = null) {
    const hash = crypto.createHash('sha256');
    if (salt) {
      hash.update(salt);
    }
    hash.update(data);
    return hash.digest('hex');
  }

  anonymizeEmail(email) {
    if (!email || !email.includes('@')) return email;

    const [localPart, domain] = email.split('@');
    const hashedLocal = this.hashPII(localPart).substring(0, 8);
    return `${hashedLocal}@${domain}`;
  }

  anonymizePhone(phone) {
    if (!phone || phone.length < 4) return phone;

    const visible = phone.slice(-4);
    const masked = '*'.repeat(phone.length - 4);
    return masked + visible;
  }

  anonymizeName(name) {
    if (!name || name.length < 2) return name;

    const firstLetter = name[0];
    const hashed = this.hashPII(name).substring(0, 6);
    return `${firstLetter}${hashed}`;
  }
}

// CLI interface for encryption operations
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const encryption = new PIIEncryption();

  try {
    switch (command) {
      case 'encrypt':
        const textToEncrypt = args[1];
        const additionalData = args[2];

        if (!textToEncrypt) {
          console.error('❌ Text to encrypt is required');
          process.exit(1);
        }

        const encrypted = encryption.encrypt(textToEncrypt, additionalData);
        console.log('🔒 Encrypted data:', JSON.stringify(encrypted, null, 2));
        break;

      case 'decrypt':
        const encryptedDataArg = args[1];

        if (!encryptedDataArg) {
          console.error('❌ Encrypted data is required');
          process.exit(1);
        }

        try {
          const encryptedData = JSON.parse(encryptedDataArg);
          const decrypted = encryption.decrypt(encryptedData);
          console.log('🔓 Decrypted data:', decrypted);
        } catch (parseError) {
          console.error('❌ Invalid encrypted data format');
          process.exit(1);
        }
        break;

      case 'hash':
        const dataToHash = args[1];
        const saltArg = args[2];

        if (!dataToHash) {
          console.error('❌ Data to hash is required');
          process.exit(1);
        }

        const hashed = encryption.hashPII(dataToHash, saltArg);
        console.log('🔐 Hashed data:', hashed);
        break;

      case 'anonymize-email':
        const email = args[1];
        if (!email) {
          console.error('❌ Email is required');
          process.exit(1);
        }
        console.log('👤 Anonymized email:', encryption.anonymizeEmail(email));
        break;

      case 'anonymize-phone':
        const phone = args[1];
        if (!phone) {
          console.error('❌ Phone number is required');
          process.exit(1);
        }
        console.log('📞 Anonymized phone:', encryption.anonymizePhone(phone));
        break;

      case 'anonymize-name':
        const name = args[1];
        if (!name) {
          console.error('❌ Name is required');
          process.exit(1);
        }
        console.log('👤 Anonymized name:', encryption.anonymizeName(name));
        break;

      case 'rotate-key':
        const backupFile = `${encryption.keyFile}.backup.${Date.now()}`;

        if (fs.existsSync(encryption.keyFile)) {
          fs.copyFileSync(encryption.keyFile, backupFile);
          console.log(`💾 Key backed up to: ${backupFile}`);
        }

        const newKey = crypto.randomBytes(encryption.keyLength);
        fs.writeFileSync(encryption.keyFile, newKey, { mode: 0o600 });
        console.log('🔑 Encryption key rotated successfully');

        console.log('⚠️  IMPORTANT: You must re-encrypt all existing data with the new key!');
        console.log('📄 Backup of old key saved for migration purposes');
        break;

      case 'verify-key':
        try {
          const key = encryption.getEncryptionKey();
          console.log('✅ Encryption key is valid');
          console.log(`🔑 Key length: ${key.length} bytes`);
          console.log(`📍 Key file: ${encryption.keyFile}`);
        } catch (error) {
          console.error('❌ Invalid or missing encryption key');
          process.exit(1);
        }
        break;

      case 'generate-key':
        const customKeyFile = args[1] || './config/custom-encryption.key';
        const customDir = path.dirname(customKeyFile);

        if (!fs.existsSync(customDir)) {
          fs.mkdirSync(customDir, { recursive: true, mode: 0o700 });
        }

        const customKey = crypto.randomBytes(encryption.keyLength);
        fs.writeFileSync(customKeyFile, customKey, { mode: 0o600 });
        console.log(`🔑 Custom encryption key generated: ${customKeyFile}`);
        console.log('⚠️  Set ENCRYPTION_KEY_FILE environment variable to use this key');
        break;

      default:
        console.log(`
Usage: node encrypt-pii.js <command> [options]

Commands:
  encrypt <text> [additionalData]  - Encrypt text with optional additional data
  decrypt <encryptedData>           - Decrypt encrypted data
  hash <data> [salt]               - Hash PII data
  anonymize-email <email>          - Anonymize email address
  anonymize-phone <phone>          - Anonymize phone number
  anonymize-name <name>             - Anonymize name
  rotate-key                       - Rotate encryption key
  verify-key                       - Verify encryption key is valid
  generate-key [filename]          - Generate new encryption key

Examples:
  node encrypt-pii.js encrypt "sensitive data"
  node encrypt-pii.js hash "user@example.com"
  node encrypt-pii.js anonymize-email "john.doe@example.com"
  node encrypt-pii.js rotate-key
        `);
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  }
}

// Export for programmatic use
module.exports = PIIEncryption;

// Run CLI if called directly
if (require.main === module) {
  main();
}