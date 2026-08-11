import fs from "node:fs";
import path from "node:path";

// Get version from package.json
const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
const packageVersion = packageJson.version;

// Check AltStore source
const altstoreSourcePath = path.join(__dirname, "..", "Autodarts_Tools_Source.json");
const altstoreSource = JSON.parse(fs.readFileSync(altstoreSourcePath, "utf-8"));
const latestAltstoreVersion = altstoreSource.apps[0].versions[0].version;

// Check Xcode project
const pbxprojPath = path.join(__dirname, "..", "Tools for Autodarts", "Tools for Autodarts.xcodeproj", "project.pbxproj");
const pbxprojContent = fs.readFileSync(pbxprojPath, "utf-8");
const marketingVersionMatch = pbxprojContent.match(/MARKETING_VERSION = ([^;]+);/);
const xcodeVersion = marketingVersionMatch ? marketingVersionMatch[1] : null;

const currentProjectVersionMatch = pbxprojContent.match(/CURRENT_PROJECT_VERSION = ([^;]+);/);
const xcodeBuildVersion = currentProjectVersionMatch ? currentProjectVersionMatch[1] : null;

const latestAltstoreBuildVersion = altstoreSource.apps[0].versions[0].buildVersion;

console.log(`📦 Package.json version: ${packageVersion}`);
console.log(`🏪 AltStore source version: ${latestAltstoreVersion}`);
console.log(`🏪 AltStore source build version: ${latestAltstoreBuildVersion}`);
console.log(`📱 Xcode project version: ${xcodeVersion}`);
console.log(`📱 Xcode project build version: ${xcodeBuildVersion}`);

let hasErrors = false;

if (packageVersion !== latestAltstoreVersion) {
  console.error(`❌ Version mismatch: package.json (${packageVersion}) != AltStore source (${latestAltstoreVersion})`);
  hasErrors = true;
}

if (packageVersion !== xcodeVersion) {
  console.error(`❌ Version mismatch: package.json (${packageVersion}) != Xcode project (${xcodeVersion})`);
  hasErrors = true;
}

if (latestAltstoreBuildVersion !== xcodeBuildVersion) {
  console.error(`❌ Build version mismatch: AltStore source (${latestAltstoreBuildVersion}) != Xcode project (${xcodeBuildVersion})`);
  hasErrors = true;
}

if (!hasErrors) {
  console.log(`✅ All versions are aligned at ${packageVersion}`);
} else {
  console.error("\n❌ Version mismatches detected. Please run the appropriate sync scripts.");
  process.exit(1);
}
