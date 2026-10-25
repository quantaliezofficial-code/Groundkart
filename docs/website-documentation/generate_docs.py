"""
Documentation Generator for GroundKart / GroundBooking
Generates both WEBSITE_FEATURE_DOCUMENTATION.md and WEBSITE_FEATURE_DOCUMENTATION.docx
Ensures 100% content alignment, strict evidence backing, and professional formatting.
"""
import os
import sys
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

DOCS_DIR = os.path.dirname(os.path.abspath(__file__))
MD_PATH = os.path.join(DOCS_DIR, "WEBSITE_FEATURE_DOCUMENTATION.md")
DOCX_PATH = os.path.join(DOCS_DIR, "WEBSITE_FEATURE_DOCUMENTATION.docx")

print(f"Generating documentation in: {DOCS_DIR}")
