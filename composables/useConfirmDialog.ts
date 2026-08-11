import { ref } from "vue";

interface ConfirmDialogState {
  show: boolean;
  title: string;
  message: string;
  onConfirm: (() => void) | null;
  confirmText?: string;
  cancelText?: string;
}

export function useConfirmDialog() {
  const confirmDialog = ref<ConfirmDialogState>({
    show: false,
    title: "",
    message: "",
    onConfirm: null,
    confirmText: "Confirm",
    cancelText: "Cancel",
  });

  function showConfirmDialog(
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { confirmText?: string; cancelText?: string },
  ) {
    confirmDialog.value = {
      show: true,
      title,
      message,
      onConfirm,
      confirmText: options?.confirmText || "Confirm",
      cancelText: options?.cancelText || "Cancel",
    };
  }

  function confirmDialogConfirm() {
    if (confirmDialog.value.onConfirm) {
      confirmDialog.value.onConfirm();
    }
    confirmDialog.value.show = false;
  }

  function confirmDialogCancel() {
    confirmDialog.value.show = false;
  }

  return {
    confirmDialog,
    showConfirmDialog,
    confirmDialogConfirm,
    confirmDialogCancel,
  };
}
