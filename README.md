# P.R.A.M.A.N
### Portal for Recording and Managing Authentic Nodes
**Digital Evidence Management & Cryptographic Chain of Custody System**

---

> **Academic Prototype Notice:**  
> P.R.A.M.A.N is an educational college BWP prototype designed to demonstrate cryptographic file hashing (FIPS 180-4 SHA-256), digital evidence integrity verification, append-only chain of custody logs, role-based access control (RBAC), and regulatory audit trail export. It is not intended as a legally certified or enterprise-grade forensics solution.

---

## 1. Key Features

- **Automated SHA-256 Ingestion Hashing:** Calculates cryptographic SHA-256 hashes using Node.js stream processing upon upload, preventing high RAM overhead.
- **On-Demand Integrity Verification:** Re-computes the physical file hash and compares it directly against the baseline reference hash to immediately flag file alterations or tampering.
- **Append-Only Chain of Custody:** Tracks every lifecycle event (`UPLOADED`, `ASSIGNED`, `TRANSFERRED`, `VERIFIED`, `STATUS_CHANGED`, `NOTE_ADDED`) in a chronological vertical timeline.
- **Role-Based Access Control (RBAC):** Strict backend enforcement for four distinct operational roles:
  - **System Admin:** Global read-only governance and oversight, user provisioning, security audit logs, XML export. Strict zero-access to evidence ingestion or modification.
  - **Investigation Officer:** Evidence ingestion, generating SHA-256 hashes, custody routing to Forensics or Court.
  - **Forensic Expert:** Technical verification, lab notes. Localized "Need-to-Know" visibility (only sees assigned/routed evidence).
  - **Court Officer:** Judicial chamber endpoint for uneditable custody review, verification, and Section 65B XML certificate export.
- **Security Audit Logging & XML Export:** Automated auditing of security events (`LOGIN_SUCCESS`, `EVIDENCE_VERIFIED`, etc.) with one-click export to safe XML.
- **Modern Forensic Theme:** Professional Dark Navy (`#081330`) and crisp slate white surface design with status badges and monospace hash displays.

---

## 2. Tech Stack

- **Frontend:** HTML5, CSS3 (Vanilla design tokens, responsive layout), Vanilla JavaScript (ES6+), Fetch API.
- **Backend:** Node.js, Express.js (RESTful API architecture).
- **Database:** Supabase (PostgreSQL) via `@supabase/supabase-js`.
- **Authentication:** Supabase Auth (or custom JWT) + Role-based middleware.
- **File Uploads:** Multer with file type/MIME inspection and filename sanitization.
- **Hashing:** Node.js native `crypto` module (Streaming SHA-256).
- **XML Generation:** `xmlbuilder2` for safe, well-formed XML exports.

---

## 3. Project Structure

```
praman/
├── frontend/
│   ├── index.html               # Authentication & login portal
│   ├── dashboard.html           # Metrics, counters, and recent activity
│   ├── evidence.html            # Evidence vault catalog with search & filters
│   ├── evidence-details.html    # Full dossier, hash check & custody actions
│   ├── upload.html              # Evidence ingestion form with file upload
│   ├── custody.html             # Vertical chain of custody visualizer
│   ├── audit.html               # System security audit trail & XML export
│   ├── users.html               # Admin user management & access controls
│   ├── css/
│   │   └── style.css            # Forensic Navy & slate design system
│   └── js/
│       ├── api.js               # Centralized API fetch client & toasts
│       ├── auth.js              # Token management & RBAC navbar controller
│       ├── dashboard.js         # Dashboard stats & widget logic
│       ├── evidence.js          # Search, filter, and catalog logic
│       ├── evidence-details.js  # Verification modal & hash comparison
│       ├── upload.js            # Multipart file ingestion controller
│       ├── custody.js           # Vertical timeline renderer
│       ├── audit.js             # Audit table & XML download trigger
│       └── users.js             # User provisioning and status toggle
│
├── backend/
│   ├── server.js                # Express app entry point & static server
│   ├── config/
│   │   └── db.js                # Supabase client initialization
│   ├── models/
│   │   └── schema.sql           # PostgreSQL database schema & tables
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── evidenceController.js
│   │   ├── custodyController.js
│   │   ├── auditController.js
│   │   ├── userController.js
│   │   └── dashboardController.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── evidenceRoutes.js
│   │   ├── custodyRoutes.js
│   │   ├── auditRoutes.js
│   │   ├── userRoutes.js
│   │   └── dashboardRoutes.js
│   ├── middleware/
│   │   ├── authMiddleware.js    # JWT Bearer token authentication
│   │   ├── roleMiddleware.js    # Role-based authorization guard
│   │   ├── uploadMiddleware.js  # Multer configuration & MIME validation
│   │   └── errorMiddleware.js   # Centralized error handler
│   ├── utils/
│   │   ├── hashFile.js          # Streaming SHA-256 calculation
│   │   ├── generateEvidenceId.js# Human-readable sequential ID generator
│   │   └── auditLogger.js       # Reusable audit logging utility
│   └── uploads/                 # Secure storage for uploaded evidence files
│
├── scripts/
│   └── seed.js                  # Database seeding script with demo records
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 4. Installation & Setup

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **Supabase Account** (Project URL and Anon Key required for PostgreSQL database)

### Step 1: Install Dependencies
Open a terminal in the `praman` directory:
```bash
cd praman
npm install
```

### Step 2: Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default `.env` contents:
```ini
PORT=5000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
JWT_SECRET=praman_super_secret_jwt_key_2026_forensics
NODE_ENV=development
```

### Step 3: Seed Database
Populate the database with demo accounts, a pre-hashed sample evidence file, and initial audit logs:
```bash
npm run seed
```

### Step 4: Run Application
Start the unified full-stack server:
```bash
npm start
# OR for automatic reload during development:
npm run dev
```

The application will be accessible at:
👉 **http://localhost:5000**

---

## 5. Demo Credentials

The login page features **one-click autofill buttons** for rapid presentation:

| Role | Email | Password | Allowed Capabilities |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@praman.com` | `Admin@123` | Global read-only governance, Audit trail, XML export, User management (Cannot upload evidence) |
| **Investigator** | `investigator@praman.com` | `Investigator@123` | Evidence ingestion (upload), Evidence routing, Custody transfers, Notes |
| **Forensic Officer** | `forensic@praman.com` | `Forensic@123` | Assigned evidence view, Cryptographic verification, Lab notes |
| **Court Officer** | `court@praman.com` | `Court@123` | Court evidence review, SHA-256 verification, Custody audit, Notes, Acceptance, Clarification requests, Reports |

---

## 6. Main Demo Scenario (Evaluator Workflow)

Follow this 8-step sequence to demonstrate all core project criteria:

1. **Step 1 — Login as Administrator**:
   - Go to `http://localhost:5000` and click the **Admin** autofill button.
   - Click **Secure System Access**. View the Dashboard with real-time stats cards.
2. **Step 2 — User Provisioning**:
   - Open **User Management** in the sidebar.
   - Click **+ Add Authorized User**, create a new officer, and observe role assignment.
3. **Step 3 — Login as Investigator**:
   - Log out and log in as `investigator@praman.com`.
   - Notice that administrative tabs (**Audit Logs**, **User Management**) are automatically hidden.
4. **Step 4 — Evidence Ingestion**:
   - Navigate to **Upload Evidence**.
   - Fill in Title: `"Disk Capture #4"`, Case: `"CR-2026-9042"`, Category: `"Document"`, and select a sample file.
   - Click **Ingest & Generate SHA-256**.
   - Notice the generated ID (e.g. `EV-2026-0002`) and immediate redirect to the evidence details page.
5. **Step 5 — Cryptographic Verification**:
   - Click **Verify Integrity**.
   - The server streams the stored file, calculates SHA-256, matches it against the stored baseline, and displays **Cryptographic Hash Verification: PASSED**.
6. **Step 6 — Chain of Custody Transfer**:
   - Click **Transfer Custody**, select `Dr. Sarah Lin (Forensic Officer)`, add transfer remarks, and confirm.
   - Observe the updated custodian.
7. **Step 7 — Forensic Review**:
   - Log in as `forensic@praman.com`.
   - Open **Chain of Custody** to view the vertical timeline showing Ingestion -> Verification -> Transfer.
   - Click **Add Note** to record a forensic laboratory observation.
8. **Step 8 — Audit Inspection & XML Export**:
   - Log back in as `admin@praman.com`.
   - Navigate to **Audit Logs**. All events (`EVIDENCE_UPLOADED`, `EVIDENCE_VERIFIED`, `EVIDENCE_TRANSFERRED`) are tracked.
   - Click **Export Audit Trail (XML)** to download `praman-audit-logs.xml`.

---

## 7. REST API Overview

### Authentication
- `POST /api/auth/login` — Authenticate user and issue JWT
- `POST /api/auth/register` — Register account (setup helper)
- `GET /api/auth/me` — Retrieve current session profile
- `POST /api/auth/logout` — Revoke and record logout event

### Digital Evidence
- `GET /api/evidence` — Filter, search & paginate evidence catalog
- `POST /api/evidence` — Multipart file upload, stream SHA-256 calculation
- `GET /api/evidence/:id` — Full evidence metadata & forensic notes
- `POST /api/evidence/:id/verify` — Recompute SHA-256 & verify integrity
- `POST /api/evidence/:id/notes` — Append forensic observation
- `PATCH /api/evidence/:id/status` — Modify review or intake status
- `GET /api/evidence/:id/download` — Download original stored evidence file

### Chain of Custody
- `GET /api/custody/:evidenceId` — Get complete chronological lifecycle timeline
- `POST /api/custody/transfer` — Record custodial handover to authorized officer

### Audit Trail & Export
- `GET /api/audit` — Paginated and filtered security ledger (Admin only)
- `GET /api/audit/export/xml` — Downloadable XML export of audit trail (Admin only)

### User Administration
- `GET /api/users` — Directory of registered officers
- `POST /api/users` — Provision new user account (Admin only)
- `PATCH /api/users/:id/status` — Deactivate or reactivate an account (Admin only)

### Judicial Review & Court Officer
- `GET /api/court/stats` — Metrics and counts for court-admitted evidence
- `GET /api/court/evidence` — List authorized exhibits submitted to court
- `GET /api/court/evidence/:id` — Full court evidence review dossier (Enforces 403 on unauthorized items)
- `POST /api/court/evidence/:id/verify` — Independent judicial SHA-256 integrity verification
- `POST /api/court/evidence/:id/notes` — Record court-specific review observation (`noteType: 'court'`)
- `POST /api/court/evidence/:id/accept` — Formally accept exhibit for official court record
- `POST /api/court/evidence/:id/clarification` — Request evidentiary clarification (requires non-empty reason)
- `POST /api/court/evidence/:id/start-review` — Mark exhibit Under Court Review
- `GET /api/court/evidence/:id/report` — Comprehensive judicial review report data
- `GET /api/court/audit` — Security and review audit log for court-admitted evidence
- `POST /api/court/submit/:id` — Submit/docket evidence for judicial review (Investigator, Forensic, Admin)

### Dashboard
- `GET /api/dashboard/stats` — Aggregated counts, categories, and recent logs

---

## 8. Security Considerations

- **Password Storage:** Salted and hashed using `bcryptjs` with work factor 10.
- **Stateless Tokens:** Signed JWT tokens with 12-hour expiration.
- **Defense in Depth:** Both frontend and backend validate roles; API routes cannot be bypassed by client manipulation.
- **Reference Hash Immutability:** The original `sha256Hash` is set at intake and is never modified during verification.
- **Safe XML Generation:** Programmatic XML building with `xmlbuilder2` prevents XML injection.
