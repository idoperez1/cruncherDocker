import React from "react";
import { useEffect } from "react";

export function useOutsideDetector(onOutsideClick = () => { }) {
    const ref = React.useRef<HTMLDivElement>(null);
    useEffect(() => {
        const shadowDom = document.getElementById("cruncher-root")?.shadowRoot;
        if (!shadowDom) {
            return;
        }

        /**
         * Alert if clicked on outside of element
         */
        function handleClickOutside(event: any) {
            if (ref.current && event.target && !ref.current.contains(event.target)) {
                onOutsideClick();
            }
        }
        // Bind the event listener
        shadowDom.addEventListener("mousedown", handleClickOutside);
        return () => {
            // Unbind the event listener on clean up
            shadowDom.removeEventListener("mousedown", handleClickOutside);
        };
    }, [ref, onOutsideClick]);

    return ref;
}
