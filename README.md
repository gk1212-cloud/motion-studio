# motion-studio

Automated film channel. Every night at 03:00 IST it picks a topic, writes a script, judges it, renders the film, and publishes.

## Quick start
```
npm run check          # lint
node tools/plan.mjs    # write + gate a storyboard (needs GEMINI_API_KEY)
node tools/build.mjs   # storyboard -> compositions
node tools/render.mjs  # render -> renders/film.mp4
```

## Requirements
- Node 22+
- HyperFrames CLI: `npm i -g hyperframes@0.8.226`
- ffmpeg
- GEMINI_API_KEY (free: https://aistudio.google.com/apikey)

## Automation
GitHub Actions runs `auto-film` nightly. Set `GEMINI_API_KEY` as a repo secret.
