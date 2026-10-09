/**
 * P.R.A.M.A.N — Court Officer Role Integration & Security Test Suite
 *
 * Validates:
 * 1. Authentication & Role Permissions
 * 2. Scope-based evidence access (Authorized vs Unauthorized)
 * 3. Cryptographic integrity verification without hash tampering
 * 4. Chain of custody inspection
 * 5. Court notes isolation
 * 6. Evidentiary acceptance for court record
 * 7. Clarification requests and reason validation
 * 8. Comprehensive court report generation
 * 9. Judicial audit logging
 * 10. Role-based denial tests (Court Officer accessing admin APIs, Unauthorized evidence, etc.)
 */

const BASE_URL = 'http://localhost:5000/api';

async function runCourtOfficerTests() {
  console.log('========================================================');
  console.log('  RUNNING P.R.A.M.A.N COURT OFFICER TEST SUITE         ');
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
    // ---------------------------------------------------------
    // 1. AUTHENTICATION & LOGIN
    // ---------------------------------------------------------
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'court@praman.com', password: 'Court@123' }),
    });
    const loginData = await loginRes.json();
    assert(
      loginRes.status === 200 && loginData.data.user.role === 'court_officer',
      'Court Officer login succeeds with role = court_officer'
    );
    const courtToken = loginData.data.token;

    // Investigator login (for non-court role checks)
    const invLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'investigator@praman.com', password: 'Investigator@123' }),
    });
    const invData = await invLoginRes.json();
    const invToken = invData.data.token;

    // Ensure at least 1 evidence item is submitted to court for test suite
    const evCheckRes = await fetch(`${BASE_URL}/evidence`, {
      headers: { Authorization: `Bearer ${invToken}` },
    });
    const evCheckData = await evCheckRes.json();
    if (evCheckData.data && evCheckData.data.length > 0) {
      const courtUserRes = await fetch(`${BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${courtToken}` },
      });
      const courtUserData = await courtUserRes.json();
      const courtUser = courtUserData.data?.find((u) => u.role === 'court_officer');
      const targetItem = evCheckData.data[0];

      if (courtUser && targetItem) {
        await fetch(`${BASE_URL}/custody/transfer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${invToken}`,
          },
          body: JSON.stringify({
            evidenceId: targetItem._id || targetItem.id,
            toUserId: courtUser._id || courtUser.id,
            remarks: 'Submitted for Judicial Court Review',
          }),
        });
      }
    }

    // ---------------------------------------------------------
    // 2. COURT DASHBOARD STATS
    // ---------------------------------------------------------
    const statsRes = await fetch(`${BASE_URL}/court/stats`, {
      headers: { Authorization: `Bearer ${courtToken}` },
    });
    const statsData = await statsRes.json();
    assert(
      statsRes.status === 200 && statsData.data.submittedToCourt >= 1,
      'GET /api/court/stats returns judicial review statistics'
    );

    // ---------------------------------------------------------
    // 3. COURT EVIDENCE LIST (Scope restricted to court exhibits)
    // ---------------------------------------------------------
    const courtEvListRes = await fetch(`${BASE_URL}/court/evidence`, {
      headers: { Authorization: `Bearer ${courtToken}` },
    });
    const courtEvListData = await courtEvListRes.json();
    assert(
      courtEvListRes.status === 200 && courtEvListData.data.length >= 1,
      'GET /api/court/evidence returns court-submitted evidence exhibits'
    );
    const courtEvidence = courtEvListData.data.find((e) => e.evidenceId === 'EV-2026-0001') || courtEvListData.data[0];

    // ---------------------------------------------------------
    // 4. EVIDENCE DOSSIER VIEW
    // ---------------------------------------------------------
    const dossierRes = await fetch(`${BASE_URL}/court/evidence/${courtEvidence._id || courtEvidence.id}`, {
      headers: { Authorization: `Bearer ${courtToken}` },
    });
    const dossierData = await dossierRes.json();
    assert(
      dossierRes.status === 200 && dossierData.data.evidenceId === courtEvidence.evidenceId,
      'GET /api/court/evidence/:id retrieves authorized court dossier'
    );

    // ---------------------------------------------------------
    // 5. NEGATIVE TEST: UNAUTHORIZED EVIDENCE ACCESS (EV-2026-0002)
    // ---------------------------------------------------------
    // EV-2026-0002 was seeded with courtReviewStatus: 'None' (internal investigation only)
    const allEvRes = await fetch(`${BASE_URL}/evidence`, {
      headers: { Authorization: `Bearer ${invToken}` },
    });
    const allEvData = await allEvRes.json();
    const internalEvidence = allEvData.data.find((e) => e.evidenceId === 'EV-2026-0002');

    if (internalEvidence) {
      const unauthRes = await fetch(`${BASE_URL}/court/evidence/${internalEvidence._id}`, {
        headers: { Authorization: `Bearer ${courtToken}` },
      });
      assert(
        unauthRes.status === 403,
        'SCOPE SECURITY: Court Officer blocked with 403 Forbidden from accessing unauthorized internal evidence'
      );
    }

    // ---------------------------------------------------------
    // 6. CRYPTOGRAPHIC VERIFICATION (INTEGRITY RULE CHECK)
    // ---------------------------------------------------------
    const origHashBefore = courtEvidence.sha256Hash;
    const verifyRes = await fetch(`${BASE_URL}/court/evidence/${courtEvidence._id}/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${courtToken}` },
    });
    const verifyData = await verifyRes.json();
    assert(
      verifyRes.status === 200 &&
      verifyData.data.isMatch === true &&
      verifyData.data.verificationResult === 'INTEGRITY VERIFIED',
      'POST /api/court/evidence/:id/verify completes stream verification with INTEGRITY VERIFIED'
    );
    assert(
      verifyData.data.originalHash === origHashBefore,
      'IMMUTABILITY RULE: Original SHA-256 hash was NOT overwritten during court verification'
    );

    // ---------------------------------------------------------
    // 7. RECORD JUDICIAL REVIEW NOTE
    // ---------------------------------------------------------
    const noteRes = await fetch(`${BASE_URL}/court/evidence/${courtEvidence._id}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${courtToken}`,
      },
      body: JSON.stringify({
        text: 'Pre-trial hearing: SHA-256 integrity verified; forensic lab certificate admitted without defense objection.',
      }),
    });
    const noteData = await noteRes.json();
    assert(
      noteRes.status === 200 &&
      noteData.data.some((n) => n.noteType === 'court'),
      'POST /api/court/evidence/:id/notes records separate judicial note with noteType = court'
    );

    // Empty note validation
    const emptyNoteRes = await fetch(`${BASE_URL}/court/evidence/${courtEvidence._id}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${courtToken}`,
      },
      body: JSON.stringify({ text: '   ' }),
    });
    assert(
      emptyNoteRes.status === 400,
      'INPUT VALIDATION: Blank court review note rejected with 400 Bad Request'
    );

    // ---------------------------------------------------------
    // 8. REQUEST CLARIFICATION
    // ---------------------------------------------------------
    // Empty clarification reason rejection
    const emptyClarRes = await fetch(`${BASE_URL}/court/evidence/${courtEvidence._id}/clarification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${courtToken}`,
      },
      body: JSON.stringify({ reason: '' }),
    });
    assert(
      emptyClarRes.status === 400,
      'INPUT VALIDATION: Blank clarification reason rejected with 400 Bad Request'
    );

    // Valid clarification request
    const clarRes = await fetch(`${BASE_URL}/court/evidence/${courtEvidence._id}/clarification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${courtToken}`,
      },
      body: JSON.stringify({
        reason: 'Please provide certified affidavit confirming write-blocker firmware version.',
      }),
    });
    const clarData = await clarRes.json();
    assert(
      clarRes.status === 200 &&
      clarData.data.courtReviewStatus === 'Requires Clarification',
      'POST /api/court/evidence/:id/clarification registers clarification request and updates status'
    );

    // ---------------------------------------------------------
    // 9. ACCEPT FOR COURT RECORD
    // ---------------------------------------------------------
    const acceptRes = await fetch(`${BASE_URL}/court/evidence/${courtEvidence._id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${courtToken}` },
    });
    const acceptData = await acceptRes.json();
    assert(
      acceptRes.status === 200 &&
      acceptData.data.courtReviewStatus === 'Accepted for Court Record',
      'POST /api/court/evidence/:id/accept updates status to Accepted for Court Record'
    );

    // ---------------------------------------------------------
    // 10. GENERATE COURT EVIDENCE REPORT
    // ---------------------------------------------------------
    const reportRes = await fetch(`${BASE_URL}/court/evidence/${courtEvidence._id}/report`, {
      headers: { Authorization: `Bearer ${courtToken}` },
    });
    const reportData = await reportRes.json();
    assert(
      reportRes.status === 200 &&
      reportData.data.notesBreakdown.courtNotes.length >= 1 &&
      reportData.data.custodyTimeline.length >= 2,
      'GET /api/court/evidence/:id/report compiles comprehensive court evidence review report'
    );

    // ---------------------------------------------------------
    // 11. COURT AUDIT LOGS
    // ---------------------------------------------------------
    const auditRes = await fetch(`${BASE_URL}/court/audit`, {
      headers: { Authorization: `Bearer ${courtToken}` },
    });
    const auditData = await auditRes.json();
    assert(
      auditRes.status === 200 &&
      auditData.data.some((a) => a.action === 'COURT_REVIEW_ACCEPTED'),
      'GET /api/court/audit logs COURT_REVIEW_ACCEPTED event in security ledger'
    );

    // ---------------------------------------------------------
    // 12. ROLE-BASED ACCESS CONTROL (DENY CHECKS)
    // ---------------------------------------------------------
    // Court officer cannot access Admin user management
    const adminUserRes = await fetch(`${BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${courtToken}` },
    });
    // Even if users endpoint returns list, non-admin cannot POST to create users
    const createUnauthRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${courtToken}`,
      },
      body: JSON.stringify({ name: 'Hacker', email: 'hack@test.com', password: '123', role: 'admin' }),
    });
    assert(
      createUnauthRes.status === 403,
      'RBAC DENIAL: Court Officer forbidden from provisioning user accounts (403 Forbidden)'
    );

    // Investigator cannot call Court Accept endpoint
    const invAcceptRes = await fetch(`${BASE_URL}/court/evidence/${courtEvidence._id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${invToken}` },
    });
    assert(
      invAcceptRes.status === 403,
      'RBAC DENIAL: Investigator forbidden from executing court-only accept action (403 Forbidden)'
    );

    console.log('\n========================================================');
    console.log(`  COURT OFFICER TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Court Officer Test execution failed:', err);
    process.exit(1);
  }
}

runCourtOfficerTests();
