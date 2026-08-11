# Scripts Documentation

## AltStore Source Update Automation

### Overview

The `update-altstore-source.js` script automatically updates the `Autodarts_Tools_Source.json` file with new version information and news entries when a new release is created.

### How it works

1. **Triggered by GitHub Actions**: The script runs automatically as part of the release workflow in `.github/workflows/release.yml`
2. **Version Detection**: Gets the version from command line arguments or `package.json`
3. **File Size Calculation**: Downloads the IPA file from the live release to calculate the actual file size
4. **Version Management**: 
   - Adds new versions to the beginning of the `versions` array
   - Updates existing versions if they already exist
   - Keeps only the last 5 versions to prevent the file from growing too large
5. **News Generation**: 
   - Creates news entries for new releases
   - Differentiates between regular releases and pre-releases
   - Keeps only the last 10 news entries

### Manual Usage

You can run the script manually:

```bash
# Use version from package.json
node scripts/update-altstore-source.js

# Specify version and prerelease flag
node scripts/update-altstore-source.js "2.1.15" false

# For pre-release
node scripts/update-altstore-source.js "2.2.0-beta.1" true
```

### GitHub Workflow Integration

The script is integrated into the release workflow with these steps:

1. **draft_release** job: Creates a live GitHub release and builds browser extensions
2. **build_ios_app** job: Builds the iOS app and adds the IPA to the live release
3. **update_altstore_source** job: Downloads the IPA from the live release, runs the update script, and commits changes

### Features

- **Live release integration**: Uses actual release assets instead of temporary artifacts
- **Automatic file size detection**: Downloads and calculates actual IPA file size from the live release
- **Duplicate prevention**: Checks for existing versions and news entries
- **Pre-release handling**: Different messaging and notification settings for pre-releases
- **Error handling**: Graceful fallbacks and informative error messages
- **Version limiting**: Automatically maintains a reasonable number of versions and news entries

### File Structure

The script updates the following sections in `Autodarts_Tools_Source.json`:

- `apps[0].versions[]`: Array of available app versions
- `news[]`: Array of news entries about releases

### Configuration

Key configuration values in the script:

- **Default IPA size**: 31,400,000 bytes (used when actual file size cannot be determined)
- **Max versions**: 5 (older versions are automatically removed)
- **Max news entries**: 10 (older news entries are automatically removed)
- **Min iOS version**: 15.6 (required iOS version for the app)

### Release Process

The workflow now creates **live releases** that are immediately public, which means:

- No draft releases that need manual publishing
- The AltStore source is updated with real, downloadable assets
- Users can immediately download new versions through AltStore
- The automation is fully hands-off once triggered 