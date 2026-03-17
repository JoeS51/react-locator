# react-source-inspector

Dev inspector UI for React apps that combines `element-source` file locations with `git blame` metadata.

## Install

```bash
npm install -D react-source-inspector element-source bippy
```

## Vite setup

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
