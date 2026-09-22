# Model-Specific Prompt Examples

## Kling 3.0: Multi-Shot Sequences

Kling 3.0 supports up to 6 camera cuts within a single generation and custom duration (3-15s).
Best for montage-style sequences where you want controlled cuts within one generation.

**Architectural montage prompt:**
> *"Shot 1: Wide exterior establishing shot, dolly in slowly. Shot 2: Cut to lobby interior,
> crane down from ceiling. Shot 3: Close-up of carved stone detail, slow push-in. Shot 4: Pool
> terrace at golden hour, slow arc right. All shots: smooth, stable, cinematic, warm golden tones,
> film grain, no jitter."*

---

## Kling 2.6: Photo-to-Video from Stills

Best for taking your actual shoot photos and animating them. Produces the most stable parallax
and dolly movements from still images.

**Simple still animation (keyframe only, no video prompt needed):**
- Upload still → Select Dolly In preset → Generate
- The still image carries all visual information; minimal prompt is optimal

**With a light video prompt:**
> *"Slow dolly in, gentle ambient movement, leaves drift, smooth."*

---

## Kling O1: Multi-Reference Spatial Transitions

Supports up to 7 image references merged into cohesive scenes. The strongest model for
Start & End Frame architectural walkthroughs.

**Start Frame:** Jewel Bagh exterior fountain courtyard (day)
**End Frame:** Lobby entrance threshold interior
**Video prompt:**
> *"Camera moves forward continuously from exterior through entrance into lobby, no cuts, smooth
> drone-level movement, maintain architectural symmetry."*

---

## Veo 3.1: Premium Aesthetics

True 4K/60fps with native audio generation. Best when output quality and lensing are the priority.

**Luxury hotel prompt for Veo:**
> *"A grand Rajasthani heritage hotel, warm golden hour. Camera performs a slow graceful crane
> down from roofline to fountain courtyard level. Light catches carved sandstone. Cinematic,
> 4K, no shake, 8 seconds."*

Veo 3.1 modes: Fast (supports Start/End Frame), Standard, Quality.
Use Fast mode when using Start & End Frame.

---

## WAN 2.6: Camera Choreography

Specializes in perspective control and complex camera paths. Best for shots where the camera
path itself is the creative statement.

**Complex pan + dolly combination:**
> *"Camera starts wide on palace exterior right side, slowly pans left while simultaneously
> dollying in, converging on the central arched entrance. Smooth, stable, continuous motion,
> cinematic, no cuts."*

**Stacking presets with WAN:**
Select: Pan Left + Dolly In simultaneously → Video prompt: *"Heritage hotel corridor, warm
ambient light, camera moves forward and pans, revealing grand arched ceiling."*

---

## Sora 2: Complex Single-Take Shots

Reserve for hero shots. Handles the most complex single-take scenarios with realistic physics
and lighting. Costs significantly more credits.

**Full scene single-take:**
> *"A single continuous cinematic shot, warm golden afternoon light falling across a grand
> Rajasthani palace courtyard. The camera is mounted on a tracking rig, starting at fountain
> level and slowly rising while pushing forward toward the main entrance, the intricate carved
> sandstone façade filling the frame as we approach. 35mm lens, shallow depth of field, realistic
> film grain, no cuts: one continuous, immersive take, 10 seconds."*

---

## Higgsfield DOP: Cinema Studio with Optical Physics

Integrates with the Cinema Studio lens engine. Simulates 1,296+ real cinema lenses.

**Lens specifications to add to any Cinema Studio prompt:**
- Body: `ARRI Alexa 35` / `RED Komodo` / `Sony Venice 2` / `IMAX`
- Lens type: `spherical` / `anamorphic` / `Petzval`
- Focal length: `24mm ultra-wide` / `35mm` / `50mm` / `85mm` / `135mm telephoto`
- Aperture: `f/1.4` (wide open) through `f/11` (deep focus)

**For architectural content:** Wide focal lengths (24-35mm) + moderate aperture (f/5.6-f/8) =
most realistic spatial rendering.

**Cinema Studio architectural example:**
> *"Grand palace hotel exterior, ARRI Alexa 35, 28mm spherical lens, f/5.6, warm natural
> golden hour, slow dolly in, full frame cinematic widescreen 2.39:1."*

---

## Nano Banana Pro: High-Control Keyframe Generation

Use for keyframe generation when you need the most control over the final static image before
animating. Supports 21:9 cinematic widescreen, ideal for agency reel hero frames.

**Prompt syntax:** Command-line style. No conversational filler. State each instruction once.

**Hotel hero keyframe:**
> *"Wide cinematic 21:9 frame. Grand Rajasthani heritage palace exterior. Low angle looking up.
> Late afternoon golden light. Fountain courtyard centered. Deep sandstone color palette.
> 35mm film. Shallow depth of field. Slight atmospheric haze. Timeless, aspirational."*

---

## Seedance: Animated Portrait / Character Motion

Best for animating a specific person (staff, talent) from a still photo into subtle natural motion.

**Subtle ambient animation:**
> *"Subject breathes naturally, slight ambient movement, hair moves gently, warm light holds
> steady. No dramatic motion. 4 seconds."*

**Staff walkthrough shot:**
> *"Subject walks forward slowly, camera tracks alongside at waist height, smooth, professional,
> no shake."*
