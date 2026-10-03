/* The effects m360 OS ships, as the real packages from Libraries.dev and React Bits, bundled once
   into window.FX so the single page can use them without a module system. React comes from the page
   (see shims/), so every component shares the one React the app runs on. Build: ./build.sh */
import {ThinkingOrb} from 'thinking-orbs';
import {BorderBeam} from 'border-beam';
import {VoiceBeam, useMicrophone} from 'voice-glow';
import {BotAvatar} from 'bot-avatars';
import {MetalFx, MetalText, MetalBadge, useMetalBend, useMetalTextReflection, PRESETS} from 'metal-fx';

/* the one edit to the packages: our agency orange. The metal's chromatic preset burns its silver with
   a blue tint; here it burns with flame (#F53901) instead, at the same strengths the preset ships.
   Its blue channel dispersion is off, so no blue or violet fringe rides the rim; the red split stays. */
PRESETS.chromatic.modes.dark.colorTint = '#F539012e';
PRESETS.chromatic.modes.light.colorTint = '#F5390199';
PRESETS.chromatic.modes.dark.shiftBlue = 0;
PRESETS.chromatic.modes.light.shiftBlue = 0;
import BellToggle from './BellToggle.jsx';

window.FX = {ThinkingOrb, BorderBeam, VoiceBeam, useMicrophone, BotAvatar, MetalFx, MetalText, MetalBadge, useMetalBend, useMetalTextReflection, BellToggle,
  version: {orbs: '0.3.2', beam: '1.4.1', voice: '0.2.1', bots: '0.2.1', metal: '2.0.11', bell: 'react-bits'}};
