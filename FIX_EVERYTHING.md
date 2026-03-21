# 🚀 COMPLETE FIX GUIDE - Schemes Not Showing & Scraper Not Working

## 📊 Current Status

```
✅ Python scraper works       - Generates 39 government schemes
✅ Frontend APIs built        - /api/policies & /api/schemes endpoints
✅ Build compiles             - No errors in Next.js build
❌ Database schema missing    - 'schemes' table not in Supabase
❌ No schemes in database     - Empty dataset
❌ Scraper not saving to DB   - Fixed: now includes saveToDb flag
❌ UI not refreshing post-scrape - Fixed: now calls fetchSchemes()
```

## 🎯 What You Need to Do (3 Simple Steps)

### STEP 1: Deploy Database Schema (Manual - 3 minutes)

The issue: **Supabase has no `schemes` table yet**

**Fix:**
1. Open: https://supabase.com/dashboard
2. Select project: `pfffwfhnvkivrrhrlesv`
3. Click: **SQL Editor** (left sidebar)
4. Click: **New Query** (or paste in blank editor)
5. **Copy/paste this entire SQL block:**

```sql
-- Create schemes table
CREATE TABLE IF NOT EXISTS schemes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  benefits TEXT,
  eligibility_text TEXT,
  rules JSONB DEFAULT '{}',
  ministry TEXT,
  official_url TEXT,
  is_active BOOLEAN DEFAULT true,
  source TEXT,
  state_specific BOOLEAN DEFAULT false,
  scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX idx_schemes_category ON schemes(category);
CREATE INDEX idx_schemes_is_active ON schemes(is_active);
CREATE INDEX idx_schemes_ministry ON schemes(ministry);
CREATE INDEX idx_schemes_source ON schemes(source);

-- Enable RLS (Row Level Security)
ALTER TABLE schemes ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for public read
CREATE POLICY "schemes_select_all" 
  ON schemes FOR SELECT 
  USING (true);

-- Create RLS policy for insert (for scraper)
CREATE POLICY "schemes_insert_all" 
  ON schemes FOR INSERT 
  WITH CHECK (true);

-- Create RLS policy for update
CREATE POLICY "schemes_update_all" 
  ON schemes FOR UPDATE 
  USING (true);
```

6. Click **RUN** (blue button, top-right)
7. You should see: `Query executed successfully`

**Verify it worked:**
- Go to **Table Editor** (left sidebar)
- You should see `schemes` table listed

### STEP 2: Seed Builtin Schemes (1 minute)

The issue: **Database is empty**

**Fix:**
```bash
cd c:\Users\Stranger\Desktop\policy-navigator
python scripts/scrape_schemes.py --source builtin --save-db
```

**Expected output:**
```
✓ Loaded 39 built-in schemes ✓
📋 Total unique schemes: 39
Saving to database...
✓ Saved 39 schemes to database
```

**If it says "Table does not exist"** → Go back to STEP 1, you didn't run the SQL

### STEP 3: Test the UI (1 minute)

1. **Start development server:**
   ```bash
   cd web
   npm run dev
   ```

2. **Visit the pages:**
   - http://localhost:3000/policies → Should show ~11 general schemes
   - http://localhost:3000/schemes → Should show all 39 schemes

3. **Test the scraper button:**
   - Click "Run Scraper" button
   - Select "builtin" source
   - Wait for results
   - Refresh the page
   - New schemes should appear

---

## 🔧 What Was Fixed (You Don't Need To Do This)

I've already fixed these issues in the code:

1. ✅ **Scraper now saves to database**
   - Changed `runScraper()` to send `saveToDb: true`
   - File: `web/app/schemes/page.tsx`

2. ✅ **UI refreshes after scrape**
   - Added `await fetchSchemes()` after scraper completes
   - File: `web/app/schemes/page.tsx`

3. ✅ **Better error messages**
   - APIs now explain what's wrong (schema missing? empty database?)
   - Files: `web/app/api/policies/route.ts` and `web/app/api/schemes/route.ts`

4. ✅ **Proper response handling**
   - Pages now check HTTP status before parsing JSON
   - Files: `web/app/policies/page.tsx` and `web/app/schemes/page.tsx`

5. ✅ **Voice utilities restored**
   - Created missing `web/lib/voiceUtils.ts`
   - Build now succeeds without errors

---

## 📋 Copy/Paste Checklist

Everything below is **100% copy/paste ready**:

### Test 1: Is schema deployed?
```bash
# Just check Supabase Dashboard → Table Editor
# Should see "schemes" table listed
```

### Test 2: Is database empty?
```sql
-- Run in Supabase SQL Editor:
SELECT COUNT(*) as scheme_count FROM schemes;
-- Should return: 39 (or more if you added more)
```

### Test 3: Can API get schemes?
```bash
# Open this in browser:
http://localhost:3000/api/schemes?limit=5
# Should return JSON array with schemes
```

### Test 4: Do pages display schemes?
```bash
# Visit page in browser:
http://localhost:3000/schemes
# Should see cards with scheme names and descriptions
```

---

## 🚨 If Something Still Doesn't Work

### Error: "Database schema not initialized"
→ You didn't run SQL in STEP 1
→ Go back and run the entire SQL block in Supabase SQL Editor

### Error: "Schemes table is empty" or "Cannot GET /api/schemes"
→ You didn't run STEP 2
→ Run: `python scripts/scrape_schemes.py --source builtin --save-db`

### Error: "Failed to load policies" but Supabase looks OK
→ Check browser DevTools → Network tab
→ Find failed request → View Response
→ Copy the error message and check what it says

### Scraper button doesn't work
→ Make sure STEP 1 and STEP 2 are complete
→ Check browser console for errors (DevTools → Console tab)
→ Take screenshot of error and we'll debug

---

## 🎓 If You Want to Understand the Architecture

```
User visits /policies → Browser fetch() → API /api/policies 
                                           ↓
                                    Supabase Client
                                           ↓
                                    PostgreSQL DB
                                        schemes table
```

**What's needed:**
1. ✅ API code (already written)
2. ✅ Supabase client config (already in .env.local)
3. ❌ **MISSING: Database table (you do STEP 1)**
4. ❌ **MISSING: Data in table (you do STEP 2)**

---

## ✅ Final Checklist

- [ ] STEP 1: Schema SQL executed in Supabase
- [ ] STEP 2: Python scraper completed (39 schemes saved)
- [ ] STEP 3: Dev server running (`npm run dev` in web/)
- [ ] Policies page shows schemes (http://localhost:3000/policies)
- [ ] Schemes page shows schemes (http://localhost:3000/schemes)
- [ ] Scraper button works (click → select → wait → refresh)

---

If you complete all 3 steps exactly as described, **everything will work**. 

**Start now with STEP 1:**
1. https://supabase.com/dashboard
2. Find pfffwfhnvkivrrhrlesv project
3. SQL Editor → New Query → Copy/paste the SQL above → Run
