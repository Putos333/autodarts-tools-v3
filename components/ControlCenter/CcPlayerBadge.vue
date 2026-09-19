<template>
  <div
    :class="[ 'cc-badge', `is-${size}`, `is-${variant}` ]"
    :title="name"
    :aria-label="name"
  >
    <span :class="isBot && 'cc-badge-bot'">{{ initials }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

/**
 * Spieler-Badge aus echten Initialen — bewusst KEINE generierten Avatare.
 * Autodarts liefert zwar teils `user.avatarUrl`, das wollen wir im Control
 * Center aber nicht nachladen (fremde Requests, unklare Verfügbarkeit).
 */
const props = withDefaults(defineProps<{
  name: string;
  isBot?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "red" | "blue" | "gold" | "plain";
}>(), {
  size: "md",
  variant: "plain",
  isBot: false,
});

const initials = computed(() => {
  if (props.isBot) return "BOT";
  const parts = props.name
    .trim()
    .split(/[\s_.-]+/)
    .filter(part => part.length > 0);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[parts.length - 1][0]}`;
});
</script>
