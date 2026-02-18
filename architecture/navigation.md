# Navigation Architecture

## Overview

MathSharthi uses a single **Stack Navigator** (`@react-navigation/stack`) as its root, with **16 active screens**. All screens disable React Navigation's default header in favor of custom animated header components. The app's entry point (`App.js`) acts as a **session gate**, conditionally routing users based on stored authentication state.

---

## Navigation Hierarchy

```
NavigationContainer
└── Stack.Navigator (initialRoute: dynamic)
    │
    ├── Landing Module
    │   ├── Home            ← Landing page shell (ScrollView with refs)
    │   ├── About           ← Standalone about section
    │   ├── Service         ← "How it Works" carousel
    │   ├── Pricing         ← Subscription CTA + modal launcher
    │   └── Footer          ← Contact + social links
    │
    ├── Authentication Module
    │   ├── Login           ← Email/password + forgot-password modal chain
    │   └── Signup          ← Registration + OTP verification modal
    │
    ├── AI Chat Module
    │   ├── Chat            ← Primary AI chat interface (ChatScreen)
    │   ├── ChatBox         ← Alternate detailed chat view
    │   └── CameraScreen    ← Camera capture → crop → upload
    │
    ├── AI Tutor Module
    │   ├── AiTutorWelcome  ← Animated splash/welcome screen
    │   └── AiTutor         ← Voice-enabled tutor chat (AiTutorChat)
    │
    ├── AI Tools Module
    │   ├── Aiwriter        ← Blog generation input form
    │   ├── Aicontentscreen ← Generated content display
    │   ├── Aipara          ← Paraphraser input form
    │   └── Paracontent     ← Paraphrased content display
    │
    └── Payments Module
        └── Subscription    ← Plan selection + Razorpay checkout
```

> **Note:** `AiTutorCameraScreen` is registered but commented out in the current build. `SubscriptionModal` renders as a child modal inside `ChatHeader`, not as a standalone screen.

---

## Stack Usage

All screens are registered at the **top level** of a single Stack Navigator — there are no nested navigators (no Tab, Drawer, or nested Stack navigators).

```
headerShown: false   →  15 screens (custom headers)
headerShown: true    →  1 screen (Subscription — uses default back arrow)
```

**Custom header components:**

| Header | Used By | Features |
|---|---|---|
| `Header.js` | Landing pages (Home, About, etc.) | Animated slide drawer (280px), menu items, login/signup links |
| `ChatHeader.js` | Chat + AI screens | Animated drawer, profile dropdown, subscription modal, logout, chat history toggle |

Both headers use `Animated.timing` on `translateX` for the drawer slide and `opacity` for the overlay.

---

## Screen Flow Patterns

### Landing → Auth → Chat

```
Home ──► Login ──► Chat
  │         ▲
  └──► Signup ─┘
```

### Chat → AI Tools (two-screen flows)

```
Chat drawer ──► Aiwriter ──► Aicontentscreen
                                  │
                                  └──► (back to Chat)

Chat drawer ──► Aipara ──► Paracontent
                               │
                               └──► (back to Chat)
```

### Chat → Camera → Chat (round-trip)

```
Chat ──► CameraScreen ──► (capture + crop + upload) ──► Chat
              │
              └──► MessagesContext updated with image + AI response
```

### Chat → AI Tutor

```
Chat drawer ──► AiTutorWelcome ──► AiTutor (voice chat)
                                       │
                                       └──► (back to Chat via BackHandler)
```

### Chat Header → Subscription

```
ChatHeader drawer ──► Subscription modal ──► Subscription screen ──► Razorpay ──► (back)
```

---

## Session Gating

`App.js` implements a **two-phase auth check** on mount:

```
Phase 1: Check Session Expiry
│
├── Read "loginTime" from AsyncStorage
├── Compare against current time
├── If elapsed > SESSION_DURATION (1 hour):
│   ├── Clear all stored credentials
│   └── Set sessionExpired flag → triggers Alert on render
│
Phase 2: Determine Initial Route
│
├── Read "authToken" from AsyncStorage
├── If token exists → initialRoute = "Chat"
└── If no token → initialRoute = "Home"
```

**Stored keys:** `authToken`, `userName`, `userEmail`, `loginTime`

While `initialRoute` is `null` (async check in progress), the app renders nothing (`return null`), preventing route flash.

---

## Param Passing

Screen-to-screen data is passed via React Navigation's `route.params`:

| Source | Target | Params Passed |
|---|---|---|
| `Aiwriter` | `Aicontentscreen` | `{ topic, wordCount, blogStyle }` |
| `Aipara` | `Paracontent` | `{ inputText, style }` |
| `CameraScreen` | `Chat` | Image URI, AI response, and message context updates (via `MessagesContext`) |
| `ChatHeader` | `Subscription` | — (navigates directly) |
| `AiTutorCameraScreen` | `AiTutor` | `{ tempId, imageUri, aiResponse, audioContent, fileData, fileMetadata }` |

> **Design note:** The camera screens use a hybrid approach — `MessagesContext` for message state updates and `route.params` for metadata. This avoids prop drilling while keeping the message array centralized.
