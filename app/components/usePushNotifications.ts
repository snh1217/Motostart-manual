import { useEffect, useState } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const usePushNotifications = () => {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const register = async () => {
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        const { status: existingStatus } =
          await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted") {
          if (mounted) setToken(null);
          return;
        }

        const response = await Notifications.getExpoPushTokenAsync();
        if (mounted) setToken(response.data);
      } catch {
        if (mounted) setToken(null);
      }
    };

    register();

    return () => {
      mounted = false;
    };
  }, []);

  return token;
};
