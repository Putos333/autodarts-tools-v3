<template>
  <section :class="[ 'cc-hero', 'cc-board-big', isLive && 'is-live' ]" data-testid="cc-match-scoreboard">
    <div class="cc-hero-top">
      <div class="cc-hero-eyebrow">
        <span v-if="isLive" class="cc-live-dot" />
        <span v-else class="icon-[pixelarticons--gamepad]" />
        <span>{{ eyebrow }}</span>
      </div>

      <div class="cc-hero-meta">
        <CcStatusPill :label="matchStateLabel" :tone="matchStateTone" class="is-sm" />
        <span v-if="matchVariant" class="cc-pill is-sm cc-tone-gold">
          <span class="cc-pill-label">{{ matchVariant }}</span>
        </span>
        <span v-if="startValue" class="cc-pill is-sm">
          <span class="cc-pill-label">{{ startValue }}</span>
        </span>
        <span v-if="rulesLabel" class="cc-pill is-sm">
          <span class="cc-pill-label">{{ rulesLabel }}</span>
        </span>
        <span v-if="matchType" class="cc-pill is-sm">
          <span class="cc-pill-label">{{ matchType }}</span>
        </span>
        <span v-if="isPrivateMatch" class="cc-pill is-sm">
          <span class="cc-pill-label">Privat</span>
        </span>
      </div>
    </div>

    <!-- Zwei Spieler: echtes VS-Scoreboard -->
    <div v-if="heroPair" class="cc-sb">
      <div :class="[ 'cc-sb-side', 'is-left', heroPair.left.isActive && 'is-active', heroPair.left.isWinner && 'is-winner' ]">
        <CcPlayerBadge
          :name="heroPair.left.name"
          :is-bot="heroPair.left.isBot"
          :variant="heroPair.left.isWinner ? 'gold' : 'red'"
          size="xl"
        />
        <div class="cc-sb-name">{{ heroPair.left.name }}</div>
        <div class="cc-hero-tags">
          <span v-if="heroPair.left.isBot" class="cc-tag">Bot</span>
          <span v-if="heroPair.left.isActive" class="cc-tag is-accent">Am Wurf</span>
          <span v-if="heroPair.left.isWinner" class="cc-tag is-gold">Sieger</span>
        </div>
        <div v-if="showScore" class="cc-sb-score-block">
          <div class="cc-hero-remaining-label">{{ scoreLabel }}</div>
          <div class="cc-sb-score is-red">{{ heroPair.left.remaining ?? "–" }}</div>
        </div>
        <div v-if="checkoutRouteFor(heroPair.left.remaining)" class="cc-checkout-route" data-testid="cc-checkout-route-left">
          <span class="cc-checkout-route-label">Checkout</span>
          <span class="cc-checkout-route-path">{{ checkoutRouteFor(heroPair.left.remaining) }}</span>
        </div>
        <CcPlayerStatGrid :player="heroPair.left" :any-sets="anySets" :stats="statKeys" />
      </div>

      <div class="cc-sb-center">
        <div v-if="heroScoreLine" class="cc-sb-center-block">
          <div class="cc-hero-score-label">{{ heroScoreLine.label }}</div>
          <div class="cc-sb-legs">{{ heroScoreLine.text }}</div>
        </div>
        <div class="cc-sb-vs">VS</div>
        <div v-if="progressLabel" class="cc-sb-progress">{{ progressLabel }}</div>
        <CcStatusPill
          v-if="!isLive && !matchFinished"
          label="Keine aktuellen Daten"
          tone="warn"
          class="is-sm"
        />
      </div>

      <div :class="[ 'cc-sb-side', 'is-right', heroPair.right.isActive && 'is-active', heroPair.right.isWinner && 'is-winner' ]">
        <CcPlayerBadge
          :name="heroPair.right.name"
          :is-bot="heroPair.right.isBot"
          :variant="heroPair.right.isWinner ? 'gold' : 'blue'"
          size="xl"
        />
        <div class="cc-sb-name">{{ heroPair.right.name }}</div>
        <div class="cc-hero-tags">
          <span v-if="heroPair.right.isBot" class="cc-tag">Bot</span>
          <span v-if="heroPair.right.isActive" class="cc-tag is-accent">Am Wurf</span>
          <span v-if="heroPair.right.isWinner" class="cc-tag is-gold">Sieger</span>
        </div>
        <div v-if="showScore" class="cc-sb-score-block">
          <div class="cc-hero-remaining-label">{{ scoreLabel }}</div>
          <div class="cc-sb-score is-blue">{{ heroPair.right.remaining ?? "–" }}</div>
        </div>
        <div v-if="checkoutRouteFor(heroPair.right.remaining)" class="cc-checkout-route" data-testid="cc-checkout-route-right">
          <span class="cc-checkout-route-label">Checkout</span>
          <span class="cc-checkout-route-path">{{ checkoutRouteFor(heroPair.right.remaining) }}</span>
        </div>
        <CcPlayerStatGrid :player="heroPair.right" :any-sets="anySets" :stats="statKeys" />
      </div>
    </div>

    <!-- Ein Spieler: ehrlich als Einzelspieler, kein erfundener Gegner -->
    <div v-else-if="players.length === 1" class="cc-sb is-single">
      <div :class="[ 'cc-sb-side', 'is-left', players[0].isActive && 'is-active' ]">
        <CcPlayerBadge :name="players[0].name" :is-bot="players[0].isBot" variant="red" size="xl" />
        <div class="cc-sb-name">{{ players[0].name }}</div>
        <div class="cc-hero-tags">
          <span class="cc-tag">Einzelspieler</span>
          <span v-if="players[0].isBot" class="cc-tag">Bot</span>
          <span v-if="players[0].isActive" class="cc-tag is-accent">Am Wurf</span>
        </div>
        <div v-if="showScore" class="cc-sb-score-block">
          <div class="cc-hero-remaining-label">{{ scoreLabel }}</div>
          <div class="cc-sb-score is-red">{{ players[0].remaining ?? "–" }}</div>
        </div>
        <div v-if="checkoutRouteFor(players[0].remaining)" class="cc-checkout-route" data-testid="cc-checkout-route-single">
          <span class="cc-checkout-route-label">Checkout</span>
          <span class="cc-checkout-route-path">{{ checkoutRouteFor(players[0].remaining) }}</span>
        </div>
        <CcPlayerStatGrid :player="players[0]" :any-sets="anySets" :stats="statKeys" />
      </div>
    </div>

    <!-- Mehr als zwei Spieler: alle gleichwertig, kein künstliches Duell -->
    <div v-else-if="players.length > 2" class="cc-sb-multi">
      <div
        v-for="player in players"
        :key="player.seat"
        :class="[ 'cc-sb-multi-row', player.isActive && 'is-active', player.isWinner && 'is-winner' ]"
      >
        <CcPlayerBadge
          :name="player.name"
          :is-bot="player.isBot"
          :variant="player.isWinner ? 'gold' : 'plain'"
          size="md"
        />
        <div style="min-width: 0; flex: 1;">
          <div class="cc-player-name">{{ player.name }}</div>
          <div class="cc-player-tags">
            <span v-if="player.isBot" class="cc-tag">Bot</span>
            <span v-if="player.isActive" class="cc-tag is-accent">Am Wurf</span>
            <span v-if="player.isWinner" class="cc-tag is-gold">Sieger</span>
          </div>
        </div>
        <CcPlayerStatGrid :player="player" :any-sets="anySets" :stats="statKeys" with-score />
      </div>
    </div>

    <div v-if="footerNote" class="cc-card-foot">{{ footerNote }}</div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";

import CcPlayerBadge from "./CcPlayerBadge.vue";
import CcStatusPill from "./CcStatusPill.vue";
import CcPlayerStatGrid from "./CcPlayerStatGrid.vue";
import { useControlCenterStatus, type ICcPlayer } from "@/composables/useControlCenterStatus";
import { CHECKOUTS } from "@/entrypoints/match.content/bogey-warning";

const {
  liveness,
  hasMatch,
  isPrivateMatch,
  matchVariant,
  matchType,
  matchFinished,
  matchStateLabel,
  matchStateTone,
  matchProgress,
  matchSettings,
  players,
  heroPair,
  heroScoreLine,
  anySets,
  scoreLabel,
  showRemaining,
  showPoints,
  isX01,
  isCricket,
} = useControlCenterStatus();

const isLive = computed(() => hasMatch.value && !matchFinished.value && liveness.value === "live");

const eyebrow = computed(() => {
  if (matchFinished.value) return "Match beendet";
  return isLive.value ? "Live Match" : "Match";
});

/** Punkte-/Restanzeige nur, wenn sie für diese Variante gemeldet ist. */
const showScore = computed(() => showRemaining.value || showPoints.value);

/**
 * Checkout-Route für einen realen Restwert. Reine Ableitung aus der von
 * Autodarts gemeldeten `remaining` — keine erfundenen Daten, keine eigene
 * Autoscoring-Logik. Nutzt dieselbe Tabelle wie das bestehende Bogey-Warning-
 * Overlay (`entrypoints/match.content/bogey-warning.ts`), nur hier zusätzlich
 * für die Elite-Scoreboard-Ansicht gelesen. Nur bei X01 sinnvoll.
 */
function checkoutRouteFor(remaining: number | undefined): string | null {
  if (!isX01.value || remaining === undefined) return null;
  return CHECKOUTS[remaining] ?? null;
}

const startValue = computed(() => {
  const baseScore = matchSettings.value?.baseScore;
  return baseScore !== null && baseScore !== undefined ? String(baseScore) : null;
});

const rulesLabel = computed(() => {
  const settings = matchSettings.value;
  if (!settings) return null;
  const parts: string[] = [];
  if (settings.inMode) parts.push(`In ${settings.inMode}`);
  if (settings.outMode) parts.push(`Out ${settings.outMode}`);
  if (parts.length === 0 && settings.mode) parts.push(settings.mode);
  return parts.length > 0 ? parts.join(" · ") : null;
});

const progressLabel = computed(() => {
  const progress = matchProgress.value;
  if (!progress) return null;
  const parts: string[] = [];
  if (progress.set !== null) parts.push(`Set ${progress.set}`);
  if (progress.leg !== null) parts.push(`Leg ${progress.leg}`);
  if (progress.round !== null) parts.push(`Runde ${progress.round}`);
  return parts.length > 0 ? parts.join(" · ") : null;
});

/**
 * Welche Kennzahlen im Scoreboard erscheinen. Bei X01 der bekannte Satz, sonst
 * nur die Werte, die für mindestens einen Spieler wirklich gemeldet sind.
 */
const statKeys = computed<string[]>(() => {
  if (isX01.value) return [ "average", "first9", "checkout", "legs", "sets", "darts", "total180" ];

  const list = players.value;
  const reported = (pick: (player: ICcPlayer) => number | undefined) =>
    list.some(player => pick(player) !== undefined);

  const keys: string[] = [];
  if (reported(player => player.legs)) keys.push("legs");
  if (reported(player => player.sets)) keys.push("sets");
  if (reported(player => player.dartsThrown)) keys.push("darts");
  if (reported(player => player.average)) keys.push("average");
  if (reported(player => player.total180)) keys.push("total180");
  return keys;
});

const footerNote = computed(() => {
  if (!hasMatch.value) return null;
  if (isCricket.value) {
    return "Cricket: Autodarts liefert im gespeicherten Match-Snapshot keine Trefferfelder (Marks) mit. Dargestellt werden ausschließlich die gemeldeten Werte — X01-Kennzahlen werden nicht erzwungen.";
  }
  if (!isX01.value) {
    return "Für diese Variante werden ausschließlich die von Autodarts gemeldeten Werte angezeigt.";
  }
  return null;
});
</script>
