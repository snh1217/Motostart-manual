import type { ExpoConfig } from "expo/config";
import appConfig from "./app.json";

const baseConfig = appConfig.expo as ExpoConfig;
const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "";
const allowCleartext = webBaseUrl.startsWith("http://");

const iosBundleIdentifier =
  process.env.EXPO_IOS_BUNDLE_ID ?? "com.motostar.manualhub";
const androidPackage =
  process.env.EXPO_ANDROID_PACKAGE ?? "com.motostar.manualhub";

const config: ExpoConfig = {
  ...baseConfig,
  extra: {
    ...(baseConfig.extra ?? {}),
    eas: {
      ...(baseConfig.extra as { eas?: { projectId?: string } })?.eas,
      projectId: "d0794df4-9e82-4b45-af54-fe4998e04028",
    },
  },
  android: {
    ...baseConfig.android,
    package: baseConfig.android?.package ?? androidPackage,
    usesCleartextTraffic: allowCleartext,
  },
  ios: {
    ...baseConfig.ios,
    bundleIdentifier: baseConfig.ios?.bundleIdentifier ?? iosBundleIdentifier,
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
