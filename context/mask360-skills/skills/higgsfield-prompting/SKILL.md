---
name: higgsfield-prompting
description: >
  Expert guide for writing Higgsfield AI video generation prompts, covering the three-layer prompt system (image/identity/motion), camera movement keywords, Start & End Frame techniques, model selection, and architectural/luxury/cinematic prompt templates. Use this skill whenever the user wants to generate video with Higgsfield AI, asks for help with Kling, Veo, WAN, Sora 2 prompts on Higgsfield, wants to create a cinematic walkthrough, hotel reel, real estate video, or luxury brand video using AI, is troubleshooting a Higgsfield generation that didn't come out right, or asks for camera movement prompts like dolly, pan, crane, or orbit shots. Trigger even if the user just says "Higgsfield prompt", "Kling prompt", "AI video prompt", or shares a screenshot of the Higgsfield interface.
---

# Higgsfield AI Prompting

Higgsfield is a **multi-model video platform** running 15+ engines (Kling 3.0, Veo 3.1, WAN 2.6, Sora 2, and others) through a cinematic logic layer. Nearly every failed generation traces back to one mistake: **cramming all instructions into one prompt block.**

---

## The Three-Layer System: Most Important Concept

Every scene has three separate prompt jobs. Never mix them.

| Layer | Tool | What goes here |
|---|---|---|
| **1. Image/Keyframe** | Popcorn, Soul Cinema, Nano Banana Pro | Framing, lighting, lens, composition, environment, mood |
| **2. Identity** | Seedream, Seedance, Soul ID | Faces, age, costumes, character consistency |
| **3. Motion/Video** | Kling, Veo, WAN, Sora 2 | Camera movement, subject action, timing ONLY |

**The golden rule:** Lighting instructions in the video layer cause flicker. Camera instructions in the image layer warp composition. Keep layers clean.

### Real example (from Higgsfield's official short film guide)

**Image prompt (Layer 1):**
> "Wide cinematic shot of a woman standing alone in her modest vintage kitchen, morning light softly filtering through lace curtains. Shot on 35mm film, realistic texture, shallow depth of field, melancholic tone, inspired by Roger Deakins cinematography."

**Video prompt (Layer 3) for the same scene:**
> "Camera dolly in, woman looks at window."

Short, direct video prompts consistently outperform long descriptive paragraphs.

---

## Camera Movement Keywords

### Use presets first (50+ available)
Select from the Motion Control tab. Stack up to **3 simultaneous movements.**

**Best presets for architectural/luxury content:**
- `Dolly In` / `Dolly Out`, forward/backward push
- `Super Dolly In`: dramatic fast push for openers
- `Pan Left` / `Pan Right`, horizontal room reveal
- `Crane Up` / `Crane Down`, vertical sweeping reveal
- `FPV Drone`: floating walkthrough feel
- `Through Object In`: enter through a doorway or archway
- `Arc Left` / `Arc Right`, orbital movement around a subject
- `360 Orbit`: full circular rotation
- `Tilt Up`: reveal tall ceilings, chandeliers, domes

### Prompt-based camera verbs

| Desired movement | Prompt keyword |
|---|---|
| Push toward subject | `dolly in`, `push-in`, `slow push` |
| Pull back | `dolly out`, `pull back` |
| Circle subject | `orbit`, `slow dolly around [object]` |
| Vertical sweep | `crane up`, `crane down` |
| Follow subject | `tracking shot` |
| Handheld feel | `handheld`, `handheld shake` |
| Drone/flythrough | `FPV`, `drone view` |
| Snap between subjects | `whip pan` |
| Sudden dramatic push | `crash zoom` |

**Always append these stability keywords:**
> `smooth, stable, no jitter, no warping`

---

## Start & End Frame: The Walkthrough Technique

Upload two images; the AI generates continuous motion connecting them. Available on: Kling General, Kling 2.5 Turbo, Kling O1, Veo 3.1 Fast.

### Rules that make or break it

1. **Match your worlds.** Start and end images must share similar color palette, exposure, and aesthetic.
2. **Prompt lightly.** Micro-jitters = over-prompting. Simplify. Kling often works best with minimal or no text prompt here.
3. **5s > 10s for clean transitions.**
4. **For perfect loops:** Use the identical image for both frames.
5. **Start Frame aspect ratio drives the entire clip.** End frame crops to match.

### Proven walkthrough prompt
> "A camera showing the door entrance, then slowly moves into the room. No cuts. Camera acts like a drone. Maintain level throughout. Smooth, stable, no jitter."

### Luxury exterior → entrance transition
> "Continuous cinematic dolly forward from the palace exterior courtyard, approaching the grand entrance doors in a single unbroken move. Stable, smooth, no cuts, no warping. Warm golden light."

---

## Prompt Templates by Shot Type

### Luxury hotel exterior
> "Wide cinematic establishing shot of a grand Rajasthani palace hotel, central fountain courtyard, warm golden hour light, camera dolly in slowly toward the entrance, shallow depth of field, film grain, smooth stable camera, 1080p, 6 seconds"

### Interior room reveal
> "Luxury hotel suite with ornate carved stone walls and draped curtains, soft evening candlelight, camera pan right slowly revealing the full room, high detail, no jitter, cinematic grade, 5 seconds"

### High ceiling / chandelier reveal
> "Grand hotel lobby with crystal chandelier and marble floors, camera crane down from ceiling to floor level, warm soft light, architectural symmetry, smooth, 6 seconds"

### Spa / intimate space
> "Candlelit spa treatment room, stone walls, floating petals in a bath, camera dolly in slowly, extreme shallow depth of field, misty atmospheric haze, dreamy and ethereal, no jitter, 5 seconds"

### Night exterior
> "Palace hotel exterior at night, warm amber uplighting on stone facade, pools of light on the courtyard, camera orbit slow arc right, stars in sky, smooth cinematic, 6 seconds"

### Food / macro detail
> "Extreme close-up of an ornate dish being plated by a chef's hand, dramatic side lighting, camera dolly in slow, ultra shallow depth of field, rich warm tones, hyper detailed, 5 seconds"

### Chef / kitchen BTS
> "Professional kitchen, chef in whites at the pass, steam rising, warm kitchen light, camera tracking slow to the left alongside the chef, cinematic documentary style, smooth, 6 seconds"

### Cocktail bar / Sheesh Mahal style
> "Opulent Rajputana bar interior with mirrored walls, crystal glassware, a cocktail being poured, candlelight reflections, camera slowly pushing in, dreamy bokeh, 5 seconds"

---

## Model Selection Guide

| Use case | Best model |
|---|---|
| Photo-to-video from stills, room walkthrough | **Kling 2.6** |
| Complex multi-reference transitions, up to 7 images | **Kling O1** |
| Multi-shot (up to 6 cuts), custom 3-15s duration | **Kling 3.0** |
| 4K 60fps, premium lensing, native audio | **Veo 3.1** |
| Complex camera choreography, perspective control | **WAN 2.6** |
| Complex single-take shots, realistic physics | **Sora 2** |
| Lens-accurate Cinema Studio renders | **Higgsfield DOP** |

---

## Keyframe Prompt Structure (Layer 1: Popcorn/Soul Cinema)

Use these six fields every time:

1. **Shot type + subject**: "Wide cinematic shot of a palace hotel exterior"
2. **Camera framing + angle**: "eye level, centered composition, symmetrical"
3. **Lighting type + behavior**: "warm golden hour sidelight, soft shadows"
4. **Environment + background**: "Rajasthani courtyard with fountain, clear blue sky"
5. **Lens / film look**: "35mm film, realistic grain, anamorphic lens flare"
6. **Mood / tone**: "dreamy, ethereal, timeless, cinematic, aspirational"

---

## Fixing Failed Generations

| Problem | Fix |
|---|---|
| Camera didn't move / static | Use a preset AND add the verb in the video prompt |
| Movement too fast or jerky | Add `extremely slow creep`, `barely perceptible movement` |
| Frames didn't connect smoothly | Match lighting/color between Start & End frames better |
| Output ignores the prompt | Shorten video prompt drastically: 5 words often beat 50 |
| Face/character drifting | Fix identity in Layer 2 (Seedream) BEFORE generating video |
| Lighting flickers mid-shot | Move all lighting instructions OUT of video prompt → into keyframe |
| Spatial warping / distortion | Add `maintain architectural symmetry, no warping, no distortion` |
| Start frame ignored | Simplify or remove video prompt entirely, less is more with Start & End Frame |

---

## Community Resources

- **Prompt gallery:** higgsfield.pro: 3,000+ prompts with one-click recreate
- **Official blog prompt library:** higgsfield.ai/blog/ai-short-film-youtube-guide
- **Camera controls reference:** higgsfield.ai/camera-controls
- **Sora 2 prompt guide:** higgsfield.ai/sora-2-prompt-guide
- **Clone Project feature:** Opens any community project's full prompt, model, and camera settings, the best learning tool on the platform
