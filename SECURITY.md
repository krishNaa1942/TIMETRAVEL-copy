# Security — Key Rotation Required

## Background

The repository's `.env` file and a plaintext password (`Lucky@1942`) were previously committed to git history. A `git filter-repo` purge has **replaced** all occurrences of these secrets with `REDACTED` in prior commits, but the original secret values **remain valid** at their respective providers until rotated.

Treat all secrets below as **compromised**.

## Exposed Secrets

### Credential / Password
| Secret | Location | Action |
|--------|----------|--------|
| Supabase password `Lucky@1942` | in connection strings in old git history | **Change password** in Supabase dashboard |

### API Keys — Rotate at Provider
| # | Key | Provider | Rotate At |
|---|-----|----------|-----------|
| 1 | `SUPABASE_URL` | Supabase project URL | [Supabase → Settings → API](https://supabase.com/dashboard) |
| 2 | `SUPABASE_KEY` (anon) | Supabase | Same — regenerate anon key |
| 3 | `SUPABASE_SERVICE_KEY` | Supabase | Same — regenerate service_role key |
| 4 | `GOOGLE_API_KEY` | Google Gemini AI | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| 5 | `OPENWEATHER_API_KEY` | OpenWeatherMap | [OpenWeatherMap](https://home.openweathermap.org/api_keys) |
| 6 | `UNSPLASH_ACCESS_KEY` | Unsplash | [Unsplash Developers](https://unsplash.com/developers) |
| 7 | `UNSPLASH_SECRET_KEY` | Unsplash | Same |
| 8 | `TOMTOM_API_KEY` | TomTom Maps | [TomTom Developer](https://developer.tomtom.com/) |
| 9 | `FOURSQUARE_API_KEY` | Foursquare Places | [Foursquare Developer](https://developer.foursquare.com/) |
| 10 | `FOURSQUARE_CLIENT_ID` | Foursquare | Same |
| 11 | `FOURSQUARE_CLIENT_SECRET` | Foursquare | Same |
| 12 | `NEWSAPI_KEY` | NewsAPI | [NewsAPI](https://newsapi.org/account) |
| 13 | `SECRET_KEY` | Flask session signing | Generate new: `python -c "import secrets; print(secrets.token_hex(32))"` |
| 14 | `DATABASE_URL` (if set) | PostgreSQL / Supabase | Rotate DB password in Supabase dashboard |

### OAuth Client IDs (Mobile)
| Key | Provider | Rotate At |
|-----|----------|-----------|
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth | Same |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google OAuth | Same |
| `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID` | Google OAuth | Same |

## Rotation Procedure

1. **Rotate secrets at each provider** using the links above
2. **Update `.env` files** (backend + mobile) with new values
3. **Update K8s secrets** if deployed:
   ```bash
   ./deploy/kubernetes/setup-secrets.sh
   ```
4. **Verify** the app works with new keys, then **revoke/destroy old keys** at each provider
5. **Force-push** the cleaned history:
   ```bash
   git remote add origin <new-or-url>
   git push --force --all
   ```
6. **Notify all collaborators** to re-clone (not `git pull`)
