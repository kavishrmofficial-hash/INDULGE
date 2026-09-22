# Higgsfield Prompts: A29 Wellbeing
## Activewear-specific cinematic prompt library

Always apply the Three-Layer System. Never mix lighting into Layer 3.
Reference the main Higgsfield skill for technical rules.

---

## A29 Visual Worlds: Prompt Sets

### WORLD 1: GOLDEN HOUR OUTDOOR (Movement Pillar)
**When to use:** Movement Reels, Monday posts, campaign hero content

**Layer 1: Keyframe (Popcorn / Soul Cinema)**
> "Wide cinematic shot of a South Indian woman in premium earth-tone activewear, soil-coloured leggings and matching sports bra, running along a coastal promenade at golden hour. Warm amber sidelight, long shadows on stone path, ocean blur in background, shallow depth of field. Shot on 35mm film, realistic grain, Alo Yoga aesthetic, aspirational lifestyle energy."

**Layer 3: Motion (Kling 3.0 / Veo 3.1)**
> "Camera tracking alongside subject at running pace. Smooth, stable, no jitter."

**Model:** Kling 3.0 (multi-shot) or Veo 3.1 (4K premium)
**Preset:** `Tracking Shot` + `Dolly In`
**Duration:** 6-8s

---

### WORLD 2: STUDIO EDITORIAL (Product Pillar)
**When to use:** Product launches, carousel hero shots, ad creative

**Layer 1: Keyframe**
> "Minimalist studio portrait of a woman wearing coal-black matching activewear set, high-waist leggings and longline sports bra. Clean white seamless background, soft diffused light from camera left, single catchlight in eyes. Editorial fashion photography, high contrast, crisp fabric detail visible, Vogue India aesthetic."

**Layer 3: Motion**
> "Slow dolly in toward subject. Subject holds eye contact, then looks down at hands. Subtle breath movement."

**Model:** Veo 3.1 (for 4K fabric detail clarity)
**Preset:** `Super Dolly In` (slow speed)
**Duration:** 5s

---

### WORLD 3: INDOOR STUDIO: PILATES / YOGA (Lifestyle)
**When to use:** Mindset pillar, Saturday community content, influencer brief inspo

**Layer 1: Keyframe**
> "Interior of a light-filled pilates studio, wooden floors, white walls, large windows with morning light flooding in. A woman in sand-coloured A29 activewear set in a deep lunge stretch. Warm natural light, dust particles visible in light beams, clean and aspirational, shot on anamorphic lens, shallow depth of field."

**Layer 3: Motion**
> "Camera arc slowly right around subject. Barely perceptible movement. Smooth, stable."

**Model:** WAN 2.6 (for complex camera arc)
**Preset:** `Arc Right` (very slow)
**Duration:** 6s

---

### WORLD 4: URBAN INDIA: CITY TEXTURE (Community / Seasonal)
**When to use:** City-specific content, India cultural moments, community campaigns

**Layer 1: Keyframe**
> "Early morning street in South Mumbai, deserted footpath, old colonial buildings, soft pre-dawn blue light transitioning to warm amber. A woman in A29 coal-black joggers and white vest walks purposefully, AirPods in, looking ahead. Documentary street photography aesthetic, 35mm film grain, cinematic 2.39:1 aspect ratio."

**Layer 3: Motion**
> "Camera slow dolly following subject from behind. Subject walks. City texture passes by. Smooth, stable, no jitter."

**Model:** Kling 2.6 (photo-to-video from reference image)
**Preset:** `Tracking Shot`
**Duration:** 6s

---

### WORLD 5: FABRIC MACRO: TEXTURE DETAIL (Product Detail)
**When to use:** Carousel slide 3, ad creative B-roll, product launch teasers

**Layer 1: Keyframe**
> "Extreme macro close-up of premium activewear fabric, soil brown, high-performance stretch material. Fabric pulled slightly taut between two hands, visible weave texture, soft directional light from left, dramatic shadow on right side. Product photography, ultra-detailed, 100mm macro lens aesthetic."

**Layer 3: Motion**
> "Hands slowly release tension on fabric. Slow dolly out from extreme close-up to medium shot. Smooth."

**Model:** Veo 3.1 (for ultra-fine fabric detail in 4K)
**Preset:** `Dolly Out` (slow)
**Duration:** 4-5s

---

### WORLD 6: POST-WORKOUT LIFESTYLE (Community / UGC-feel)
**When to use:** Community pillar, story-first content, influencer creative direction

**Layer 1: Keyframe**
> "Two Indian women in matching A29 activewear sets laughing outside a gym entrance, one holding a water bottle, both in sand and coal colorways. Late morning light, urban background slightly blurred, candid moment captured mid-laugh. Documentary photography, honest and warm, lifestyle brand aesthetic."

**Layer 3: Motion**
> "Camera handheld, slow push in toward subjects. Natural handheld feel, slight organic movement."

**Model:** Kling 3.0
**Preset:** `Dolly In` (slow) + slight handheld
**Duration:** 5s

---

### WORLD 7: THE TEASE (Campaign Launch / Pre-drop)
**When to use:** 3 days before a collection launch, create desire without revealing product fully

**Layer 1: Keyframe**
> "Abstract close-up of moving activewear fabric in earth tones, soil and coal, swirling in slow motion. No face visible. Rich, sensory, cinematic. Soft dramatic lighting from one side. Fashion editorial aesthetic, mysterious and aspirational."

**Layer 3: Motion**
> "Fabric billows in slow motion. Camera barely moves, only the fabric moves. Extremely slow, dreamlike."

**Model:** Sora 2 (for complex fabric physics) or Veo 3.1
**Preset:** None (motion should come from prompt only)
**Duration:** 4-6s

---

## Start & End Frame Technique: A29 Applications

### Application 1: Outfit transition Reel
- **Start frame:** Model in street clothes, standing in gym entrance
- **End frame:** Same model in A29 set, mid-workout
- **Prompt:** "Smooth transition. Same person, same location. Camera maintains position."
- **Model:** Kling 2.5 Turbo or Kling O1

### Application 2: Morning-to-golden-hour arc
- **Start frame:** Pre-dawn blue: lone figure at starting position
- **End frame:** Golden hour: figure in motion, warm light
- **Prompt:** "Continuous time-lapse feel. Light shifts. Subject begins to move. No cuts."
- **Model:** Veo 3.1 Fast

### Application 3: Product flat → worn
- **Start frame:** Neatly folded A29 set on minimal surface
- **End frame:** Set worn on model, mid-movement
- **Prompt:** Minimal or none: let the model interpolate
- **Model:** Kling 2.6

---

## Model Selection: A29 Cheat Sheet

| Content type | Best model |
|---|---|
| Campaign hero Reel (premium) | Veo 3.1 |
| Lifestyle multi-shot Reel | Kling 3.0 |
| Photo-to-video (from product shot) | Kling 2.6 |
| Complex camera arc or dolly | WAN 2.6 |
| Fabric physics / slow-motion abstraction | Sora 2 |
| Outfit transition (Start & End Frame) | Kling O1 |

---

## A29 Prompt Quality Rules

1. **Always specify Indian model** in Layer 1, "South Asian woman", "Indian woman", for cultural authenticity
2. **Always include colorway** by name, soil, coal, sand, not just "brown" or "dark"
3. **Always name the Alo Yoga aesthetic** as a reference in Layer 1, it calibrates the model's style output
4. **Keep Layer 3 under 15 words**: short video prompts outperform long ones every time
5. **Append to every Layer 3:** `smooth, stable, no jitter, no warping`
