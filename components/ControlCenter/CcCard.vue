<template>
  <section :class="[ 'cc-card', accent === 'gold' && 'is-gold', accent === 'muted' && 'is-muted' ]">
    <header class="cc-card-head">
      <span v-if="icon" class="cc-card-icon">
        <span :class="icon" />
      </span>
      <div class="cc-card-titles">
        <h2 class="cc-card-title">{{ title }}</h2>
        <p v-if="subtitle" class="cc-card-sub">{{ subtitle }}</p>
      </div>
      <slot name="status" />
    </header>

    <div class="cc-card-body">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="cc-card-foot">
      <slot name="footer" />
    </footer>
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  subtitle?: string | null;
  /** Iconify-Klasse, z.B. "icon-[pixelarticons--bullseye]". */
  icon?: string;
  accent?: "red" | "gold" | "muted";
}>(), {
  accent: "red",
});
</script>
