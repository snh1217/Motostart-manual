import { useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";

const WEB_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://motostart-manual.vercel.app";

export default function ViewerScreen() {
  const params = useLocalSearchParams<{
    file?: string;
    entryId?: string;
    title?: string;
    page?: string;
    url?: string;
  }>();

  const targetUrl = useMemo(() => {
    if (params.url && typeof params.url === "string") {
      return params.url;
    }

    if (!params.file || typeof params.file !== "string") return "";
    const pageParam = params.page ? `&page=${params.page}` : "";
    const entryParam = params.entryId
      ? `entryId=${encodeURIComponent(params.entryId)}`
      : "";
    const titleParam = params.title
      ? `&title=${encodeURIComponent(params.title)}`
      : "";
    const fileParam = `file=${encodeURIComponent(params.file)}`;
    const query = entryParam ? `${entryParam}&${fileParam}${titleParam}` : `${fileParam}${titleParam}`;
    return `${WEB_BASE_URL}/viewer?${query}${pageParam}`;
  }, [params]);

  if (!targetUrl) {
    return (
      <View style={styles.center}>
        <Text style={styles.helper}>표시할 문서가 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: targetUrl }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#0f172a" />
          </View>
        )}
      />
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
  },
  helper: {
    fontSize: 14,
    color: "#94a3b8",
  },
});
