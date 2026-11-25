# PRD — 37V2 BOOKING LIFECYCLE & RESERVATION ENGINE
## Phase 0: Business Logic Discovery & Architecture Freeze

**Project:** 37 Music Studio (37V2)  
**Repository:** https://github.com/jangangitungapah-pixel/37V2  
**Branch baseline:** `main`  
**Phase:** 0  
**Document Status:** Draft — Requires Owner Approval  
**Date:** 25 November 2026

---

# 1. Executive Summary

Phase 0 bertujuan melakukan audit dan finalisasi arsitektur Booking Lifecycle & Reservation Engine 37V2 sebelum implementasi dimulai.

Permasalahan utama sistem saat ini adalah belum adanya pemisahan lifecycle yang konsisten antara:

1. Booking Request — permintaan client kepada studio.
2. Reservation — proses penguasaan slot dan kepastian jadwal.
3. Payment — pembayaran DP, cicilan, dan pelunasan.
4. Session — pelaksanaan sesi studio.
5. Project — pekerjaan Mix & Master atau post-production.

Sistem harus mampu menangani transaksi nyata, termasuk deposit hold, pembayaran multi-metode, perubahan booking, cancellation, refund, dan project quotation.

Phase 0 tidak mengimplementasikan source code. Output utamanya adalah spesifikasi arsitektur yang telah diaudit, memiliki keputusan bisnis yang terdokumentasi, dan siap dijadikan acuan implementasi Phase 1.

# 2. Business Objectives

Tujuan pengembangan:

- Mencegah double booking dan konflik slot.
- Memisahkan status request, reservation, payment, dan session.
- Memberikan client kontrol yang mudah atas pengajuan dan pembayaran booking.
- Memungkinkan pembayaran DP dan pelunasan menggunakan metode berbeda.
- Menjaga akurasi seluruh histori transaksi keuangan.
- Memberikan Staff/Admin kemampuan menangani pengecualian operasional.
- Menjamin perubahan booking tidak merusak histori harga atau pembayaran.
- Menyediakan refund workflow yang dapat diaudit.
- Memisahkan Mix & Master dari room reservation.
- Menjaga kompatibilitas dengan data booking dan invoice existing.

# 3. Existing System Baseline

Audit harus mengacu pada repository `main` terbaru.

Fakta existing yang wajib diperhatikan:

### 3.1 Booking Request

- Collection: `publicBookingRequests`.
- Sudah mendukung public website dan Client Portal.
- Status existing: `new`, `in_review`, `awaiting_customer`, `accepted`, `confirmed`, `declined`, `closed`.
- `Accepted` tidak sama dengan `Confirmed`.
- Accepted saat ini tidak mengunci slot.
- Konversi ke Calendar dilakukan melalui `createBooking()`.

### 3.2 Reservation & Calendar

- Collection: `bookings`.
- Slot locks: `bookingSlots`.
- Interval slot lock: 30 menit.
- Booking dan slot locks dibuat secara atomik.
- Session lifecycle saat ini menggunakan `sessionStatus`.
- Perubahan booking menggunakan optimistic concurrency/version checks.

### 3.3 Financial

- Collection: `invoices`.
- Collection: `paymentTransactions`.
- Collection: `paymentEvidence`.
- Satu booking mempunyai maksimal satu invoice deterministik.
- Payment transactions bersifat append-only.
- Pembayaran parsial dan pelunasan sudah didukung.
- Payment method yang tersedia: `cash`, `transfer`, `qris`, `other`.
- Invoice menggunakan integer Rupiah.

### 3.4 Client Payment Evidence

- Client Portal sudah memiliki upload bukti pembayaran.
- Evidence dimulai dari `pending_review`.
- Staff/Owner melakukan verifikasi.
- Verifikasi menciptakan payment transaction dan memperbarui invoice secara atomik.
- Invoice Client Portal saat ini mempunyai mandatory evidence policy.
- Generic manual payment untuk invoice Client Portal saat ini diblokir.
- Client Payment Evidence Form masih mengizinkan pilihan `cash`, sehingga terdapat ketidaksesuaian dengan keputusan Cash Policy Staff.
- Satu evidence pending saat ini menghalangi submission evidence berikutnya untuk invoice yang sama.

Hal-hal tersebut wajib menjadi objek evaluasi Phase 0.

# 4. Approved Business Decisions

Keputusan berikut sudah disetujui Owner dan tidak boleh diubah tanpa persetujuan eksplisit.

| Domain | Approved Decision |
|---|---|
| Reservation model | `deposit_hold` |
| Deposit policy | `configurable` |
| Cash policy | `staff` |
| Refund policy | `case_by_case` |
| Hold expiry | `manual_expiry` |
| Pricing changes | `adjustment` |
| Client changes | `approval` |
| Mix & Master | `project` |

### Interpretasi wajib

**Reservation: deposit_hold**
- Mendukung reservation yang menunggu pemenuhan deposit.
- Slot harus terlindungi selama hold aktif.
- Hold dan Confirmed merupakan status berbeda.

**Deposit: configurable**
- Mendukung No Deposit, Fixed Amount, dan Percentage.
- Dapat memiliki default dan override berdasarkan layanan atau paket.
- Nilai penawaran yang sudah disetujui tidak berubah ketika konfigurasi global diperbarui.

**Cash: staff**
- Client tidak dapat menyatakan pembayaran Cash sebagai pembayaran yang sudah diterima.
- Staff/Owner mencatat penerimaan tunai secara langsung.
- Cash transaction harus memiliki actor dan audit.

**Refund: case_by_case**
- Refund tidak dilakukan otomatis.
- Harus ada keputusan dan alasan.
- Refund aktual harus dibedakan dari Payment Reversal.

**Hold expiry: manual_expiry**
- Tidak menggunakan automatic scheduled expiry.
- Staff/Owner bertanggung jawab melakukan expiry/release.
- Sistem harus menyediakan informasi hold overdue agar tidak terlupakan.

**Pricing changes: adjustment**
- Harga penawaran dan invoice historis tidak boleh ditimpa diam-diam.
- Perubahan harga harus memiliki alasan, nominal, approval, dan histori.

**Client changes: approval**
- Perubahan yang diajukan client harus melalui persetujuan Staff/Admin.
- Tidak boleh langsung memutasi booking.

**Mix & Master: project**
- Tidak menggunakan booking room slots.
- Memiliki quotation, scope, milestone, deadline, revisi, dan payment lifecycle tersendiri.

# 5. Functional Requirements

## FR-01 — Independent Lifecycle Architecture

Rancang pemisahan state:

- Request status.
- Offer status.
- Reservation status.
- Payment status.
- Payment evidence status.
- Session status.
- Project status.
- Change request status.
- Refund status.

Tidak boleh ada satu status yang mewakili beberapa kondisi berbeda.

## FR-02 — Booking Request & Offer

Sistem harus mendukung:

- Client mengirim request.
- Admin melakukan review.
- Admin memeriksa availability.
- Admin menentukan jadwal, service, harga, deposit, dan deadline pembayaran.
- Admin mengirim penawaran.
- Client menerima, menolak, atau meminta perubahan.
- Setiap revisi penawaran mempunyai snapshot dan histori.
- Penawaran yang diterima harus mempunyai nilai yang immutable sebagai kesepakatan.

## FR-03 — Reservation & Slot Management

Sistem harus mendukung:

- Deposit Hold.
- Confirmed.
- Expired.
- Cancelled.
- Manual expiry.
- Hold extension.
- Atomic slot locking.
- Atomic slot release.
- Pencegahan double booking.
- Pencegahan stale updates.
- Perlindungan terhadap hold ketika payment evidence sedang menunggu verifikasi.

Pertahankan konsep slot lock existing 30 menit dan kompatibilitas booking HH:30.

## FR-04 — Deposit & Multi-Method Payment

Satu invoice harus mampu menerima beberapa transaksi pembayaran.

Contoh:

Invoice: Rp600.000.

| Transaction | Method | Amount |
|---|---|---:|
| DP | Transfer | Rp180.000 |
| Pelunasan | QRIS | Rp420.000 |
| Total | | Rp600.000 |

Ketentuan:

- Setiap pembayaran memiliki transaksi tersendiri.
- Setiap transaksi mempunyai payment method independen.
- Mixed payment wajib didukung.
- Partial payment wajib didukung.
- Full payment diperbolehkan.
- Cash hanya dapat dicatat Staff/Owner.
- Transfer dan QRIS dapat menggunakan Client Payment Evidence.
- Verifikasi tidak boleh menyebabkan double recording.
- Overpayment harus dicegah.
- Histori transaksi tidak boleh dihapus atau ditimpa.

Phase 0 harus menyelesaikan desain interaksi antara Staff Cash Recording dan mandatory Client Payment Evidence Policy.

## FR-05 — Deposit Confirmation Gate

Desain aturan:

- Reservation Hold tidak otomatis berarti Confirmed.
- Jumlah pembayaran yang sudah diterima harus dihitung dari transaksi terverifikasi.
- Minimum deposit harus menjadi parameter yang dapat diperiksa.
- Confirmation dilakukan sesuai confirmation policy yang disetujui Owner.
- No Deposit policy harus mempunyai jalur konfirmasi tersendiri.
- Full payment harus langsung memenuhi persyaratan pembayaran.

Trigger confirmation masih memerlukan keputusan Owner.

## FR-06 — Payment Evidence

Sistem harus mampu menangani:

- Upload evidence.
- Pending review.
- Verified.
- Rejected.
- Resubmission.
- Multiple installment submissions.
- Multiple payment methods.
- Evidence mismatch.
- Duplicate evidence.
- Overlapping submissions.
- Late evidence after hold expiry.
- Concurrent staff verification.

Tentukan apakah beberapa evidence pending boleh ada bersamaan untuk satu invoice, dengan perlindungan transaksi atomik.

## FR-07 — Hold Management

Sistem harus mendukung:

- Hold deadline.
- Manual extension.
- Manual expiry.
- Manual release.
- Overdue notification.
- Audit actor.
- Prevention of unauthorized release.

Tentukan hubungan antara hold expiry dan payment evidence yang sedang pending.

## FR-08 — Booking Change & Pricing Adjustment

Sistem harus mendukung:

- Reschedule.
- Change room.
- Change duration.
- Change service.
- Additional time.
- Price increase.
- Price decrease.
- Adjustment dan credit.
- Client approval.
- Admin approval.
- Slot replacement secara atomik.

Perubahan tidak boleh merusak payment history atau snapshot historis.

## FR-09 — Cancellation & Refund

Rancang:

- Client cancellation.
- Studio cancellation.
- No Show.
- Late arrival.
- Partial refund.
- Full refund.
- Refund rejection.
- Credit instead of refund.
- Refund settlement.
- Payment correction.

Bedakan secara eksplisit:
- Payment Reversal: koreksi transaksi.
- Refund: pengembalian uang aktual.

## FR-10 — Mix & Master Project

Rancang lifecycle terpisah untuk:

- Project Inquiry.
- Quotation.
- Client Approval.
- Project Deposit.
- Payment Milestones.
- Production.
- Waiting for Client Materials.
- Revision.
- Additional Scope.
- Delivery.
- Project Completion.
- Cancellation and Refund.

Project tidak boleh membuat `bookingSlots` atau booking room.

## FR-11 — Access Control & Audit

Buat permission matrix untuk:

- Owner.
- Staff.
- Client.

Setiap mutasi operasional dan finansial harus mencatat actor, waktu, alasan, dan perubahan yang dilakukan.

Client tidak boleh mengubah status pembayaran verified, reservation confirmed, atau data booking canonical secara langsung.

## FR-12 — Existing Data Compatibility

Rancang migrasi yang mempertahankan:

- Existing bookings.
- Existing booking slots.
- Existing invoices.
- Existing payment transactions.
- Existing payment evidence.
- Existing booking events.
- Existing Client Portal records.
- Existing public booking requests.

Legacy booking tidak boleh tiba-tiba dianggap deposit hold tanpa dasar data historis.

# 6. Architecture & Technology Constraints

Tetap menggunakan:

- React 19.
- Vite 8.
- JavaScript / JSX.
- Tailwind CSS v4.
- Firebase Authentication.
- Cloud Firestore.
- Firebase Hosting.
- Firebase Spark Plan.
- Cloudinary hanya untuk kebutuhan media yang sudah disetujui.

Dilarang memperkenalkan:

- Cloud Functions.
- Cloudflare Workers.
- Firebase Blaze.
- Cloud Billing.
- Firebase Storage.
- External paid backend.
- Payment gateway berbayar.
- Background scheduler berbayar.

Desain harus memperhatikan keterbatasan Firestore Security Rules, atomic transaction, query bounds, dan concurrency.

# 7. Phase 0 Required Deliverables

Antigravity wajib menghasilkan dokumen berikut:

1. `docs/prd/PRD-PHASE-0-BOOKING-LIFECYCLE-ARCHITECTURE-FREEZE.md`
   - PRD ini dalam bentuk dokumen repository.

2. `docs/architecture/BOOKING-LIFECYCLE-ENGINE-SPECIFICATION.md`
   - Penjelasan arsitektur domain.
   - End-to-end workflows.
   - Business rules.
   - Integration boundaries.

3. `docs/architecture/BOOKING-LIFECYCLE-DATA-CONTRACTS.md`
   - Proposed entities.
   - Fields.
   - Relationships.
   - Ownership.
   - Immutable snapshots.
   - Transaction boundaries.
   - Firestore security considerations.

4. `docs/architecture/BOOKING-LIFECYCLE-STATE-MACHINES.md`
   - Status definitions.
   - Allowed transitions.
   - Forbidden transitions.
   - Transition actors.
   - Failure and recovery behavior.

5. `docs/architecture/BOOKING-LIFECYCLE-MIGRATION-PLAN.md`
   - Existing data compatibility.
   - Migration sequence.
   - Legacy normalization.
   - Rollback/recovery strategy.
   - Security rule changes required in future implementation phases.

6. `docs/handoffs/HANDOFF-PHASE-0-BOOKING-LIFECYCLE-ARCHITECTURE-FREEZE.md`
   - Final handoff for the next implementation session.

# 8. Unresolved Owner Decisions

Do not silently assume answers.

Phase 0 must produce a decision matrix with available choices, consequences, risks, recommendation, and approval status.

Minimum decisions requiring evaluation:

| Decision | Options to evaluate |
|---|---|
| Reservation confirmation trigger | Verified minimum deposit / Client acceptance / Authorized staff override |
| No Deposit confirmation | Immediate after accepted offer / Manual approval |
| Hold deadline | Per booking / Configurable default with override / Fixed rule |
| Balance due deadline | Before session / At check-in / Configurable by service |
| Multiple pending evidence | One pending at a time / Multiple independent pending submissions |
| Cash on Client Portal booking | Staff-recorded transaction without client evidence / Alternative approved workflow |
| Deposit below minimum | Keep hold / Top-up deadline / Manual exception |
| Hold extension | Client request and staff approval / Staff-only |
| Evidence received after expiry | Recheck availability / Refund or credit workflow |
| Pricing decrease | Credit / Refund case / Invoice adjustment |
| Refund accounting | Separate refund record linked to original payment transactions |
| Offer revision | Supersede previous offer / Explicit withdrawal and new offer |

The three most important decisions must receive explicit Owner approval before implementation:
1. Reservation confirmation trigger.
2. Hold deadline policy.
3. Outstanding balance deadline.

Recommendations may be made by Antigravity, but recommendations are not approved decisions until the Owner confirms them.

# 9. Non-Functional Requirements

- Financial arithmetic uses integer IDR.
- All booking operations must be concurrency-safe.
- Slot locks must be deterministic.
- Critical financial mutations must be atomic.
- Payment transactions must be append-only.
- Historical snapshots must remain immutable.
- All business timestamps must have clearly defined Asia/Jakarta behavior.
- Client-readable projections must exclude internal fees and private staff data.
- Security Rules must enforce ownership and role permissions.
- All lifecycle transitions must be auditable.
- System must be recoverable from interrupted or duplicate submissions.

# 10. Out of Scope

Phase 0 does not include:

- React component implementation.
- Admin UI overhaul.
- Client Portal UI implementation.
- New booking workflows in source code.
- Firestore rules deployment.
- Data migrations.
- Firebase Hosting deployment.
- Payment gateway integrations.
- Automatic scheduled expiry.

# 11. Acceptance Criteria

Phase 0 is complete only when:

- Existing implementation has been audited against the latest `main`.
- All eight approved decisions are respected.
- All critical real-world booking scenarios are addressed.
- Four major operational lifecycles are clearly separated.
- Multi-method installment payments are designed.
- Staff-only Cash recording is explicitly addressed.
- Deposit confirmation rules are documented.
- Hold expiry behavior is documented.
- Client change approval is documented.
- Refund and Payment Reversal are distinctly modeled.
- Mix & Master project lifecycle is separated.
- Existing data compatibility is documented.
- State transition rules are explicit.
- Data contracts are sufficiently detailed for Phase 1.
- Unresolved decisions are visible and not fabricated.
- All required documents and handoff exist.
- No unapproved application source code changes have been made.

# 12. Phase 1 Entry Gate

Phase 1 may begin only after Owner review and approval of:

1. Engine Specification.
2. Data Contracts.
3. State Machines.
4. Migration Plan.
5. Outstanding Decision Log.

Phase 1 will implement only the approved Core Domain & Data Foundation.

Phase 0 must not pre-implement Phase 1 functionality.

---

**End of PRD — Phase 0**
