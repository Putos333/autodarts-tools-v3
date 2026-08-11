import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

// Get version from package.json
const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
const version = packageJson.version;

// Get build number from git commit count
const gitCommitCount = execSync("git rev-list --count HEAD", { encoding: "utf-8" }).trim();
const buildNumber = gitCommitCount;

console.log(`Updating Xcode project to version ${version} with build ${buildNumber}`);

// Read the Xcode project file
const pbxprojPath = path.join(__dirname, "..", "Tools for Autodarts", "Tools for Autodarts.xcodeproj", "project.pbxproj");
let pbxprojContent = fs.readFileSync(pbxprojPath, "utf-8");

// Update all MARKETING_VERSION entries
const marketingVersionRegex = /MARKETING_VERSION = [^;]+;/g;
pbxprojContent = pbxprojContent.replace(marketingVersionRegex, `MARKETING_VERSION = ${version};`);

// Update all CURRENT_PROJECT_VERSION entries to use git commit count
const currentProjectVersionRegex = /CURRENT_PROJECT_VERSION = [^;]+;/g;
pbxprojContent = pbxprojContent.replace(currentProjectVersionRegex, `CURRENT_PROJECT_VERSION = ${buildNumber};`);

// Write back the updated content
fs.writeFileSync(pbxprojPath, pbxprojContent);

console.log(`✅ Updated Xcode project MARKETING_VERSION to ${version}`);
console.log(`✅ Updated Xcode project CURRENT_PROJECT_VERSION to ${buildNumber}`);

// Output for use in other scripts
console.log(`VERSION=${version}`);
console.log(`BUILD_NUMBER=${buildNumber}`);
