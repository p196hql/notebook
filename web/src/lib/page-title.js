import { useEffect } from "react";

const APP_NAME = "Notebook AI";

function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | ${APP_NAME}` : APP_NAME;
  }, [title]);
}

export { APP_NAME, usePageTitle };
