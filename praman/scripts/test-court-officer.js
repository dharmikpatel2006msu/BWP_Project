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

require('dotenv').config({ path: './backend/.env' });
const { supabase } = require('../backend/config/db');

const BASE_URL = 'http://localhost:5000/api';

async function runCourtOfficerTests() {
  console.log('========================================================');
  console.log('  RUNNING P.R.A.M.A.N COURT OFFICER TEST SUITE         ');
  console.log('========================================================\n');

  // Setup predictable test state:
  // EV-2026-0002 -> None (for unauthorized internal scope check)
  await supabase.from('evidence').update({
    courtReviewStatus: 'None',
    courtAssignedTo: null,
    courtClarificationReason: '',
    courtReviewedBy: null,
    courtReviewedAt: null,
  }).eq('evidenceId', 'EV-2026-0002');

  // EV-2026-0001 -> Pending Court Review (for full court review cycle)
  await supabase.from('evidence').update({
    courtReviewStatus: 'Pending Court Review',
    courtClarificationReason: '',
    courtReviewedBy: null,
    courtReviewedAt: null,
  }).eq('evidenceId', 'EV-2026-0001');

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
    const courtUserId = loginData.data.user.id || loginData.data.user._id;
    const internalEvidence = allEvData.data.find(
      (e) => (e.courtReviewStatus === 'None' || !e.courtReviewStatus) && String(e.currentHolder?.id || e.currentHolder?._id || e.currentHolder) !== String(courtUserId)
    );

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
    // 8A. JUDICIAL ACTIONS PAUSED DURING CLARIFICATION
    // ---------------------------------------------------------
    // Judge cannot accept while awaiting clarification
    const acceptWhileClarifying = await fetch(`${BASE_URL}/court/evidence/${courtEvidence._id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${courtToken}` },
    });
    assert(
      acceptWhileClarifying.status === 400,
      'WORKFLOW LOCK: Court accept rejected with 400 while evidence is awaiting clarification'
    );

    // Judge cannot add court notes while awaiting clarification
    const noteWhileClarifying = await fetch(`${BASE_URL}/court/evidence/${courtEvidence._id}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${courtToken}`,
      },
      body: JSON.stringify({ text: 'Attempting court note during clarification' }),
    });
    assert(
      noteWhileClarifying.status === 400,
      'WORKFLOW LOCK: Court notes rejected with 400 while evidence is awaiting clarification'
    );

    // Investigator CAN add notes during clarification to resolve the query
    const clarNoteRes = await fetch(`${BASE_URL}/evidence/${courtEvidence._id}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${invToken}`,
      },
      body: JSON.stringify({ text: 'Certified write-blocker firmware v2.4.1 affidavit attached.' }),
    });
    assert(
      clarNoteRes.status === 200,
      'WORKFLOW: Investigator can add clarifying forensic note when clarification requested'
    );

    // Investigator resubmits evidence to court
    const resubmitRes = await fetch(`${BASE_URL}/court/submit/${courtEvidence._id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${invToken}`,
      },
      body: JSON.stringify({ remarks: 'Clarification provided with write-blocker affidavit.' }),
    });
    assert(
      resubmitRes.status === 200,
      'WORKFLOW: Investigator successfully resubmits evidence to court after clarification'
    );

    // ---------------------------------------------------------
    // 8B. PREVIEW EVIDENCE INLINE
    // ---------------------------------------------------------
    const previewRes = await fetch(`${BASE_URL}/court/evidence/${courtEvidence._id}/preview`, {
      headers: { Authorization: `Bearer ${courtToken}` },
    });
    const previewDisposition = previewRes.headers.get('content-disposition') || '';
    assert(
      previewRes.status === 200 && previewDisposition.includes('inline'),
      'GET /api/court/evidence/:id/preview serves exhibit file inline for judicial inspection'
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

    // Duplicate accept attempt must be rejected
    const dupAcceptRes = await fetch(`${BASE_URL}/court/evidence/${courtEvidence._id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${courtToken}` },
    });
    assert(
      dupAcceptRes.status === 400,
      'IMMUTABILITY: Duplicate accept rejected with 400 once exhibit is in official court record'
    );

    // Clarification request on accepted evidence must be rejected
    const clarAfterAccept = await fetch(`${BASE_URL}/court/evidence/${courtEvidence._id}/clarification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${courtToken}`,
      },
      body: JSON.stringify({ reason: 'Attempting clarification after acceptance' }),
    });
    assert(
      clarAfterAccept.status === 400,
      'IMMUTABILITY: Clarification rejected with 400 on accepted court record'
    );

    // Investigator custody transfer prohibited on accepted court record
    const blockedTransferAccepted = await fetch(`${BASE_URL}/custody/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${invToken}`,
      },
      body: JSON.stringify({
        evidenceId: courtEvidence._id,
        toUserId: courtEvidence.uploadedBy?.id || courtEvidence.uploadedBy,
        remarks: 'Attempting transfer after acceptance',
      }),
    });
    assert(
      blockedTransferAccepted.status === 400,
      'IMMUTABILITY: Custody transfer prohibited on evidence accepted for court record'
    );

    // Investigator adding notes prohibited on accepted court record
    const blockedNoteAccepted = await fetch(`${BASE_URL}/evidence/${courtEvidence._id}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${invToken}`,
      },
      body: JSON.stringify({ text: 'Attempting note after acceptance' }),
    });
    assert(
      blockedNoteAccepted.status === 400,
      'IMMUTABILITY: Adding notes prohibited on evidence accepted for court record'
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
    // 10B. EXPORT SECTION 65B XML CERTIFICATE
    // ---------------------------------------------------------
    const certXmlRes = await fetch(`${BASE_URL}/court/evidence/${courtEvidence._id}/certificate/xml`, {
      headers: { Authorization: `Bearer ${courtToken}` },
    });
    const xmlContent = await certXmlRes.text();
    assert(
      certXmlRes.status === 200 &&
      certXmlRes.headers.get('content-type').includes('xml') &&
      xmlContent.includes('<Section65BCertificate') &&
      xmlContent.includes('<CryptographicIntegrity'),
      'GET /api/court/evidence/:id/certificate/xml generates well-formed Section 65B XML certificate'
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
