# Synesthesia

Deep audio perception through analysis. Downloads from YouTube, analyzes with Essentia, fetches lyrics via LRCLIB. Returns BPM, mood, energy, spectrograms, and synced lyrics.

## Why Local?

YouTube blocks downloads from datacenter IPs (like Cloudflare Workers and HuggingFace Spaces). This MCP runs locally on your machine with a residential IP, so downloads work.

## Prerequisites

- Node.js 18+
- yt-dlp (`pip install yt-dlp`)
- Your own HF Space for audio analysis (deploy from Synesthesia's `hf-space/` folder)

## Installation

```bash
npm install
```

## Tools

### Audio Analysis
| Tool | Description |
|------|-------------|
| `analyze_youtube` | Download + analyze audio from YouTube URL |
| `download_audio` | Just download audio (returns local path) |

### Lyrics
| Tool | Description |
|------|-------------|
| `get_lyrics` | Get lyrics for a track (synced if available) |
| `search_lyrics` | Search LRCLIB for lyrics |

### Utility
| Tool | Description |
|------|-------------|
| `ping` | Check if Synesthesia is running |

## Configuration

Set your HF Space URL as an environment variable:

```bash
export HF_SPACE_URL="https://YOUR-USERNAME-audio-analysis-api.hf.space"
```

## Claude Code Config

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "synesthesia": {
      "command": "node",
      "args": ["/path/to/synesthesia/index.js"],
      "env": {
        "HF_SPACE_URL": "https://YOUR-USERNAME-audio-analysis-api.hf.space"
      }
    }
  }
}
```

## Claude Desktop Config

Add to `claude_desktop_config.json`:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "synesthesia": {
      "command": "node",
      "args": ["/path/to/synesthesia/index.js"],
      "env": {
        "HF_SPACE_URL": "https://YOUR-USERNAME-audio-analysis-api.hf.space"
      }
    }
  }
}
```

Restart Claude Desktop after adding.

## Architecture

```
Your PC (residential IP)          Cloud
┌─────────────────────┐          ┌─────────────────────┐
│ Synesthesia         │  ──────▶ │ HF Space            │
│ (Local MCP)         │  upload  │ (Essentia analysis) │
│                     │  ◀────── │                     │
│ - yt-dlp download   │  results │ - Audio features    │
│ - Lyrics fetch      │          │ - Spectrogram       │
│ - Audio analysis    │          └─────────────────────┘
└─────────────────────┘
         │                       ┌─────────────────────┐
         │ download              │ LRCLIB              │
         ▼                 ────▶ │ (Lyrics API)        │
┌─────────────────────┐          │                     │
│ YouTube             │          │ - Synced lyrics     │
│ (residential IP OK) │          │ - Plain lyrics      │
└─────────────────────┘          └─────────────────────┘
```

## Usage Example

```
> analyze_youtube "https://www.youtube.com/watch?v=..."

Returns full Essentia analysis:
- BPM, key, scale
- Energy, danceability
- Mood vectors
- Genre classification
- Spectrogram
```

---

## Credits

Spectrogram visualization inspired by [Audio Visualizer](https://github.com/SweetSunnyBunny/Sharing-MCPs/tree/main/audio-visualizer) by **Shauna and her boys**.

---

## Support

  If this helped you, consider supporting my work ☕

  [![Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20Me-FF5E5B?style=flat&logo=ko-fi&logoColor=white)](https://ko-fi.com/maii983083)

---


*Built by the Triad (Mai, Kai Stryder and Lucian Vale) for the community.*
