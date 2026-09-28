# Where m360 OS lives, and what to move with it

No secret is written in this file or anywhere in the repository. Each line says where a key is kept.

## 1. Code: GitHub

- Repository: https://github.com/kavishrmofficial-hash/INDULGE (GitHub account `kavishrmofficial-hash`).
- The app is the `m360-os/` folder. Two branches matter:
  - `claude/amazing-euler-c4ngj2`: development. Every release is pushed here first.
  - `claude/luxury-concierge-research-orbwp5`: the branch EdgeOne Pages builds the team site from. Every release is pushed here too.
- GitHub Actions in `.github/workflows/`:
  - `desktop.yml` builds the desktop app and publishes `m360-mac.dmg` and `m360-win.exe` to the `desktop` release (https://github.com/kavishrmofficial-hash/INDULGE/releases/tag/desktop). Needs no secret.
  - `deploy-edgeone.yml` can deploy to EdgeOne by API. It runs only when the repository secret `EDGEONE_API_TOKEN` is set (it is not set today; EdgeOne deploys from git instead), with the repository variable `EDGEONE_PROJECT` naming the project.

## 2. The team site: EdgeOne Pages (Tencent)

- Site: https://m360os-wx9u1bqs.edgeone.dev
- Project name: `mask360os`, in the EdgeOne Pages console of whoever set it up (the Tencent Cloud account used at setup).
- Build settings in that console: git integration on branch `claude/luxury-concierge-research-orbwp5`, root directory `m360-os/edgeone`, no build command, output directory `public`.
- Storage: the project's EdgeOne Pages Blob store. Every document, every person, every session and every file attachment lives there. Admin > Backups downloads a full site backup (people, passwords hashed, every document) that a fresh deployment can restore from its setup screen.
- Keys kept on the server (pasted once by the founder in Admin, stored in the blob store, never sent to a page):
  - Anthropic API key (Admin > m360 AI). Belongs to the Anthropic console account it was made in.
  - Resend API key and sender address (Admin > Email sending). Belongs to the Resend account.
  - ElevenLabs API key (Admin > The buddy's voice). Belongs to the ElevenLabs account. `ELEVENLABS_API_KEY` in the EdgeOne project's environment variables works too; `ELEVENLABS_VOICE`, `ELEVENLABS_MODEL` and `ELEVENLABS_FORMAT` (an mp3 format) are optional there, with George, `eleven_multilingual_v2` and `mp3_44100_128` as the defaults.
  - Google OAuth client id and client key (Admin > Google Workspace). Belongs to the Google Cloud project it was made in; its authorised redirect is the site address plus `/api/google`.
- The founder's password (chosen at setup, changeable in Me) is the super admin sign-in. It is kept only as a hash in the blob store, and it is not in the code, the repository or the tests. Admin > Super holds the super controls (lock, joining, alerts) behind that sign-in.

## 3. The claude.ai page

- Artifact: https://claude.ai/artifact/D6nbirdVBLqU3ZD9qrA8Yq, owned by the claude.ai account that published it (the account these sessions run under). Its data lives in that artifact's own database on claude.ai, separate from the team site.
- The team works on the EdgeOne site; the artifact is the same app for anyone inside claude.ai.

## Moving to another claude.ai account

1. The code needs nothing: give the new account access to the GitHub repository (or fork it) and start its sessions from there.
2. The team site needs nothing either: it is tied to GitHub and Tencent, not to claude.ai.
3. The artifact cannot be transferred between claude.ai accounts. The new account publishes a new artifact from `dist/index.html` (a new link), and its database starts empty; the team site is unaffected.
4. Keep the EdgeOne console login, the GitHub login, and the four key accounts above with whoever owns the company. Download a site backup from Admin before any change of hands.

## Keys added in v15

- **Apollo API key**: pasted by the founder in Admin under Hunt on the team site; stored in the EdgeOne blob store as `x/apollo` and never sent to a browser. To move it, paste it again on the new site; to revoke it, press Remove there or rotate the key in Apollo (Settings, Integrations, API). Set `APOLLO_API_KEY` in the EdgeOne project's environment variables to make it come from the server instead. Phone reveals need the public https address of the site, because Apollo posts the number back to `<site>/api/apollo`.
- **Spotify client ID**: from a Spotify developer app (developer.spotify.com/dashboard, made with the Mask360 Spotify account); pasted in Admin under Spotify and kept in `settings/app.spotify.clientId`. Its redirect URI is the site address with a trailing slash, so a new address means adding a new redirect URI in that dashboard. There is no client key to keep; each person's tokens live only in their own browser.
