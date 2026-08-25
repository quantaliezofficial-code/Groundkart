import re

# 1. VenueCard.tsx
with open('src/components/VenueCard.tsx', 'r', encoding='utf-8') as f:
    vc_code = f.read()

# Add useNavigate
if "useNavigate" not in vc_code:
    vc_code = vc_code.replace("import { motion } from 'framer-motion';", "import { motion } from 'framer-motion';\nimport { useNavigate } from 'react-router-dom';")

# Add role="button", tabIndex={0}, onKeyDown to the outer motion.div
# Update onClick to use navigate
# Currently it receives `onClick: (venueId: string) => void;` but we can just use navigate internally
vc_code = vc_code.replace("export default function VenueCard({", "export default function VenueCard({\n  venue,\n  onClick,\n  onToggleFavorite,\n  isFavorite\n}: VenueCardProps) {\n  const navigate = useNavigate();\n")
vc_code = re.sub(r'export default function VenueCard\(\{.*?\}\: VenueCardProps\) \{', '', vc_code, flags=re.DOTALL, count=1)
# Actually, let's do this cleaner:
vc_code = re.sub(
    r'(export default function VenueCard\(\{[\s\S]*?\}\: VenueCardProps\) \{)',
    r'\1\n  const navigate = useNavigate();',
    vc_code
)

vc_code = vc_code.replace("onClick={() => onClick(venue.id)}", "onClick={() => navigate('/venues/' + venue.id, { state: { venue } })}")

vc_code = vc_code.replace(
    "className={`bg-chalk rounded-2xl ring-1 ring-ink/5 overflow-hidden flex flex-col shadow-lg transition-colors cursor-pointer group select-none ${",
    "role=\"button\"\n      tabIndex={0}\n      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/venues/' + venue.id, { state: { venue } }); } }}\n      className={`bg-chalk rounded-2xl ring-1 ring-ink/5 overflow-hidden flex flex-col shadow-lg transition-colors cursor-pointer group select-none ${"
)

with open('src/components/VenueCard.tsx', 'w', encoding='utf-8') as f:
    f.write(vc_code)

print("VenueCard.tsx done")

# 2. Header.tsx
with open('src/components/Header.tsx', 'r', encoding='utf-8') as f:
    hdr_code = f.read()

hdr_code = hdr_code.replace("import React, { useState, useEffect, useRef } from 'react';", "import React, { useState, useEffect, useRef } from 'react';\nimport { useNavigate } from 'react-router-dom';")

# Search debounce
search_debounce = """
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (val: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(val);
    }, 300);
  };
"""
hdr_code = re.sub(r'(const \{ user, logout \} = useAuth\(\);)', r'\1\n' + search_debounce, hdr_code)

hdr_code = hdr_code.replace("onChange={(e) => onSearchChange(e.target.value)}", "onChange={(e) => { handleSearchChange(e.target.value); }}")

# Mobile menu Escape key
escape_hook = """
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);
"""
hdr_code = re.sub(r'(const \{ user, logout \} = useAuth\(\);)', r'\1\n' + escape_hook, hdr_code)

# Aria expanded on hamburger
hdr_code = hdr_code.replace(
    "aria-label=\"Toggle menu\"",
    "aria-label=\"Toggle menu\"\n                  aria-expanded={mobileMenuOpen}"
)

# Aria expanded on profile
hdr_code = hdr_code.replace(
    "aria-label=\"Account menu\"",
    "aria-label=\"Account menu\"\n                      aria-expanded={showProfileMenu}"
)

# Role navigation on mobile menu
hdr_code = hdr_code.replace(
    "className=\"lg:hidden bg-[#143828] border-t border-white/5 shadow-2xl overflow-hidden\"",
    "className=\"lg:hidden bg-[#143828] border-t border-white/5 shadow-2xl overflow-hidden\"\n              role=\"navigation\"\n              aria-label=\"Mobile navigation\""
)

# Update setCurrentView calls to navigate
# The instructions say: "Update all setCurrentView() calls in Header to use useNavigate()"
# But wait, Header uses `onNavigate` instead of `setCurrentView`. Let's just make Header use `navigate` directly, or if it doesn't have `setCurrentView`, let's just make sure `useNavigate` is imported.
if "setCurrentView" in hdr_code:
    hdr_code = hdr_code.replace("setCurrentView", "navigate")

with open('src/components/Header.tsx', 'w', encoding='utf-8') as f:
    f.write(hdr_code)

print("Header.tsx done")

# 3. Hero.tsx
with open('src/components/Hero.tsx', 'r', encoding='utf-8') as f:
    hero_code = f.read()

# "Any navigation calls need to use navigate()"
# Hero currently only calls onSearchSubmit. If it doesn't have setCurrentView, we just add useNavigate just in case or leave it.
if "useNavigate" not in hero_code:
    hero_code = hero_code.replace("import { motion } from 'framer-motion';", "import { motion } from 'framer-motion';\nimport { useNavigate } from 'react-router-dom';")

with open('src/components/Hero.tsx', 'w', encoding='utf-8') as f:
    f.write(hero_code)

print("Hero.tsx done")
