#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { faker } from "@faker-js/faker";

interface UserMapping {
  originalName: string;
  fakeName: string;
  fakeEmail: string;
  fakeImage: string;
  slugifiedName: string;
}

interface TeamMapping {
  originalName: string;
  fakeName: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/[ö]/g, "o")
    .replace(/[æ]/g, "ae")
    .replace(/[ø]/g, "o")
    .replace(/[þ]/g, "th")
    .replace(/[ð]/g, "d")
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "");
}

function generateFakeUserData(): UserMapping {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const fakeName = `${firstName} ${lastName}`;
  const slugifiedName = slugify(fakeName);

  return {
    originalName: "",
    fakeName,
    fakeEmail: faker.internet.email({ firstName, lastName }).toLowerCase(),
    fakeImage: `https://avatar.iran.liara.run/public?username=${slugifiedName}`,
    slugifiedName,
  };
}

function generateFakeTeamData(): TeamMapping {
  return {
    originalName: "",
    fakeName: faker.company.name(),
  };
}

// Extract names specifically from data sections, not schema/comments
function extractNamesFromData(content: string): { userNames: Set<string>; teamNames: Set<string> } {
  const userNames = new Set<string>();
  const teamNames = new Set<string>();

  // Get the public.user table data
  const userTableRegex = /COPY "public"\."user"[^;]*?FROM stdin;\n((?:.*\n)*?)\\./gm;
  const userMatch = userTableRegex.exec(content);

  if (userMatch?.[1]) {
    const userRows = userMatch[1]
      .trim()
      .split("\n")
      .filter((row) => row.trim());
    for (const row of userRows) {
      const columns = row.split("\t");
      if (columns.length >= 2 && columns[1] && columns[1] !== "\\N") {
        userNames.add(columns[1]);
      }
    }
  }

  // Get the league_team table data
  const teamTableRegex = /COPY "public"\."league_team"[^;]*?FROM stdin;\n((?:.*\n)*?)\\./gm;
  const teamMatch = teamTableRegex.exec(content);

  if (teamMatch?.[1]) {
    const teamRows = teamMatch[1]
      .trim()
      .split("\n")
      .filter((row) => row.trim());
    for (const row of teamRows) {
      const columns = row.split("\t");
      if (columns.length >= 2 && columns[1] && columns[1] !== "\\N") {
        teamNames.add(columns[1]);
      }
    }
  }

  // Extract individual names from team names for better anonymization
  for (const teamName of teamNames) {
    // Split team names that contain individual names
    const parts = teamName.split(/\s*[&+]\s*|\s+og\s+|\s+and\s+/i);
    for (const part of parts) {
      const trimmed = part.trim();
      // If it looks like a person's name (2-3 words, proper case)
      if (
        trimmed.match(
          /^[A-ZÁÐÉÍÓÚÝÞÆÖ][a-záðéíóúýþæö]+(?:\s+[A-ZÁÐÉÍÓÚÝÞÆÖ][a-záðéíóúýþæö]+){1,2}$/,
        ) &&
        trimmed.length > 3 &&
        trimmed.length < 30
      ) {
        userNames.add(trimmed);
      }
    }
  }

  return { userNames, teamNames };
}

function anonymizeSqlDump(): void {
  const scriptDir = import.meta.dir;
  const inputFile = join(scriptDir, ".dump.sql");
  const outputFile = join(scriptDir, "anonymized-dump.sql");

  console.log("Reading SQL dump file...");
  const content = readFileSync(inputFile, "utf-8");

  const userMappings = new Map<string, UserMapping>();
  const teamMappings = new Map<string, TeamMapping>();
  const emailMappings = new Map<string, string>();

  console.log("Extracting names from data tables...");

  const { userNames, teamNames } = extractNamesFromData(content);

  console.log(`Found ${userNames.size} user names`);
  console.log(`Found ${teamNames.size} team names`);

  // Create mappings for all found names
  for (const name of userNames) {
    if (!userMappings.has(name)) {
      const fakeData = generateFakeUserData();
      fakeData.originalName = name;
      userMappings.set(name, fakeData);
    }
  }

  // Create mappings for team names
  for (const teamName of teamNames) {
    if (!teamMappings.has(teamName)) {
      const fakeData = generateFakeTeamData();
      fakeData.originalName = teamName;
      teamMappings.set(teamName, fakeData);
    }
  }

  // Extract emails from data sections only
  const emailDataRegex = /COPY.*FROM stdin;\n((?:.*\n)*?)\\./gm;
  let match: RegExpExecArray | null = emailDataRegex.exec(content);
  while (match !== null) {
    const dataSection = match[1];
    if (!dataSection) {
      match = emailDataRegex.exec(content);
      continue;
    }
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    let emailMatch: RegExpExecArray | null = emailPattern.exec(dataSection);
    while (emailMatch !== null) {
      const email = emailMatch[0];
      if (!emailMappings.has(email)) {
        const fakeData = generateFakeUserData();
        emailMappings.set(email, fakeData.fakeEmail);
      }
      emailMatch = emailPattern.exec(dataSection);
    }
    match = emailDataRegex.exec(content);
  }

  console.log(`User names to anonymize: ${userMappings.size}`);
  console.log(`Team names to anonymize: ${teamMappings.size}`);
  console.log(`Email addresses to anonymize: ${emailMappings.size}`);

  console.log("Anonymizing content...");

  let anonymizedContent = content;

  // Replace user names (sort by length descending to replace longer names first)
  const sortedUserNames = Array.from(userMappings.keys()).sort((a, b) => b.length - a.length);
  for (const originalName of sortedUserNames) {
    const mapping = userMappings.get(originalName);
    if (!mapping) continue;
    const escapedOriginalName = originalName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Use tab boundaries to avoid replacing within schema definitions
    const nameRegex = new RegExp(`(\\t)${escapedOriginalName}(\\t|$)`, "g");
    const replacementCount = (anonymizedContent.match(nameRegex) || []).length;
    if (replacementCount > 0) {
      anonymizedContent = anonymizedContent.replace(nameRegex, `$1${mapping.fakeName}$2`);
      console.log(
        `✓ Replaced user "${originalName}" with "${mapping.fakeName}" (${replacementCount} occurrences)`,
      );
    }
  }

  // Replace team names (sort by length descending to replace longer names first)
  const sortedTeamNames = Array.from(teamMappings.keys()).sort((a, b) => b.length - a.length);
  for (const originalName of sortedTeamNames) {
    const mapping = teamMappings.get(originalName);
    if (!mapping) continue;
    const escapedOriginalName = originalName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Use tab boundaries for team names too
    const nameRegex = new RegExp(`(\\t)${escapedOriginalName}(\\t|$)`, "g");
    const replacementCount = (anonymizedContent.match(nameRegex) || []).length;
    if (replacementCount > 0) {
      anonymizedContent = anonymizedContent.replace(nameRegex, `$1${mapping.fakeName}$2`);
      console.log(
        `✓ Replaced team "${originalName}" with "${mapping.fakeName}" (${replacementCount} occurrences)`,
      );
    }
  }

  // Replace email addresses
  for (const [originalEmail, fakeEmail] of emailMappings) {
    const emailRegex = new RegExp(originalEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const replacementCount = (anonymizedContent.match(emailRegex) || []).length;
    if (replacementCount > 0) {
      anonymizedContent = anonymizedContent.replace(emailRegex, fakeEmail);
      console.log(`✓ Replaced email "${originalEmail}" with "${fakeEmail}"`);
    }
  }

  // Replace image URLs
  const imageUrlRegex = /(https:\/\/(?:img\.clerk\.com|lh3\.googleusercontent\.com)\/[^\t\n\s]+)/g;
  let imageReplacements = 0;

  anonymizedContent = anonymizedContent.replace(imageUrlRegex, () => {
    imageReplacements++;
    const randomUsername = slugify(faker.person.fullName());
    return `https://avatar.iran.liara.run/public?username=${randomUsername}`;
  });

  console.log(`✓ Replaced ${imageReplacements} image URLs`);

  console.log("Writing anonymized dump...");
  writeFileSync(outputFile, anonymizedContent, "utf-8");

  console.log("\\n🎉 Anonymization complete!");
  console.log(`📂 Input file: ${inputFile}`);
  console.log(`📂 Output file: ${outputFile}`);
  console.log(`👤 User names anonymized: ${userMappings.size}`);
  console.log(`🏢 Team names anonymized: ${teamMappings.size}`);
  console.log(`📧 Email addresses anonymized: ${emailMappings.size}`);
  console.log(`🖼️  Image URLs anonymized: ${imageReplacements}`);
}

// Main execution
try {
  anonymizeSqlDump();
} catch (error) {
  console.error("❌ Error during anonymization:", error);
  process.exit(1);
}
