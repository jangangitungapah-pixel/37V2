# CLOUDINARY PAYMENT EVIDENCE SETUP GUIDE

## Dedicated Unsigned Upload Preset for Payment Evidence & Verification v1

37 Music Studio (`37V2`) uses **direct unsigned image uploads** from the browser to Cloudinary for payment proof receipts. To preserve the Firebase Spark-only architecture and keep payment receipts isolated from Studio Gallery media, payment evidence **MUST** use its own dedicated Cloudinary upload preset (`VITE_CLOUDINARY_PAYMENT_UPLOAD_PRESET`).

> **Important Security Notice:** Uploaded payment proof images are served via **public Cloudinary delivery URLs**. Anyone who possesses the exact URL can open the image. Firestore Security Rules protect Firestore `paymentEvidence` metadata documents, **not** Cloudinary delivery URLs. Mitigate exposure by using random non-identifying public IDs, isolating the upload folder/preset, and reminding users not to expose sensitive credentials or card details in screenshots.

---

## 1. Create the Dedicated Unsigned Upload Preset in Cloudinary

1. Sign in to the [Cloudinary Console](https://console.cloudinary.com/).
2. Navigate to **Settings** -> **Upload** -> **Upload presets**.
3. Click **Add upload preset**.
4. Configure the preset with these exact recommended settings:
   - **Upload preset name:** `37payment-evidence`
   - **Signing Mode:** `Unsigned`
   - **Asset folder:** `37music/payment-evidence` (separate from Gallery folder)
   - **Public ID / Naming:**
     - **Use filename or externally defined Public ID:** `Off` (recommended, or `On` with **Unique filename: `On`** — the app already sends randomized `pe_<random>.<ext>` filenames with zero customer PII)
     - **Overwrite:** `Off`
   - **Upload Manipulations / Incoming Restrictions (recommended):**
     - **Allowed formats:** `jpg, jpeg, png, webp`
     - **Max file size:** `5 MB` (`5242880` bytes)
     - **Resource type:** `Image`
5. Click **Save**.

---

## 2. Configure Environment Variables

Add the following variables to your local `.env.local` (and your production hosting build environment):

```dotenv
VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
VITE_CLOUDINARY_PAYMENT_UPLOAD_PRESET=37payment-evidence
```

Keep your existing Studio Gallery preset separate:

```dotenv
VITE_CLOUDINARY_UPLOAD_PRESET=37gallery
```

### Strict Rules
- **NEVER** put `CLOUDINARY_API_SECRET`, `CLOUDINARY_API_KEY`, or signing secrets into any `VITE_*` variable or frontend source file.
- The Payment Evidence upload module **explicitly refuses to fall back** to `VITE_CLOUDINARY_UPLOAD_PRESET` (`37gallery`). If `VITE_CLOUDINARY_PAYMENT_UPLOAD_PRESET` is unset, payment proof upload fails gracefully with a clear configuration notice while Studio Gallery continues working normally.

---

## 3. Restart & Verify

1. Restart the Vite dev server (`npm run dev`) or rebuild (`npm run build`) after updating `.env.local`.
2. Sign in as a **Client** with an issued Client Portal invoice (`clientPaymentEvidenceRequired: true`, `balanceDue > 0`), open **Invoices & Payments -> View Details**, and confirm:
   - The **Payment Proof & Verification** section renders with the privacy notice.
   - Selecting a JPG/PNG/WEBP image under 5 MB previews locally and uploads to `https://api.cloudinary.com/v1_1/<cloudName>/image/upload` using `upload_preset=37payment-evidence`.
   - The uploaded filename is randomized (`pe_<random>.<ext>`) with zero customer name, phone number, or invoice number.
   - The resulting record appears in **Admin Portal -> Payment and Bill -> Payment Evidence** with a working image preview and **Buka Gambar Asli** link.
3. Verify **Admin Portal** optional upload:
   - In **Record Payment** (`Catat Pembayaran`) on an Admin-managed invoice, verify a **Cash** payment without any image still completes without error, and a payment with an optional image attaches cleanly (`status: 'attached'`).

---

## 4. Troubleshooting

| Symptom | Cause | Resolution |
|---|---|---|
| `"Payment proof upload is not configured yet"` | `VITE_CLOUDINARY_CLOUD_NAME` or `VITE_CLOUDINARY_PAYMENT_UPLOAD_PRESET` is missing | Set both env vars in `.env.local` and restart Vite / rebuild |
| `"Upload preset must be whitelisted for unsigned uploads"` | Preset was created in `Signed` mode | Change preset `37payment-evidence` Signing Mode to `Unsigned` in Cloudinary Console |
| `"Unsupported format"` | User selected PDF, SVG, AVIF, HEIC, or GIF | Convert or take a JPG, PNG, or WEBP screenshot (max 5 MB) |
| Firestore save fails after image upload | Temporary network outage or stale invoice state | Click Submit again — the app preserves the uploaded Cloudinary metadata in session state and retries Firestore without re-uploading a duplicate image |
