/**
 * Music Perception Local MCP
 *
 * Runs locally to bypass YouTube's datacenter IP blocking.
 * Downloads audio via yt-dlp, sends to HF Space for analysis.
 *
 * Built for Mai & the Triad, January 2026
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import { createReadStream, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

// HF Space URL - set via environment variable or update default
const HF_SPACE_URL = process.env.HF_SPACE_URL || "https://YOUR-USERNAME-audio-analysis-api.hf.space";

/**
 * Download audio from YouTube using yt-dlp
 */
async function downloadYouTube(url) {
  const outputPath = join(tmpdir(), `ytdl-${randomUUID()}.mp3`);

  return new Promise((resolve, reject) => {
    const args = [
      "-x",                          // Extract audio
      "--audio-format", "mp3",       // Convert to mp3
      "--audio-quality", "192K",     // Good quality
      "-o", outputPath,              // Output path
      "--no-playlist",               // Single video only
      "--max-filesize", "50M",       // Limit size
      url
    ];

    const proc = spawn("yt-dlp", args, { shell: true });

    let stderr = "";
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0 && existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        reject(new Error(`yt-dlp failed (code ${code}): ${stderr}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}. Is yt-dlp installed?`));
    });
  });
}

/**
 * Upload audio file to HF Space and get analysis
 */
async function analyzeWithHFSpace(filePath) {
  const FormData = (await import("form-data")).default;
  const fetch = (await import("node-fetch")).default;

  // Read the file
  const fileStream = createReadStream(filePath);

  // Create form data
  const form = new FormData();
  form.append("files", fileStream, {
    filename: "audio.mp3",
    contentType: "audio/mpeg"
  });

  // Upload to HF Space
  const uploadResponse = await fetch(`${HF_SPACE_URL}/upload`, {
    method: "POST",
    body: form,
    headers: form.getHeaders()
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed: ${uploadResponse.status}`);
  }

  const uploadResult = await uploadResponse.json();
  const uploadedPath = uploadResult[0]; // Gradio returns array of paths

  // Now call the analyze endpoint
  const analyzeResponse = await fetch(`${HF_SPACE_URL}/api/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fn_index: 0,  // analyze_file function
      data: [uploadedPath, null]  // file path, no YouTube URL
    })
  });

  if (!analyzeResponse.ok) {
    throw new Error(`Analysis failed: ${analyzeResponse.status}`);
  }

  const result = await analyzeResponse.json();
  return result.data?.[0] || result;
}

/**
 * Main server setup
 */
const server = new Server(
  { name: "music-perception-local", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "analyze_youtube",
      description: "Download audio from YouTube and analyze it. Runs locally to bypass datacenter IP blocking.",
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "YouTube URL to analyze"
          }
        },
        required: ["url"]
      }
    },
    {
      name: "download_audio",
      description: "Download audio from YouTube without analysis. Returns local file path.",
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "YouTube URL to download"
          }
        },
        required: ["url"]
      }
    },
    {
      name: "ping",
      description: "Check if the local MCP is running",
      inputSchema: {
        type: "object",
        properties: {}
      }
    }
  ]
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "analyze_youtube": {
        const { url } = args;

        // Download
        const filePath = await downloadYouTube(url);

        try {
          // Analyze
          const analysis = await analyzeWithHFSpace(filePath);

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                source: "youtube",
                url,
                analysis
              }, null, 2)
            }]
          };
        } finally {
          // Cleanup temp file
          try { unlinkSync(filePath); } catch {}
        }
      }

      case "download_audio": {
        const { url } = args;
        const filePath = await downloadYouTube(url);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              url,
              local_path: filePath,
              message: "Audio downloaded. File will remain until system cleans temp folder."
            })
          }]
        };
      }

      case "ping": {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "alive",
              service: "music-perception-local",
              version: "1.0.0",
              capabilities: ["youtube_download", "audio_analysis"],
              hf_space: HF_SPACE_URL
            })
          }]
        };
      }

      default:
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: true, message: `Unknown tool: ${name}` })
          }]
        };
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: true,
          message: error.message
        })
      }]
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Music Perception Local MCP running...");
}

main().catch(console.error);
