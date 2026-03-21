# React Locator

A React dev overlay that lets you inspect rendered components, jump to source in your IDE, and view git metadata.

[![Watch demo](assets/readme-demo.gif)](assets/export-1773893512682.mp4)

[Watch the full MP4 demo](assets/export-1773893512682.mp4)

## Why use it?

- Inspect rendered React components directly in the browser
- Jump from selected UI to source in your IDE
- See git metadata for faster debugging and review context

## Installation

```bash
npm install -D react-source-inspector bippy
```

## Quick start (Vite + git metadata)

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sourceInspectorVitePlugin } from "react-source-inspector/vite";

export default defineConfig({
  plugins: [react(), sourceInspectorVitePlugin()],
});
```

```tsx
// main.tsx
import { instrument } from "bippy";
import { createRoot } from "react-dom/client";
import { App } from "./app";

instrument({
  name: "my-app",
  onCommitFiberRoot: () => {},
});

createRoot(document.getElementById("root")!).render(<App />);
```

```tsx
// app.tsx
import { SourceInspector } from "react-source-inspector";

export const App = () => (
  <>
    <YourApp />
    <SourceInspector />
  </>
);
```

## Requirements

- `SourceInspector` mount + `bippy` instrumentation are required for source mapping
- `sourceInspectorVitePlugin()` is only required if you want the built-in git metadata endpoint in Vite

## Shortcuts

- `cmd + option + i`: toggle inspector mode
- `option + click`: capture selected component
- `esc`: exit inspector mode
- `cmd + option + h`: open quick guide
