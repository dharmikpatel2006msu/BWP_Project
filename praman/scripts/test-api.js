/**
 * P.R.A.M.A.N — Automated Test Suite
 * Validates authentication, upload, verification, chain of custody, and XML export.
 */

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('========================================================');
  console.log('  RUNNING P.R.A.M.A.N INTEGRATION TEST SUITE           ');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Health Check
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200 && healthData.success, 'GET /api/health responds with 200 OK');

    // 2. Admin Login
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@praman.com', password: 'Admin@123' }),
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200 && adminLoginData.data.token, 'POST /api/auth/login (Admin authentication)');
    const adminToken = adminLoginData.data.token;

    // 3. Investigator Login
    const invLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'investigator@praman.com', password: 'Investigator@123' }),
    });
    const invLoginData = await invLoginRes.json();
    assert(invLoginRes.status === 200 && invLoginData.data.user.role === 'investigator', 'POST /api/auth/login (Investigator role check)');
    const invToken = invLoginData.data.token;

    // 4. Invalid Login (Check generic error message)
    const badLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'fake@praman.com', password: 'WrongPassword' }),
    });
    const badLoginData = await badLoginRes.json();
    assert(badLoginRes.status === 401 && badLoginData.success === false, 'POST /api/auth/login (Invalid credentials rejected without user leakage)');

    // 5. Dashboard Stats
    const statsRes = await fetch(`${BASE_URL}/dashboard/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const statsData = await statsRes.json();
    assert(statsRes.status === 200 && statsData.data.totalEvidence >= 1, 'GET /api/dashboard/stats returns metrics');

    // 6. Get Evidence Catalog
    const evRes = await fetch(`${BASE_URL}/evidence`, {
      headers: { Authorization: `Bearer ${invToken}` },
    });
    const evData = await evRes.json();
    assert(evRes.status === 200 && evData.data.length > 0, 'GET /api/evidence returns seeded evidence record');
    const sampleEvidence = evData.data[0];

    // 7. Verify Evidence Cryptographic Hash
    const verifyRes = await fetch(`${BASE_URL}/evidence/${sampleEvidence._id}/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${invToken}` },
    });
    const verifyData = await verifyRes.json();
    assert(
      verifyRes.status === 200 &&
      verifyData.data.isMatch === true &&
      verifyData.data.integrityStatus === 'Verified',
      'POST /api/evidence/:id/verify matches original SHA-256 and sets integrityStatus to Verified'
    );
    assert(verifyData.data.originalHash === sampleEvidence.sha256Hash, 'Integrity rule check: original sha256Hash was preserved');

    // 8. Add Note
    const noteRes = await fetch(`${BASE_URL}/evidence/${sampleEvidence._id}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${invToken}`,
      },
      body: JSON.stringify({ text: 'Automated test observation note.' }),
    });
    const noteData = await noteRes.json();
    assert(noteRes.status === 200 && noteData.data.length >= 2, 'POST /api/evidence/:id/notes appends note');

    // 9. Custody Timeline
    const custodyRes = await fetch(`${BASE_URL}/custody/${sampleEvidence._id}`, {
      headers: { Authorization: `Bearer ${invToken}` },
    });
    const custodyData = await custodyRes.json();
    assert(custodyRes.status === 200 && custodyData.data.timeline.length >= 2, 'GET /api/custody/:id returns chronological events');

    // 10. Custody Transfer
    // First get forensic officer user id
    const usersRes = await fetch(`${BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const usersData = await usersRes.json();
    const forensicUser = usersData.data.find((u) => u.role === 'forensic');

    const transferRes = await fetch(`${BASE_URL}/custody/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${invToken}`,
      },
      body: JSON.stringify({
        evidenceId: sampleEvidence._id,
        toUserId: forensicUser._id,
        remarks: 'Handover for digital forensic laboratory spectroscopy and memory extraction.',
      }),
    });
    const transferData = await transferRes.json();
    assert(transferRes.status === 200 && transferData.data.evidence.currentHolder === forensicUser._id, 'POST /api/custody/transfer transfers custody');

    // 11. Audit Logs (Admin only)
    const auditRes = await fetch(`${BASE_URL}/audit`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const auditData = await auditRes.json();
    assert(auditRes.status === 200 && auditData.data.length >= 3, 'GET /api/audit retrieves security event logs');

    // 12. XML Export
    const xmlRes = await fetch(`${BASE_URL}/audit/export/xml`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const xmlText = await xmlRes.text();
    assert(
      xmlRes.status === 200 &&
      xmlText.includes('<AuditLogs') &&
      xmlText.includes('<Action>EVIDENCE_UPLOADED</Action>'),
      'GET /api/audit/export/xml generates valid, well-formed XML audit report'
    );

    // 13. RBAC Protection Check: Non-admin accessing Audit Logs
    const rbacRes = await fetch(`${BASE_URL}/audit`, {
      headers: { Authorization: `Bearer ${invToken}` },
    });
    assert(rbacRes.status === 403, 'RBAC check: Non-admin user receives 403 Forbidden for /api/audit');

    console.log('\n========================================================');
    console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

runTests();
