import { createRoot } from "react-dom/client";
import { AppProvider } from "./app/provider";
import App, { ErrorBoundary } from "./app/App";
import "./styles/global.css";
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <AppProvider>
      <App />
    </AppProvider>
  </ErrorBoundary>,
);
