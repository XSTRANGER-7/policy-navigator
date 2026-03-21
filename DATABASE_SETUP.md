# 🚀 Policy Navigator - Database Setup Guide

## Current Status
- ✅ Python scraper works (generates 39 builtin schemes)
- ✅ Frontend APIs built and deployed
- ❌ **Database schema NOT deployed to Supabase**
- ❌ **No schemes in database**

## What You Need to Do

### Step 1: Deploy Database Schema (5 minutes)

The `supabase/schema.sql` file defines the database structure. You need to run it in Supabase:

1. **Open Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard
   - Select project: `pfffwfhnvkivrrhrlesv`

2. **Execute the SQL:**
   - Click: **SQL Editor** (left sidebar)
   - Click: **New Query** (or paste into blank editor)
   - Open file: `supabase/schema.sql` (in your project root)
   - Copy entire contents
   - Paste into Supabase SQL editor
   - Click: **Run** (blue button, top-right)

3. **Verify Success:**
   - You should see: `Query executed successfully`
   - The `schemes` table is now created

### Step 2: Seed Builtin Schemes (2 minutes)

Run the Python scraper to populate the database with 39 builtin government schemes:

```bash
cd policy-navigator
python scripts/scrape_schemes.py --source builtin --save-db
```

**Expected Output:**
```
✓ Loaded 39 built-in schemes ✓
📋 Total unique schemes: 39
Saved to database: 39 schemes
```

### Step 3: Verify and Test (1 minute)

1. **Start development server:**
   ```bash
   cd web
   npm run dev
   ```

2. **Test Policies Page:**
   - Visit: http://localhost:3000/policies
   - You should see 11 general schemes displayed

3. **Test Schemes Page:**
   - Visit: http://localhost:3000/schemes
   - You should see all 39 schemes
   - Try filtering by category
   - Try the "Run Scraper" button to fetch live government schemes

## Troubleshooting

### "No schemes showing" on /policies or /schemes

**Check 1: Is schema deployed?**
```bash
# Visit Supabase Dashboard → SQL Editor
# Run this query:
SELECT COUNT(*) FROM information_schema.tables WHERE table_name='schemes';
```
- If result is 0: Schema not deployed (do Step 1)
- If result is 1: Schema exists, but no data

**Check 2: Are schemes in database?**
```bash
# Run in Supabase SQL Editor:
SELECT COUNT(*) FROM schemes;
```
- If result is 0: Database is empty (do Step 2)
- If result > 0: Data exists, check API (see below)

### "Failed to load policies" error in browser

**Check API response:**
```bash
# Test the API directly:
curl "http://localhost:3000/api/policies"
```

**Common errors:**
- `"error": "Database schema not initialized"` → Do Step 1
- `"error": "does not exist"` → Schema table missing, do Step 1
- Empty array `[]` → Step 2 not run yet

### Scraper button not working

1. Make sure schema is deployed (Step 1)
2. Make sure some schemes are in database (Step 2)
3. The scraper will then ADD more schemes from live sources
4. Click "Run Scraper" → Select "builtin" → See new schemes appear

## File Locations

- **Schema definition:** `supabase/schema.sql`
- **Scraper script:** `scripts/scrape_schemes.py`
- **Deployment helpers:**
  - `scripts/deploy-schema.js` - (WIP) Auto-deploy helper
  - `scripts/setup-db.js` - (WIP) Full setup wizard

## Architecture

```
┌─────────────────────┐
│  Web Frontend       │
│ /policies           │
│ /schemes            │
└──────────┬──────────┘
           │ fetch /api/policies, /api/schemes
┌──────────▼──────────┐
│  Next.js API Routes │
│ /api/policies       │
│ /api/schemes        │
│ /api/scrape         │
└──────────┬──────────┘
           │ query via Supabase client
┌──────────▼──────────┐
│  Supabase (PostgreSQL)
│  schemes table      │
│  (39+ rows)         │
└─────────────────────┘
```

## Next Steps After Setup

1. Go to `/schemes` page
2. Click "Run Scraper" button
3. Select "builtin" or "live" source
4. Scraper will fetch schemes and save to DB
5. Page will auto-refresh with new schemes

---

**Still having issues?** Check the API error messages in browser DevTools → Network tab → Click failed request → View Response.
