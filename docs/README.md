# GroundBooking — Documentation Portal

Welcome to the GroundBooking documentation hub. All project documentation, reports, guides, and reference materials live here.

---

## Directory Structure

```
docs/
├── 01-overview/                    ← Project overview & getting-started guides
├── 02-requirements-and-planning/   ← PRD, requirements, planning artefacts
├── 03-features-and-user-guides/    ← Feature docs, user guide, booking lifecycle
├── 04-architecture-and-design/     ← Technical architecture, system design
├── 05-api-and-data/                ← API reference, data models, schemas
├── 06-workflows-and-business-logic/← Business workflows, state machines
├── 07-quality-assurance/           ← QA checklists, enhancement tracking
├── 08-research-and-decisions/      ← Phase summaries, ADRs, decision records
├── 09-operations-and-deployment/   ← Setup, maintenance, handoff, session notes
├── 10-security-and-reliability/    ← Security model, permissions, resilience
├── 11-project-reports/             ← All audit & analysis reports (subcategorised)
│   ├── seo/                        ← SEO audits and remediation reports
│   ├── security/                   ← Security hardening & threat model
│   ├── performance/                ← Core Web Vitals, image, mobile performance
│   ├── qa-and-testing/             ← Test matrices, display gaps, resilience
│   ├── cleanup-and-maintenance/    ← Cleanup plans, verification matrices
│   └── auth-and-fixes/             ← Auth fix reports, password reset plans
├── 12-reference/                   ← Glossary, known limitations, support tickets
├── management/                     ← Documentation inventory and manifest
└── website-documentation/          ← Generated comprehensive website docs (source-of-truth)
    └── diagrams/                   ← Mermaid architecture diagrams
```

---

## Quick Links

| Area | File |
|---|---|
| Project Overview | [01-overview/PROJECT_OVERVIEW.md](01-overview/PROJECT_OVERVIEW.md) |
| Getting Started | [01-overview/GroundBooking_Getting_Started_Guide (1).md](01-overview/GroundBooking_Getting_Started_Guide%20(1).md) |
| Technical Architecture | [04-architecture-and-design/TECHNICAL_ARCHITECTURE.md](04-architecture-and-design/TECHNICAL_ARCHITECTURE.md) |
| API & Data Model | [05-api-and-data/API_AND_DATA_MODEL.md](05-api-and-data/API_AND_DATA_MODEL.md) |
| User Guide | [03-features-and-user-guides/USER_GUIDE.md](03-features-and-user-guides/USER_GUIDE.md) |
| Security & Permissions | [10-security-and-reliability/SECURITY_AND_PERMISSIONS.md](10-security-and-reliability/SECURITY_AND_PERMISSIONS.md) |
| Setup & Maintenance | [09-operations-and-deployment/SETUP_AND_MAINTENANCE.md](09-operations-and-deployment/SETUP_AND_MAINTENANCE.md) |
| Full Feature Docs | [website-documentation/WEBSITE_FEATURE_DOCUMENTATION.md](website-documentation/WEBSITE_FEATURE_DOCUMENTATION.md) |
| Glossary | [12-reference/GLOSSARY.md](12-reference/GLOSSARY.md) |
| Known Limitations | [12-reference/KNOWN_LIMITATIONS.md](12-reference/KNOWN_LIMITATIONS.md) |

---

## About `website-documentation/`

This folder contains the **generated authoritative documentation** for the GroundBooking platform. The `.py` scripts in that folder re-generate the docs from source. Do not edit the output `.md` files by hand — run `generate_docs.py` instead.

---

> For the documentation manifest and inventory see [management/DOCUMENTATION_MANIFEST.md](management/DOCUMENTATION_MANIFEST.md).
