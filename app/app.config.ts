import type { ExpoConfig } from "expo/config";
import appConfig from "./app.json";

const baseConfig = appConfig.expo as ExpoConfig;
const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "";
const allowCleartext = webBaseUrl.startsWith("http://");

const config: ExpoConfig = {
  ...baseConfig,
  android: {
    ...baseConfig.android,
    usesCleartextTraffic: allowCleartext,
  },
  ios: {
    ...baseConfig.ios,
    infoPlist: allowCleartext
      ? {
          ...baseConfig.ios?.infoPlist,
          NSAppTransportSecurity: {
            NSAllowsArbitraryLoads: true,
          },
        }
      : baseConfig.ios?.infoPlist,
  },
};

export default config;
