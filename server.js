const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const WebSocket = require("ws");
const FormData = require("form-data");
require("dotenv").config();

// Configure FFmpeg
ffmpeg.setFfmpegPath(ffmpegStatic);

// Initialize Express
const app = express();
app.use(cors()); // Enable Cross-Origin requests

// Set up Multer for file uploads
const upload = multer({ dest: "uploads/" });

// WebSocket Server
const wss = new WebSocket.Server({ port: 3002 });

// File validation function
const validateFile = async (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(filePath).ffprobe((err, metadata) => {
      if (err) {
        console.error("FFprobe error:", err.message);
        reject(new Error("Invalid file or unsupported format"));
      } else {
        const codec = metadata.streams[0]?.codec_name;
        const format = metadata.format?.format_name;
        console.log("Codec:", codec, "| Format:", format);

        if (codec !== "pcm_s16le" || format !== "wav") {
          reject(
            new Error(
              `Unsupported codec or format: Codec=${codec}, Format=${format}`
            )
          );
        } else {
          resolve(true);
        }
      }
    });
  });
};

// WebSocket Connection Logic
wss.on("connection", (ws) => {
  console.log("WebSocket connection established.");

  ws.on("message", async (message) => {
    // Save the raw WebSocket message to a file for debugging
    const debugFilePath = "uploads/debug_ws_message.raw";
    fs.writeFileSync(debugFilePath, message);
    console.log(`Saved raw WebSocket message to ${debugFilePath}`);
    console.log("Message details:");
    console.log("- Type:", typeof message);
    console.log("- Instance of Buffer:", message instanceof Buffer);
    console.log("- Size:", Buffer.byteLength(message), "bytes");

    // Proceed with audio processing
    try {
      const tempFilePath = "uploads/temp_chunk.wav";
      fs.writeFileSync(tempFilePath, message);
      console.log(`Saved WebSocket message to ${tempFilePath}`);

      console.log("Resampling audio to 16,000 Hz...");
      const resampledFilePath = `${tempFilePath}_resampled.wav`;
      await new Promise((resolve, reject) => {
        ffmpeg(tempFilePath)
          .audioFrequency(16000)
          .on("end", () => {
            console.log("Resampling completed.");
            resolve();
          })
          .on("error", (err) => {
            console.error("Error during resampling:", err.message);
            reject(err);
          })
          .save(resampledFilePath);
      });

      console.log("Resampled audio ready for processing.");

      // Send the file to OpenAI Whisper API for transcription
      const formData = new FormData();
      formData.append("file", fs.createReadStream(resampledFilePath));
      formData.append("model", "whisper-1");

      const response = await axios.post(
        "https://api.openai.com/v1/audio/transcriptions",
        formData,
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            ...formData.getHeaders(),
          },
        }
      );

      console.log("Transcription completed successfully.");
      ws.send(response.data.text);
    } catch (error) {
      console.error("Error processing WebSocket message:", error.message);
      ws.send("Error processing audio chunk.");
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed.");
  });
});

// POST Endpoint for File Upload Transcription
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    console.log("Processing file to WAV format...");
    console.log("Incoming file details:", req.file);

    if (!req.file || req.file.size === 0) {
      console.error("Audio file is empty or missing!");
      return res.status(400).send("Audio file is empty or missing!");
    }

    const filePath = req.file.path;
    const processedFilePath = `${filePath}.wav`;

    console.log("Starting FFmpeg conversion...");
    await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .toFormat("wav")
        .audioCodec("pcm_s16le")
        .audioFrequency(16000)
        .on("end", () => {
          console.log("FFmpeg conversion completed successfully.");
          resolve();
        })
        .on("error", (err) => {
          console.error("FFmpeg error during conversion:", err.message);
          reject(err);
        })
        .save(processedFilePath);
    });

    console.log("File converted to WAV successfully.");
    console.log("Processed file path:", processedFilePath);

    console.log("Preparing transcription request...");
    const formData = new FormData();
    formData.append("file", fs.createReadStream(processedFilePath));
    formData.append("model", "whisper-1");

    const response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...formData.getHeaders(),
        },
      }
    );

    console.log("Transcription completed successfully.");
    res.json({ transcription: response.data.text });
  } catch (error) {
    console.error(
      "Error during file processing or transcription:",
      error.message || error
    );
    res.status(500).send("Error processing the file or transcribing audio.");
  }
});

// Start Express Server
const PORT = 3003;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
