import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import {
  TranslateClient,
  TranslateTextCommand,
} from "@aws-sdk/client-translate";

ffmpeg.setFfmpegPath(ffmpegPath);

const VIDEO_INPUT = "video.mp4";
const TRANSCRIPT_FILE = "transcript.json";
const OUTPUT_VIDEO = "captioned.mp4";
const REGION = "ap-southeast-1"; // your bucket region

const ACCESS_KEY = "<AWS_KEY>";
const SECRET_KEY = "<AWS_SECRET_KEY>";

const translate = new TranslateClient({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

function secondsToSrtTime(sec) {
  const date = new Date(sec * 1000);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  const ms = String(date.getUTCMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss},${ms}`;
}

async function generateSrt(transcriptData, detectedLanguage) {
  const items = transcriptData.results.items;
  let srt = "";
  let index = 1;

  let chunkWords = [];
  let chunkStart = null;
  let chunkEnd = null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item.type === "pronunciation") {
      const start = parseFloat(item.start_time);
      const end = parseFloat(item.end_time);
      const word = item.alternatives[0].content;

      if (!chunkStart) chunkStart = start;

      chunkWords.push(word);
      chunkEnd = end;

      // create chunk every ~3 seconds
      if (chunkEnd - chunkStart >= 3) {
        const originalText = chunkWords.join(" ");

        const translation = await translate.send(
          new TranslateTextCommand({
            Text: originalText,
            SourceLanguageCode: detectedLanguage,
            TargetLanguageCode: "en",
          }),
        );

        const englishText = translation.TranslatedText;

        srt += `${index}\n${secondsToSrtTime(chunkStart)} --> ${secondsToSrtTime(chunkEnd)}\n${englishText}\n\n`;

        index++;
        chunkWords = [];
        chunkStart = null;
      }
    }
  }

  return srt;
}

async function render() {
  try {
    console.log("Reading transcript.json...");
    const transcriptData = JSON.parse(
      fs.readFileSync(TRANSCRIPT_FILE, "utf-8"),
    );
    const detectedLanguage = transcriptData.results.language_code || "ja";
    console.log("Detected language:", detectedLanguage);
    console.log("Generating subtitles.srt...");
    const srtContent = await generateSrt(transcriptData, detectedLanguage);
    fs.writeFileSync("subtitles.srt", srtContent);

    console.log("Rendering captioned video...");

    await new Promise((resolve, reject) => {
      ffmpeg(VIDEO_INPUT)
        .outputOptions([
          "-vf subtitles=subtitles.srt:force_style='Fontsize=24,PrimaryColour=&Hffffff&,OutlineColour=&H000000&,BorderStyle=3'",
        ])
        .save(OUTPUT_VIDEO)
        .on("end", () => {
          console.log("🎬 captioned.mp4 created!");
          resolve();
        })
        .on("error", reject);
    });
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

render();
