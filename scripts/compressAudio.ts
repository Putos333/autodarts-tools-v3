import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execAsync = promisify(exec);

// Check if ffmpeg is installed
async function checkFfmpegInstalled(): Promise<boolean> {
  try {
    await execAsync("ffmpeg -version");
    return true;
  } catch (error) {
    console.error("Error: ffmpeg is not installed or not in PATH.");
    console.error("Please install ffmpeg to use this script.");
    console.error("Installation instructions: https://ffmpeg.org/download.html");
    return false;
  }
}

async function compressAudioFiles() {
  // Check if ffmpeg is installed first
  const ffmpegInstalled = await checkFfmpegInstalled();
  if (!ffmpegInstalled) {
    return;
  }

  // Get the directory where this script is located
  const scriptDir = dirname(fileURLToPath(import.meta.url));

  // Create compressed directory if it doesn't exist
  const compressedDir = join(scriptDir, "compressed");
  if (!existsSync(compressedDir)) {
    mkdirSync(compressedDir);
  }

  // Get all mp3 and wav files in the current directory
  const files = readdirSync(scriptDir).filter(file =>
    file.endsWith(".mp3") || file.endsWith(".wav"),
  );

  if (files.length === 0) {
    console.log("No audio files found in the current directory.");
    return;
  }

  console.log(`Found ${files.length} audio file(s) to compress.`);

  // Process each file
  for (const file of files) {
    const inputPath = join(scriptDir, file);
    const outputPath = join(compressedDir, file);

    console.log(`Compressing: ${file}`);

    try {
      // Use ffmpeg to compress the audio file with balanced settings
      // 24kbps mono, 16kHz sample rate for better voice clarity
      const ffmpegCmd = file.endsWith(".mp3")
        ? `ffmpeg -i "${inputPath}" -b:a 24k -ac 1 -ar 16000 -codec:a libmp3lame -q:a 7 -y "${outputPath}"`
        : `ffmpeg -i "${inputPath}" -b:a 24k -ac 1 -ar 16000 -codec:a libmp3lame -q:a 7 -y "${outputPath.replace(".wav", ".mp3")}"`;

      const { stderr } = await execAsync(ffmpegCmd);

      if (stderr && !stderr.includes("video:0kB")) {
        console.log(`Warning for ${file}: ${stderr}`);
      }

      console.log(`Successfully compressed: ${file}`);
    } catch (error) {
      console.error(`Error compressing ${file}:`, error);
    }
  }

  console.log("Compression complete. Files saved to the \"compressed\" folder.");
}

compressAudioFiles().catch(console.error);
