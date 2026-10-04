# RecoveryNav

## One-command run

On Windows, double-click:

`RUN_RECOVERYNAV.bat`

It automatically enters the app folder, installs dependencies on the first run, starts the development server, and opens:

`http://localhost:3000`

## Assistant improvements

- Chat-style AI responses with clean headings, bold highlights, bullets, numbered steps, and useful emojis.
- Raw `##`, escaped Markdown, and ugly formatting are cleaned before display.
- AI responses stream into the chat instead of waiting for the complete answer.
- **Auto Listen** can speak the response progressively as sentences arrive.
- Speech uses a queue so streamed sentences do not interrupt each other.
- The existing manual **Listen** button remains available for individual replies.
- The AI prompt is instructed to answer naturally and directly instead of sounding like a canned FAQ.

## Production build

```bat
npm install
npm run build
set NODE_ENV=production
set PORT=3000
npm start
```

The existing `.env` / `.env.example` configuration remains unchanged.
