const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const { connectDB, disconnectDB } = require('../backend/config/db');
const User = require('../backend/models/User');
const Evidence = require('../backend/models/Evidence');
const CustodyLog = require('../backend/models/CustodyLog');
const AuditLog = require('../backend/models/AuditLog');
const { calculateFileHash } = require('../backend/utils/hashFile');

const seedData = async () => {
  try {
    console.log('[PRAMAN Seed] Connecting to database...');
    await connectDB();

    console.log('[PRAMAN Seed] Clearing existing records...');
    await User.deleteMany({});
    await Evidence.deleteMany({});
    await CustodyLog.deleteMany({});
    await AuditLog.deleteMany({});

    console.log('[PRAMAN Seed] Creating demo users...');
    const admin = await User.create({
      name: 'Dr. Evelyn Reed (Chief Admin)',
      email: 'admin@praman.com',
      password: 'Admin@123',
      role: 'admin',
      isActive: true,
    });

    const investigator = await User.create({
      name: 'Inspector Vikram Patel',
      email: 'investigator@praman.com',
      password: 'Investigator@123',
      role: 'investigator',
      isActive: true,
    });

    const forensic = await User.create({
      name: 'Dr. Sarah Lin (Forensic Officer)',
      email: 'forensic@praman.com',
      password: 'Forensic@123',
      role: 'forensic',
      isActive: true,
    });

    const courtOfficer = await User.create({
      name: 'Hon. Justice Aditi Sharma (Court Officer)',
      email: 'court@praman.com',
      password: 'Court@123',
      role: 'court_officer',
      isActive: true,
    });

    console.log('[PRAMAN Seed] Users created:');
    console.log(' - Admin: admin@praman.com / Admin@123');
    console.log(' - Investigator: investigator@praman.com / Investigator@123');
    console.log(' - Forensic: forensic@praman.com / Forensic@123');
    console.log(' - Court Officer: court@praman.com / Court@123 [NEW]');

    // Create a real sample evidence file on disk
    const uploadDir = path.join(__dirname, '../backend/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const sampleFileName = 'financial-transfer-node4.txt';
    const sampleFilePath = path.join(uploadDir, `ev-seed-${sampleFileName}`);
    const sampleContent = `P.R.A.M.A.N DIGITAL FORENSIC EVIDENCE SAMPLE
Case File: CR-2026-9042
Subject: Financial Audit Log and Unauthorized Transaction Records
Seizure Location: Cyber Crime Division Server Node #4
Hash Generation Standard: FIPS 180-4 SHA-256
Integrity Status: Seized & Secured at Time of Ingestion
Timestamp: ${new Date().toISOString()}
============================================================
Record #1: 2026-09-14T08:12:00Z - Transfer INR 4,500,000 -> Account #9821034
Record #2: 2026-09-14T08:14:22Z - SysAdmin Override executed by uid: 1042
Record #3: 2026-09-14T08:19:40Z - Server Audit logs purge attempted
============================================================
Cryptographic verification required under IT Act Section 65B guidelines.`;

    fs.writeFileSync(sampleFilePath, sampleContent, 'utf-8');
    const realHash = await calculateFileHash(sampleFilePath);

    // Create sample Evidence document (submitted to court)
    const evidence1 = await Evidence.create({
      evidenceId: 'EV-2026-0001',
      caseNumber: 'CR-2026-9042',
      title: 'Financial Server Access Log & Ledger',
      description: 'Extracted transaction journal and unauthorized override activity logs from secure database node.',
      evidenceType: 'Document',
      originalFilename: sampleFileName,
      storedFilename: path.basename(sampleFilePath),
      filePath: sampleFilePath,
      mimeType: 'text/plain',
      fileSize: Buffer.byteLength(sampleContent),
      sha256Hash: realHash,
      uploadedBy: investigator._id,
      uploadedAt: new Date(Date.now() - 3600000 * 24),
      currentHolder: investigator._id,
      status: 'Verified',
      integrityStatus: 'Verified',
      lastVerifiedAt: new Date(Date.now() - 3600000 * 12),
      courtReviewStatus: 'Pending Court Review',
      courtAssignedTo: courtOfficer._id,
      notes: [
        {
          text: 'Initial forensic clone extracted without physical tampering.',
          addedBy: investigator._id,
          addedByName: investigator.name,
          noteType: 'investigator',
          addedAt: new Date(Date.now() - 3600000 * 24),
        },
        {
          text: 'Forensic integrity hash verified against server logs. Cleared for judicial submission.',
          addedBy: forensic._id,
          addedByName: forensic.name,
          noteType: 'forensic',
          addedAt: new Date(Date.now() - 3600000 * 12),
        },
      ],
    });

    // Evidence 2: Internal Investigation Only (NOT submitted to court)
    const sample2FileName = 'encrypted-usb-partition.bin';
    const sample2FilePath = path.join(uploadDir, `ev-seed-${sample2FileName}`);
    const sample2Content = `RAW PHYSICAL DISK DUMP - SUSPECT USB DRIVE SEIZED AT SCENE`;
    fs.writeFileSync(sample2FilePath, sample2Content, 'utf-8');
    const realHash2 = await calculateFileHash(sample2FilePath);

    const evidence2 = await Evidence.create({
      evidenceId: 'EV-2026-0002',
      caseNumber: 'CR-2026-9080',
      title: 'Encrypted Flash Drive Raw Dump',
      description: 'Raw block image of thumb drive seized during search warrant execution. Under decryption analysis.',
      evidenceType: 'Disk Image',
      originalFilename: sample2FileName,
      storedFilename: path.basename(sample2FilePath),
      filePath: sample2FilePath,
      mimeType: 'application/octet-stream',
      fileSize: Buffer.byteLength(sample2Content),
      sha256Hash: realHash2,
      uploadedBy: investigator._id,
      uploadedAt: new Date(Date.now() - 3600000 * 6),
      currentHolder: investigator._id,
      status: 'Under Review',
      integrityStatus: 'Not Checked',
      courtReviewStatus: 'None',
      notes: [
        {
          text: 'Bitstream image captured using hardware write-blocker.',
          addedBy: investigator._id,
          addedByName: investigator.name,
          noteType: 'investigator',
          addedAt: new Date(Date.now() - 3600000 * 6),
        },
      ],
    });

    // Create Custody Logs
    await CustodyLog.create([
      {
        evidence: evidence1._id,
        action: 'UPLOADED',
        fromUser: null,
        toUser: investigator._id,
        performedBy: investigator._id,
        remarks: `Initial evidence ingestion. Generated SHA-256: ${realHash}`,
        timestamp: new Date(Date.now() - 3600000 * 24),
      },
      {
        evidence: evidence1._id,
        action: 'TRANSFERRED',
        fromUser: investigator._id,
        toUser: forensic._id,
        performedBy: investigator._id,
        remarks: `Transferred to Forensic Lab for integrity certification.`,
        timestamp: new Date(Date.now() - 3600000 * 18),
      },
      {
        evidence: evidence1._id,
        action: 'VERIFIED',
        performedBy: forensic._id,
        remarks: `Forensic officer certified SHA-256 match.`,
        timestamp: new Date(Date.now() - 3600000 * 12),
      },
      {
        evidence: evidence1._id,
        action: 'SUBMITTED_TO_COURT',
        fromUser: forensic._id,
        toUser: courtOfficer._id,
        performedBy: forensic._id,
        remarks: `Submitted to Court for evidentiary review in Case CR-2026-9042.`,
        timestamp: new Date(Date.now() - 3600000 * 8),
      },
      {
        evidence: evidence2._id,
        action: 'UPLOADED',
        fromUser: null,
        toUser: investigator._id,
        performedBy: investigator._id,
        remarks: `Internal ingestion. Generated SHA-256: ${realHash2}`,
        timestamp: new Date(Date.now() - 3600000 * 6),
      },
    ]);

    // Create Audit Logs
    await AuditLog.create([
      {
        user: admin._id,
        action: 'LOGIN_SUCCESS',
        details: 'Admin logged into system for routine inspection',
        ipAddress: '127.0.0.1',
        timestamp: new Date(Date.now() - 3600000 * 25),
      },
      {
        user: investigator._id,
        action: 'EVIDENCE_UPLOADED',
        evidence: evidence1._id,
        details: `Evidence EV-2026-0001 ingested for Case #CR-2026-9042`,
        ipAddress: '127.0.0.1',
        timestamp: new Date(Date.now() - 3600000 * 24),
      },
      {
        user: forensic._id,
        action: 'STATUS_CHANGED',
        evidence: evidence1._id,
        details: `Evidence EV-2026-0001 submitted to court for judicial review`,
        ipAddress: '127.0.0.1',
        timestamp: new Date(Date.now() - 3600000 * 8),
      },
    ]);

    console.log('[PRAMAN Seed] Initial database seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[PRAMAN Seed] Error seeding database:', err);
    process.exit(1);
  }
};

seedData();
