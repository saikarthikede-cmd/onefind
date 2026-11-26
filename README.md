# One Find

A free, private personal assistant for iPhone, with a cheerful pixel-art look and **Pip**, a little companion who levels up as you get things done: birthdays, to-dos, money, bills, habits, notes, an encrypted vault, and "where did I keep it?". It runs as a web app on your Home Screen, works fully offline, and keeps everything encrypted on your phone. It's built for an iPhone 6s (iOS 15.8) and newer.

---

## 1. Put it online for free (about 15 minutes, one time)

You only need a free GitHub account. No Mac, no Apple fee and no coding are needed.

1. Go to **github.com** and sign up (free).
2. Click **+ → New repository**.
   - Name: `onefind`
   - Visibility: **Public**. Only the app's code is public. Your data never leaves your phones.
   - Click **Create repository**.
3. On the new repo page, click **uploading an existing file**.
4. Unzip `onefind.zip` on your computer. Open the `onefind` folder, select **everything inside it** (index.html, css, js, icons, manifest.webmanifest, sw.js, README.md) and drag it into the GitHub upload box. Wait for all files to upload, then click **Commit changes**.
5. Go to **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, then branch **main** and folder **/ (root)**. Click **Save**.
6. Wait 1–2 minutes and refresh the Pages screen. Your address appears: `https://YOUR-USERNAME.github.io/onefind/`

> Check: `index.html` must sit at the top of the repo, not inside an extra `onefind/` folder.

## 2. Install on each iPhone

1. Open your address in **Safari** (not Chrome).
2. Tap **Share** (the square with an up arrow) → **Add to Home Screen** → **Add**.
3. Open **One Find** from the new icon. Set it up **there**, not in Safari. iOS keeps Safari data and Home Screen app data separately.
4. Create a passcode and **write the recovery key on paper**. It's the only way back in if you forget the passcode.

### Using both phones (iPhone 17 + iPhone 6s)

1. Set up on the first phone and add a few things.
2. Go to **Settings → Backup & move data → Back up now** → AirDrop the file to the other phone (or save it to iCloud Drive).
3. On the second phone, install the app, then choose **Restore from a backup file** at the welcome screen. It uses the same passcode.
4. From then on, back up on one phone and **Merge** on the other whenever you like. The newest change wins.

## 3. Turn on reminders

iPhones don't let web apps ring alarms by themselves, so One Find puts reminders into the iPhone **Calendar** app instead:

1. In the Calendar app: **Calendars → Add Calendar** → name it **One Find**.
2. In One Find: **Settings → Calendar reminders → Add to Calendar** → **Add All** → choose the One Find calendar.
3. After many changes (the Today screen will tell you), delete the One Find calendar, recreate it and import again. This avoids duplicate alerts.

If "Add to Calendar" doesn't open anything, use **Save / share file** → save to Files → tap the file in the Files app (or AirDrop/mail it to yourself and tap it).

## 4. Old iPhone as a desk assistant

**More → Desk mode** shows a big clock plus today's birthdays, bills, tasks and habits. On the old phone, set **Settings → Display & Brightness → Auto-Lock → Never** and leave it on the charger.

## 5. Updating the app later

Upload the changed files to the same GitHub repo. In `sw.js`, bump the version line (e.g. `onefind-1.1.0` → `onefind-1.1.1`) so phones fetch the new files. The app will then show **"A new version is ready — Reload"**.

---

## Privacy & security

- All data is encrypted on the device with **AES-256-GCM** using the browser's built-in Web Crypto. The key comes from your passcode (PBKDF2-SHA256, tuned to about 0.7 s per try on your phone).
- **Vault** items are encrypted a second time with a separate passphrase and auto-lock after 2 minutes. They are never included in search or calendar exports.
- The **recovery key** can reset the passcode and the vault passphrase. Lose both the passcode and the recovery key and the data can't be recovered. That's by design.
- No servers, accounts, analytics, ads or third-party scripts. A strict Content-Security-Policy blocks anything that isn't the app's own files.
- After 10 wrong passcodes in a row, the app makes you wait, and the wait grows with each wrong try.
- **Back up weekly.** If the phone is lost or reset, the backup file is your copy.

## What's inside

| Folder | Purpose |
| --- | --- |
| `index.html`, `manifest.webmanifest`, `sw.js` | App shell, Home Screen install info, offline cache |
| `js/core/` | Encryption (`crypto.js`, `keys.js`), storage (`db.js`, `store.js`), backup, calendar export, dates |
| `js/screens/` | One file per screen: today, tasks, people, money, bills, notes, habits, vault, places, settings |
| `js/ui/kit.js`, `js/ui/pip.js`, `js/ui/icons.js` | Shared UI pieces, Pip the pixel companion (+ pixel clock), pixel icons |
| `fonts/` | Pixelify Sans title font (SIL Open Font License) |
| `js/vendor/` | Preact + htm (MIT / Apache-2.0), self-hosted; Pixelarticons licence |

Plain JavaScript modules with no build step: edit a file, upload it, bump `sw.js`, done.

## Credits

- **Pixelarticons** by Gerrit Halfmann: pixel icons, MIT License (`js/vendor/LICENSE-pixelarticons.txt`)
- **Pixelify Sans** by Stefie Justprince: title font, SIL Open Font License 1.1 (`fonts/LICENSE-OFL-pixelify-sans.txt`)
- **Preact** and **htm**: MIT / Apache-2.0 (`js/vendor/`)
- **Pip**, the app icon and the desk-clock digits are original pixel art made for One Find.
