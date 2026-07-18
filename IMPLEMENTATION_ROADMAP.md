# 🚀 TimeTravelMobile: Implementation Roadmap

**Target:** Full working mobile app + Android APK for submission in **2-3 weeks**

---

## 📅 WEEK-BY-WEEK BREAKDOWN

### **WEEK 1: Foundation & Setup**

#### **Days 1-2: Project Setup**

- [ ] Install Node.js, npm, Expo CLI
- [ ] Run setup script: `chmod +x SETUP_MOBILE_APP.sh && ./SETUP_MOBILE_APP.sh`
- [ ] OR create manually: `npx create-expo-app@latest TimeTravelMobile`
- [ ] Install all dependencies
- [ ] Create folder structure
- [ ] Test with `npx expo start`

**Time:** 2-3 hours  
**Verification:** See Expo QR code in terminal

#### **Days 2-3: Theme & Core Setup**

- [ ] Copy `STARTER_colors.ts` → `src/theme/colors.ts`
- [ ] Create `src/constants/config.ts` with API URL
- [ ] Create `src/types/index.ts` with type definitions
- [ ] Create `src/theme/index.ts` to export theme

**Code Example:**

```bash
# Copy starter files
cp STARTER_colors.ts src/theme/colors.ts
cp STARTER_package.json package.json  # Use this as reference
cp STARTER_App.tsx App.tsx
```

**Time:** 2-3 hours  
**Verification:** App compiles, no TypeScript errors

#### **Days 4-5: State Management & API**

- [ ] Copy `STARTER_authStore.ts` → `src/stores/authStore.ts`
- [ ] Create `src/stores/uiStore.ts` (theme toggle)
- [ ] Copy `STARTER_api.ts` → `src/services/api.ts`
- [ ] Copy `STARTER_authService.ts` → `src/services/auth.ts`
- [ ] Create remaining service files (trips, chatbot, weather, etc.)

**Services to create:**

```typescript
// src/services/trips.ts
// src/services/chatbot.ts
// src/services/weather.ts
// src/services/safety.ts
// src/services/maps.ts
// src/services/news.ts
```

**Time:** 3-4 hours  
**Verification:** No import errors, services export correctly

#### **Days 5-7: Navigation Setup**

- [ ] Create `src/navigation/RootNavigator.tsx`
- [ ] Create `src/navigation/BottomTabNavigator.tsx`
- [ ] Test navigation structure with mock screens

**File Structure Expected:**

```
src/
├── navigation/
│   ├── RootNavigator.tsx      ✓ Done
│   └── BottomTabNavigator.tsx ✓ Done
├── stores/
│   ├── authStore.ts           ✓ Done
│   └── uiStore.ts             ✓ Done
├── services/
│   ├── api.ts                 ✓ Done
│   ├── auth.ts                ✓ Done
│   ├── trips.ts               ✓ Done
│   ├── chatbot.ts             ✓ Done
│   └── ...others              ✓ Done
├── theme/
│   ├── colors.ts              ✓ Done
│   └── index.ts               ✓ Done
└── constants/
    └── config.ts              ✓ Done
```

**Time:** 2-3 hours  
**Verification:** App runs with tab navigation, can switch tabs

---

### **WEEK 2: Core Screens Implementation**

#### **Days 1-2: Authentication Screens**

- [ ] Create `src/screens/AuthScreen.tsx`
  - Login form
  - Register form
  - Form validation
  - Error handling
  - Loading state

**Features:**

- Toggle between login/register
- Password visibility toggle
- Error message display
- Loading spinner

**Time:** 3-4 hours  
**Testing:** Try login with test credentials

#### **Days 2-3: Home Screen**

- [ ] Create `src/screens/HomeScreen.tsx`
  - Fetch trips from API
  - Display trip cards
  - Welcome message
  - Pull-to-refresh
  - Empty state
  - Quick action buttons

**API Calls:**

```typescript
// GET /api/trips
```

**Time:** 2-3 hours  
**Testing:** Login → See trips listed (or empty state)

#### **Days 3-4: Reusable Components**

- [ ] Create `src/components/Common/LoadingSpinner.tsx`
- [ ] Create `src/components/Common/ErrorMessage.tsx`
- [ ] Create `src/components/Features/ChatBubble.tsx`
- [ ] Create `src/components/Features/TripCard.tsx`
- [ ] Create `src/components/Features/BudgetChart.tsx`

**Time:** 2 hours  
**Verification:** Components render without errors

#### **Days 4-5: Chat Screen**

- [ ] Create `src/screens/ChatScreen.tsx`
  - Message list (FlatList)
  - Chat bubbles (user/assistant)
  - Text input
  - Send button
  - Auto-scroll to latest message
  - Loading indicator

**API Calls:**

```typescript
// POST /api/chatbot/message
```

**Time:** 3-4 hours  
**Testing:** Type message → See bot response

#### **Days 6-7: Itinerary Screen**

- [ ] Create `src/screens/ItineraryScreen.tsx`
  - List all itineraries
  - Show trip details
  - Daily activities
  - Timeline view
  - Add activity button

**API Calls:**

```typescript
// GET /api/trips/:id
// GET /api/trips/:id/itinerary
// POST /api/trips/:id/itinerary
```

**Time:** 4-5 hours

---

### **WEEK 3: Polish & Deployment**

#### **Days 1-2: Additional Screens**

- [ ] Create `src/screens/BudgetScreen.tsx` (Tools screen)
  - Budget overview
  - Expense tracker
  - Currency conversion
  - Budget alerts

- [ ] Create `src/screens/ExploreScreen.tsx`
  - Gallery view
  - Destination cards
  - Search/filter
  - Share functionality

- [ ] Create `src/screens/ProfileScreen.tsx`
  - User info
  - Settings
  - Dark mode toggle
  - Logout button

**Time:** 4-5 hours

#### **Days 3-4: Testing & Bug Fixes**

- [ ] Test on Expo Go (iOS/Android)
- [ ] Test on Android emulator
- [ ] Fix any connectivity issues
- [ ] Add error boundaries
- [ ] Test edge cases

**Testing Checklist:**

- [ ] Auth flow (register → login → logout)
- [ ] API calls return data correctly
- [ ] Offline state handled
- [ ] Images load properly
- [ ] Navigation works smoothly
- [ ] Forms validate correctly

**Time:** 3-4 hours

#### **Days 5-6: APK Build & Submission Setup**

- [ ] Add app icon (1024×1024)
- [ ] Add splash screen (1242×2436)
- [ ] Update app.json with metadata
- [ ] Build APK:

```bash
npx eas login
npx eas build --platform android
```

- [ ] Download & test APK on device
- [ ] Fix any runtime issues
- [ ] Prepare submission materials

**Time:** 2-3 hours

#### **Day 7: Documentation & Submission**

- [ ] Update README.md
- [ ] Document setup instructions
- [ ] Add screenshots
- [ ] Submit APK

**Time:** 1-2 hours

---

## 📋 DAILY TASK CHECKLIST

### **Day 1 Task List**

```
Setup & Installation
├─ [ ] Install Node.js & npm
├─ [ ] Install Expo CLI globally
├─ [ ] Verify: node --version, npm --version, expo --version
├─ [ ] Create Expo project
├─ [ ] Install dependencies
├─ [ ] Verify: npx expo start works
└─ [ ] Commit to git
```

### **Day 2-3 Task List**

```
Project Structure & Theme
├─ [ ] Create folder structure
├─ [ ] Copy theme files
├─ [ ] Create types file
├─ [ ] Create config file
├─ [ ] Update App.tsx
├─ [ ] Test theme application
└─ [ ] Commit to git
```

### **Day 4-5 Task List**

```
State Management & API
├─ [ ] Create auth store (Zustand)
├─ [ ] Create UI store
├─ [ ] Create API service (axios)
├─ [ ] Create auth service endpoints
├─ [ ] Create trips service
├─ [ ] Create chatbot service
├─ [ ] Create other services
├─ [ ] Test API connections
└─ [ ] Commit to git
```

### **Day 6-7 Task List**

```
Navigation Setup
├─ [ ] Create RootNavigator
├─ [ ] Create BottomTabNavigator
├─ [ ] Create placeholder screens
├─ [ ] Test navigation flow
├─ [ ] Test on Expo Go
└─ [ ] Commit to git
```

---

## 🎯 PRIORITY CHECKLIST

### **Must Have (MVP)**

- [ ] Login/Register screens
- [ ] Home screen with trip list
- [ ] Chat screen with AI
- [ ] Itinerary planner
- [ ] Navigation between screens
- [ ] API integration working
- [ ] Error handling
- [ ] Loading states

### **Should Have (Polish)**

- [ ] Dark/Light theme toggle
- [ ] Pull-to-refresh
- [ ] Offline caching
- [ ] Better UI animations
- [ ] Form validation messages
- [ ] Camera integration
- [ ] Image gallery

### **Nice to Have (Bonus)**

- [ ] Push notifications
- [ ] App sharing
- [ ] PDF export
- [ ] Maps integration
- [ ] Weather widget
- [ ] Safety ratings

---

## 🔧 BACKEND PREPARATION (Before Week 2)

Before starting mobile app screens, ensure backend is ready:

```bash
# 1. Navigate to backend
cd /Users/laxmanp/Pictures/TIMETRAVEL

# 2. Activate venv
source venv/bin/activate

# 3. Install CORS support
pip install flask-cors

# 4. Update app/main.py:
```

**Add to main Flask app:**

```python
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:*", "http://192.168.*"],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
```

```bash
# 5. Start backend
python run.py
# Should show: Running on http://0.0.0.0:5000

# 6. Get your IP
ifconfig | grep "inet " | grep -v 127.0.0.1
# Copy this to src/constants/config.ts
```

---

## 📱 TESTING WORKFLOW

### **Daily Testing Cycle**

```bash
# 1. Start backend
# Terminal 1:
cd /Users/laxmanp/Pictures/TIMETRAVEL
source venv/bin/activate
python run.py

# 2. Start mobile app
# Terminal 2:
cd /path/to/TimeTravelMobile
npx expo start

# 3. Test options:
# Press 'w' for web browser (fastest)
# Press 'i' for iOS simulator (macOS only)
# Press 'a' for Android emulator
# Scan QR code with Expo Go app (fastest mobile)
```

### **Testing Checklist Per Screen**

```
AuthScreen:
├─ [ ] Register works
├─ [ ] Login works
├─ [ ] Error messages display
├─ [ ] Loading spinner shows
└─ [ ] Navigation to home after login

HomeScreen:
├─ [ ] Trip list displays
├─ [ ] Can tap trip to open details
├─ [ ] Pull-to-refresh works
├─ [ ] Empty state shows when no trips
└─ [ ] Quick action buttons work

ChatScreen:
├─ [ ] Can type message
├─ [ ] Send button works
├─ [ ] Message appears in chat
├─ [ ] API response shows
├─ [ ] Auto-scroll to bottom
└─ [ ] Loading indicator shows during API call
```

---

## 🐛 COMMON ISSUES & SOLUTIONS

### **"Cannot connect to API"**

```
Problem: Mobile app can't reach Flask backend
Solution:
1. Check backend is running: curl http://192.168.1.100:5000/api
2. Verify IP in src/constants/config.ts is correct
3. Ensure both on same WiFi network
4. Check firewall isn't blocking port 5000
```

### **"Module not found"**

```
Problem: Package not in node_modules
Solution:
rm -rf node_modules package-lock.json
npm install
npm start --clear
```

### **"Navigation not working"**

```
Problem: Screens not switching
Solution:
1. Check RootNavigator.tsx has all screens
2. Verify authStore.token logic
3. Look at expo start console for errors
4. Rebuild: npx expo start --clear
```

### **"Keyboard overlaps input"**

```
Solution: Use KeyboardAvoidingView
import { KeyboardAvoidingView, Platform } from 'react-native';

<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
  {/* Your form */}
</KeyboardAvoidingView>
```

---

## 📦 GIT WORKFLOW

```bash
# Daily commits
git add .
git commit -m "feat: Add HomeScreen implementation"

# End of week
git tag -a v1.0.0-week-1 -m "Week 1 complete"
git push origin main
```

---

## 📊 PROGRESS TRACKING

After each day, update progress:

```markdown
# TimeTravelMobile Progress

## Week 1

- [x] Days 1-2: Project setup
- [x] Days 2-3: Theme setup
- [x] Days 4-5: State management
- [ ] Days 6-7: Navigation

## Week 2

- [ ] Days 1-2: Auth screens
- [ ] Days 2-3: Home screen
- [ ] Days 3-4: Components
- [ ] Days 4-5: Chat screen
- [ ] Days 6-7: Itinerary screen

## Week 3

- [ ] Days 1-2: Additional screens
- [ ] Days 3-4: Testing
- [ ] Days 5-6: APK build
- [ ] Day 7: Submission
```

---

## ✅ FINAL SUBMISSION CHECKLIST

Before submitting for evaluation:

```
Code Quality:
├─ [ ] No console.errors or warnings
├─ [ ] Code is formatted
├─ [ ] TypeScript has no errors
├─ [ ] Comments explain complex logic
└─ [ ] README.md is complete

Functionality:
├─ [ ] All screens load properly
├─ [ ] API integration works
├─ [ ] Auth flow works end-to-end
├─ [ ] Error handling present
├─ [ ] Loading states implemented
└─ [ ] Offline fallback works

Testing:
├─ [ ] Tested on Expo Go
├─ [ ] Tested on Android emulator
├─ [ ] Tested on physical device
├─ [ ] APK builds successfully
├─ [ ] APK installs on device
└─ [ ] All features work on device

Documentation:
├─ [ ] Setup instructions clear
├─ [ ] API documentation included
├─ [ ] Feature overview written
├─ [ ] Screenshots/demo included
└─ [ ] Known issues documented

Deployment:
├─ [ ] APK built and signed
├─ [ ] Version bumped in app.json
├─ [ ] Git tags created
├─ [ ] Code pushed to GitHub
└─ [ ] APK ready for Play Store
```

---

## 📞 HELP & RESOURCES

- **Expo Docs:** https://docs.expo.dev/
- **React Navigation:** https://reactnavigation.org/
- **React Native Paper:** https://callstack.github.io/react-native-paper/
- **Stack Overflow:** Tag: `react-native`, `expo`
- **Expo Forums:** https://forums.expo.dev/

---

**Start with Week 1 Day 1 now!** You've got this! 🚀
