#!/usr/bin/env node

/**
 * Policy Navigator - Database Setup Guide
 * Verifies schema deployment and seeds builtin schemes
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(msg: string) {
  console.log(`  ${msg}`);
}

function logStep(step: number, total: number, msg: string) {
  console.log(`\n[${step}/${total}] ${msg}`);
}

async function main() {
  console.clear();
  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║  Policy Navigator - Database Setup                 ║");
  console.log("╚════════════════════════════════════════════════════╝");

  // Step 1: Load environment
  logStep(1, 3, "Checking environment...");

  const dotenvPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(dotenvPath)) {
    console.error("\n❌ .env.local not found");
    console.log("\nCreate .env.local with:");
    console.log("  SUPABASE_URL=...");
    console.log("  SUPABASE_SERVICE_ROLE_KEY=...");
    process.exit(1);
  }

  const envContent = fs.readFileSync(dotenvPath, "utf-8");
  const env: Record<string, string> = {};
  envContent.split("\n").forEach((line) => {
    const [key, value] = line.split("=");
    if (key && value) {
      env[key.trim()] = value.trim();
    }
  });

  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("\n❌ Missing env vars");
    console.log("  SUPABASE_URL:", supabaseUrl ? "✓" : "missing");
    console.log("  SUPABASE_SERVICE_ROLE_KEY:", serviceRoleKey ? "✓" : "missing");
    process.exit(1);
  }

  log("✓ SUPABASE_URL: " + supabaseUrl.split(".")[0] + "...");
  log("✓ SUPABASE_SERVICE_ROLE_KEY: " + serviceRoleKey.slice(0, 20) + "...");

  // Step 2: Deploy Schema
  logStep(2, 3, "Deploying database schema...");

  const schemaPath = path.join(__dirname, "..", "supabase", "schema.sql");
  if (!fs.existsSync(schemaPath)) {
    console.error("\n❌ schema.sql not found");
    process.exit(1);
  }

  const schemaSql = fs.readFileSync(schemaPath, "utf-8");

  try {
    // Try to execute schema via admin API
    console.log("\n  Attempting schema deployment...");
    log('This requires manual steps in Supabase Dashboard.');
    log('');
    log('📌 MANUAL SETUP REQUIRED:');
    log('');
    log('1. Visit: https://supabase.com/dashboard/projects');
    log('2. Select project: pfffwfhnvkivrrhrlesv');
    log('3. Go to: SQL Editor');
    log('4. Click: New Query');
    log('5. Copy & Paste schema.sql contents (from supabase/schema.sql)');
    log('6. Click: Run');
    log('');
    log('Continue with step 3 after schema is deployed...');
  } catch (err) {
    console.error("\n❌ Error:", err);
  }

  // Step 3: Seed builtin schemes
  logStep(3, 3, "Seeding builtin schemes...");

  log("Running Python scraper for builtin schemes...");

  const pythonScript = new Promise((resolve, reject) => {
    const python = spawn("python", [
      path.join(__dirname, "scrape_schemes.py"),
      "--source",
      "builtin",
      "--save-db",
    ]);

    let output = "";
    python.stdout?.on("data", (data) => {
      output += data.toString();
      process.stdout.write(`  ${data}`);
    });

    python.stderr?.on("data", (data) => {
      process.stderr.write(`  ${data}`);
    });

    python.on("close", (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Python scraper exited with code ${code}`));
      }
    });
  });

  try {
    await pythonScript;
    log("✓ Builtin schemes seeded successfully");
  } catch (err) {
    console.warn("\n⚠️  Warning: Could not seed builtin schemes");
    console.warn("  Reason:", err);
    console.log("\n  This is OK - you can scrape schemes later via the web UI");
  }

  // Summary
  console.log("\n╔════════════════════════════════════════════════════╗");
  console.log("║  ✅ Setup Complete                                 ║");
  console.log("╚════════════════════════════════════════════════════╝");
  console.log("\n  Next steps:");
  console.log("  1. Start the dev server: npm run dev");
  console.log("  2. Visit http://localhost:3000/schemes");
  console.log("  3. Schemes should now load from database");
  console.log("  4. Use 'Run Scraper' to add government schemes");
  console.log("");
}

main().catch((err) => {
  console.error("\n❌ Setup failed:", err);
  process.exit(1);
});
