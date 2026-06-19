---
name: ColdCall CRM
description: Premium lead management and retention tracking system
colors:
  primary: "#0ea5e9"
  primary-dark: "#0284c7"
  success: "#10b981"
  success-dark: "#059669"
  warning: "#f59e0b"
  danger: "#ef4444"
  neutral-bg: "#f8fafc"
  neutral-card: "#ffffff"
  neutral-text: "#0f172a"
  muted-text: "#64748b"
  border: "#e2e8f0"
typography:
  display:
    fontFamily: "Inter, Anuphan, sans-serif"
    fontSize: "3rem"
    fontWeight: 900
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter, Anuphan, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, Anuphan, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, Anuphan, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, Anuphan, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  md: "12px"
  lg: "16px"
  xl: "24px"
  "2xl": "32px"
  "3xl": "40px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
  card-container:
    backgroundColor: "{colors.neutral-card}"
    rounded: "{rounded.2xl}"
    padding: "24px"
---

# Design System: ColdCall CRM

## 1. Overview

**Creative North Star: "The Crystal Streamline"**

The Crystal Streamline represents a crisp, transparent, and fast-flowing workspace designed for high-efficiency outbound agents. By pairing clean sky-blue branding with soft cool slates and blue-tinted shadows, the layout minimizes visual fatigue while maintaining a premium dashboard feel. It rejects raw flat tables, harsh drop-shadows, and chaotic grids in favor of structured components with smooth micro-interactions.

**Key Characteristics:**
- **Refined Sky Theme**: Sky Blue primary accents used strategically to direct attention.
- **Rhythmic Spatial Layout**: Generous spacing and rounded containers for a soft, friendly UI.
- **Highly Interactive**: Fluid hover states and transitions to signify action.

## 2. Colors

The ColdCall CRM utilizes a bright Sky-Slate scheme to establish a modern, clean, and professional appearance.

### Primary
- **Sky Blue** (`#0ea5e9`): Used for primary action buttons, focused inputs, and prominent active tabs.
- **Deep Sky** (`#0284c7`): Used for hover states on primary components.

### Success
- **Cool Emerald** (`#10b981`): Used to show positive indicators (e.g. Stage: Customer / Retention, successful phone calls).
- **Emerald Dark** (`#059669`): Used for hover/focus on success states.

### Neutral
- **Slate Light** (`#f8fafc`): The global body background color.
- **Pure White** (`#ffffff`): Card containers, modal sheets, and sidebars.
- **Slate Ink** (`#0f172a`): Body text, titles, and prominent labels.
- **Slate Muted** (`#64748b`): Secondary labels, helper text, and placeholders.
- **Cool Grey Border** (`#e2e8f0`): Structural grid borders and boundaries.

**The Ten Percent Accent Rule.** Sky Blue accents must never occupy more than 10% of the screen area. Accent colors must act as signals, not wallpapers.

**The Thai Text Contrast Rule.** Text in Thai must maintain a contrast ratio of at least 4.5:1 against its background. Muted grey text must be bumped darker to ensure readability.

## 3. Typography

**Display Font:** Inter (with system sans-serif fallback)
**Body Font:** Anuphan (Thai sans-serif)

**Character:** The pairing of Inter (for numerals and English headings) with Anuphan (for clean, modern Thai readability) forms a harmonious, contemporary corporate voice without relying on default serif system fonts.

### Hierarchy
- **Display** (900, 3rem, 1.15): Major dashboard hero stats and call counters.
- **Headline** (800, 2.25rem, 1.2): Main page headers and action views.
- **Title** (600, 1.25rem, 1.5): Card section titles and modal headers.
- **Body** (400, 1rem, 1.6): Default reading lists and logs description.
- **Label** (500, 0.875rem, 1.4): Table headers, badge labels, buttons, and helper details.

## 4. Elevation

The elevation philosophy is flat and layered. Surfaces are flat at rest, with soft blue-tinted shadows rising dynamically on hover or interaction to establish visual hierarchy.

### Shadow Vocabulary
- **Slate Glow SM** (`0 2px 12px rgba(14, 165, 233, 0.04)`): Flat resting card borders.
- **Slate Glow MD** (`0 4px 20px -2px rgba(14, 165, 233, 0.06)`): Hover state card elevate.
- **Slate Glow LG** (`0 10px 30px -5px rgba(14, 165, 233, 0.08)`): Elevated dropdowns, calendar picks, and popovers.
- **Slate Glow XL** (`0 20px 40px -10px rgba(14, 165, 233, 0.12)`): Active modals and system dialogs.

## 5. Components

### Buttons
- **Shape:** Gently curved edges (16px radius, `radius-lg`).
- **Primary:** Sky blue background (`#0ea5e9`), white text (`#ffffff`), padding of 10px 20px.
- **Hover / Focus:** Transits smoothly to Deep Sky (`#0284c7`) with scale feedback (`active:scale-95`).

### Cards / Containers
- **Corner Style:** Broad rounded corners (32px radius, `radius-2xl`).
- **Background:** White (`#ffffff`).
- **Shadow Strategy:** Rises from SM shadow at rest to MD shadow on hover.
- **Border:** Subtle border (1px, `#e2e8f0`).
- **Internal Padding:** Generous padding (`24px`).

### Inputs / Fields
- **Style:** 1px solid border (`#e2e8f0`), rounded edges (12px radius, `radius-md`), height of 42px.
- **Focus:** Highlighted with a Sky Blue ring (`#0ea5e9`) and soft shadow glow.

### Custom Select Dropdowns
- **Style:** Replaces default browser dropdowns with custom lists. Always rendered via absolute position with z-index overlay to prevent clipping issues.

## 6. Do's and Don'ts

### Do:
- **Do** use `Anuphan` for all Thai characters to prevent standard system font rendering errors.
- **Do** set explicit `responsibleId: null` and `responsibleName: 'Unassigned'` for unassigned leads.
- **Do** make all interactive elements bounce slightly (`active:scale-95 transition-all duration-300`).

### Don't:
- **Don't** use side-stripe borders (e.g. `border-left-4`) as accents on list items or cards.
- **Don't** use gradient text under any circumstances.
- **Don't** use low-contrast grey text for body or badge content.
- **Don't** nest cards inside cards.
