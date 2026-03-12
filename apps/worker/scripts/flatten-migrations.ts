import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const getMigrationsDir = () => {
	// find repository root using git rev parse --show-toplevel
	const gitRoot = (() => {
		const { execSync } = require("node:child_process");
		return execSync("git rev-parse --show-toplevel").toString().trim();
	})();

	return join(gitRoot, "apps", "worker", "migrations");
};

const migrationsDir = getMigrationsDir();

// Find the highest existing migration number from .sql files
const getHighestMigrationNumber = () => {
	const files = readdirSync(migrationsDir, { withFileTypes: true })
		.filter((dirent) => dirent.isFile() && dirent.name.endsWith(".sql"))
		.map((dirent) => dirent.name);

	let maxNum = -1;
	for (const file of files) {
		const match = file.match(/^(\d{4})_/);
		if (match) {
			const num = Number.parseInt(match[1], 10);
			if (num > maxNum) maxNum = num;
		}
	}
	return maxNum;
};

const highestNum = getHighestMigrationNumber();
let nextNum = highestNum + 1;

// Get all migration folders (sorted by timestamp)
const folders = readdirSync(migrationsDir, { withFileTypes: true })
	.filter((dirent) => dirent.isDirectory())
	.map((dirent) => dirent.name)
	.sort();

console.log(`Found ${folders.length} migration folders, highest existing: ${highestNum}`);

// Flatten each migration
for (const folder of folders) {
	const sqlPath = join(migrationsDir, folder, "migration.sql");

	if (!existsSync(sqlPath)) {
		console.log(`⚠️  Skipping ${folder} - no migration.sql found`);
		continue;
	}

	// Skip if already flattened (check if any .sql file exists with this folder name)
	const existingFiles = readdirSync(migrationsDir).filter(
		(f) => f.endsWith(".sql") && f.includes(folder)
	);
	if (existingFiles.length > 0) {
		console.log(`⏭️  Skipping ${folder} - already flattened as ${existingFiles[0]}`);
		continue;
	}

	const sql = readFileSync(sqlPath, "utf-8");
	const paddedNum = String(nextNum).padStart(4, "0");
	const outputPath = join(migrationsDir, `${paddedNum}_${folder}.sql`);

	writeFileSync(outputPath, sql);
	console.log(`✅ Created ${outputPath}`);
	nextNum++;
}

console.log("✨ Migrations flattened successfully!");
