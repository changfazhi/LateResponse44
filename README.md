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

*   **Smart Form**: Auto-formats times (`HH:mm:ss`) and durations (`xx Min xx Sec`).
*   **Auto-Calculations**: Automatically computes Real Response Time, Time Exceeded, and SFTL Durations.
*   **Image Replacement**: Intelligent mapping of user-uploaded images to specific placeholders within the template.
*   **Instant Generation**: Generates reports locally in the browser with zero latency.
