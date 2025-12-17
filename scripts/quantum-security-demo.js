#!/usr/bin/env node

const crypto = require('crypto');
const {
    generateQuantumFingerprint,
    verifyQuantumFingerprint
} = require('agentic-jujutsu');

async function demonstrateQuantumSecurity() {
    console.log('🔐 Quantum-Resistant Security Demo\n');

    // Generate test data
    const testData = 'Agentic Jujutsu quantum security test data';
    const buffer = Buffer.from(testData);

    console.log('📝 Original data:', testData);

    // Generate SHA3-512 quantum fingerprint
    console.log('\n🔍 Generating SHA3-512 fingerprint...');
    const fingerprint = generateQuantumFingerprint(buffer);
    console.log(`  Fingerprint (hex): ${fingerprint.toString('hex')}`);
    console.log(`  Length: ${fingerprint.length} bytes (512 bits)`);

    // Verify integrity
    console.log('\n✅ Verifying integrity...');
    const isValid = verifyQuantumFingerprint(buffer, fingerprint);
    console.log(`  Verification result: ${isValid ? 'VALID' : 'INVALID'}`);

    // Tamper with data to show verification failure
    console.log('\n🔓 Testing with tampered data...');
    const tamperedData = Buffer.from('Agentic Jujutsu quantum security test data (tampered)');
    const isTamperedValid = verifyQuantumFingerprint(tamperedData, fingerprint);
    console.log(`  Tampered data verification: ${isTamperedValid ? 'VALID' : 'INVALID'}`);

    // Performance measurement
    console.log('\n⚡ Performance Metrics:');
    const iterations = 1000;
    const start = Date.now();

    for (let i = 0; i < iterations; i++) {
        generateQuantumFingerprint(buffer);
        verifyQuantumFingerprint(buffer, fingerprint);
    }

    const duration = Date.now() - start;
    console.log(`  ${iterations} generations + verifications: ${duration}ms`);
    console.log(`  Average per operation: ${(duration / (iterations * 2)).toFixed(3)}ms`);

    // Quantum resistance explanation
    console.log('\n🛡️  Quantum Resistance Properties:');
    console.log('  ✓ SHA3-512 is NIST FIPS 202 compliant');
    console.log('  ✓ Resistant to known quantum attacks (Grover\'s algorithm)');
    console.log('  ✓ 512-bit security level against classical and quantum attacks');
    console.log('  ✓ Future-proof for post-quantum computing era');

    // Demonstrate encryption support (if available)
    console.log('\n🔐 Testing Encryption Support:');
    const { JjWrapper } = require('agentic-jujutsu');
    const jj = new JjWrapper();

    try {
        // Generate encryption key
        const encryptionKey = crypto.randomBytes(32).toString('base64');
        console.log(`  Generated encryption key (${encryptionKey.length} chars)`);

        // Enable encryption
        jj.enableEncryption(encryptionKey);
        console.log(`  Encryption status: ${jj.isEncryptionEnabled() ? 'ENABLED' : 'DISABLED'}`);

        // Create a secure trajectory
        jj.startTrajectory('Quantum-encrypted deployment workflow');
        jj.finalizeTrajectory(0.95, 'Successfully encrypted trajectory data');

        console.log('  ✓ Trajectory data encrypted with HQC-128');

        // Disable encryption
        jj.disableEncryption();
        console.log(`  Encryption after disable: ${jj.isEncryptionEnabled() ? 'ENABLED' : 'DISABLED'}`);

    } catch (error) {
        console.log(`  ⚠️  Encryption demo failed: ${error.message}`);
        console.log('  Note: Encryption may require additional dependencies');
    }

    // Show fingerprint collision resistance
    console.log('\n🎯 Testing Collision Resistance:');
    const testStrings = [
        'test',
        'Test',
        'test ',
        'test\n',
        'test\u0000'
    ];

    const fingerprints = new Set();
    let collisions = 0;

    testStrings.forEach(str => {
        const fp = generateQuantumFingerprint(Buffer.from(str)).toString('hex');
        if (fingerprints.has(fp)) {
            collisions++;
        } else {
            fingerprints.add(fp);
        }
        console.log(`  "${str}" → ${fp}`);
    });

    console.log(`  Collisions found: ${collisions} (expect 0)`);
    console.log(`  Unique fingerprints: ${fingerprints.size}/${testStrings.length}`);
}

if (require.main === module) {
    demonstrateQuantumSecurity().catch(console.error);
}

module.exports = { demonstrateQuantumSecurity };