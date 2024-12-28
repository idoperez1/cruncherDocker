import { css } from "@emotion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MockController } from "~adapters/local/controller";
import MainContent from "~core/MainContent";


// const startTime = new Date(new Date().getTime() - 1000 * 60 * 60 * 24);

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
      <MainContent controller={MockController}
          initialQuery="developer | table _time, name, age"
        />
    </div>
  </StrictMode>
);
