"""
Validation script for GroundKart Documentation Package
Verifies file existence, feature count, link consistency, and DOCX integrity.
"""
import os
import sys
import zipfile
import re

# Ensure UTF-8 output on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

DOCS_DIR = os.path.dirname(os.path.abspath(__file__))


REQUIRED_FILES = [
    "README.md",
    "WEBSITE_FEATURE_DOCUMENTATION.md",
    "WEBSITE_FEATURE_DOCUMENTATION.docx",
    "TECHNICAL_ARCHITECTURE.md",
    "USER_GUIDE.md",
    "API_AND_DATA_MODEL.md",
    "WORKFLOWS_AND_BUSINESS_LOGIC.md",
    "SETUP_AND_MAINTENANCE.md",
    "SECURITY_AND_PERMISSIONS.md",
    "KNOWN_LIMITATIONS.md",
    "GLOSSARY.md",
    "diagrams/system-architecture.mmd",
    "diagrams/application-workflows.mmd",
    "diagrams/data-flow.mmd",
]

print("=" * 60)
print("GROUNDKART DOCUMENTATION VALIDATION SUITE")
print("=" * 60)

errors = []
warnings = []

# 1. File existence checks
print("\n[Check 1] Verifying Required Files Existence...")
for fname in REQUIRED_FILES:
    fpath = os.path.join(DOCS_DIR, fname)
    if os.path.isfile(fpath):
        size = os.path.getsize(fpath)
        print(f"  ✓ {fname} ({size:,} bytes)")
    else:
        errors.append(f"Missing required file: {fname}")
        print(f"  ✗ MISSING: {fname}")

# 2. DOCX Integrity check
print("\n[Check 2] Verifying DOCX Package Integrity...")
docx_path = os.path.join(DOCS_DIR, "WEBSITE_FEATURE_DOCUMENTATION.docx")
if os.path.isfile(docx_path):
    try:
        with zipfile.ZipFile(docx_path, 'r') as z:
            namelist = z.namelist()
            assert "word/document.xml" in namelist, "document.xml missing from docx"
            assert "[Content_Types].xml" in namelist, "Content_Types.xml missing"
            print("  ✓ DOCX package is valid, uncorrupted, and contains word/document.xml")
    except Exception as e:
        errors.append(f"DOCX validation error: {e}")
        print(f"  ✗ DOCX Corrupted: {e}")

# 3. Feature Inventory & ID Uniqueness
print("\n[Check 3] Verifying Feature IDs & Inventory in Markdown...")
md_path = os.path.join(DOCS_DIR, "WEBSITE_FEATURE_DOCUMENTATION.md")
if os.path.isfile(md_path):
    with open(md_path, "r", encoding="utf-8") as f:
        md_text = f.read()
    
    feature_ids = re.findall(r"FEAT-\d{3}", md_text)
    unique_ids = sorted(list(set(feature_ids)))
    print(f"  Found {len(unique_ids)} unique Feature IDs (Total mentions: {len(feature_ids)})")
    
    if len(unique_ids) == 56:
        print(f"  ✓ Exactly 56 features present (FEAT-001 through FEAT-056)")
    else:
        errors.append(f"Expected 56 unique feature IDs, found {len(unique_ids)}")

    # Verify ID sequence
    for i in range(1, 57):
        expected_id = f"FEAT-{i:03d}"
        if expected_id not in unique_ids:
            errors.append(f"Missing feature ID sequence: {expected_id}")

# 4. Markdown Internal Links Check
print("\n[Check 4] Verifying Markdown Relative Links...")
for root, _, files in os.walk(DOCS_DIR):
    for f in files:
        if f.endswith(".md"):
            full_path = os.path.join(root, f)
            with open(full_path, "r", encoding="utf-8") as md_f:
                content = md_f.read()
            links = re.findall(r"\[.*?\]\((?!http)(.*?)\)", content)
            for link in links:
                clean_link = link.split("#")[0]
                if not clean_link:
                    continue
                target_path = os.path.normpath(os.path.join(os.path.dirname(full_path), clean_link))
                if not os.path.exists(target_path):
                    errors.append(f"Broken link in {f}: {link} -> {target_path}")

if not errors:
    print("  ✓ All relative links between documentation files resolve successfully.")

# Summary
print("\n" + "=" * 60)
if errors:
    print(f"VALIDATION FAILED with {len(errors)} error(s):")
    for err in errors:
        print(f"  - {err}")
    sys.exit(1)
else:
    print("ALL VALIDATION CHECKS PASSED (100% SUCCESS)!")
    print(f"All 14 required files and 56 features successfully verified.")
print("=" * 60)
