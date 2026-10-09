const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { supabase } = require('../config/db');
const { calculateFileHash } = require('./hashFile');

const seedInitialDataIfEmpty = async () => {
  try {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.warn('[PRAMAN] Could not query Supabase users table for auto-seeding:', error.message);
      return;
    }

    if (count && count > 0) {
      return; // Already populated
    }

    console.log('[PRAMAN] Empty Supabase database detected. Auto-seeding demo users and initial records...');

    const salt = await bcrypt.genSalt(10);
    const adminPass = await bcrypt.hash('Admin@123', salt);
    const invPass = await bcrypt.hash('Investigator@123', salt);
    const forensicPass = await bcrypt.hash('Forensic@123', salt);
    const courtPass = await bcrypt.hash('Court@123', salt);

    const adminId = crypto.randomUUID();
    const invId = crypto.randomUUID();
    const forensicId = crypto.randomUUID();
    const courtId = crypto.randomUUID();
    const now = new Date().toISOString();

    // 1. Insert Default Users
    await supabase.from('users').insert([
      {
        id: adminId,
        name: 'Dr. Evelyn Reed (Chief Admin)',
        email: 'admin@praman.com',
        password: adminPass,
        role: 'admin',
        isActive: true,
        createdAt: now,
      },
      {
        id: invId,
        name: 'Inspector Vikram Patel',
        email: 'investigator@praman.com',
        password: invPass,
        role: 'investigator',
        isActive: true,
        createdAt: now,
      },
      {
        id: forensicId,
        name: 'Dr. Sarah Lin (Forensic Officer)',
        email: 'forensic@praman.com',
        password: forensicPass,
        role: 'forensic',
        isActive: true,
        createdAt: now,
      },
      {
        id: courtId,
        name: 'Hon. Justice Aditi Sharma (Court Officer)',
        email: 'court@praman.com',
        password: courtPass,
        role: 'court_officer',
        isActive: true,
        createdAt: now,
      },
    ]);

    // 2. Prepare Sample Evidence Files
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Evidence 1
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

    const ev1Id = crypto.randomUUID();
    const ev1Date = new Date(Date.now() - 3600000 * 24).toISOString();

    await supabase.from('evidence').insert({
      id: ev1Id,
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
      uploadedBy: invId,
      uploadedAt: ev1Date,
      currentHolder: invId,
      status: 'Verified',
      integrityStatus: 'Verified',
      lastVerifiedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
      courtReviewStatus: 'Pending Court Review',
      courtAssignedTo: courtId,
      notes: [
        {
          text: 'Initial forensic clone extracted without physical tampering.',
          addedBy: invId,
          addedByName: 'Inspector Vikram Patel',
          noteType: 'investigator',
          addedAt: ev1Date,
        },
        {
          text: 'Forensic integrity hash verified against server logs. Cleared for judicial submission.',
          addedBy: forensicId,
          addedByName: 'Dr. Sarah Lin (Forensic Officer)',
          noteType: 'forensic',
          addedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        },
      ],
      createdAt: ev1Date,
      updatedAt: now,
    });

    // Evidence 2
    const sample2FileName = 'encrypted-usb-partition.bin';
    const sample2FilePath = path.join(uploadDir, `ev-seed-${sample2FileName}`);
    const sample2Content = `RAW PHYSICAL DISK DUMP - SUSPECT USB DRIVE SEIZED AT SCENE`;
    fs.writeFileSync(sample2FilePath, sample2Content, 'utf-8');
    const realHash2 = await calculateFileHash(sample2FilePath);

    const ev2Id = crypto.randomUUID();
    const ev2Date = new Date(Date.now() - 3600000 * 6).toISOString();

    await supabase.from('evidence').insert({
      id: ev2Id,
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
      uploadedBy: invId,
      uploadedAt: ev2Date,
      currentHolder: invId,
      status: 'Under Review',
      integrityStatus: 'Not Checked',
      courtReviewStatus: 'None',
      notes: [
        {
          text: 'Bitstream image captured using hardware write-blocker.',
          addedBy: invId,
          addedByName: 'Inspector Vikram Patel',
          noteType: 'investigator',
          addedAt: ev2Date,
        },
      ],
      createdAt: ev2Date,
      updatedAt: now,
    });

    // 3. Custody Logs
    await supabase.from('custody_logs').insert([
      {
        id: crypto.randomUUID(),
        evidence: ev1Id,
        action: 'UPLOADED',
        fromUser: null,
        toUser: invId,
        performedBy: invId,
        remarks: `Initial evidence ingestion. Generated SHA-256: ${realHash}`,
        timestamp: ev1Date,
      },
      {
        id: crypto.randomUUID(),
        evidence: ev1Id,
        action: 'TRANSFERRED',
        fromUser: invId,
        toUser: forensicId,
        performedBy: invId,
        remarks: `Transferred to Forensic Lab for integrity certification.`,
        timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
      },
      {
        id: crypto.randomUUID(),
        evidence: ev1Id,
        action: 'VERIFIED',
        fromUser: null,
        toUser: null,
        performedBy: forensicId,
        remarks: `Forensic officer certified SHA-256 match.`,
        timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
      },
      {
        id: crypto.randomUUID(),
        evidence: ev1Id,
        action: 'SUBMITTED_TO_COURT',
        fromUser: forensicId,
        toUser: courtId,
        performedBy: forensicId,
        remarks: `Submitted to Court for evidentiary review in Case CR-2026-9042.`,
        timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
      },
      {
        id: crypto.randomUUID(),
        evidence: ev2Id,
        action: 'UPLOADED',
        fromUser: null,
        toUser: invId,
        performedBy: invId,
        remarks: `Internal ingestion. Generated SHA-256: ${realHash2}`,
        timestamp: ev2Date,
      },
    ]);

    // 4. Initial Audit Logs
    await supabase.from('audit_logs').insert([
      {
        id: crypto.randomUUID(),
        user: adminId,
        action: 'LOGIN_SUCCESS',
        details: 'Admin logged into system for routine inspection',
        ipAddress: '127.0.0.1',
        timestamp: new Date(Date.now() - 3600000 * 25).toISOString(),
      },
      {
        id: crypto.randomUUID(),
        user: invId,
        action: 'EVIDENCE_UPLOADED',
        evidence: ev1Id,
        details: `Evidence EV-2026-0001 ingested for Case #CR-2026-9042`,
        ipAddress: '127.0.0.1',
        timestamp: ev1Date,
      },
      {
        id: crypto.randomUUID(),
        user: forensicId,
        action: 'STATUS_CHANGED',
        evidence: ev1Id,
        details: `Evidence EV-2026-0001 submitted to court for judicial review`,
        ipAddress: '127.0.0.1',
        timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
      },
    ]);

    console.log('[PRAMAN] Default demo credentials seeded successfully into Supabase:');
    console.log('         - admin@praman.com (Admin@123)');
    console.log('         - investigator@praman.com (Investigator@123)');
    console.log('         - forensic@praman.com (Forensic@123)');
    console.log('         - court@praman.com (Court@123)');
  } catch (err) {
    console.error('[PRAMAN] Error auto-seeding defaults:', err.message);
  }
};

module.exports = { seedInitialDataIfEmpty };
