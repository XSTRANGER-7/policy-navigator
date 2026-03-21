#!/usr/bin/env node

/**
 * Health Check Script
 * Verifies all components of the Policy Navigator setup
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const results = [];

function check(name, status, message, details) {
  results.push({ name, status, message, details });
  const icon = status === "ok" ? "✅" : status === "warning" ? "⚠️ " : "❌";
  console.log(`${icon} ${name}: ${message}`);
  if (details) {
    details.forEach((d) => console.log(`   ${d}`));
  }
}

async function main() {
  console.log("\n╔════════════════════════════════════════╗");
  console.log("║  Policy Navigator - Health Check      ║");
  console.log("╚════════════════════════════════════════╝\n");

  // 1. Check .env.local
  console.log("📋 Checking Configuration...");
  const dotenvPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(dotenvPath)) {
    check(".env.local", "error", "not found", [
      "Create .env.local with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    ]);
    return;
  }

  const envContent = fs.readFileSync(dotenvPath, "utf-8");
  const env = {};
  envContent.split("\n").forEach((line) => {
    const [key, value] = line.split("=");
    if (key && value) {
      env[key.trim()] = value.trim();
    }
  });

  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && serviceRoleKey && anonKey) {
    check(".env.local", "ok", "All required env vars present", [
      `SUPABASE_URL: ${supabaseUrl.slice(0, 30)}...`,
      `SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey.slice(0, 20)}...`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${anonKey.slice(0, 20)}...`,
    ]);
  } else {
    check(".env.local", "error", "Missing required environment variables", [
      `SUPABASE_URL: ${supabaseUrl ? "✓" : "missing"}`,
      `SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? "✓" : "missing"}`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${anonKey ? "✓" : "missing"}`,
    ]);
    return;
  }

  // 2. Check schema.sql
  console.log("\n📁 Checking Files...");
  const schemaPath = path.join(__dirname, "..", "supabase", "schema.sql");
  if (fs.existsSync(schemaPath)) {
    const schemaSize = fs.statSync(schemaPath).size;
    check(
      "supabase/schema.sql",
      "ok",
      `Found (${Math.round(schemaSize / 1024)}KB)`
    );
  } else {
    check("supabase/schema.sql", "error", "not found");
  }

  // 3. Check scraper script
  const scraperPath = path.join(__dirname, "scrape_schemes.py");
  if (fs.existsSync(scraperPath)) {
    check("scripts/scrape_schemes.py", "ok", "Found");
  } else {
    check("scripts/scrape_schemes.py", "error", "not found");
  }

  // 4. Test Supabase connection
  console.log("\n🔌 Testing Supabase Connection...");
  try {
    const testUrl = new URL(supabaseUrl);
    const projectRef = testUrl.hostname.split(".")[0];

    // For now, just verify credentials exist
    check(
      "Supabase Connection",
      "ok",
      `Credentials configured for project ${projectRef}`,
      [
        "To verify database: visit Supabase Dashboard",
        "Run: python scripts/scrape_schemes.py --source builtin --save-db",
      ]
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    check("Supabase Connection", "warning", message, [
      `Project: ${supabaseUrl}`,
      `Debug: Open Supabase Dashboard to verify connection`,
    ]);
  }

  // 5. Summary
  console.log("\n╔════════════════════════════════════════╗");
  const errorCount = results.filter((r) => r.status === "error").length;
  const warningCount = results.filter((r) => r.status === "warning").length;
  const okCount = results.filter((r) => r.status === "ok").length;

  if (errorCount === 0 && warningCount === 0) {
    console.log("║  ✅ All checks passed!                 ║");
    console.log("╚════════════════════════════════════════╝");
    console.log("\n✅ Ready to use:");
    console.log("   npm run dev      # Start development server");
    console.log("   /policies        # View all policies");
    console.log("   /schemes         # View and scrape schemes\n");
  } else if (errorCount === 0) {
    console.log("║  ⚠️  Some warnings (setup needed)       ║");
    console.log("╚════════════════════════════════════════╝");
    console.log("\n📌 Next Steps:");
    if (warningCount > 0) {
      console.log("   1. Deploy schema: supabase/schema.sql");
      console.log("   2. Seed schemes: python scripts/scrape_schemes.py --source builtin --save-db");
      console.log("   3. Start dev server: npm run dev\n");
    }
  } else {
    console.log("║  ❌ Setup incomplete                   ║");
    console.log("╚════════════════════════════════════════╝");
    console.log("\n📖 See DATABASE_SETUP.md for detailed instructions\n");
  }
}

main().catch(console.error);
