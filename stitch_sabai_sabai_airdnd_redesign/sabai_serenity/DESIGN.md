# Design System Document: The Sensory Sanctuary

## 1. Overview & Creative North Star
The objective of this design system is to transcend the utility of a "directory" and instead create a digital sanctuary that mirrors the tactile, tranquil experience of a high-end Thai spa. 

**Creative North Star: "The Digital Breath"**
The interface should feel like it is exhaling. We move away from the rigid, boxed-in layouts of traditional booking sites in favor of **Organic Minimalism**. This is achieved through intentional asymmetry, massive typographic contrast, and "High-End Editorial" layouts. We prioritize white space not as "empty space," but as a luxury material. Elements should feel like they are resting on fine linen or handmade paper, rather than pinned to a digital grid.

---

## 2. Colors & Surface Philosophy
The palette is rooted in Thai earth tones: weathered sand, charcoal teak, and the vibrant ochre of a setting sun.

### The "No-Line" Rule
To maintain a premium, organic feel, **1px solid borders are strictly prohibited** for sectioning or containment. Traditional lines create visual "noise" that interrupts tranquility. 
- **Boundaries** must be defined solely through background color shifts.
- **Example:** A `surface-container-low` section sitting against a `surface` background provides all the separation a user needs without the harshness of a line.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of frosted glass or textured paper. 
- **Base Layer:** Use `surface` (#faf9f8) for the overall page background.
- **Elevation through Tone:** Use `surface-container-lowest` to `surface-container-highest` to create depth. A card should not "pop" with a shadow; it should be "revealed" by being a slightly lighter or darker tone than the section beneath it.

### The "Glass & Gradient" Rule
To prevent the design from feeling "flat" or "cheap":
- **Glassmorphism:** For floating headers or navigation bars, use semi-transparent `surface` colors (80% opacity) with a `backdrop-blur` of 12px–20px. 
- **Signature Textures:** Use subtle linear gradients for primary CTAs, transitioning from `primary` (#b02f00) to `primary_container` (#ff5722). This mimics the natural shift of light on silk.

---

## 3. Typography: The Editorial Voice
We utilize a high-contrast typographic scale to create an authoritative, "Curated Magazine" feel.

- **The Serif (Noto Serif / Playfair Display):** Used for `display` and `headline` tiers. This font represents the heritage, luxury, and "slow" nature of the brand.
- **The Sans-Serif (Plus Jakarta Sans):** Used for `title`, `body`, and `label` tiers. It is clean, modern, and highly legible, representing the efficiency of the booking service.

**Director's Note:** When using `display-lg`, reduce the letter-spacing to `-0.02em` for a tighter, more "fashion-editorial" look. Conversely, for `label-sm`, increase letter-spacing to `0.05em` and use uppercase for a premium, navigational feel.

---

## 4. Elevation & Depth
In this design system, depth is a feeling, not a structure.

### The Layering Principle
Hierarchy is achieved through **Tonal Layering**. 
- Place a `surface-container-lowest` (#ffffff) card on a `surface-container-low` (#f4f3f2) background. The contrast is enough to define the object while remaining soft.

### Ambient Shadows
Shadows are a last resort. When a "floating" effect is mandatory (e.g., a "Book Now" floating action button):
- Use an **extra-diffused shadow**: `blur: 40px`, `spread: -5px`.
- **Shadow Color:** Never use grey. Use a 6%–8% opacity version of `on-surface` (#1a1c1c) or a tinted version of `primary` to mimic natural ambient light.

### The "Ghost Border" Fallback
If accessibility requirements demand a border (e.g., inside an input field), use a **Ghost Border**: 
- Token: `outline-variant` (#e4beb4) at **15% opacity**. It should be felt more than seen.

---

## 5. Components

### Buttons
- **Primary:** Rounded `xl` (1.5rem). Use the primary-to-primary_container gradient. Typography: `title-sm` in `on-primary`.
- **Secondary:** No background. Ghost Border (15% opacity). Subtle hover state using `surface-container-high`.
- **Tertiary:** Purely typographic. Use `label-md` with a subtle underline in `primary` that expands on hover.

### Cards & Lists
- **The Divider Rule:** Forbid the use of divider lines. Separate list items using the `spacing-md` (1rem) or `spacing-lg` (1.5rem) scale.
- **Visual Stacking:** Cards should use `rounded-lg` (1rem) or `rounded-xl` (1.5rem). Images within cards should always have an aspect ratio of 4:5 (portrait) to emphasize the "Editorial" look.

### Input Fields
- Avoid the "box" look. Use `surface-container-low` as the field background with a `rounded-md` corner. 
- The label should use `label-md` and sit high above the field, never inside it, to maintain a clean horizontal flow.

### Signature Component: The "Wellness Chip"
- Used for massage types (e.g., "Deep Tissue," "Aromatherapy").
- Style: `surface-container-high` background, `rounded-full`, with `label-sm` typography. No border.

---

## 6. Do's and Don'ts

### Do:
- **Embrace Asymmetry:** Offset images from text blocks to create a dynamic, high-end feel.
- **Use Wide Margins:** Ensure content has at least `48px` of horizontal padding on desktop to allow the design to "breathe."
- **Use Tonal Transitions:** Use background color changes to signal a new section of the page (e.g., moving from a `surface` hero to a `surface-container-low` list).

### Don't:
- **Don't use 100% Black:** Use `on-background` (#1a1c1c) or the charcoal tone (#0B0B0B) for text to keep the contrast "organic" rather than "digital."
- **Don't use 1px Borders:** Never use a solid line to separate content. Use space or tonal shifts.
- **Don't Over-Round:** While we want a "soft" feel, avoid making everything a pill shape. Use `rounded-lg` (1rem) for most containers to maintain a sense of architectural sophistication.
- **Don't Crowd:** If you think you need more content, you probably need more margin instead. Luxury is defined by what you omit.