# 🛡️ Security & Privacy

Synesthesia is a **local** MCP server that downloads audio from YouTube and performs deep audio analysis—BPM, mood, energy, spectrograms, and synced lyrics. This document explains how your data flows and how to stay secure.

---

## 🔑 Architecture: Local + Cloud Hybrid

Synesthesia runs on your machine but uses cloud services for heavy processing:

| Component | Where It Runs | What It Does |
|-----------|---------------|--------------|
| **MCP Server** | Your machine | Handles requests, coordinates everything |
| **yt-dlp** | Your machine | Downloads audio from YouTube |
| **Audio Analysis** | Hugging Face Space | Extracts BPM, energy, mood, spectrograms |
| **Lyrics** | LRCLIB API | Fetches synced/plain lyrics |

> **Why local?** YouTube blocks downloads from datacenter IPs (Cloudflare, Hugging Face, etc.). Running locally means your residential IP works where cloud servers can't.

---

## 🔑 Key Security Features

### What This MCP Can Do

| Tool | Function |
|------|----------|
| `analyze_youtube` | Download + full audio analysis in one call |
| `download_audio` | Just download the audio file locally |
| `get_lyrics` | Fetch lyrics for a specific track |
| `search_lyrics` | Search LRCLIB database |
| `ping` | Health check |

### Local Downloads

Audio files download to **your machine**. They don't pass through third-party servers first.

> **What this means:** When you download from YouTube, the file goes directly to your computer. No intermediary storage.

### Cloud Analysis

Audio features are extracted by a Hugging Face Space running the Essentia library. The audio or its features are sent there for processing.

> **What this means:** If you use audio analysis, data does leave your machine—it goes to the Hugging Face Space you configure. Review Hugging Face's privacy practices, and consider self-hosting the Space if you need maximum privacy.

### Lyrics via LRCLIB

Lyrics are fetched from LRCLIB's public API. Queries include track name and artist.

> **What this means:** LRCLIB sees your lyrics searches (track + artist). No account required, but queries are visible to that service.

### No Persistent History

Synesthesia doesn't maintain logs of what you've downloaded or analyzed. Each request is independent.

> **What this means:** No database of your YouTube history, no log of analyzed tracks. When the request is done, the data flow ends.

---

## 🔐 Best Practices

### Secure Your Machine

Since this runs locally, your machine's security is the security:
- Keep your OS and Node.js updated
- Use a firewall
- Don't run as admin/root unless necessary

### Review Downloaded Files

Audio downloads go to a local directory. Periodically clean up files you no longer need.

### Self-Host Analysis (Optional)

For maximum privacy, deploy your own Hugging Face Space for audio analysis. Then your audio features never touch shared infrastructure.

### Keep yt-dlp Updated

```bash
pip install -U yt-dlp
```

yt-dlp updates frequently to keep up with YouTube changes. Stay current.

---

## 🚫 What Synesthesia Does NOT Do

- ❌ Store your download/analysis history
- ❌ Upload your audio anywhere except the configured analysis service
- ❌ Send analytics or telemetry
- ❌ Require any account or login
- ❌ Run in the cloud (it's local by design)

---

## 🔍 Transparency

This project is fully open source. You can audit every line of code. The local server, analysis flow, and lyrics integration are all visible in the repository.

Your audio, your machine, your analysis.
