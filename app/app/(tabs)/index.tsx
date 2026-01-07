import { ScrollView, Text, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

const QUICK_LINKS = [
  { label: "검색", path: "/search", description: "키워드로 빠르게 찾기" },
  { label: "스펙", path: "/specs", description: "토크/오일/용량" },
  { label: "정비사례", path: "/cases", description: "현장 사례 모음" },
  { label: "회로도", path: "/wiring", description: "전장 회로도" },
  { label: "매뉴얼", path: "/manuals", description: "원문 매뉴얼" },
  { label: "부품/절차", path: "/parts", description: "부품 및 절차" },
];

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>MOTOSTAR Manual Hub</Text>
      <Text style={styles.subtitle}>모바일에서 필요한 메뉴로 바로 이동하세요.</Text>

      <View style={styles.grid}>
        {QUICK_LINKS.map((item) => (
          <Pressable
            key={item.path}
            style={styles.card}
            onPress={() => router.push(item.path)}
          >
            <Text style={styles.cardTitle}>{item.label}</Text>
            <Text style={styles.cardDesc}>{item.description}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  grid: {
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardDesc: {
    marginTop: 6,
    fontSize: 13,
    color: "#64748b",
  },
});
