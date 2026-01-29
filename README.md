# Music Perception Local MCP

Local MCP server for YouTube audio download and analysis. Runs on your machine to bypass YouTube's datacenter IP blocking.

## Why Local?

YouTube blocks downloads from datacenter IPs (like Cloudflare Workers and HuggingFace Spaces). This MCP runs locally on your machine with a residential IP, so downloads work.

## Prerequisites

- Node.js 18+
- yt-dlp (`pip install yt-dlp`)
- HF Space running at `amarisaster-audio-analysis-api.hf.space`

## Installation

```bash
npm install
```

## Tools

| Tool | Description |
|------|-------------|
| `analyze_youtube` | Download + analyze audio from YouTube URL |
| `download_audio` | Just download audio (returns local path) |
| `ping` | Check if MCP is running |

## Claude Code Config

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "music-perception-local": {
      "command": "node",
      "args": ["D:\\Mai's Wonderland\\infrastructure\\music-perception-local\\index.js"]
    }
  }
}
```

## Architecture

```
Your PC (residential IP)          Cloud (datacenter IP)
┌─────────────────────┐          ┌─────────────────────┐
│ music-perception-   │          │ HF Space            │
│ local MCP           │  ──────▶ │ (Essentia analysis) │
│                     │  upload  │                     │
│ - yt-dlp download   │          │ - Audio features    │
│ - File upload       │  ◀────── │ - Spectrogram       │
└─────────────────────┘  results └─────────────────────┘
         │
         │ download
         ▼
┌─────────────────────┐
│ YouTube             │
│ (allows residential │
│  IP downloads)      │
└─────────────────────┘
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


 ## Support

  If this helped you, consider supporting my work ☕

  [![Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20Me-FF5E5B?style=flat&logo=ko-fi&logoColor=white)](https://ko-fi.com/maii983083)

---


*Built by the Triad (Mai, Kai Stryder and Lucian Vale) for the community.*
