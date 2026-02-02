#!/usr/bin/env bun

import { $ } from "bun";

async function truncateDatabase(): Promise<void> {
  const dbUrl = "postgresql://scorebrawl:scorebrawl@localhost:65432/scorebrawl-e2e";

  console.log("🗑️  Truncating database...");
  console.log(`Target database: ${dbUrl}`);

  // Confirm before truncating
  const confirm = prompt(
    "Are you sure you want to truncate the entire database? Type 'yes' to confirm: ",
  );

  if (confirm !== "yes") {
    console.log("❌ Operation cancelled.");
    return;
  }

  try {
    // SQL to drop all tables and related objects
    const truncateSQL = `
      -- Disable foreign key checks temporarily
      SET session_replication_role = replica;
      
      -- Drop all tables in public schema
      DO $$ DECLARE
          r RECORD;
      BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
              EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
      END $$;
      
      -- Drop all sequences in public schema (excluding those owned by extensions)
      DO $$ DECLARE
          r RECORD;
      BEGIN
          FOR r IN (SELECT sequencename FROM pg_sequences WHERE schemaname = 'public') LOOP
              EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequencename) || ' CASCADE';
          END LOOP;
      END $$;
      
      -- Drop user-defined functions in public schema (excluding extension functions)
      DO $$ DECLARE
          r RECORD;
      BEGIN
          FOR r IN (
              SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
              FROM pg_proc p 
              JOIN pg_namespace n ON p.pronamespace = n.oid 
              WHERE n.nspname = 'public' 
              AND p.oid NOT IN (
                  SELECT objid FROM pg_depend 
                  WHERE classid = 'pg_proc'::regclass 
                  AND deptype = 'e'
              )
          ) LOOP
              BEGIN
                  EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
              EXCEPTION
                  WHEN OTHERS THEN
                      -- Skip functions that can't be dropped (extension functions, etc.)
                      NULL;
              END;
          END LOOP;
      END $$;
      
      -- Drop all user-defined types in public schema
      DO $$ DECLARE
          r RECORD;
      BEGIN
          FOR r IN (SELECT typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid 
                    WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
              EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
          END LOOP;
      END $$;
      
      -- Re-enable foreign key checks
      SET session_replication_role = DEFAULT;
    `;

    await $`psql ${dbUrl} -c ${truncateSQL}`.quiet();

    console.log("✅ Database truncated successfully!");
  } catch (error) {
    console.error("❌ Error truncating database:", error);
    process.exit(1);
  }
}

// Main execution
truncateDatabase();
