# P.R.A.M.A.N — Team-Wise & Member-Wise Project Contribution Report
**Portal for Recording and Managing Authentic Nodes (Digital Evidence Management & Chain of Custody System)**

---

## 📋 Executive Contribution Summary Matrix

| Member | Team | Assigned Role | Primary Focus Modules | Work Share |
| :--- | :--- | :--- | :--- | :---: |
| **Member 1** | **Frontend** | UI/UX Lead & Core Portal Engineer | Design System (`style.css`), Auth, Main Dashboard, Evidence Upload & Directory | **25%** |
| **Member 2** | **Frontend** | Forensic & Legal UI Engineer | Evidence Inspector, Chain of Custody Timeline, Court Review Portal & Section 65B Certificate UI | **25%** |
| **Member 3** | **Backend** | Core Architecture & Evidence API Engineer | Express Server, Supabase DB Schema, JWT Auth, RBAC Middleware & Ingestion Engine | **25%** |
| **Member 4** | **Backend** | Cryptography, Audit & Legal API Engineer | SHA-256 Stream Hashing, Custody Transfer Engine, Court Officer APIs & XML Generators | **25%** |

---

# 🎨 Team 1: Frontend Development Team (50%)

### Team Architecture Overview
The Frontend Team designed and engineered a responsive, high-performance web interface built strictly on **Vanilla HTML5, Vanilla CSS3 (custom design system), and Modular JavaScript (ES6)**. External CSS frameworks (like Tailwind or Bootstrap) were deliberately avoided to eliminate third-party dependencies, reduce supply-chain security risks, and ensure pixel-perfect fidelity for legal document printing under Section 65B.

---

## 👤 Member 1: Frontend Developer A (UI/UX Lead & Core Portal Engineer)
**Work Share:** 25% (50% of Frontend Sub-team)  
**Primary Focus:** System Design Tokens, Authentication Flow, Main Investigation Dashboard, Evidence Ingestion, and User Management.

### 1. Modules & Files Developed
* **Global Design System & Styling:** [`frontend/css/style.css`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/css/style.css)
  * Built the design system from scratch (CSS variables for dark palette, glassmorphism cards, badge indicators, responsive sidebar layout, modal system, toast notifications).
* **API Communication Core:** [`frontend/js/api.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/js/api.js)
  * Created the unified `apiRequest` fetch wrapper handling JWT token injection in `Authorization: Bearer <token>` headers, automatic 401 redirect, and standardized error toast handling.
* **Authentication Portal:** [`frontend/index.html`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/index.html) & [`frontend/js/auth.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/js/auth.js)
  * Secure login interface with client-side credential validation, JWT storage in `localStorage`, role-based redirection (`court_officer` → Court Dashboard; `investigator`/`admin` → Main Dashboard), and session logout.
* **Main Investigation Dashboard:** [`frontend/dashboard.html`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/dashboard.html) & [`frontend/js/dashboard.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/js/dashboard.js)
  * Dynamic metric cards (Total Evidence, Pending Verification, Active Transfers, Tamper Alerts), quick-action links, and real-time recent evidence table.
* **Evidence Ingestion Portal:** [`frontend/upload.html`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/upload.html) & [`frontend/js/upload.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/js/upload.js)
  * Drag-and-drop evidence upload interface, client-side MIME/extension verification, case number validation, and form submission via `FormData`.
* **Evidence Directory & Search:** [`frontend/evidence.html`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/evidence.html) & [`frontend/js/evidence.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/js/evidence.js)
  * Evidence catalog featuring multi-parameter filtering (by status, evidence type, case number) and search bar.
* **Admin User Management:** [`frontend/users.html`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/users.html) & [`frontend/js/users.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/js/users.js)
  * User provisioning interface for `admin` role to view system users, create new personnel accounts, and toggle active/inactive status.

### 2. Key Responsibilities & Technical Highlights
* Established responsive sidebar and top-navigation layout across all screens.
* Client-side role gating: dynamically hides or displays navigation links (e.g., Upload button hidden from Admin as Admin is strictly an observer/governance role).
* Asynchronous state handling and visual error/success feedback using floating toast alerts.

### 3. Viva Voce Defense Q&A
* **Q: Why did you choose Vanilla JS and CSS over React or Tailwind?**
  * **A:** Forensic and judicial software demands maximum runtime stability, zero supply-chain risk from nested npm dependencies, and sub-second load times. A native CSS token system keeps the stylesheet under 50KB and allows exact control over print stylesheets for court certificates.
* **Q: How does user session state persist across separate HTML pages?**
  * **A:** Stored JWT token and parsed role in browser `localStorage`. A lightweight script in `<head>` runs `checkAuth()` on page load, verifying token presence and redirecting unauthorized users before the DOM renders.
* **Q: How did you implement file uploads in Vanilla JS without corruption?**
  * **A:** Encapsulated file metadata and the raw file buffer into the browser's native `FormData` API and streamed it via `fetch` as `multipart/form-data`, ensuring raw byte accuracy for SHA-256 hashing.

### 4. PPT Presentation Speaking Script (1–2 Mins)
> *"Good morning respected evaluators. As Member 1 and Frontend Lead, my focus was on the foundational UI architecture, authentication security, and core investigation workflows.*
> *I designed our custom zero-dependency design system in `style.css`, defining our dark theme, responsive sidebars, modals, and toast notifications. In `api.js`, I built our unified request handler with automatic JWT Bearer token injection and session recovery.*
> *I developed the login gateway with role-based routing, the main executive dashboard featuring dynamic KPI cards, and the evidence ingestion module supporting drag-and-drop uploads with client-side MIME validation. Thank you."*

---

## 👤 Member 2: Frontend Developer B (Forensic & Legal UI Engineer)
**Work Share:** 25% (50% of Frontend Sub-team)  
**Primary Focus:** Cryptographic Hash Inspector, Interactive Custody Timeline, Judicial Court Review Portal, Section 65B Print Certificate, and Audit Log UI.

### 1. Modules & Files Developed
* **Evidence Deep Inspector & Tamper Verification UI:** [`frontend/evidence-details.html`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/evidence-details.html) & [`frontend/js/evidence-details.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/js/evidence-details.js)
  * Evidence inspection panel displaying stored SHA-256 hash vs. re-calculated live hash, visual tamper-alert badges (Match: Green / Tampered: Red), file preview modal, notes log, and court submission triggers.
* **Chain of Custody Tracking UI:** [`frontend/custody.html`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/custody.html) & [`frontend/js/custody.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/js/custody.js)
  * Interactive vertical custody timeline mapping evidence movement between officers; modal dialog for transferring custody with recipient dropdown and mandatory reason/remarks field.
* **Court Officer Portal (Judicial Module):**
  * **Court Dashboard:** [`frontend/court-dashboard.html`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/court-dashboard.html) & [`frontend/js/court-dashboard.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/js/court-dashboard.js) (metrics on submitted evidence, accepted exhibits, clarification requests).
  * **Court Evidence Docket:** [`frontend/court-evidence.html`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/court-evidence.html) & [`frontend/js/court-evidence.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/js/court-evidence.js) (case docket list for judicial officers).
  * **Judicial Review Screen:** [`frontend/court-review.html`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/court-review.html) & [`frontend/js/court-review.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/js/court-review.js) (interface to verify hash, mark as "Accepted for Court Record" or "Clarification Requested", and enter judicial remarks).
  * **Court Activity Stream:** [`frontend/court-activity.html`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/court-activity.html) & [`frontend/js/court-activity.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/js/court-activity.js).
* **Section 65B Admissibility Certificate Generator:** [`frontend/court-report.html`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/court-report.html) & [`frontend/js/court-report.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/js/court-report.js)
  * Implemented legal report generator under Section 65B of the Indian Evidence Act; embedded judicial seal/stamp and styled with `@media print` rules for browser printing/PDF export.
* **Tamper-Evident Audit Logs UI:** [`frontend/audit.html`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/audit.html) & [`frontend/js/audit.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/frontend/js/audit.js)
  * Searchable table displaying system actions, user IDs, action names, timestamps, and IP addresses with an XML export download trigger.

### 2. Key Responsibilities & Technical Highlights
* Designed the dynamic custody timeline rendering logic that parses timestamps, sender/receiver identities, and custody transfer notes into chronological nodes.
* Engineered print-specific CSS formatting (`@media print`) that removes navigation bars, adjusts margins, and preserves high-contrast court seal rendering for paper submission.
* Integrated the instant hash verification trigger communicating with the backend's SHA-256 verification endpoints.

### 3. Viva Voce Defense Q&A
* **Q: What is the legal significance of the Section 65B certificate in P.R.A.M.A.N?**
  * **A:** Under the Indian Evidence Act, electronic records are only admissible if accompanied by a certificate identifying the electronic device, certifying that it was in lawful control and operated properly, and proving data integrity. Our module generates this verified legal certificate with embedded hashes and timestamps.
* **Q: How does the Chain of Custody visualization work?**
  * **A:** Built a vertical CSS timeline using pseudo-elements (`::before` lines) and dynamically populated chronological DOM nodes detailing timestamp, transferring officer, receiving custodian, and mandatory legal justification.

### 4. PPT Presentation Speaking Script (1–2 Mins)
> *"Hello everyone. As Member 2, I developed the forensic verification and judicial review tier of P.R.A.M.A.N.*
> *I built the Evidence Deep Inspector that triggers live cryptographic re-hashing against the file on disk to visually flag data integrity or tampering in real time.*
> *I implemented the interactive Chain of Custody timeline, tracking every transfer from initial seizure to court submission. Finally, I built the Judicial Review Portal and the automated Section 65B Certificate Generator with print-media styling, providing courts with legally admissible electronic evidence dossiers. Thank you."*

---

# ⚙️ Team 2: Backend Development Team (50%)

### Team Architecture Overview
The Backend Team engineered an enterprise-grade RESTful API using **Node.js, Express.js, Supabase (PostgreSQL), Multer, and Node Crypto**. The backend enforces Role-Based Access Control (RBAC), multi-stage schema validation, streaming SHA-256 hashing, immutable custody auditing, and court XML export facilities.

---

## 👤 Member 3: Backend Developer A (Core Architecture, Security & Ingestion Engineer)
**Work Share:** 25% (50% of Backend Sub-team)  
**Primary Focus:** Express Server Setup, Relational Database Schema Design, JWT Authentication, RBAC Middlewares, and Evidence Ingestion Engine.

### 1. Modules & Files Developed
* **Server Bootstrap & Infrastructure:** [`backend/server.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/server.js)
  * Configured Express application, middleware pipeline (`cors`, `express.json()`, `express.urlencoded()`), static file serving for the frontend and evidence uploads directory, and global error handling.
* **Database Connection & Relational Schema:** [`backend/config/db.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/config/db.js) & [`backend/models/schema.sql`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/models/schema.sql)
  * Architected PostgreSQL relational schema on Supabase: `users`, `evidence`, `custody_logs`, and `audit_logs` tables with foreign key constraints, default timestamps, and JSONB note fields.
* **Authentication & Authorization Engine:**
  * [`backend/middleware/authMiddleware.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/middleware/authMiddleware.js): Intercepts incoming requests, validates Bearer JWT tokens, and attaches user records to `req.user`.
  * [`backend/middleware/roleMiddleware.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/middleware/roleMiddleware.js): Implemented `authorize(...roles)` higher-order middleware enforcing strict role gates (`admin`, `investigator`, `forensic`, `court_officer`).
  * [`backend/controllers/authController.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/controllers/authController.js) & [`backend/routes/authRoutes.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/routes/authRoutes.js): Login validation, password comparison using `bcryptjs` (salted hashing), and JWT generation (`jsonwebtoken`).
* **Evidence Ingestion & File Upload Subsystem:**
  * [`backend/middleware/uploadMiddleware.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/middleware/uploadMiddleware.js): Multer storage engine handling sanitized disk storage (`Date.now()` prefix), file size limits, and allowed MIME type filters.
  * [`backend/utils/generateEvidenceId.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/utils/generateEvidenceId.js): Generates formatted unique institutional tracking IDs (e.g., `EVD-2026-XXXX`).
  * [`backend/controllers/evidenceController.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/controllers/evidenceController.js) (Core ingestion): Validates file types by category, generates initial custody log, assigns initial holder, and enforces role separation.
  * [`backend/routes/evidenceRoutes.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/routes/evidenceRoutes.js): Evidence routes for upload, catalog list, download, and inline preview.
* **User Management Subsystem:** [`backend/controllers/userController.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/controllers/userController.js) & [`backend/routes/userRoutes.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/routes/userRoutes.js)
  * Endpoints to list system users, register new officers with hashed passwords, and activate/deactivate accounts.
* **Database Seeding Automation:** [`scripts/seed.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/scripts/seed.js) & [`backend/utils/seedDefaults.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/utils/seedDefaults.js)
  * Automated migration and seeding scripts creating demo users and initial sample evidence files for all 4 roles.

### 2. Key Responsibilities & Technical Highlights
* Enforced the principle of separation of duties: *System Admin is an observer for governance and cannot upload evidence directly* (only `investigator` can upload).
* Implemented secure file naming conventions to prevent directory traversal attacks or filename collisions.
* Managed relational integrity in PostgreSQL so that evidence records link to uploading officers and current custodians.

### 3. Viva Voce Defense Q&A
* **Q: Why PostgreSQL/Supabase instead of a NoSQL database like MongoDB?**
  * **A:** Chain of Custody and judicial evidence require strict ACID compliance, foreign key referential integrity, and cascading guarantees. A NoSQL database risks orphaned records or inconsistent transfer states if a custodian record is deleted or modified.
* **Q: How are credentials secured in the backend?**
  * **A:** Passwords are never stored in plain text. We utilize `bcryptjs` with 10 salt rounds to hash passwords before database storage. During authentication, `bcrypt.compare()` verifies passwords using timing-safe comparisons to prevent timing attacks.

### 4. PPT Presentation Speaking Script (1–2 Mins)
> *"Respected panel, as Member 3, I was responsible for the core backend infrastructure, database schema, and security architecture of P.R.A.M.A.N.*
> *I designed our relational database schema in PostgreSQL/Supabase, enforcing foreign keys across users, evidence, custody logs, and audit trails.*
> *I implemented JWT authentication with `bcryptjs` password hashing and engineered our Role-Based Access Control middleware to enforce strict separation of duties. Finally, I built the Multer file ingestion pipeline with sanitized storage and metadata binding. Thank you."*

---

## 👤 Member 4: Backend Developer B (Cryptography, Custody State Machine & Legal Compliance)
**Work Share:** 25% (50% of Backend Sub-team)  
**Primary Focus:** Cryptographic Stream Hashing, Custody Transfer State Machine, Judicial Court APIs, Section 65B XML Generation, and System Audit Logging.

### 1. Modules & Files Developed
* **Cryptographic Integrity Engine:** [`backend/utils/hashFile.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/utils/hashFile.js)
  * Implemented SHA-256 cryptographic hashing using Node.js `crypto.createHash('sha256')` with memory-efficient file read streams (`fs.createReadStream`) to process large evidence files without memory overflow.
* **Integrity Verification Endpoints:**
  * Implemented `verifyEvidence` in [`evidenceController.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/controllers/evidenceController.js) and `verifyCourtEvidence` in [`courtController.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/controllers/courtController.js): Reads the stored file from disk, computes a fresh SHA-256 hash, compares it with the database benchmark hash, and updates `integrityStatus` ('Verified' or 'Tampered').
* **Chain of Custody Engine:** [`backend/controllers/custodyController.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/controllers/custodyController.js) & [`backend/routes/custodyRoutes.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/routes/custodyRoutes.js)
  * Implemented atomic evidence transfer logic: verifies that the requester is the current custodian or admin, updates `currentHolder` in the `evidence` table, and creates an immutable row in `custody_logs` with sender, recipient, action (`TRANSFER`), remarks, and timestamp.
* **Court Officer Subsystem:** [`backend/controllers/courtController.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/controllers/courtController.js) & [`backend/routes/courtRoutes.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/routes/courtRoutes.js)
  * Built complete judicial lifecycle API: evidence submission to court docket, court review status changes (`Pending Court Review`, `Accepted for Court Record`, `Clarification Requested`), judicial notes, and court dashboard statistics.
* **Section 65B Legal Certificate XML & Report Generator:**
  * Implemented `exportCourtCertificateXml` using `xmlbuilder2` generating machine-readable legal certificates with case details, file metadata, hash signatures, custodian identity, and judicial timestamps.
  * Implemented `getCourtEvidenceReport` compiling the legal dossier for print/inspection.
* **Audit Subsystem & Helper:** [`backend/controllers/auditController.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/controllers/auditController.js), [`backend/routes/auditRoutes.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/routes/auditRoutes.js), and [`backend/utils/auditLogger.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/utils/auditLogger.js)
  * Created centralized asynchronous `logAudit()` utility invoked across all controllers; implemented `exportAuditLogsXml` for system security audit exports.
* **Data Population Helper & Automated API Testing:** [`backend/utils/populateHelper.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/backend/utils/populateHelper.js), [`scripts/test-api.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/scripts/test-api.js), and [`scripts/test-court-officer.js`](file:///c:/Users/KHATRI%20OM%20KUMAR/Desktop/BWP%20PROJECT/scripts/test-court-officer.js)
  * Developed relational join helper simulating foreign-key expansions in Supabase; wrote automated test suites validating all API endpoints.

### 2. Key Responsibilities & Technical Highlights
* Implemented streaming cryptographic hashing to support files of any size without blocking the Node.js event loop.
* Developed tamper-detection algorithms: if even a single byte or character in an evidence file is altered on disk, the live calculated hash diverges, immediately flagging the evidence status as `Tampered`.
* Engineered structured XML export builders compliant with e-Court digital certificate standards.

### 3. Viva Voce Defense Q&A
* **Q: Why use `fs.createReadStream` instead of `fs.readFileSync` for cryptographic hashing?**
  * **A:** `fs.readFileSync` loads the entire file into Node's V8 heap in RAM, which crashes the server with `Out of Memory` errors on large video files (100MB+). Streams process files in 64KB chunks sequentially, maintaining low, constant memory utilization regardless of file size.
* **Q: How does the custody state machine prevent unauthorized transfers?**
  * **A:** Before updating `currentHolder`, the controller checks that `req.user.id === evidence.currentHolder` (or that the user is an authorized `admin`). An unauthorized officer cannot trigger a transfer of evidence they do not physically hold.

### 4. PPT Presentation Speaking Script (1–2 Mins)
> *"Good morning. As Member 4, I engineered the cryptographic verification engine, chain of custody state machine, and judicial compliance systems.*
> *I implemented streaming SHA-256 hashing in `hashFile.js` which guarantees tamper detection without memory bottlenecks. When verification runs, the live disk file is re-hashed; any single-byte change immediately triggers a 'Tampered' alert.*
> *I developed the custody transfer API ensuring immutable custody audit logging, built the judicial endpoints for court review, and created automated Section 65B XML generators for e-Court compliance. Thank you."*

---

## 📊 Feature-to-Member Traceability Matrix

| Project Feature | Frontend Owner | Backend Owner | Key Files Involved |
| :--- | :---: | :---: | :--- |
| **Authentication & RBAC** | Member 1 | Member 3 | `auth.js`, `authController.js`, `authMiddleware.js`, `roleMiddleware.js` |
| **Evidence Ingestion & Validation** | Member 1 | Member 3 | `upload.html`, `upload.js`, `uploadMiddleware.js`, `evidenceController.js` |
| **Evidence Catalog & Search** | Member 1 | Member 3 | `evidence.html`, `evidence.js`, `evidenceRoutes.js` |
| **User Administration** | Member 1 | Member 3 | `users.html`, `users.js`, `userController.js`, `userRoutes.js` |
| **SHA-256 Hash Integrity Check** | Member 2 | Member 4 | `evidence-details.js`, `hashFile.js`, `evidenceController.js` |
| **Chain of Custody Tracking** | Member 2 | Member 4 | `custody.html`, `custody.js`, `custodyController.js`, `custodyRoutes.js` |
| **Judicial Docket & Review** | Member 2 | Member 4 | `court-review.js`, `court-dashboard.js`, `courtController.js`, `courtRoutes.js` |
| **Section 65B Legal Certificate** | Member 2 | Member 4 | `court-report.html`, `court-report.js`, `xmlbuilder2`, `courtController.js` |
| **Security Audit Logs & XML Export** | Member 2 | Member 4 | `audit.html`, `audit.js`, `auditLogger.js`, `auditController.js` |

---

## ✍️ Certificate of Equal Contribution (University Declaration Template)

```markdown
### CERTIFICATE OF EQUAL CONTRIBUTION

We, the undersigned group members for the project entitled "P.R.A.M.A.N (Portal for Recording and Managing Authentic Nodes)", hereby confirm that the system was collaboratively designed, architected, and implemented in two balanced sub-teams (Frontend & Backend).

The distribution of technical responsibilities and individual contributions is certified as follows:

1. [Member 1 Name] (Roll No: __________) — Frontend Team Lead (25%)
   Focus: Design System, UI Styling, Authentication UI, Evidence Upload & Catalog, User Management.

2. [Member 2 Name] (Roll No: __________) — Frontend Forensic & Legal UI Engineer (25%)
   Focus: Hash Verification UI, Custody Timeline, Court Review Portal, Section 65B Certificate UI, Audit UI.

3. [Member 3 Name] (Roll No: __________) — Backend Architecture & Core API Engineer (25%)
   Focus: Server Setup, Supabase DB Schema, JWT Auth, RBAC Middleware, File Uploads, Evidence Ingestion.

4. [Member 4 Name] (Roll No: __________) — Backend Cryptography & Compliance Engineer (25%)
   Focus: SHA-256 Stream Hashing, Custody Transfer Engine, Court Officer APIs, Section 65B XML Generator, Audit Logger.

Signatures of Group Members:
1. __________________      2. __________________
3. __________________      4. __________________

Project Guide / Faculty Advisor Signature: __________________
Date: __________________
```
