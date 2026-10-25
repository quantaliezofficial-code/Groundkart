# GroundKart — HTTPS Enforcement & Canonicalization Report

**Auditor:** Agent 01 & Agent 10 — Technical SEO & Security Specialist  
**Domain:** `https://groundkart.com`  
**Date:** October 2026  
**Status:** Remediated & Verified  

---

## 1. Executive Summary

Transport Layer Security (HTTPS) is a confirmed Google ranking signal, an essential foundation for user privacy during payment checkout, and a mandatory prerequisite for modern browser features (Service Workers, HTTP/2 multiplexing, HTTP/3 QUIC).

Prior to remediation:
- Inconsistent origin usage existed across static configuration files (references to `http://localhost:8000`, `http://groundbooking.com`, and unencrypted URLs in public sitemaps).
- Missing HTTP Strict Transport Security (HSTS) deployment directives.
- Ambiguity regarding `www` versus apex domain preference.

All configuration files, sitemap generators, robots directives, HTML templates, and React Helmet headers have been synchronized to strictly enforce `https://groundkart.com` as the canonical origin.

---

## 2. Canonicalization Standards

### 2.1 The Four Insecure / Duplicate Origins
For any public web service, four URL permutations exist:
1. `http://groundkart.com` (Insecure apex)
2. `http://www.groundkart.com` (Insecure www)
3. `https://www.groundkart.com` (Secure www)
4. `https://groundkart.com` (**The Authoritative Canonical Origin**)

Google treats these as four distinct websites unless canonicalization and 301 redirects are strictly configured.

### 2.2 Canonical Redirection Strategy
At the edge proxy layer (Nginx, Caddy, Cloudflare, or AWS CloudFront), all non-canonical permutations must 301 permanently redirect to `https://groundkart.com`:

```
http://groundkart.com        ───(301)───►
http://www.groundkart.com    ───(301)───►  https://groundkart.com$request_uri
https://www.groundkart.com   ───(301)───►
```

---

## 3. Security Headers & HSTS Configuration

To protect user authentication cookies, prevent man-in-the-middle downgrade attacks, and earn Google's HTTPS trust signals, the following response headers are specified for the production web server:

```nginx
# Production Security Headers
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(self), camera=(), microphone=()" always;
```

### 3.1 Session Cookie Security
The GroundKart authentication backend (`backend/app/core/auth.py`) issues sessions using encrypted cookies configured with:
- `Secure=True` (Transmitted exclusively over TLS/HTTPS).
- `HttpOnly=True` (Inaccessible to client-side JavaScript, mitigating XSS attacks).
- `SameSite=Lax` (Prevents cross-site request forgery while preserving top-level navigation).

---

## 4. Mixed Content Audit

A full scan of frontend templates, CSS stylesheets, and backend API endpoints was conducted:
- **Image URLs:** All Unsplash CDN assets and local media reference explicit `https://` origins or relative root paths (`/hero-sports.webp`, `/logo-full.png`, `/og-image.png`). Zero unencrypted `http://` image assets are present.
- **Font & Stylesheet Inclusions:** Google Fonts and stylesheet bundles are resolved over HTTPS.
- **API Origin:** Public catalog endpoints (`/api/v1/venues`, `/api/v1/homepage`) use relative paths or environment-injected secure origins (`VITE_API_URL`).

---

## 5. Verification Checklist

1. [x] `frontend/index.html` specifies `<link rel="canonical" href="https://groundkart.com/" />`.
2. [x] `frontend/src/components/SEOHead.tsx` dynamically generates `<link rel="canonical" href="https://groundkart.com[path]" />`.
3. [x] `backend/app/main.py` dynamic sitemap generator outputs `<loc>https://groundkart.com/venues/[slug]</loc>`.
4. [x] `frontend/public/robots.txt` and `@app.get("/robots.txt")` output `Sitemap: https://groundkart.com/sitemap.xml`.
5. [x] Zero mixed-content warnings during production Vite build (`npm run build`).
