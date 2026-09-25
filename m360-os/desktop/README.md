# m360 Desktop

m360 OS as an app on your Mac or Windows laptop, with a real browser inside the Web section: every site
opens (nothing can refuse a real browser view), logins stay signed in, and a link that wants a new window
becomes a new m360 tab.

## Get it

GitHub Actions builds it: open the repository's Actions tab, pick the newest "m360 desktop" run, and
download `m360-mac` (a .dmg) or `m360-win` (an installer). The app is not signed with a paid certificate,
so on a Mac the first open is right-click, Open, then Open again. Windows shows a SmartScreen note; choose
More info, Run anyway.

## Build it yourself

    cd desktop
    npm install
    npm start              # runs it against the live site
    npm run dist:mac       # a .dmg in desktop/dist (on a Mac)
    npm run dist:win       # an installer in desktop/dist (on Windows)

`M360_URL=https://your-address/ npm start` points it at another deployment.

## How it works

`main.js` opens one window on the m360 site and hands the Web section real Chromium views
(`WebContentsView`), one per tab, placed over the section's stage; `preload.js` is the bridge the page
sees as `window.m360desktop`. The page's own Web section (src/js/79-web.js) drives the views: tabs,
spaces, back and forward, full screen, all the same as on the web.
