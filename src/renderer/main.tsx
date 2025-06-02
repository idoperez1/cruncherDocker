import { css } from "@emotion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import MainContent from "~core/MainContent";

import "./binding";
import "./index.css";
import "./websocket_bridge";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div
      css={css`
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
      `}
    >
      <MainContent />
    </div>
  </StrictMode>
);
