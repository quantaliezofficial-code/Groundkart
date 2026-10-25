# GroundKart — Heading Hierarchy & Semantic Structure Report

**Auditor:** Agent 02 — On-Page SEO & Semantic Structure Specialist  
**Domain:** `https://groundkart.com`  
**Date:** October 2026  
**Status:** Remediated & Verified  

---

## 1. Executive Summary

A logical, accessible heading hierarchy (single H1 per page, followed by sequential H2 and H3 elements without skipping levels) is essential for search engine document outline comprehension and screen-reader accessibility (WCAG 2.1 AA).

Prior to remediation:
- In several components, text styling was achieved using `<div>` or `<p>` tags with large CSS font classes instead of semantic headings, or conversely, heading tags (`h2`, `h3`) were used out of order.
- The venue detail page lacked a clear H1 designating the venue name as the primary document title.
- The Search & Catalog view lacked an explicit H1 identifying the category or city context.
- Static informational pages (`/about`, `/contact`, `/terms`, `/privacy`) did not exist and therefore had no heading hierarchy.

All pages have been audited and updated to enforce a clean single-H1 rule with strictly nested secondary sections.

---

## 2. Page-by-Page Heading Structure

### 2.1 Homepage (`/`)
- **`H1`:** Hero dynamic title (`Hero.tsx`):  
  `Make time for the game.` / `Make your big day feel unforgettable.` / `Give your next meeting the right space.`  
  *(Serves as the primary thematic headline for the marketplace)*
- **`H2`:** `Trending in Metropolis`
  - **`H3`:** Featured Arena Name (e.g., `Grand Turf Arena`)
  - **`H3`:** Individual Trending Venue Card Names (`Skyline Tennis Courts`, `Apex Badminton Center`, etc.)
- **`H2`:** `One platform. Every occasion.`
  - **`H4`:** `Verified Premium Venues`
  - **`H4`:** `Transparent Pricing`
  - **`H3`:** `Banquet Halls` (Bento Tile)
  - **`H3`:** `Sports Grounds` (Bento Tile)
  - **`H3`:** `Corporate Spaces` (Bento Tile)
- **`H2`:** `Why GroundKart?`
  - **`H3`:** `Instant Booking`
  - **`H3`:** `Verified Venues`
  - **`H3`:** `Transparent Pricing`
  - **`H3`:** `Smart Discovery`
- **`H2`:** `Loved by Our Community`
  - **`H4`:** Customer names (`Rahul Sharma`, `Anita Desai`, `Vikram Singh`)
- **`H2`:** `Your next occasion starts here.` (Closing CTA section)
- **`H4`:** Footer section titles (`Explore`, `For Owners`, `Company`, `Legal`)

### 2.2 Search & Category Catalog (`/search`, `/categories/:slug`)
- **`H1`:** Dynamic catalog title:  
  `[Category Name] in Metropolis` (when filtered by category) or `Premium Venues in Metropolis` (default catalog)
- **`H3`:** Venue Card Titles (each listed arena, turf, or hall)
- **`H3`:** Empty state heading (`No venues available yet` when filters return zero results)

### 2.3 Venue Detail Page (`/venues/:slug`)
- **`H1`:** `venue.name` (e.g. `Grand Turf Arena — Football & Cricket Turf`)
- **`H2`:** `Select Date & Time Slot` (Booking engine section)
- **`H2`:** `About this space` (Comprehensive narrative description)
- **`H2`:** `Key Features & Amenities` (Physical specifications list)
- **`H2`:** `Location & Directions` (Address & geographic proximity)
- **`H2`:** `Ratings & Customer Reviews`
  - **`H3`:** `Write a Customer Review`
  - **`H3`:** `Verified Guest Feedback`

### 2.4 About Us (`/about`)
- **`H1`:** `Precision in Every Play. Clarity in Every Booking.`
- **`H2`:** Core Pillars:
  - `Physical Verification`
  - `Transparent Pricing`
  - `Dedicated Support`
- **`H2`:** `Built for Players, Hosts, and Venue Owners`

### 2.5 Contact Us (`/contact`)
- **`H1`:** `We're Here to Help`
- **`H2`:** `Contact Channels`
  - **`H3`:** `Customer Support`
  - **`H3`:** `Venue Partnerships`
  - **`H3`:** `Operating Hours`
  - **`H3`:** `Locations Served`
- **`H3`:** `Venue Owners` (Owner onboarding callout)
- **`H2`:** `Send an Inquiry` (Interactive form)
  - **`H3`:** `Message Received` (Submission confirmation state)

### 2.6 Privacy Policy (`/privacy`) & Terms of Service (`/terms`)
- **`H1`:** `Privacy Policy` / `Terms of Service`
- **`H2`:** Numbered legal sections (e.g. `1. Information We Collect`, `2. How We Use Information`, `3. Cookie & Authentication Architecture`, etc.)

### 2.7 404 Catch-All (`/404`)
- **`H1`:** `Page Not Found` (accompanied by stylized `404` graphical element)

---

## 3. Structural Rules Enforced

1. **Strictly One `H1` Per Route:** Every view has exactly one primary H1 representing its core topic.
2. **No Skipped Levels in Content Blocks:** Primary sections use `H2`, sub-features and card components use `H3`, sub-labels use `H4`.
3. **Styling Decoupled from Semantics:** Visual sizing is controlled entirely via Tailwind utility classes (`text-2xl`, `text-3xl`, `text-4xl`, `font-display`, `font-sans`) rather than relying on default browser heading styles, ensuring visual consistency without compromising semantics.
