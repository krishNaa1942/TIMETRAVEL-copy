# Contributing to TimeTravel

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

1. **Fork & clone** the repository
2. **Copy** `.env.example` to `.env` and fill in your API keys
3. **Install backend** dependencies:
   ```bash
   cd "TIMETRAVEL copy"
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
4. **Install frontend** dependencies:
   ```bash
   cd TimeTravelMobile
   npm install
   ```
5. **Run the stack**:
   ```bash
   # Terminal 1 — Backend
   .venv/bin/python run.py

   # Terminal 2 — Frontend
   cd TimeTravelMobile && npx expo start --web
   ```

## Project Structure

```
├── app/                  # Flask backend (blueprints, models, services)
├── TimeTravelMobile/     # React Native (Expo) frontend
│   ├── src/screens/      # Screen components
│   ├── src/navigation/   # NavOS navigation system
│   ├── src/api/          # API client & React Query hooks
│   ├── src/stores/       # Zustand state management
│   └── src/components/   # Reusable UI components
├── supabase/             # Database schema & migrations
└── data/                 # Curated destination data
```

## Code Standards

### TypeScript (Frontend)
- Use functional components with hooks
- Wrap expensive renders in `React.memo`
- Use `useCallback` / `useMemo` for stable references
- Use `FlashList` instead of `FlatList` for lists
- Import icons explicitly: `import { MaterialCommunityIcons } from '@expo/vector-icons'`

### Python (Backend)
- Follow Flask blueprint pattern for new routes
- Use SQLAlchemy models for database access
- Add proper error handling and logging
- Rate-limit all public endpoints

## Pull Request Process

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes with clear commit messages
3. Ensure no TypeScript errors: `npx tsc --noEmit`
4. Test on both web and mobile
5. Open a PR with a description of what changed and why
