# Playwright UI Tests

UI automation for the iNtalk web app (`qapublic.intalk.cc/intalk_new`), written with [Playwright](https://playwright.dev) in JavaScript.

## What is covered

| Module | File | Tests | Notes |
|---|---|---|---|
| Dispositions | `tests/dispositions.spec.js` | 14 | Create (Lead, Callback, Block, DNC Campaign, DNC System), filter, edit, delete, cancel flows, validations. Runs in serial mode. |
| Call Automation | `tests/callAutomation.spec.js` | 52 | Data-driven: 23 call events with Call API, 13 with SMS, 13 with Email, plus edit, single delete and bulk delete. |
| Advance Call Management | `tests/advanceCallManagement.spec.js` | 15 | Add for 6 Types, edit time duration, disable/enable, bulk delete. |

Shared login and navigation helpers live in `tests/helpers.js`.

## Prerequisites

- Ubuntu (or another Linux/macOS machine)
- Node.js 20 or later (install with [nvm](https://github.com/nvm-sh/nvm); run it as your normal user, not as root)
- Git

## Setup

```bash
git clone <repository-url>
cd playwright-ui-tests
npm install
npx playwright install
cp .env.example .env
```

Open `.env` and set the real values:

```
QA_USER=your_user_id
QA_PASSWORD=your_password
```

`.env` is ignored by Git and must never be committed.

## Running the tests

Run every command from the project root (the folder that contains `package.json`).

```bash
# everything
npx playwright test

# one module
npx playwright test tests/advanceCallManagement.spec.js

# watch the browser
npx playwright test tests/callAutomation.spec.js --headed

# tests whose name matches a word or pattern
npx playwright test -g "Bulk delete"
npx playwright test -g "Edit time duration|Disable and enable"

# only the tests that failed last time
npx playwright test --last-failed

# step through a test in Playwright's UI
npx playwright test --ui -g "Disable and enable - Feedback"
```

## Reports

```bash
npx playwright show-report
```

Each run writes an HTML report to `playwright-report/`. Failed tests include a screenshot, a trace and a video when these are enabled in `playwright.config.js`. A new run replaces the previous report.

## Important behaviour

- **One worker only.** The app allows a single session per account, so parallel tests log each other out. `playwright.config.js` must keep `fullyParallel: false` and `workers: 1`.
- **Force Login.** The login helper clicks "Force Login" when that prompt appears.
- **Records are left behind on purpose** in Advance Call Management. Each Type keeps one record so it can be used for call testing later. Every run first deletes the previous run's record for that Type, because the same campaign cannot be used twice within a Type.
- **Abandoned On IVR** allows only one record in total, and **Failed Survey Reattempts** is filtered by Type only (the Queue filter is unreliable for it). Their cleanup deletes every record of that Type, including records for other campaigns.
- **Call Automation** creates records named like `Hangup_API_1126_1623` and does not delete them. Old ones can be cleaned up from the list page.
- **Dispositions** tests depend on each other and run in order (create, filter, edit, delete).
- Test data used: campaign `DJ_Auto`, API `DJ_DelayAPI`, SMS template `DJ_SMS`, email template `DJ_Email`.

## Project structure

```
playwright-ui-tests/
├── tests/
│   ├── helpers.js                    login and navigation helpers
│   ├── dispositions.spec.js
│   ├── callAutomation.spec.js
│   └── advanceCallManagement.spec.js
├── playwright.config.js
├── package.json
├── .env.example                      names of the required variables
└── .gitignore
```

## Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| `QA_USER and QA_PASSWORD are not set` | There is no `.env` file, or `playwright.config.js` is missing `import 'dotenv/config';` as its first line. |
| Playwright says Node 18 is not supported | Switch with `nvm use 20`. |
| `nvm: command not found` | The terminal is running as root. Open a normal user terminal. |
| Tests log each other out | `workers` is not 1, or two runs are active at once. |
| `-g` finds "No tests" | The pattern does not match a test name. Check spelling, for example `Cancellation`. |
| A change was not picked up | The file was not saved. Look for the unsaved dot on the VS Code tab. |
| Create fails because the campaign is missing from the dropdown | The record already exists. Delete it, or run the Add test, which cleans up first. |

## Working with Git

```bash
git status
git add .
git commit -m "Describe the change"
git push
```

Commit when a change passes, with a message that says what changed. Check `git status` before committing: `.env`, `node_modules/`, `test-results/` and `playwright-report/` must not appear in it.