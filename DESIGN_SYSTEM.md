# Adulting App — Elevated Design System

## Overview

The Adulting clinical workspace app now features an "Elevated" design system with a professional, clinical-appropriate color palette and refined visual hierarchy. This design system prioritizes clarity, accessibility, and clinical usability.

## Color Palette

### Primary Colors

#### Forest Green (Primary)
- **HSL**: `140 45% 25%`
- **Hex**: `#2d5740`
- **Usage**: Primary buttons, headers, icons, active states
- **Clinical Purpose**: Professional, trustworthy, clinical authority

#### Medium Green (Secondary)
- **HSL**: `140 60% 35%`
- **Hex**: `#3d7a52`
- **Usage**: Secondary buttons, accent elements
- **Purpose**: Supporting actions and secondary interactions

### Urgency & Status Colors

#### Clinical Red (Urgent/High Priority)
- **HSL**: `14 78% 50%`
- **Hex**: `#c84a2c`
- **Usage**: Urgent tasks, high-priority items, missed calls, warnings
- **Clinical Purpose**: Immediate attention needed

#### Warning Orange (Medium Priority)
- **HSL**: `31 85% 55%`
- **Hex**: `#ff9a4a`
- **Usage**: Medium priority tasks, upcoming deadlines, reminders
- **Purpose**: Requires attention but not urgent

#### Success Green (Completed/Normal)
- **Inherited from Primary**
- **Usage**: Completed tasks, successful actions, normal status
- **Purpose**: Positive state confirmation

### Neutral Colors

#### Light Mint Background
- **HSL**: `155 53% 95%`
- **Hex**: `#eefdf4`
- **Usage**: Main background, page surfaces
- **Purpose**: Calming clinical environment

#### White
- **HSL**: `0 0% 100%`
- **Hex**: `#ffffff`
- **Usage**: Card backgrounds, modals, form inputs
- **Purpose**: Content containers

#### Dark Text
- **HSL**: `171 35% 9%`
- **Hex**: `#121e19`
- **Usage**: Body text, headings, primary text
- **Purpose**: Maximum readability

#### Muted Text
- **HSL**: `168 16% 30%`
- **Hex**: `#52675f`
- **Usage**: Secondary text, timestamps, hints
- **Purpose**: Visual hierarchy

## Typography

### Font Families

- **Displays/Headlines**: Montserrat (500-700 weight)
  - Use for: Page titles, section headers, emphasis
  - Weight: 600-700 for maximum impact

- **Body Text**: Plus Jakarta Sans (400-600 weight)
  - Use for: Paragraphs, descriptions, body content
  - Weight: 400 regular, 500-600 for emphasis

- **Labels/Tags**: Archivo Narrow (500-600 weight)
  - Use for: Form labels, badges, small text
  - Weight: 500 regular, 600 for emphasis

### Text Sizes & Hierarchy

- **Display Large**: 2.5rem / 40px (headlines)
- **Display Medium**: 2rem / 32px (page titles)
- **Display Small**: 1.5rem / 24px (section headers)
- **Body Large**: 1.125rem / 18px (content headers)
- **Body Medium**: 1rem / 16px (body text, default)
- **Body Small**: 0.875rem / 14px (secondary text)
- **Label**: 0.75rem / 12px (badges, small labels)

## Component Styling

### Buttons

#### Primary Button
```
Background: Forest Green (#2d5740)
Text: White
Padding: 12px 20px (default)
Border Radius: 8px (rounded-lg)
Shadow: md (0 4px 6px -1px)
Hover: Increased shadow (lg), lighter green
Active: Scale down (95%)
```

#### Secondary Button
```
Background: Medium Green (#3d7a52)
Text: White
Similar sizing and spacing to primary
```

#### Outline Button
```
Background: Transparent
Border: 1px solid input color
Text: Foreground
Hover: Light primary background
```

#### Destructive Button
```
Background: Clinical Red (#c84a2c)
Text: White
Used for: Delete, cancel, urgent actions
```

### Cards & Surfaces

- **Background**: White (#ffffff)
- **Border**: Light gray, subtle
- **Shadow**: Minimal (shadow-sm) at rest
- **Hover**: Slightly increased shadow
- **Border Radius**: 8-12px (rounded-lg to rounded-xl)
- **Padding**: 16-24px depending on content

### Input Fields

- **Background**: White or light background
- **Border**: 1px solid input color
- **Border Radius**: 8px (rounded-lg)
- **Padding**: 10px 16px
- **Focus**: 2px ring with primary color
- **Placeholder**: Muted text color

### Badges & Tags

#### Priority Badges
- **High Priority**: Clinical red background, white text
- **Medium Priority**: Warning orange background, white text
- **Low Priority**: Light gray background, dark text
- **Normal**: Light green background, dark text

#### Status Badges
- **Active/Online**: Green background
- **Inactive/Offline**: Gray background
- **Pending**: Orange background
- **Completed**: Green background

## Spacing & Layout

### Base Unit
- **8px spacing system**
- All spacing uses multiples of 8px

### Common Spacing Values
- **xs**: 4px (0.25rem)
- **sm**: 8px (0.5rem)
- **md**: 16px (1rem)
- **lg**: 24px (1.5rem)
- **xl**: 32px (2rem)
- **2xl**: 48px (3rem)

### Content Padding
- **Cards**: 16-24px
- **Page**: 16-24px (mobile), 24-32px (desktop)
- **Forms**: 16px between rows
- **Lists**: 12px between items

## Dark Mode

The design system includes a full dark mode implementation with all colors adjusted for proper contrast:

### Dark Mode Colors
- **Background**: Forest green dark (`140 30% 15%`)
- **Card**: Forest green darker (`140 30% 20%`)
- **Primary**: Lighter forest green (`140 60% 60%`)
- **Text**: Light off-white (`140 20% 90%`)

All dark mode colors are automatically applied when `.dark` class is present on root element.

## Accessibility

### Contrast Ratios
- **Body Text**: Minimum 7:1 (AAA standard)
- **Large Text**: Minimum 4.5:1 (WCAG AA)
- **UI Components**: Minimum 3:1

### Color Blindness
- Do not rely on color alone to convey information
- Use icons, patterns, or text labels alongside colors
- Urgent items (red) also have icon indicators

### Focus States
- **Focus Ring**: 2px ring with offset
- **Visible**: Clearly visible on all interactive elements
- **Color**: Primary color for consistent UX

## Implementation

### CSS Variables
All colors are defined in `/src/index.css` as CSS custom properties:

```css
--primary: 140 45% 25%;           /* Forest green */
--destructive: 14 78% 50%;        /* Clinical red */
--warning: 31 85% 55%;            /* Orange */
```

### Tailwind Classes
Use Tailwind utility classes directly:

```html
<!-- Primary button -->
<button class="bg-primary text-primary-foreground rounded-lg px-4 py-2">
  Action
</button>

<!-- Urgent/high priority item -->
<div class="border-l-4 border-destructive bg-destructive/10 p-4">
  High Priority
</div>

<!-- Medium priority item -->
<div class="border-l-4 border-warning bg-warning/10 p-4">
  Medium Priority
</div>
```

## Component Examples

### Task Item with Priority

```
┌─ High Priority (Red border)
│ ├─ [✓] Call Patient A (Follow-up)
│ ├─ PHONE | Today, 2:30 PM
│ └─ Red badge: Overdue by 2 hours
└─

Normal Task (Green tint)
├─ [ ] Review Lab Results
├─ EMAIL | Today, 4:00 PM
└─ No badge
```

### Calendar Event

```
Week View
Mon | Tue | Wed | Thu | Fri
-----|-----|-----|-----|-----
  1  |  2  |  3  |  4  |  5
     |     |     |     |
[ Patient Intake ] (Green)
  9:00 AM - 10:00 AM

[ Therapy Session ] (Green)
  2:00 PM - 3:00 PM

[ Staff Meeting ] (Red)
  3:30 PM - 4:30 PM
```

## Design Principles

1. **Clinical Authority**: Professional colors convey trust
2. **Clear Hierarchy**: Size, weight, and color create visual order
3. **Accessibility First**: High contrast, no color-only indicators
4. **Minimal Distractions**: Clean layouts, purposeful use of color
5. **Consistent Experience**: Predictable component behavior
6. **Responsive Design**: Works across devices seamlessly

## Migration from Previous Design

### What Changed
- **Primary Color**: Teal (#25695d) → Forest Green (#2d5740)
- **Sidebar**: Updated to forest green theme
- **Priority Colors**: Added distinct red and orange
- **Typography**: Enhanced hierarchy with better sizing

### What Stayed the Same
- **Component structure**: All components work the same
- **Layout patterns**: No layout changes required
- **Functionality**: All features remain unchanged
- **Responsive behavior**: Mobile/tablet experience unchanged

## Future Enhancements

Potential improvements for future iterations:

- [ ] Animated color transitions
- [ ] Advanced color theming options
- [ ] Custom theme builder for organizations
- [ ] High contrast mode for accessibility
- [ ] Color blind friendly palette option
- [ ] Animated transitions between color states
