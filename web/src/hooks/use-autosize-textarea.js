import { useLayoutEffect } from "react";

export function useAutosizeTextarea(ref, value, maxHeight = 220) {
  useLayoutEffect(() => {
    const textarea = ref.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [maxHeight, ref, value]);
}
