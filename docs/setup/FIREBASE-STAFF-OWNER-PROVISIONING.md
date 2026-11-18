# 37 Music Studio — Manual Staff & Owner Account Provisioning Guide

**Phase:** 3 — Staff & Owner Authentication  
**Date:** 18 November 2026  
**Firebase Project ID:** `studio37classic`

---

## 1. Purpose

37 Music Studio deliberately does **not** allow public registration on `/staff/login`. Users cannot sign up on their own or choose a role from the login screen.

All **Owner** and **Staff** accounts are provisioned manually by the Studio Owner in Firebase Console. This guide walks through every step required to set up the Firebase project prerequisites, create Owner and Staff accounts, and deactivate accounts when needed.

---

## 2. Firebase Console Prerequisites Checklist

Before testing `/staff/login`, complete these prerequisites in [Firebase Console](https://console.firebase.google.com/):

1. **Open Project:** Sign in to Firebase Console and open project **`studio37classic`**.
2. **Enable Authentication:**
   - In the left sidebar, go to **Build → Authentication**.
   - Click **Get started** (if Authentication is not initialized yet).
   - Open the **Sign-in method** tab.
   - Click **Email/Password**, toggle **Enable** ON (leave "Email link (passwordless sign-in)" OFF), and click **Save**.
3. **Verify Authorized Domains:**
   - Go to **Authentication → Settings → Authorized domains**.
   - Confirm `localhost`, `studio37classic.firebaseapp.com`, and `studio37-os.web.app` (plus your custom domain when ready) are listed.
   - Note: If you run the local dev server on `http://127.0.0.1:5173`, either open `http://localhost:5173` or add `127.0.0.1` to Authorized domains.
4. **Create Default Cloud Firestore Database:**
   - Go to **Build → Firestore Database**.
   - If no database exists yet, click **Create database**, keep the `(default)` database ID, choose your preferred region (e.g., `asia-southeast2` Jakarta or `asia-southeast1` Singapore), and start in **Production mode**.
5. **Publish Firestore Security Rules:**
   - Open **Firestore Database → Rules**.
   - Paste the contents of [`firestore.rules`](../../firestore.rules) and click **Publish**.

---

## 3. Initial Owner Account Setup

Follow these steps to create the Studio Owner account:

1. In Firebase Console (`studio37classic`), open **Build → Authentication → Users**.
2. Click **Add user**.
3. Enter the Owner's **Email** and a strong **Password**, then click **Add user**.
4. In the Users table, locate the new row and click the copy icon next to **User UID** (for example, `k9xP2mQ...`).
5. Open **Build → Firestore Database → Data**.
6. Click **+ Start collection** (or open `staffProfiles` if it already exists):
   - **Collection ID:** `staffProfiles`
7. Create the Owner's profile document:
   - **Document ID:** Paste the exact **User UID** copied in step 4.
   - Add the following 5 fields with their exact types:

| Field Name    | Field Type  | Value                                                   |
| ------------- | ----------- | ------------------------------------------------------- |
| `displayName` | `string`    | `Studio Owner` _(replace with actual name)_             |
| `email`       | `string`    | `owner@example.com` _(replace with actual owner email)_ |
| `role`        | `string`    | `owner` _(lowercase)_                                   |
| `active`      | `boolean`   | `true`                                                  |
| `createdAt`   | `timestamp` | Select current date and time                            |

8. Click **Save**.

---

## 4. Staff Account Setup

Repeat the same process for each staff member:

1. Go to **Authentication → Users** and click **Add user**.
2. Enter the staff member's **Email** and initial **Password**, then click **Add user**.
3. Copy the generated **User UID**.
4. Go to **Firestore Database → Data → `staffProfiles`** and click **+ Add document**.
5. Paste the staff member's **User UID** as the **Document ID**.
6. Add the 5 required fields:

| Field Name    | Field Type  | Value                                                     |
| ------------- | ----------- | --------------------------------------------------------- |
| `displayName` | `string`    | `Studio Staff` _(replace with staff member's name)_       |
| `email`       | `string`    | `staff@example.com` _(replace with staff member's email)_ |
| `role`        | `string`    | `staff` _(lowercase)_                                     |
| `active`      | `boolean`   | `true`                                                    |
| `createdAt`   | `timestamp` | Select current date and time                              |

7. Click **Save**.

> **Important:** `role` is case-sensitive and must be either `"owner"` or `"staff"`. Any other value will be rejected by the application.

---

## 5. How to Deactivate or Reactivate a Staff Account

To revoke a staff member's access without deleting historical records:

1. Open **Firestore Database → Data → `staffProfiles`**.
2. Select the staff member's document (`{uid}`).
3. Change `active` from `true` to `false` and save.

**What happens in the app:**

- If the staff member tries to sign in at `/staff/login`, the app detects `active === false`, immediately signs them out of Firebase Auth, and displays `"Account inactive."`
- If the staff member already had `/admin` open, refreshing the page re-checks `staffProfiles/{uid}`, signs them out, and redirects them back to `/staff/login`.

For immediate login blocking at the Firebase Auth layer as well, you can also open **Authentication → Users**, click the three-dot menu on that user, and select **Disable account**.

---

## 6. How to Test Login Locally (Smoke-Test Checklist)

1. Ensure `.env.local` exists in the project root with the `studio37classic` web configuration.
2. Start the local dev server:
   ```powershell
   npm run dev
   ```
3. Open `http://localhost:5173/`.
4. Click **`Client Login`** in the top header and verify the **"Client Login Coming Soon"** dialog opens (does not navigate to `/staff/login`).
5. Scroll to the footer and click **`Staff / Owner Login`** to open `/staff/login`.
6. Sign in with your provisioned Owner or Staff account:
   - Verify you are redirected to `/admin`.
   - Verify your actual `displayName`, `email`, and `OWNER` / `STAFF` role badge are displayed.
7. Refresh `/admin` in the browser and verify your session is restored automatically.
8. Click **Sign Out** and verify you are signed out and redirected away from `/admin`.
9. Try opening `http://localhost:5173/admin` while signed out and verify you are redirected to `/staff/login`.
