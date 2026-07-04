# Project Portfolio Summary

## Project name
Formosan Echoes

## One-line pitch
A curated browser and discovery platform for Formosan-language (Indigenous Taiwanese) music, with an AI-assisted curation backend.

## Target users / clients
Language learners, music enthusiasts, ethnomusicology researchers, and Indigenous Taiwanese communities. Secondary: cultural institutions and NLP researchers interested in low-resource language corpora.

## Problem it solves
Music in Taiwan's 16+ Indigenous (CIP) languages — Amis, Bunun, Paiwan, Atayal, Puyuma, Seediq, Rukai, Saisiyat, Tao, Thao, Kavalan, and others — is scattered across YouTube with inconsistent, often Sinicized metadata and almost no structured catalog. There is no single, accurate, searchable home where this music is correctly attributed by language, artist, and Indigenous-script title, with rights-aware lyrics. Formosan Echoes builds that catalog and the tooling to keep it accurate.

## What I built
A full-stack Next.js application with two faces:
- **Public browser (`/`)** — search, language/artist faceted filters, favorites, playlists, a persistent bottom audio player with synced video mirror, karaoke mode, lyrics in multiple scripts (Indigenous / Chinese / English), share/deep-link support, bilingual UI (English + Traditional Chinese), and PWA behavior.
- **Admin curation panel (`/admin`)** — Google-OAuth-gated. A YouTube → Gemini AI enrichment → human-review pipeline for songs and artists: single and batch (playlist/channel) import via the YouTube Data API, AI web-search-grounded metadata research, three-script name handling, artist↔song auto-linking, audit/verification workflow, and a metrics dashboard.

Backend is Supabase (PostgreSQL) as the source of truth, with a fully migrated relational schema (songs, artists, name aliases, group membership, lyrics, tags). Analytics via cookie-free Umami.

## Top 5 features
1. **AI enrichment pipeline** — YouTube URL in, structured verified metadata out: Gemini 2.5 (Flash/Pro) with Google Search grounding fills Indigenous-script titles, Chinese titles, artist credits, and lyrics, with human-readable grounding sources and a strict human-review gate before anything goes public.
2. **Rights-aware lyrics system** — lyrics never render publicly unless explicitly approved (`show_publicly`), with multi-script display (Indigenous / romanized / Chinese / English) and swipe-to-cycle modes.
3. **Dual-player architecture** — a single hidden master audio player synced to a muted visual video mirror, avoiding double-audio while keeping playback state global and seek-synced.
4. **Batch curation tooling** — import entire YouTube playlists/channels, run AI research per-item or in batch with progress tracking, auto-link songs to artists, and verify in a unified admin workflow.
5. **Bilingual, mobile-first PWA** — full English / Traditional Chinese localization, karaoke mode, share + deep links, and installable PWA behavior with back-button handling.

## What makes it impressive
It pairs a polished consumer music-app UX with a genuinely hard data problem — accurate, script-correct, rights-respecting metadata for severely under-documented languages — and solves the data bottleneck with an AI-in-the-loop pipeline that keeps a human reviewer in control of anything sensitive. The architectural discipline (single source-of-truth audio, controlled vocabularies, epistemic confidence vs. workflow status as separate axes, lyric publication gating) shows production-grade thinking, not a demo.

## What it proves I can do
- Ship a complete full-stack product end to end: relational data modeling, server/client boundaries, ISR, auth, and a real admin tool — not just a frontend.
- Integrate LLMs responsibly into a real workflow (grounded research, structured output, human review gates) rather than as a gimmick.
- Design for a real domain with cultural and legal nuance, encoding those constraints into the system.
- Build careful, non-obvious frontend architecture (synced players, gesture/PWA handling, i18n).

## Current status
Prototype — feature-rich and pre-public-launch. Core public browser and admin pipeline are built and working; ranking/sorting and the larger automated ingestion corpus are the main remaining pre-launch items.

## Demo URL
Not yet publicly launched. _(Add Vercel/hosted URL here once live.)_

## GitHub URL, if public
https://github.com/BenAXiong/FormosanEchoes _(repository is currently private — confirm before linking publicly.)_

## Screenshots available?
Not yet captured — UI is built and screenshot-ready (public browser, NowPlaying/karaoke, admin Songs/Artists tabs, Metrics dashboard).

## Short demo video available?
Not yet recorded.

## Tech stack
Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Supabase (PostgreSQL + Auth) · Google Gemini 2.5 · YouTube Data API · ReactPlayer · Umami analytics · Vercel-style ISR.

## Data / copyright / privacy caveats
- **Lyrics are copyrighted.** Lyrics are gated behind a manual `show_publicly` approval and are never published by default. Do not present the project as freely distributing full lyrics.
- **Music is embedded, not hosted.** Playback is via embedded YouTube — Formosan Echoes does not host or own the audio.
- **Cultural sensitivity.** Some ceremonial songs are not meant for general circulation or AI training; any future corpus/NLP use requires explicit community consent and licensing. Do not overstate "open dataset" claims.
- **AI-generated metadata is human-reviewed**, not authoritative until verified — avoid claiming the catalog is fully authoritative.
- Analytics are cookie-free (Umami); no personal data harvesting to highlight.

## Best commercial angle
Cultural institutions, language-revitalization programs, museums, and education platforms that need accurate, rights-aware catalogs of minority-language media. The AI-assisted curation pipeline is the reusable, sellable core — it generalizes to any "messy public media → clean, verified, multilingual catalog" problem (other Indigenous/minority languages, archives, folk-music collections).

## Best portfolio angle
Lead with the AI-in-the-loop data pipeline and the domain difficulty: turning chaotic YouTube metadata for low-resource languages into a clean, script-correct, rights-respecting catalog. Emphasize the product completeness (consumer UX + real admin tooling), the responsible-AI framing (human review gates, cultural sensitivity), and the architectural decisions. Frame it as mission-driven engineering, not a generic music clone.
