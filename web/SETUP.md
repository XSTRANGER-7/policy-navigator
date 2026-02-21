# Setup Guide: Getting the Project Running

## Prerequisites
- Node.js 18+
- npm
- A Supabase account (free at https://app.supabase.com)

## Quickstart (Development)

### 1. Get Your Supabase Keys
1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Select your project (or create a new one)
3. Go to **Settings** → **API** to find:
   - **Project URL** (under "API URL")
   - **Public Anon Key** (under "Project API keys")
   - **Service Role Key** (under "Project API keys" — keep this secret!)

### 2. Configure Environment Variables
Create or update `web/.env.local`:
```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service_role_your_actual_key_here
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
N8N_CITIZEN_WEBHOOK=http://localhost:5678/webhook/citizen-agent
```

### 3. (Optional) Disable RLS for Development
If you don't have the service role key handy, you can temporarily disable RLS:

1. Go to your Supabase dashboard
2. Click **SQL Editor** (left sidebar)
3. Create a new query and run: [see `supabase/disable-rls-dev.sql`](./supabase/disable-rls-dev.sql)
4. This allows writes with the anon key during development

⚠️ **Don't do this in production!** Always use proper RLS policies + service role key in production.

### 4. Start the Dev Server
```bash
cd web
npm run dev -- --webpack
```

Visit **http://localhost:3000** in your browser.

### 5. Test the Form
1. Fill out the citizen form on the homepage
2. Click **Check Eligibility**
3. You should see a success message or a clear error

## Troubleshooting

### "Invalid API key" error
- Verify your keys are correct in `.env.local`
- Make sure you copied the full key from Supabase (no truncation)

### "Supabase not configured"
- Check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Restart the dev server after updating `.env.local`

### "new row violates row-level security policy"
- Solution 1: Set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
- Solution 2: Disable RLS on tables (development only, using the SQL above)
- Solution 3: Create proper RLS policies in Supabase

## Folder Structure
```
web/
├── app/
│   ├── api/
│   │   ├── citizen/      # POST endpoint to insert citizens
│   │   ├── eligibility/  # GET endpoint for eligibility
│   │   └── vc/          # GET endpoint for verifiable credentials
│   ├── page.tsx         # Home page
│   └── layout.tsx       # Root layout
├── components/
│   ├── CitizenForm.tsx  # Form for submitting citizen data
│   ├── SchemeCard.tsx   # Card component for schemes
│   └── VCBadge.tsx      # Badge for credentials
├── libs/
│   ├── serverSupabase.ts # Supabase server client (service role key)
│   ├── n8nClient.ts     # N8N webhook calls
│   └── supabaseClient.ts # Supabase client (anon key, browser-safe)
├── .env.local           # Environment variables (local, not in git)
└── .env.example         # Example .env.local template
```

## Next Steps
- [ ] Integrate with N8N for citizen agent processing
- [ ] Implement eligibility rules
- [ ] Generate verifiable credentials
- [ ] Deploy to production with proper RLS policies
