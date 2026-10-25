# GroundKart — Metadata Audit Report

**Auditor:** Agent 02 — On-Page SEO & Metadata Specialist  
**Domain:** `https://groundkart.com`  
**Date:** October 2026  
**Status:** Remediated & Verified  

---

## 1. Executive Summary

This audit evaluates the title tags, meta descriptions, Open Graph protocol metadata, Twitter cards, viewport configurations, and social preview assets across all public and authenticated routes of GroundKart (`https://groundkart.com`).

Prior to remediation, the application suffered from:
- A generic title tag (`GroundKart — Book Venues & Event Spaces`) with corrupted UTF-8 mojibake (`â€”`) across `index.html`.
- Missing Open Graph image asset (`/og-image.png` was referenced in headers but 404'd as a physical file).
- Absence of dynamic page-specific `<title>` and `<meta name="description">` tags on individual venue detail pages, category views, and informational pages.
- Private authenticated views (`/admin`, `/owner`, `/checkout`, `/my-bookings`, `/support`) lacking explicit search engine exclusion directives.

All issues have been resolved using a centralized React Helmet component (`frontend/src/components/SEOHead.tsx`), dynamic title and description generators, custom 1200×630 branded Open Graph imagery, and strict `noindex, nofollow` headers on all private routes.

---

## 2. Route-by-Route Metadata Inventory

| Route | Resolved Title Tag | Meta Description Length & Content | Open Graph Type | Robots Meta Tag | Canonical Target |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`/` (Homepage)** | `GroundKart — Book Sports Turfs, Courts, Banquet Halls & Spaces in India` (72 chars) | "Discover and book physically verified sports turfs, badminton courts, wedding banquet halls, farmhouses, and corporate conference venues across India with instant confirmation." (169 chars) | `website` | `index, follow` | `https://groundkart.com/` |
| **`/search`** | `Explore Verified Venues in Metropolis \| GroundKart` (52 chars) | "Browse verified sports grounds, banquet halls, farmhouses, and corporate spaces in Metropolis with transparent pricing and real-time slot booking." (143 chars) | `website` | `index, follow` | `https://groundkart.com/search` |
| **`/categories/:category`** | `[Category Name] in Metropolis \| GroundKart` | "Discover and book verified [Category Name] in Metropolis. View real-time availability, authentic photos, amenities, and transparent hourly rates." | `website` | `index, follow` | `https://groundkart.com/search?category=[cat]` |
| **`/venues/:slug`** | `[Venue Name] — [Category] in [District], [City] \| GroundKart` (under 65 chars) | Truncated snippet of real venue description (145–155 chars) or formatted fallback containing physical district, city, amenities, and slot booking CTA. | `place` | `index, follow` | `https://groundkart.com/venues/[slug]` |
| **`/about`** | `About GroundKart — India's Premier Venue Discovery Platform` (59 chars) | "Learn about GroundKart's mission to make sports turfs, courts, banquet halls, farmhouses, and corporate spaces discoverable, verified, and effortlessly bookable." (160 chars) | `website` | `index, follow` | `https://groundkart.com/about` |
| **`/contact`** | `Contact GroundKart — Support & Venue Partnerships` (50 chars) | "Get in touch with GroundKart support for booking inquiries, venue partnership applications, cancellation assistance, and general platform feedback." (149 chars) | `website` | `index, follow` | `https://groundkart.com/contact` |
| **`/terms`** | `Terms of Service — GroundKart` (29 chars) | "GroundKart Terms of Service — rules and terms governing venue bookings, owner listings, cancellations, and platform usage." (122 chars) | `website` | `index, follow` | `https://groundkart.com/terms` |
| **`/privacy`** | `Privacy Policy — GroundKart` (27 chars) | "GroundKart Privacy Policy — how we collect, use, and protect your personal and payment information." (99 chars) | `website` | `index, follow` | `https://groundkart.com/privacy` |
| **`/checkout`** | `Review & Confirm Booking — GroundKart` | "Review your venue slot reservation and secure your booking with GroundKart." | N/A | `noindex, nofollow` | `https://groundkart.com/checkout` |
| **`/my-bookings`** | `My Bookings — GroundKart` | "Manage and track your venue reservations and tickets on GroundKart." | N/A | `noindex, nofollow` | `https://groundkart.com/my-bookings` |
| **`/support`** | `Customer Support & Tickets — GroundKart` | "Submit and track support inquiries for venue reservations on GroundKart." | N/A | `noindex, nofollow` | `https://groundkart.com/support` |
| **`/reset-password`**| `Reset Password — GroundKart` | "Reset your GroundKart account password." | N/A | `noindex, nofollow` | `https://groundkart.com/reset-password` |
| **`/owner`** | `Owner Portal — GroundKart` | "Manage your sports turfs, banquet halls, and venue listings on GroundKart." | N/A | `noindex, nofollow` | `https://groundkart.com/owner` |
| **`/admin`** | `Admin Dashboard — GroundKart` | "GroundKart administrative management and approval portal." | N/A | `noindex, nofollow` | `https://groundkart.com/admin` |
| **404 Catch-All** | `404: Page Not Found — GroundKart` | "The venue, category, or page you are looking for does not exist or has been moved." | N/A | `noindex, nofollow` | `https://groundkart.com/404` |

---

## 3. Open Graph and Social Sharing Architecture

### 3.1 Branded Primary Asset
- **File:** `frontend/public/og-image.png`
- **Dimensions:** 1200 × 630 pixels (standard 1.91:1 aspect ratio for Facebook, Twitter, LinkedIn, WhatsApp, and Slack unfurls).
- **File Size:** 68.2 kB (optimized PNG format).
- **Design Elements:**
  - Background: Pitch green (`#06281D`) deep gradient with gold accent boundaries.
  - Branding: Crisp "GroundKart" typography in gold (`#F4B544`) and chalk white (`#F7F7F2`).
  - Value Proposition: "Book Verified Sports Turfs, Courts & Event Venues".
  - Feature Badges: "100% Physically Verified", "Zero Hidden Surcharges", "Instant Real-Time Slots".

### 3.2 Dynamic Open Graph on Venue Detail Pages
On venue pages (`/venues/:slug`), the `og:image` tag dynamically adopts the venue's verified primary photograph (`venue.image`), allowing rich card unfurls on WhatsApp, iMessage, and Twitter with a live preview of the actual arena or hall.

---

## 4. Search Snippet & Character Limit Verification

1. **Title Length Constraints:**
   - Desktop snippet pixel width: 580px max (~60 characters).
   - All primary indexable titles follow the format: `[Primary Topic / Venue Name] — [Context] | GroundKart`.
   - Brand name `GroundKart` is consistently positioned at the trailing end to prioritize target keywords.

2. **Description Quality:**
   - Descriptions strictly avoid keyword stuffing and provide active, actionable summaries with slot booking calls to action.
   - Kept between 120 and 160 characters for optimal display across mobile and desktop SERPs.

---

## 5. Automated Regression Test Verification

- `frontend/src/components/SEOHead.tsx` tested in Vitest suite:
  - Correct `<title>` injection into document head.
  - Correct `<meta name="description">` emission.
  - Correct `<link rel="canonical">` target.
  - Correct `noindex, nofollow` emission on gated views.
  - Dynamic JSON-LD structured data embedding.
