# GroundKart — Google Search Console Setup & Indexing Diagnostics

**Auditor:** Agent 08 — Google Search Console & Indexing Specialist  
**Domain:** `https://groundkart.com`  
**Date:** October 2026  
**Status:** Verification Protocol Prepared & Diagnostics Documented  

---

## 1. Operating Principle & Access Disclosure

> [!IMPORTANT]
> **Adherence to Operating Principle 11 & 18:**  
> Google Search Console property ownership verification requires external administrative credentials (DNS TXT record insertion at the registrar or DNS hosting provider, or authenticated Google Workspace / Google Analytics binding).  
> In accordance with our engineering integrity standards, we **do not** fabricate Search Console property verification, invent simulated crawl counts, or report artificial impression telemetry. This document provides the concrete operational protocol for the GroundKart site owner to claim and monitor the property.

---

## 2. Recommended Verification Method: Domain Property (DNS TXT)

Domain-level verification is strongly recommended over URL-prefix verification because it unifies data across all subdomains (`www`, bare domain, and staging environments) and protocols (`http://` and `https://`).

### Step-by-Step DNS Verification Protocol:
1. Log into Google Search Console (`https://search.google.com/search-console`).
2. Select **Add Property** and choose **Domain** (not URL prefix).
3. Enter `groundkart.com`.
4. Copy the unique Google TXT verification string provided (format: `google-site-verification=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`).
5. In the DNS management console for `groundkart.com` (e.g., Cloudflare, Route 53, GoDaddy, or Namecheap), create a DNS record:
   - **Type:** `TXT`
   - **Name / Host:** `@` (or `groundkart.com.`)
   - **Value:** `google-site-verification=[copied-string]`
   - **TTL:** `Auto` (or `300` seconds)
6. Return to Google Search Console and click **Verify**.

### Alternative Verification: HTML Meta Tag Fallback
If DNS management access is delayed, the site owner may inject the Google verification token into `frontend/index.html` within `<head>`:

```html
<meta name="google-site-verification" content="INSERT_VERIFICATION_TOKEN_HERE" />
```

---

## 3. Sitemap Submission Procedure

Once domain ownership is verified:
1. Navigate to **Sitemaps** under the **Indexing** section in the left navigation sidebar.
2. Under "Add a new sitemap", input the relative path:
   `sitemap.xml` (Full target: `https://groundkart.com/sitemap.xml`).
3. Click **Submit**.
4. **Expected Response:** Status `Success`, Discovered URLs count matching the total active indexable venues in PostgreSQL (currently 12 active venues + 6 core public pages = 18 URLs).

---

## 4. URL Inspection & Live Test Diagnostics

Use the URL Inspection Tool on key representative URLs:

| URL Tested | Expected Canonical (Declared) | Expected Canonical (Google-selected) | Expected Indexing State |
| :--- | :--- | :--- | :--- |
| `https://groundkart.com/` | `https://groundkart.com/` | `https://groundkart.com/` | Submitted and indexed |
| `https://groundkart.com/search` | `https://groundkart.com/search` | `https://groundkart.com/search` | Submitted and indexed |
| `https://groundkart.com/venues/grand-turf-arena` | `https://groundkart.com/venues/grand-turf-arena` | `https://groundkart.com/venues/grand-turf-arena` | Submitted and indexed |
| `https://groundkart.com/about` | `https://groundkart.com/about` | `https://groundkart.com/about` | Submitted and indexed |
| `https://groundkart.com/checkout` | `https://groundkart.com/checkout` | N/A | Excluded by 'noindex' tag |
| `https://groundkart.com/admin` | `https://groundkart.com/admin` | N/A | Excluded by 'noindex' tag |

### Live Test Diagnostic Steps:
- Click **Test Live URL**.
- Inspect **View Tested Page** > **Screenshot**: Verify that client-rendered React venue titles, pricing, and images render fully without blank canvases (verifies that Googlebot WRS executes client-side API requests).
- Verify **HTTP Response:** `200 OK`.
- Verify **Rich Results Tab:** "SportsActivityLocation", "WebSite", and "Breadcrumbs" detected without errors.

---

## 5. Indexing Report Monitoring & Triage Playbook

| GSC Status Category | Root Cause in SPA Architecture | Remediation Action |
| :--- | :--- | :--- |
| **Discovered – currently not indexed** | Googlebot found the link in sitemap/page but has not scheduled crawl due to crawl budget or low site authority. | Build internal links from high-traffic pages (homepage featured arena); ensure XML sitemap is fresh. |
| **Crawled – currently not indexed** | Googlebot rendered the page but deemed content thin or duplicative. | Verify venue description is unique (>150 words); confirm real photos and amenities are visible. |
| **Excluded by 'noindex' tag** | Intentionally blocked from indexing. | Expected for `/admin`, `/owner`, `/checkout`, `/my-bookings`, `/support`, `/reset-password`. If public venue appears here, remove unintended `noindex` prop. |
| **Duplicate without user-selected canonical** | Multiple query parameters pointing to same content. | Ensure `<link rel="canonical">` points strictly to the clean parameterized URL or root archive. |
| **Soft 404** | Client returns a blank or "not found" page with a `200 OK` HTTP status without `noindex`. | Our `NotFound.tsx` component automatically emits `noindex={true}`, eliminating soft 404 classification. |

---

## 6. Core Web Vitals & Page Experience Monitoring

Monitor the **Core Web Vitals** tab in Search Console:
- Field data will populate after 28 days of real Chrome user telemetry.
- Group URLs by template: `Homepage`, `Search/Category`, and `Venue Detail`.
- Alert threshold: Any URL group exceeding 2.5s LCP or 0.1 CLS must be flagged for image compression or asset code-splitting remediation.
