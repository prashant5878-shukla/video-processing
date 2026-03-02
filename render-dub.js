import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import {
  TranslateClient,
  TranslateTextCommand,
} from "@aws-sdk/client-translate";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

ffmpeg.setFfmpegPath(ffmpegPath);

const VIDEO_INPUT = "video.mp4";
const TRANSCRIPT_FILE = "transcript.json";
const OUTPUT_VIDEO = "dubbed.mp4";
const REGION = "<AWS_REGION>";

const ACCESS_KEY = "<ACCESS_KEY>";
const SECRET_KEY = "<SECRET_KEY>";

const translate = new TranslateClient({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

const polly = new PollyClient({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

async function streamToBuffer(stream) {
  const chunks = [];
  for await (let chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function generateDub() {
  try {
    console.log("Reading transcript.json...");
    const transcriptData = JSON.parse(
      fs.readFileSync(TRANSCRIPT_FILE, "utf-8"),
    );

    const japaneseText = transcriptData.results.transcripts[0].transcript;

    console.log("Translating to English...");
    const translation = await translate.send(
      new TranslateTextCommand({
        Text: japaneseText,
        SourceLanguageCode: "ja",
        TargetLanguageCode: "en",
      }),
    );

    const englishText = translation.TranslatedText;

    console.log("Generating English speech...");
    const speech = await polly.send(
      new SynthesizeSpeechCommand({
        Text: englishText,
        OutputFormat: "mp3",
        VoiceId: "Joanna", // English voice
        Engine: "neural",
      }),
    );

    const audioBuffer = await streamToBuffer(speech.AudioStream);
    fs.writeFileSync("english-audio.mp3", audioBuffer);

    console.log("Replacing original audio...");

    await new Promise((resolve, reject) => {
      ffmpeg(VIDEO_INPUT)
        .input("english-audio.mp3")
        .outputOptions(["-map 0:v", "-map 1:a", "-c:v copy", "-shortest"])
        .save(OUTPUT_VIDEO)
        .on("end", () => {
          console.log("🎬 dubbed.mp4 created!");
          resolve();
        })
        .on("error", reject);
    });
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

generateDub();
