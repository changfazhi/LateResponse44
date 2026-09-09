# LateResponse44

A sleek, modern web application designed to streamline the generation of late response incident report presentations for frontliners. Built with React and client-side PPTX processing.

## What is Late Response?
A response is considered late by SCDF when SCDF vehicles are unable to reach the incident location within 8 minutes. Section Commanders or Vehicles ICs must create a powerpoint presentation to justify their late response.

## Technologies Used

This application uses a modern, lightweight technology stack to deliver fast performance and a premium user experience without requiring a heavy backend.

### Core Framework & Build
*   **[React](https://react.dev/)**: Component-based UI library for a dynamic and responsive interface.
*   **[Vite](https://vitejs.dev/)**: Next-generation frontend tooling for lightning-fast development and optimized production builds.

### Styling & Design
*   **Vanilla CSS**: Custom-architected CSS using native modern features:
    *   CSS Variables for consistent theming.
    *   Flexbox & Grid for responsive layouts.
    *   Glassmorphism effects for a premium "dark mode" aesthetic.
    *   Animations for smooth interactions.

### PowerPoint Generation
*   **[JSZip](https://stuk.github.io/jszip/)**: Client-side creation and manipulation of ZIP archives (the underlying format of `.pptx` files).
*   **[FileSaver.js](https://github.com/eligrey/FileSaver.js/)**: Handles the client-side saving of the generated presentation files.
*   **XML Manipulation**: Custom logic to parse and update the internal XML structure of PowerPoint templates for precise text and image replacement.

## Features

*   **Fill from incident notes (optional)**: Paste raw incident notes and have Google's Gemini
    read them into the form. Every proposed value is shown next to the exact snippet of the
    note that supports it; you tick the ones you want and press Apply. Nothing is filled in
    automatically, existing values are never overwritten without a separate tick, and
    calculated fields are never proposed — the app still works those out itself.
*   **Smart Form**: Auto-formats times (`HH:mm:ss`) and durations (`xx Min xx Sec`).
*   **Auto-Calculations**: Automatically computes Real Response Time, Time Exceeded, and SFTL Durations.
*   **Image Replacement**: Intelligent mapping of user-uploaded images to specific placeholders within the template.
*   **Instant Generation**: Generates reports locally in the browser with zero latency.

## Note extraction setup

Extraction is off until you add a Gemini API key:

1. Get a key at [Google AI Studio](https://aistudio.google.com/apikey).
2. Open **Fill from incident notes** on the form and paste it in.

The key is stored in your browser's `localStorage` and sent with each extraction request.

**For local development**, you can skip the pasting: copy `.env.example` to `.env` (or
`.env.local`) and put your key in `VITE_GEMINI_API_KEY`. This is read only by `npm run dev` —
`npm run build` strips it out, so it can never end up in a deployed bundle. A pasted key
always takes priority over the file.

Note that Vite loads `.env.local` *after* `.env`, so an empty `VITE_GEMINI_API_KEY=` in
`.env.local` will silently override a real key in `.env`. Use one file, not both.

**What this means for your data.** The text you paste is sent to Google's Gemini API. Your
evidence images, the template, and the generated PowerPoint never leave your device. Don't
paste anything you are not permitted to send to a third-party service.

**Who can see the key.** It lives in the browser, so anyone using this browser profile can
read it, and it is sent from the client rather than from a server. That is a deliberate
tradeoff for a single-operator tool with no backend. If you deploy this URL for other people
to use, move the key behind a small serverless function first rather than sharing one.

## Development

```bash
npm install
npm run dev      # Vite dev server on :5173
npm test         # Vitest
npm run lint
npm run build
```
