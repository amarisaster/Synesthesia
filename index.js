/**
 * Synesthesia - Local Audio Perception MCP
 *
 * Deep audio perception: YouTube download, Essentia analysis, lyrics.
 * Runs locally to bypass YouTube's datacenter IP blocking.
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
const HF_SPACE_URL = process.env.HF_SPACE_URL || "https://itsamaris-audio-analysis-api.hf.space";

// LRCLIB for lyrics
const LRCLIB_BASE = "https://lrclib.net/api";

/**
 * Fetch lyrics from LRCLIB
 */
async function fetchLyrics(trackName, artistName) {
  const fetch = (await import("node-fetch")).default;

  const params = new URLSearchParams();
  if (trackName) params.set("track_name", trackName);
  if (artistName) params.set("artist_name", artistName);

  const response = await fetch(`${LRCLIB_BASE}/get?${params}`, {
    headers: { "User-Agent": "Synesthesia/1.0.0" }
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`LRCLIB error: ${response.status}`);
  }

  return response.json();
}

/**
 * Search lyrics on LRCLIB
 */
async function searchLyrics(query) {
  const fetch = (await import("node-fetch")).default;

  const response = await fetch(`${LRCLIB_BASE}/search?q=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "Synesthesia/1.0.0" }
  });

  if (!response.ok) {
    throw new Error(`LRCLIB search error: ${response.status}`);
  }

  return response.json();
}

/**
 * Parse synced lyrics into array of {time, text}
 */
function parseSyncedLyrics(synced) {
  const lines = synced.split("\n").filter(line => line.trim());
  const parsed = [];

  for (const line of lines) {
    const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2})\]\s*(.*)$/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const centiseconds = parseInt(match[3], 10);
      const text = match[4];
      const timeInSeconds = minutes * 60 + seconds + centiseconds / 100;
      parsed.push({ time: timeInSeconds, text });
    }
  }
  return parsed;
}

/**
 * Download audio from YouTube using yt-dlp
 */
async function downloadYouTube(url) {
  const outputPath = join(tmpdir(), `ytdl-${randomUUID()}.mp3`);

  return new Promise((resolve, reject) => {
    const args = [
      "--ffmpeg-location", "C:\\Users\\AMD\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.0.1-full_build\\bin",
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

  // Create Gradio file object (required format for Gradio 3.x)
  const fileObj = {
    name: uploadedPath,
    data: uploadedPath,
    is_file: true
  };

  // Now call the analyze endpoint
  const analyzeResponse = await fetch(`${HF_SPACE_URL}/api/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fn_index: 0,  // analyze_file function
      data: [fileObj, true]  // file object, generate visualization
    })
  });

  if (!analyzeResponse.ok) {
    throw new Error(`Analysis failed: ${analyzeResponse.status}`);
  }

  const result = await analyzeResponse.json();
  const analysis = result.data?.[0] || result;
  const spectrogram = result.data?.[1] || null;  // base64 PNG image

  return { ...analysis, spectrogram };
}

/**
 * Main server setup
 */
const server = new Server(
  { name: "synesthesia", version: "1.1.0" },
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
      name: "get_lyrics",
      description: "Get lyrics for a track from LRCLIB. Returns synced lyrics if available.",
      inputSchema: {
        type: "object",
        properties: {
          track_name: {
            type: "string",
            description: "Track name"
          },
          artist_name: {
            type: "string",
            description: "Artist name"
          }
        },
        required: ["track_name", "artist_name"]
      }
    },
    {
      name: "search_lyrics",
      description: "Search for lyrics on LRCLIB",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query (track name, artist, or lyrics)"
          }
        },
        required: ["query"]
      }
    },
    {
      name: "ping",
      description: "Check if Synesthesia is running",
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

      case "get_lyrics": {
        const { track_name, artist_name } = args;
        const result = await fetchLyrics(track_name, artist_name);

        if (!result) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ found: false, message: "No lyrics found" })
            }]
          };
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              found: true,
              track: result.trackName,
              artist: result.artistName,
              album: result.albumName,
              duration: result.duration,
              instrumental: result.instrumental,
              synced: !!result.syncedLyrics,
              lyrics: result.syncedLyrics
                ? parseSyncedLyrics(result.syncedLyrics)
                : result.plainLyrics
            }, null, 2)
          }]
        };
      }

      case "search_lyrics": {
        const { query } = args;
        const results = await searchLyrics(query);

        if (!results || results.length === 0) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ found: false, message: "No results" })
            }]
          };
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              found: true,
              count: results.length,
              results: results.slice(0, 10).map(r => ({
                track: r.trackName,
                artist: r.artistName,
                album: r.albumName,
                synced: !!r.syncedLyrics
              }))
            }, null, 2)
          }]
        };
      }

      case "ping": {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "alive",
              service: "synesthesia",
              version: "1.1.0",
              capabilities: ["youtube_download", "audio_analysis", "lyrics"],
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
  console.error("Synesthesia running...");
}

main().catch(console.error);
