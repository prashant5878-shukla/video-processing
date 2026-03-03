import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
} from "@aws-sdk/client-transcribe";
import fs from "fs";
import fetch from "node-fetch";

// ================= CONFIG =================
const REGION = "ap-southeast-1"; // your bucket region
const BUCKET = "<BUCKET_NAME>"; // your bucket name
const FILE_PATH = "video.mp4"; // local file
const FILE_KEY = "video.mp4"; // S3 file name

const ACCESS_KEY = "<AWS_KEY>";
const SECRET_KEY = "<AWS_SECRET_KEY>";

// ==========================================

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});
const transcribe = new TranscribeClient({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

async function run() {
  try {
    console.log("Uploading video to S3...");

    const fileStream = fs.readFileSync(FILE_PATH);

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: FILE_KEY,
        Body: fileStream,
        ContentType: "video/mp4",
      }),
    );

    console.log("✅ Upload complete");

    const jobName = "job-" + Date.now();

    console.log("Starting transcription...");

    await transcribe.send(
      new StartTranscriptionJobCommand({
        TranscriptionJobName: jobName,
        IdentifyLanguage: true,
        Media: {
          MediaFileUri: `s3://${BUCKET}/${FILE_KEY}`,
        },
        OutputBucketName: BUCKET,
      }),
    );

    let status = "IN_PROGRESS";
    let transcriptUrl = null;

    while (status === "IN_PROGRESS") {
      await new Promise((res) => setTimeout(res, 5000));

      const data = await transcribe.send(
        new GetTranscriptionJobCommand({
          TranscriptionJobName: jobName,
        }),
      );

      status = data.TranscriptionJob.TranscriptionJobStatus;
      console.log("Status:", status);

      if (status === "COMPLETED") {
        transcriptUrl = data.TranscriptionJob.Transcript.TranscriptFileUri;
      }

      if (status === "FAILED") {
        throw new Error("Transcription failed");
      }
    }

    console.log("Downloading transcript...");

    const response = await fetch(transcriptUrl);
    const result = await response.json();
    fs.writeFileSync("transcript.json", JSON.stringify(result, null, 2));
    console.log("✅ transcript.json saved");
    const transcriptText = result.results.transcripts[0].transcript;

    console.log("\n===== TRANSCRIPT =====\n");
    console.log(transcriptText);
    console.log("\n======================\n");
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

run();
