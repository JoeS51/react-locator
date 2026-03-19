# react-source-inspector

A React dev overlay that lets you inspect rendered components, jump to source in your IDE, and view git metadata.

## Install

```bash
npm install -D react-source-inspector bippy
```

## Vite setup (with git metadata)

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

## Shortcuts

- `cmd + option + i`: toggle inspector mode
- `option + click`: capture selected component
- `esc`: exit inspector mode
- `cmd + option + h`: open quick guide

## What is required?

- `SourceInspector` mount + `bippy` instrumentation are required for source mapping.
- `sourceInspectorVitePlugin()` is required only if you want built-in git metadata endpoint support in Vite.
