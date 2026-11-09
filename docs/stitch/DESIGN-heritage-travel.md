---
name: Heritage Travel Concierge Workspace
colors:
  surface: '#faf9f6'
  surface-dim: '#dbdad7'
  surface-bright: '#faf9f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f0'
  surface-container: '#efeeeb'
  surface-container-high: '#e9e8e5'
  surface-container-highest: '#e3e2e0'
  on-surface: '#1a1c1a'
  on-surface-variant: '#5d3f3c'
  inverse-surface: '#2f312f'
  inverse-on-surface: '#f2f1ee'
  outline: '#926e6b'
  outline-variant: '#e7bdb8'
  surface-tint: '#c00017'
  primary: '#a30012'
  on-primary: '#ffffff'
  primary-container: '#d0021b'
  on-primary-container: '#ffdfdc'
  inverse-primary: '#ffb3ac'
  secondary: '#4e6073'
  on-secondary: '#ffffff'
  secondary-container: '#cfe2f9'
  on-secondary-container: '#526478'
  tertiary: '#005b3c'
  on-tertiary: '#ffffff'
  tertiary-container: '#007650'
  on-tertiary-container: '#97fac8'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad6'
  primary-fixed-dim: '#ffb3ac'
  on-primary-fixed: '#410003'
  on-primary-fixed-variant: '#93000f'
  secondary-fixed: '#d1e4fb'
  secondary-fixed-dim: '#b5c8df'
  on-secondary-fixed: '#091d2e'
  on-secondary-fixed-variant: '#36485b'
  tertiary-fixed: '#93f6c4'
  tertiary-fixed-dim: '#77daaa'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#faf9f6'
  on-background: '#1a1c1a'
  surface-variant: '#e3e2e0'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 12px
    letterSpacing: 0.03em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 1.75rem
---

## Brand & Style

This design system establishes an enterprise-grade conversation and tour booking cockpit tailored specifically for high-velocity Vietnamese travel operations. Combining the authority of an established heritage brand with the agility of modern multi-channel messaging (Zalo Official Account, Facebook Messenger, Live Chat), the visual direction rejects sterile, generic SaaS dashboards in favor of an architectural, sand-grounded workspace.

### Core Principles
- **Heritage Precision, Modern Restraint:** The iconic red is deployed strictly as an authoritative focal anchor—never as large floods or distracting full-bleed backgrounds. It communicates action, critical tour milestones, and brand lineage.
- **Warm Sand & Travel Slate Neutrality:** Long 8-to-10 hour operational shifts demand an eye-resting baseline. Instead of harsh `#FFFFFF` and cool blue-gray slates, the foundation utilizes warm parchment and sand-tinted slates inspired by coastal landscapes and classic travel dossiers.
- **Concierge Ergonomics:** High data density balanced by architectural air. Information hierarchy supports real-time multi-tasking: scanning passenger itineraries, holding seats, cross-referencing flight allotments, and dispatching quotes without visual friction.
- **Contextual Clarity:** Operational status—such as instant booking deposits, customer verification via Zalo OA, and pending itinerary slots—is immediately signaled through crisp emerald and burnished amber accents.

## Colors

The palette balances historical enterprise gravitas with rapid conversational triage.

### Palette Architecture
- **Primary (`#D0021B` - Heritage Red):** Reserved strictly for primary callouts, vital booking confirmations, urgent system notifications, and primary operational triggers. It must never exceed 8% of the surface area on any active screen.
- **Secondary (`#2C3E50` - Travel Slate):** Provides steady structural typography, sidebar navigation headers, deep structural dividers, and secondary controls.
- **Tertiary (`#0D8259` - Tour Emerald):** Direct indicator for successful deposit receipts, active online status across Zalo/chat channels, confirmed flight/hotel allotments, and verified VIP customer tags.
- **Warning/Pending (`#D97706` - Warm Amber):** Flags quotation expiration warnings, pending visa approvals, and unassigned incoming leads.
- **Neutral Core (`#F9F8F5` - Sand Parchment):** The master canvas tone. Paired with pure surface cards (`#FFFFFF`) and warm stone border accents (`#E6E2DA`), this creates an organic, warm backdrop that eliminates glare during all-day customer service shifts.

## Typography

Typography is calibrated for intricate Vietnamese diacritics (`dấu hỏi`, `ngã`, `nặng`) within dense tabular and messaging interfaces. Inter provides vertical stability, robust metric balance, and uncompromised legibility across complex multi-line Vietnamese names, pricing structures, and itinerary itineraries.

### Typographic Hierarchy Guidelines
- **Numbers & Currencies:** Tour pricing (VND/USD), PNR booking codes, and tour departure dates utilize tabular lining numerals to ensure clean vertical alignment across booking grids.
- **Diacritic Clearance:** Body text uses an elevated line-height ratio (`~1.38` to `1.45`) to prevent overlapping accents on capital Vietnamese letters (`Đ`, `Ư`, `Ậ`, `Ổ`).
- **Conversational Tone:** Chat message content renders at `body-md` (13px/18px) for agent exchanges, allowing maximum conversational context without scrolling, while primary client dossier summaries utilize `body-lg`.

## Layout & Spacing

The workspace uses a 3-column operational layout engine:
1. **Inbox & Channel Stream (Left, Fixed 320px–360px):** Fast filterable conversation feed (Zalo, Messenger, Hotline, Web).
2. **Active Dialogue Thread (Center, Fluid):** Customer conversation timeline, quick reply drawer, and travel quotation builder.
3. **Concierge Dossier & Tour Booker (Right, Fixed 380px–420px):** Itinerary allotment picker, passenger manifest, payment status, and CRM notes.

### Spacing Philosophy
- Base layout rhythm operates on a crisp 4px sub-grid with primary jumps at 8px increments.
- Avoid wide void spaces common in consumer landing pages; customer support representatives rely on tight, organized content zones with disciplined padding (`space-sm` for list items, `space-md` for message bubbles, `space-lg` for drawer panels).
- Screen adaptivity relies on collapsible side panes: below 1280px, the Right Dossier becomes an overlay slide-out; on mobile (phone inspections), the layout collapses into a single-pane sequential view.

## Elevation & Depth

To eliminate visual exhaustion, elevation relies on subtle tonal layering, structured surface containment, and warm micro-shadows rather than generic blurred drop-shadows.

### Layering Model
- **Base Canvas (`Level 0` - `#F9F8F5`):** The structural foundation behind panels.
- **Work Panels (`Level 1` - `#FFFFFF`):** Chat lists, conversation logs, and customer itinerary sheets sit directly on the canvas, separated by hairline warm borders (`1px solid #E6E2DA`).
- **Floating Modals & Flyouts (`Level 2` - `#FFFFFF`):** Quick-booking drawers, tour catalogue pickers, and flight seat selectors use warm ambient depth: `box-shadow: 0 4px 16px -2px rgba(44, 62, 80, 0.08), 0 2px 6px -1px rgba(44, 62, 80, 0.04)`.
- **Urgent Popovers (`Level 3`):** Payment confirmation dialogues and cancellation warnings introduce a soft `#1E2833` tinted overlay at 35% opacity.

## Shapes

The workspace embraces a disciplined, tailored corner radius (`0.25rem` / 4px base; `0.5rem` / 8px for cards and containers).

### Corner System
- **Micro UI (Buttons, Form Inputs, Badges, Tabs):** `rounded` (4px). Delivers a crisp, professional, enterprise-first finish.
- **Containers (Panels, Chat Bubbles, Modals):** `rounded-lg` (8px). Maintains structure without playful softness.
- **Pill Tags (Status Badges, Zalo Channel Identifiers):** Fully circular pill boundaries reserved strictly for status dots and channel tags (`rounded-full`) to immediately differentiate metadata from interactive triggers.

## Components

### Buttons
- **Primary Action (Book Tour / Send Quote):** Solid `#D0021B` background, `#FFFFFF` text, 4px radius, subtle active scale. Focus ring: 2px offset with `#D0021B33`.
- **Secondary Action (Add Note / Attach Itinerary):** Warm slate outline (`1px solid #CFD8DC`), transparent background, `#2C3E50` text. Hover shifts to `#F2EFE9`.
- **Tertiary / Utility (Channel Filter, More Actions):** Ghost button with neutral text and sand hover background.

### Conversation Stream & Message Bubbles
- **Customer Messages:** `#FFFFFF` background, fine border (`1px solid #E6E2DA`), `#1A1D20` text, left-aligned. Channel stamp (Zalo icon, Facebook icon) pinned subtly at bottom right.
- **Agent Responses:** Warm cream surface (`#FFF5F5` with left border hint of `#D0021B` for drafted quotes, or `#F4F2EC` for general messages), dark slate text, right-aligned.
- **Interactive Tour Card in Chat:** Structured embedded card displaying Tour Code, Destination thumbnail, Departure Date, and real-time Available Slots badge with a one-click "Gửi Báo Giá" (Send Quote) action.

### Chips & Status Badges
- **Confirmed / Deposited:** Background `#E6F5EE`, text `#0D8259`, dot `#0D8259`.
- **Pending / Expiring:** Background `#FEF3C7`, text `#B45309`, dot `#D97706`.
- **VIP Customer:** Background `#FDF2F2`, text `#D0021B`, bordered with `#F8D7DA`.

### Form Fields & Quotation Inputs
- Background `#FFFFFF`, border `#DCD7CE`, text `#1A1D20`. Focus states transition border to `#2C3E50` with an ambient glow. Compact height (34px–38px) for maximum operational speed.

### Dossier & Customer Info Panels
- Clean, vertical key-value lists with faint sand dividing lines. Passenger count, visa status, passport expiration dates, and cumulative booking value displayed in high-contrast data rows with tabular numbers.