import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { notifyFirstFrameReady } from "./lib/youtubePlayables";

createRoot(document.getElementById("root")!).render(<App />);

requestAnimationFrame(() => notifyFirstFrameReady());
