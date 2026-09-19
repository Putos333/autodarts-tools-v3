import { ref } from "vue";

interface NotificationState {
  show: boolean;
  type: "success" | "error";
  message: string;
  timeout: NodeJS.Timeout | null;
}

export function useNotification() {
  const notification = ref<NotificationState>({
    show: false,
    type: "success",
    message: "",
    timeout: null,
  });

  function showNotification(message: string, type: "success" | "error" = "success", duration: number = 5000) {
    if (notification.value.timeout) {
      clearTimeout(notification.value.timeout);
    }

    notification.value = {
      show: true,
      type,
      message,
      timeout: setTimeout(() => {
        notification.value.show = false;
      }, duration) as unknown as NodeJS.Timeout,
    };
  }

  function hideNotification() {
    if (notification.value.timeout) {
      clearTimeout(notification.value.timeout);
    }
    notification.value.show = false;
  }

  return {
    notification,
    showNotification,
    hideNotification,
  };
}
