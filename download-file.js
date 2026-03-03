import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import ffmpegPath from "ffmpeg-static";

async function run() {
  const url = process.argv[2];

  if (!url) {
    console.log("Usage: node test.js <url>");
    process.exit(1);
  }

  const outputBase = path.resolve("video");

  console.log("🔗 URL:", url);
  console.log("📥 Downloading and merging...");

  const ytdlp = spawn("yt-dlp", [
    "-f",
    "bv*+ba/b",
    "--merge-output-format",
    "mp4",
    "--no-keep-video",
    "--no-write-thumbnail",
    "--force-overwrites",
    "--ffmpeg-location",
    ffmpegPath,
    "-o",
    "video.%(ext)s",
    url,
  ]);

  ytdlp.stdout.on("data", (data) => {
    console.log(data.toString());
  });

  ytdlp.stderr.on("data", (data) => {
    console.log(data.toString());
  });

  ytdlp.on("close", (code) => {
    if (code === 0) {
      const finalFile = `${outputBase}.mp4`;

      if (fs.existsSync(finalFile)) {
        console.log("✅ Final merged file:", finalFile);
      } else {
        console.log("⚠ Download finished but file not found.");
      }
    } else {
      console.log("❌ Download failed with code:", code);
    }
  });
}

run();
