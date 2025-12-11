import ReactGA from "react-ga4";

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

export const initGA = () => {
  if (!MEASUREMENT_ID) {
    console.warn("Google Analytics Measurement ID not found");
    return;
  }

  ReactGA.initialize(MEASUREMENT_ID, {
    testMode: import.meta.env.DEV,
  });
};

export const trackPageView = (path: string) => {
  ReactGA.send({ hitType: "pageview", page: path });
};

export const trackEvent = (category: string, action: string, label?: string, value?: number) => {
  ReactGA.event({
    category,
    action,
    label,
    value,
  });
};
