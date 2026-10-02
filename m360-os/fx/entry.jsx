/* The effects m360 OS ships, as the real packages from Libraries.dev and React Bits, bundled once
   into window.FX so the single page can use them without a module system. React comes from the page
   (see shims/), so every component shares the one React the app runs on. Build: ./build.sh */
import {ThinkingOrb} from 'thinking-orbs';
import {BorderBeam} from 'border-beam';
import {VoiceBeam, useMicrophone} from 'voice-glow';
import {BotAvatar} from 'bot-avatars';
import {MetalFx, MetalText, MetalBadge, useMetalBend, useMetalTextReflection} from 'metal-fx';
import BellToggle from './BellToggle.jsx';

window.FX = {ThinkingOrb, BorderBeam, VoiceBeam, useMicrophone, BotAvatar, MetalFx, MetalText, MetalBadge, useMetalBend, useMetalTextReflection, BellToggle,
  version: {orbs: '0.3.2', beam: '1.4.1', voice: '0.2.1', bots: '0.2.1', metal: '2.0.11', bell: 'react-bits'}};
