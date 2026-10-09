-- ===================================================================
-- P.R.A.M.A.N — Supabase PostgreSQL Relational Database Schema
-- Portal for Recording and Managing Authentic Nodes
-- Migration from MongoDB (NoSQL) to Supabase (Relational PostgreSQL)
-- ===================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'investigator',
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 2. EVIDENCE TABLE
CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  "evidenceId" TEXT UNIQUE NOT NULL,
  "caseNumber" TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  "evidenceType" TEXT NOT NULL DEFAULT 'Document',
  "originalFilename" TEXT NOT NULL,
  "storedFilename" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" BIGINT NOT NULL,
  "sha256Hash" TEXT NOT NULL,
  "uploadedBy" TEXT REFERENCES users(id),
  "uploadedAt" TIMESTAMPTZ DEFAULT NOW(),
  "currentHolder" TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'Uploaded',
  notes JSONB DEFAULT '[]'::jsonb,
  "lastVerifiedAt" TIMESTAMPTZ,
  "integrityStatus" TEXT NOT NULL DEFAULT 'Not Checked',
  "courtReviewStatus" TEXT NOT NULL DEFAULT 'None',
  "courtAssignedTo" TEXT REFERENCES users(id),
  "courtClarificationReason" TEXT DEFAULT '',
  "courtReviewedBy" TEXT REFERENCES users(id),
  "courtReviewedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CUSTODY LOGS TABLE
CREATE TABLE IF NOT EXISTS custody_logs (
  id TEXT PRIMARY KEY,
  evidence TEXT REFERENCES evidence(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  "fromUser" TEXT REFERENCES users(id),
  "toUser" TEXT REFERENCES users(id),
  "performedBy" TEXT REFERENCES users(id) NOT NULL,
  remarks TEXT DEFAULT '',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  "user" TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  evidence TEXT REFERENCES evidence(id) ON DELETE SET NULL,
  details TEXT DEFAULT '',
  "ipAddress" TEXT DEFAULT '127.0.0.1',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Disable Row Level Security (RLS) so the Express backend can access tables freely
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE evidence DISABLE ROW LEVEL SECURITY;
ALTER TABLE custody_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
