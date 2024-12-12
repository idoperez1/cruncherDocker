import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import MainContent from "~core/MainContent";
import { MockController } from "~adapters/local/controller";
import { css } from "@emotion/react";

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
      <MainContent controller={MockController} />
    </div>
  </StrictMode>
);
