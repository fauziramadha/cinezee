"use client";

import { useEffect, useState } from "react";

/**
 * MonetagLoader - Load Monetag popunder script
 * - Only loads after first user interaction (not on page load)
 * - Only once per session (sessionStorage)
 * - Non-intrusive: doesn't block page load
 */
export function MonetagLoader() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Check if already loaded this session
    if (sessionStorage.getItem("monetag_loaded") === "true") return;

    const loadScript = () => {
      if (loaded) return;
      setLoaded(true);

      fetch("/api/ads/config")
        .then((res) => res.json())
        .then((data) => {
          if (data.monetag?.script_url) {
            // Create script element
            const script = document.createElement("script");
            script.src = data.monetag.script_url;
            script.async = true;
            script.type = "text/javascript";
            document.body.appendChild(script);
            
            // Mark as loaded for this session
            sessionStorage.setItem("monetag_loaded", "true");
          }
        })
        .catch(() => {});

      // Remove listeners after first load
      document.removeEventListener("click", loadScript);
      document.removeEventListener("touchstart", loadScript);
    };

    // Load on first user interaction (not on page load)
    // This makes it less spammy
    document.addEventListener("click", loadScript, { once: true });
    document.addEventListener("touchstart", loadScript, { once: true });

    return () => {
      document.removeEventListener("click", loadScript);
      document.removeEventListener("touchstart", loadScript);
    };
  }, [loaded]);

  return null;
}
