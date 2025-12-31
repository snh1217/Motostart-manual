import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useNetInfo } from "@react-native-community/netinfo";
import Constants from "expo-constants";
import * as LocalAuthentication from "expo-local-authentication";
import { usePushNotifications } from "./usePushNotifications";

const WEB_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://motostart-manual.vercel.app";

const REAUTH_TIMEOUT_MS = 3 * 60 * 1000;

type WebScreenProps = {
  path: string;
  initialContext: Record<string, unknown>;
};

type WebMessage = {
  type?: string;
};

export default function WebScreen({ path, initialContext }: WebScreenProps) {
  const targetUrl = `${WEB_BASE_URL}${path}`;
  const webViewRef = useRef<WebView>(null);
  const lastBackgroundAt = useRef<number | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("Failed to load page.");
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const netInfo = useNetInfo();
  const isOffline = netInfo.isConnected === false;
  const pushToken = usePushNotifications();

  const appContext = useMemo(
    () => ({
      ...initialContext,
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version ?? "unknown",
    }),
    [initialContext]
  );

  const injectedJavaScriptBeforeContentLoaded = useMemo(
    () => `
      (function() {
        window.__APP_CONTEXT__ = ${JSON.stringify(appContext)};
        window.dispatchEvent(new CustomEvent("app-context", { detail: window.__APP_CONTEXT__ }));
      })();
      true;
    `,
    [appContext]
  );

  const baseOrigin = useMemo(() => {
    try {
      return new URL(WEB_BASE_URL).origin;
    } catch {
      return WEB_BASE_URL;
    }
  }, []);

  const originWhitelist = useMemo(
    () => [
      baseOrigin,
      `${baseOrigin}/*`,
      "http://192.168.*",
      "http://192.168.*/*",
      "about:blank",
    ],
    [baseOrigin]
  );

  const isAllowedUrl = (url: string) => {
    if (url.startsWith(baseOrigin)) return true;
    if (url.startsWith("http://192.168.")) return true;
    return false;
  };

  const runBiometricAuth = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        setIsUnlocked(true);
        return;
      }
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        setIsUnlocked(true);
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock app",
        cancelLabel: "Cancel",
      });
      setIsUnlocked(result.success);
    } catch {
      setIsUnlocked(true);
    }
  };

  useEffect(() => {
    runBiometricAuth();
  }, []);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === "background" || state === "inactive") {
        lastBackgroundAt.current = Date.now();
      }
      if (state === "active" && lastBackgroundAt.current) {
        const elapsed = Date.now() - lastBackgroundAt.current;
        lastBackgroundAt.current = null;
        if (elapsed > REAUTH_TIMEOUT_MS) {
          setIsUnlocked(false);
          runBiometricAuth();
        }
      }
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const onBackPress = () => {
      if (canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );
    return () => subscription.remove();
  }, [canGoBack]);

  useEffect(() => {
    if (!isOffline && hasError) {
      setHasError(false);
      setHttpStatus(null);
      setReloadKey((prev) => prev + 1);
    }
  }, [isOffline, hasError]);

  const handleRetry = () => {
    setHasError(false);
    setHttpStatus(null);
    setReloadKey((prev) => prev + 1);
  };

  const handleMessage = (event: { nativeEvent: { data?: string } }) => {
    const raw = event.nativeEvent.data;
    if (!raw) return;
    try {
      const message = JSON.parse(raw) as WebMessage;
      if (message.type === "READY_FOR_TOKEN" && pushToken) {
        webViewRef.current?.postMessage(
          JSON.stringify({ type: "PUSH_TOKEN", value: pushToken })
        );
      }
    } catch {
      // Ignore invalid payloads.
    }
  };

  const errorTitle = useMemo(() => {
    if (isOffline) return "Offline";
    if (httpStatus === 404) return "Not found";
    if (httpStatus && httpStatus >= 500) return "Server error";
    if (hasError) return "Unable to load";
    return "";
  }, [isOffline, httpStatus, hasError]);

  const errorDetail = useMemo(() => {
    if (isOffline) return "Check your internet connection.";
    if (httpStatus === 404) return "The page does not exist.";
    if (httpStatus && httpStatus >= 500) return "Try again later.";
    if (hasError) return errorMessage;
    return "";
  }, [isOffline, httpStatus, hasError, errorMessage]);

  if (!isUnlocked) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Authentication required</Text>
          <Text style={styles.errorMessage}>
            Please verify your identity to continue.
          </Text>
          <Pressable style={styles.retryButton} onPress={runBiometricAuth}>
            <Text style={styles.retryButtonText}>Retry Auth</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isOffline || hasError ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>{errorTitle}</Text>
          <Text style={styles.errorMessage}>{errorDetail}</Text>
          <Pressable style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          key={`web-${reloadKey}`}
          source={{ uri: targetUrl }}
          originWhitelist={originWhitelist}
          startInLoadingState
          injectedJavaScriptBeforeContentLoaded={
            injectedJavaScriptBeforeContentLoaded
          }
          onMessage={handleMessage}
          onNavigationStateChange={(navState) =>
            setCanGoBack(Boolean(navState.canGoBack))
          }
          onShouldStartLoadWithRequest={(request) => {
            if (isAllowedUrl(request.url)) {
              return true;
            }
            Linking.openURL(request.url);
            return false;
          }}
          onLoadEnd={() => {
            setHasError(false);
            setHttpStatus(null);
          }}
          onError={(event) => {
            setErrorMessage(
              event.nativeEvent.description ?? "Failed to load page."
            );
            setHasError(true);
          }}
          onHttpError={(event) => {
            setHttpStatus(event.nativeEvent.statusCode);
            setHasError(true);
          }}
          renderLoading={() => (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#0f172a" />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  errorMessage: {
    fontSize: 13,
    textAlign: "center",
    color: "#64748b",
  },
  retryButton: {
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#0f172a",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
});
