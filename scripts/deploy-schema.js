#!/usr/bin/env node

/**
 * Deploy Supabase Schema
 * Runs the schema.sql file against Supabase project
 */

const fs = require("fs");
const path = require("path");

async function deploySchema() {
  // Load environment variables
  const dotenvPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(dotenvPath)) {
    console.error("❌ .env.local not found");
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
    console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    console.error(
      "   Required vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exit(1);
  }

  // Read schema.sql
  const schemaPath = path.join(__dirname, "..", "supabase", "schema.sql");
  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ schema.sql not found at ${schemaPath}`);
    process.exit(1);
  }

  const schemaSql = fs.readFileSync(schemaPath, "utf-8");

  // Execute schema using Supabase REST API with service role
  try {
    console.log("📋 Deploying schema to Supabase...");

    // We need to use the Supabase SQL API or execute via direct connection
    // For now, we'll use the REST API approach with postgrest
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        sql: schemaSql,
      }),
    });

    if (!response.ok) {
      // If direct RPC fails, we need to inform user to do it via dashboard
      console.warn(
        "⚠️  Direct schema deployment not available via API (expected)"
      );
      console.log("");
      console.log(
        "📌 To deploy schema, follow these steps in Supabase Dashboard:"
      );
      console.log("");
      console.log(
        "1. Go to https://supabase.com/dashboard/project/" +
          supabaseUrl.split(".")[0] +
          "/sql/new"
      );
      console.log("2. Click 'File' → 'Create a new file'");
      console.log("3. Paste the contents of: supabase/schema.sql");
      console.log("4. Click 'Run'");
      console.log("");
      return;
    }

    console.log("✅ Schema deployed successfully!");
  } catch (err) {
    console.error("⚠️  Error deploying schema via API:", err);
    console.log("");
    console.log("📌 Manual deployment steps:");
    console.log("");
    console.log(
      "1. Visit: https://supabase.com/dashboard/project/pfffwfhnvkivrrhrlesv/sql"
    );
    console.log("2. Click 'New Query'");
    console.log("3. Paste contents of: supabase/schema.sql");
    console.log("4. Click 'Run'");
    console.log("");
  }
}

deploySchema();
