# m360 frame helper

A tiny Chrome or Edge extension. In tabs that show m360 OS, pages framed inside the Web section lose the
headers that forbid framing (X-Frame-Options and Content-Security-Policy frame-ancestors). No other tab is
touched, nothing is read, nothing is sent anywhere.

Install, once per laptop:

1. Unzip the download. You get a folder called m360-frame-helper.
2. Chrome: open chrome://extensions. Edge: edge://extensions. Switch on Developer mode (top right).
3. Load unpacked, pick the folder. Reload m360.

Sites that also refuse by script (Google, Meet, YouTube, LinkedIn, WhatsApp, Instagram) still open outside.
