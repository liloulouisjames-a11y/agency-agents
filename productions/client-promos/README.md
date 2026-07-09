# Client Promos — produced with OpenMontage

Two 1080p promo videos rendered with OpenMontage's Remotion composer
(zero-key path — no external AI providers needed).

| File | Client | Length |
|------|--------|--------|
| `green-eco-solar-promo.mp4` | Green Eco Solar (Mauritius) | ~29s |
| `shanghai-beauty-promo.mp4` | Shanghai Beauty | ~28s |

## Re-render / edit

The `.json` files are the full edit — scene timings, copy, colors. To tweak
a video, edit its JSON and re-render:

```bash
cd openmontage/remotion-composer
# backdrops must be in public/brand/ (copies live in brand-backdrops/)
npx remotion render src/index.tsx Explainer out.mp4 \
  --props=../../productions/client-promos/green-eco-solar.json \
  --codec h264
```

Add `--browser-executable=<chromium> --chrome-mode=chrome-for-testing` if
Remotion can't launch its own browser.

Next step when API keys are configured in OpenMontage (`docs/` explains how):
regenerate these with AI footage, voice-over (ElevenLabs) and music behind
the same scene structure.
