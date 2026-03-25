import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const getMigrationsDir = () => {
	// find repository root using git rev parse --show-toplevel
	const gitRoot = (() => {
		const { execSync } = require("child_process");
		return execSync("git rev-parse --show-toplevel").toString().trim();
	})();

	return join(gitRoot, "apps", "worker", "migrations");
};

const migrationsDir = getMigrationsDir();
const folders = readdirSync(migrationsDir, { withFileTypes: true })
	.filter((dirent) => dirent.isDirectory())
	.map((dirent) => dirent.name)
	.sort();

const validMigrations = folders.filter((f) => existsSync(join(migrationsDir, f, "migration.sql")));

console.log(
	`Found ${folders.length} migration folders (${validMigrations.length} with migration.sql)`
);

validMigrations.forEach((folder, index) => {
	const sqlPath = join(migrationsDir, folder, "migration.sql");
	const sql = readFileSync(sqlPath, "utf-8");
	const paddedIndex = String(index).padStart(4, "0");
	const outputPath = join(migrationsDir, `${paddedIndex}_${folder}.sql`);

	if (existsSync(outputPath)) {
		console.log(`⏭️  Skipped ${outputPath} - already exists`);
		return;
	}

	writeFileSync(outputPath, sql);
	console.log(`✅ Created ${outputPath}`);
});

console.log("✨ Migrations flattened successfully!");
