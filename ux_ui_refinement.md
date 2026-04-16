# UX/UI Refinement — Home Budget Tracker (HBT)

## 🎯 OBJECTIF

Refactor the existing Home Budget Tracker (HBT) into a premium, ultra-fluid, emotionally warm and frictionless experience, designed for daily usage with zero cognitive load.

The application must feel:
- Fast (perceived performance > actual performance)
- Simple (no unnecessary decisions)
- Reassuring (financial clarity reduces anxiety)
- Pleasant (micro-delight interactions)

Target: Best-in-class UX for shared expenses apps

---

## 🧠 CORE UX PRINCIPLES (NON-NEGOTIABLE)

### 1. Zero Cognitive Friction
- Every screen must answer: “What should I do next?”
- Max 1 primary action per view
- Reduce visible inputs → progressive disclosure

### 2. Action-Oriented UI
- Replace passive screens with actionable ones
- Example:
  - ❌ “Expenses list”
  - ✅ “Add / Understand / Settle expenses”

### 3. Instant Feedback Everywhere
- Every user action → visual feedback < 100ms
- Use:
  - loading skeletons
  - optimistic UI updates
  - subtle animations

### 4. Emotional Design Layer
- Finance = stress → UI must reduce tension
- Use:
  - soft colors
  - friendly wording
  - clear balance visibility

---

## 🎨 VISUAL DESIGN SYSTEM

### Color Strategy
```
primary: #3B82F6
success: #22C55E
danger: #EF4444
background: #F9FAFB
card: #FFFFFF
text-primary: #111827
text-secondary: #6B7280
```

### Typography
- Font: Inter / System UI
- Title: 24–28px semibold
- Section: 18px medium
- Body: 14–16px regular
- Micro: 12px muted

### Spacing System
- 8px grid system
- Cards: padding 16–20px
- Sections: spacing 24–32px

---

## 🧩 GLOBAL LAYOUT REFACTOR

### Sticky Top Bar
- Left: Logo (HBT)
- Center: Page title (dynamic)
- Right: Profile / Logout

### Bottom Navigation (Mobile-first)
```
[ Dashboard ] [ Households ] [ + ] [ Expenses ] [ Profile ]
```

👉 The “+” button = primary action (Add Expense)

---

## 🏠 DASHBOARD REFACTOR

### Global Balance Card (Hero)
```
You are owed: +€100
You owe: -€50
Net: +€50
```
- Color-coded
- Animated number on load
- Tap → detail view

### Household Cards
- Name
- Net balance
- Last activity
- Hover elevation
- Click ripple

### Smart CTA
- Add an expense
- Settle balances

---

## 🧾 EXPENSE FLOW (MAJOR UX REWRITE)

### Conversational Input UX

#### Step 1: Amount
- Large input
- Numeric keyboard

#### Step 2: Description
- Presets + custom

#### Step 3: Who paid
- Default: current user

#### Step 4: Split
- Default: equal
- Advanced optional

👉 Show steps progressively

### Micro-interactions
- Auto-focus
- Smooth transitions
- Success animation

---

## 👥 HOUSEHOLD PAGE REFACTOR

### Header Card
- Name
- Balance
- Members count

### Members List
- Avatar
- Name
- Balance (color-coded)

### Invite UX
- Modal
- Success toast

---

## ⚡ PERFORMANCE UX

### Skeleton Loaders
- Replace empty states

### Optimistic UI
- Immediate feedback

### Transitions
- 150–250ms animations

---

## 🎯 MICRO-INTERACTIONS

- Hover scale (1.02)
- Click ripple
- Card elevation
- Success animation
- Error shake

---

## 🔁 STATE MANAGEMENT UX

- No full reload
- Preserve scroll
- Instant navigation

---

## 📱 MOBILE-FIRST

- Thumb-friendly
- Bottom CTA
- Auto-focus inputs

---

## 🧪 UX METRICS TARGET

- Add expense < 5s
- Zero unnecessary clicks
- Instant perceived speed

---

## 🧠 FINAL INSTRUCTIONS

Refactor in order:
1. Design System
2. Layout
3. Dashboard
4. Expense Flow
5. Interactions
6. Performance

Rules:
- No unnecessary complexity
- Clarity > completeness
- Speed > flexibility
- Intuition > logic

---

## 🔥 EXPECTED OUTPUT

- Clean UI (Stripe / Linear quality)
- Fluid interactions
- Minimal cognitive load
- Strong hierarchy

---

## EXTENSIONS (OPTIONAL)

- Dark mode
- Sound feedback
- Gesture navigation
