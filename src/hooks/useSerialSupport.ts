import { useEffect, useState } from 'react';

export interface SerialSupport {
  /** Web Serial API is callable in this environment. */
  supported: boolean;
  /** Coarse environment classification — used to tailor the warning copy. */
  kind: 'supported' | 'insecure' | 'mobile' | 'firefox' | 'safari' | 'other';
  /** Short description suitable for a toast/banner headline. */
  headline: string;
  /** Longer actionable message explaining what to do. */
  message: string;
}

function detect(): SerialSupport {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return {
      supported: false,
      kind: 'other',
      headline: 'Serial control unavailable',
      message: 'Browser environment not detected.',
    };
  }

  // Web Serial requires a secure context. The check has to run before the
  // navigator.serial probe, because Chrome simply doesn't expose `serial`
  // on http:// origins — and the user would then think their (perfectly
  // capable) browser is the problem. localhost and 127.0.0.1 count as
  // secure contexts even on http.
  if (!window.isSecureContext) {
    const httpsUrl = `https://${window.location.host}${window.location.pathname}${window.location.search}`;
    return {
      supported: false,
      kind: 'insecure',
      headline: 'This page is loaded over HTTP — Web Serial needs HTTPS',
      message: `Web Serial only runs on secure contexts (HTTPS or localhost). Reopen the page at ${httpsUrl} to enable the Connect button.`,
    };
  }

  const ua = navigator.userAgent;
  const uaL = ua.toLowerCase();
  const isMobile = /mobi|android|iphone|ipad|ipod/i.test(ua) || (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile === true;

  if ('serial' in navigator) {
    // Web Serial is exposed but not on mobile in practice — Chrome on Android
    // doesn't ship it. Treat mobile as unsupported even when the API key
    // somehow appears, since pairing flow won't work end-to-end.
    if (isMobile) {
      return {
        supported: false,
        kind: 'mobile',
        headline: 'Mobile browsers can\'t pair serial devices',
        message: 'Web Serial pairing requires a desktop machine. Open this page on a Mac, Windows, or Linux laptop to connect to the ESP32-S3.',
      };
    }
    return {
      supported: true,
      kind: 'supported',
      headline: 'Web Serial available',
      message: 'Web Serial API is supported in this browser.',
    };
  }

  if (isMobile) {
    return {
      supported: false,
      kind: 'mobile',
      headline: 'Mobile browsers can\'t pair serial devices',
      message: 'Web Serial pairing requires a desktop machine. Open this page on a Mac, Windows, or Linux laptop to connect to the ESP32-S3.',
    };
  }
  if (/firefox/.test(uaL)) {
    return {
      supported: false,
      kind: 'firefox',
      headline: 'Firefox doesn\'t support Web Serial',
      message: 'Firefox hasn\'t implemented the Web Serial API. Reopen this page in Chrome, Edge, Brave, or Opera to talk to the device.',
    };
  }
  if (/safari/.test(uaL) && !/chrome|chromium/.test(uaL)) {
    return {
      supported: false,
      kind: 'safari',
      headline: 'Safari doesn\'t support Web Serial',
      message: 'Safari hasn\'t shipped the Web Serial API. Reopen this page in Chrome, Edge, Brave, or Opera to talk to the device.',
    };
  }
  return {
    supported: false,
    kind: 'other',
    headline: 'Serial control unavailable',
    message: 'This browser doesn\'t expose the Web Serial API. Reopen the page in a Chromium-based desktop browser (Chrome, Edge, Brave, Opera).',
  };
}

/** Returns the cached Web Serial support classification for this environment. */
export function useSerialSupport(): SerialSupport {
  const [state] = useState<SerialSupport>(() => detect());
  return state;
}

const DISMISS_KEY = 'dq-dsp:serial-warning-dismissed';

/** True if the user has dismissed the support banner this session. */
export function useBannerDismissed(): [boolean, () => void] {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!dismissed) return;
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore quota errors */
    }
  }, [dismissed]);

  return [dismissed, () => setDismissed(true)];
}
