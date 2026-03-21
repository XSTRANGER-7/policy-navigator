#!/usr/bin/env node
/**
 * Quick check: Is the 'schemes' table deployed in Supabase?
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

// Load env from web/.env.local
const envPath = path.join(__dirname, "..", "web", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
envContent.split("\n").forEach((line) => {
  if (line.trim() && !line.startsWith("#")) {
    const [k, v] = line.split("=");
    if (k && v) env[k.trim()] = v.trim();
  }
});

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase credentials in web/.env.local");
  process.exit(1);
}

async function checkSchema() {
  console.log("\n🔍 Checking if 'schemes' table exists in Supabase...\n");

  const projectId = SUPABASE_URL.split(".")[0].replace("https://", "");
  console.log(`   Project: ${projectId}`);
  console.log(`   URL: ${SUPABASE_URL}`);

  // Try to fetch from the schemes table
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/schemes?limit=1`);

    const response = await new Promise((resolve, reject) => {
      https
        .get(url, {
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            apikey: ANON_KEY,
          },
        })
        .on("error", reject)
        .on("response", (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            resolve({ status: res.statusCode, body });
          });
        });
    });

    if (response.status === 404) {
      console.log("\n❌ Database schema NOT deployed\n");
      console.log("   The 'schemes' table does not exist.");
      console.log("\n📌 To fix this:\n");
      console.log("   1. Login to Supabase Dashboard:");
      console.log("      https://supabase.com/dashboard");
      console.log("\n   2. Select project: pfffwfhnvkivrrhrlesv");
      console.log("\n   3. Go to: SQL Editor → New Query");
      console.log("\n   4. Open and copy: supabase/schema.sql");
      console.log("\n   5. Paste into SQL editor and click RUN");
      console.log("\n   6. Then seed with: python scripts/scrape_schemes.py --source builtin --save-db\n");
      return false;
    }

    if (response.status === 200) {
      const data = JSON.parse(response.body);
      if (Array.isArray(data)) {
        console.log(
          `\n✅ Database schema IS deployed\n`
        );
        console.log(
          `   Found ${data.length} schemes in database`
        );

        if (data.length === 0) {
          console.log("\n⚠️  But database is EMPTY");
          console.log("\n   Seed with: python scripts/scrape_schemes.py --source builtin --save-db\n");
          return "empty";
        }
        console.log("\n   ✓ Ready to use!\n");
        return true;
      }
    }

    console.log(`\n⚠️  Unexpected response: ${response.status}\n`);
    return null;
  } catch (err) {
    console.error("\n❌ Connection error:", err.message);
    console.log("\n   Check your Supabase credentials in web/.env.local\n");
    return false;
  }
}

checkSchema().then((result) => {
  if (result === false) process.exit(1);
  if (result === null) process.exit(2);
});
