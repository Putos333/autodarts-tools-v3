<template>
  <section :class="[ 'cc-hero', isLive && 'is-live' ]" data-testid="cc-hero">
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
        <span v-if="baseScoreLabel" class="cc-pill is-sm">
          <span class="cc-pill-label">{{ baseScoreLabel }}</span>
        </span>
        <span v-if="modeLabel" class="cc-pill is-sm">
          <span class="cc-pill-label">{{ modeLabel }}</span>
        </span>
        <span v-if="isPrivateMatch" class="cc-pill is-sm">
          <span class="cc-pill-label">Privat</span>
        </span>
      </div>
    </div>

    <!-- Zwei Spieler → echtes Duell-Layout -->
    <div v-if="heroPair" class="cc-hero-body">
      <div class="cc-hero-side is-left">
        <CcPlayerBadge
          :name="heroPair.left.name"
          :is-bot="heroPair.left.isBot"
          :variant="heroPair.left.isWinner ? 'gold' : 'red'"
          size="xl"
        />
        <div class="cc-hero-side-info">
          <div class="cc-hero-name">{{ heroPair.left.name }}</div>
          <div class="cc-hero-tags">
            <span v-if="heroPair.left.isBot" class="cc-tag">Bot</span>
            <span v-if="heroPair.left.isActive" class="cc-tag is-accent">Am Wurf</span>
            <span v-if="heroPair.left.isWinner" class="cc-tag is-gold">Sieger</span>
          </div>
          <div v-if="showScore" style="margin-top: 8px;">
            <div class="cc-hero-remaining-label">{{ scoreLabel }}</div>
            <div class="cc-hero-remaining">{{ heroPair.left.remaining ?? "–" }}</div>
          </div>
          <div class="cc-hero-sub">
            <div class="cc-stat" style="text-align: left;">
              <div class="cc-stat-label">Average</div>
              <div :class="[ 'cc-stat-value', heroPair.left.average === undefined && 'is-unknown' ]">
                {{ formatAvg(heroPair.left.average) }}
              </div>
            </div>
            <div class="cc-stat" style="text-align: left;">
              <div class="cc-stat-label">Legs</div>
              <div :class="[ 'cc-stat-value', heroPair.left.legs === undefined && 'is-unknown' ]">
                {{ heroPair.left.legs ?? "–" }}
              </div>
            </div>
            <div v-if="anySets" class="cc-stat" style="text-align: left;">
              <div class="cc-stat-label">Sets</div>
              <div :class="[ 'cc-stat-value', heroPair.left.sets === undefined && 'is-unknown' ]">
                {{ heroPair.left.sets ?? "–" }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="cc-hero-center">
        <template v-if="heroScoreLine">
          <div class="cc-hero-score-label">{{ heroScoreLine.label }}</div>
          <div class="cc-hero-score">{{ heroScoreLine.text }}</div>
        </template>
        <div class="cc-hero-vs">VS</div>
        <div v-if="centerNote" class="cc-note" style="text-align: center;">{{ centerNote }}</div>
      </div>

      <div class="cc-hero-side is-right">
        <CcPlayerBadge
          :name="heroPair.right.name"
          :is-bot="heroPair.right.isBot"
          :variant="heroPair.right.isWinner ? 'gold' : 'blue'"
          size="xl"
        />
        <div class="cc-hero-side-info">
          <div class="cc-hero-name">{{ heroPair.right.name }}</div>
          <div class="cc-hero-tags">
            <span v-if="heroPair.right.isBot" class="cc-tag">Bot</span>
            <span v-if="heroPair.right.isActive" class="cc-tag is-accent">Am Wurf</span>
            <span v-if="heroPair.right.isWinner" class="cc-tag is-gold">Sieger</span>
          </div>
          <div v-if="showScore" style="margin-top: 8px;">
            <div class="cc-hero-remaining-label">{{ scoreLabel }}</div>
            <div class="cc-hero-remaining">{{ heroPair.right.remaining ?? "–" }}</div>
          </div>
          <div class="cc-hero-sub">
            <div class="cc-stat">
              <div class="cc-stat-label">Average</div>
              <div :class="[ 'cc-stat-value', heroPair.right.average === undefined && 'is-unknown' ]">
                {{ formatAvg(heroPair.right.average) }}
              </div>
            </div>
            <div class="cc-stat">
              <div class="cc-stat-label">Legs</div>
              <div :class="[ 'cc-stat-value', heroPair.right.legs === undefined && 'is-unknown' ]">
                {{ heroPair.right.legs ?? "–" }}
              </div>
            </div>
            <div v-if="anySets" class="cc-stat">
              <div class="cc-stat-label">Sets</div>
              <div :class="[ 'cc-stat-value', heroPair.right.sets === undefined && 'is-unknown' ]">
                {{ heroPair.right.sets ?? "–" }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Ein einzelner Spieler (z.B. Solo-Training): kein erfundener Gegner -->
    <div v-else-if="players.length === 1" class="cc-hero-body" style="grid-template-columns: minmax(0, 1fr);">
      <div class="cc-hero-side is-left">
        <CcPlayerBadge :name="players[0].name" :is-bot="players[0].isBot" variant="red" size="lg" />
        <div class="cc-hero-side-info">
          <div class="cc-hero-name">{{ players[0].name }}</div>
          <div class="cc-hero-tags">
            <span class="cc-tag">Einzelspieler</span>
            <span v-if="players[0].isBot" class="cc-tag">Bot</span>
          </div>
          <div class="cc-hero-sub">
            <div class="cc-stat" style="text-align: left;">
              <div class="cc-stat-label">Average</div>
              <div :class="[ 'cc-stat-value', players[0].average === undefined && 'is-unknown' ]">
                {{ formatAvg(players[0].average) }}
              </div>
            </div>
            <div class="cc-stat" style="text-align: left;">
              <div class="cc-stat-label">Legs</div>
              <div :class="[ 'cc-stat-value', players[0].legs === undefined && 'is-unknown' ]">
                {{ players[0].legs ?? "–" }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Kein Match -->
    <div v-else class="cc-hero-empty">
      <CcEmptyState
        icon="icon-[pixelarticons--downasaur]"
        title="Kein aktives Match"
        text="Sobald auf play.autodarts.io ein Match läuft, erscheinen hier Spieler, Spielstand und Live-Statistik."
      >
        <template #action>
          <button @click="openAutodarts(autodartsOrigin)" class="cc-btn is-primary" type="button" data-testid="cc-hero-open-autodarts">
            <span class="icon-[pixelarticons--external-link]" />
            <span>Autodarts öffnen</span>
          </button>
          <button @click="goToMatchSection" class="cc-btn" type="button" data-testid="cc-hero-match-section">
            <span class="icon-[pixelarticons--gamepad]" />
            <span>Match-Bereich</span>
          </button>
        </template>
      </CcEmptyState>
    </div>

    <div v-if="heroPair && extraPlayers > 0" class="cc-card-foot">
      {{ extraPlayers }} weitere{{ extraPlayers === 1 ? "r" : "" }} Spieler in der Spieler-Karte.
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";

import CcPlayerBadge from "./CcPlayerBadge.vue";
import CcStatusPill from "./CcStatusPill.vue";
import CcEmptyState from "./CcEmptyState.vue";
import { openAutodarts } from "./open-autodarts";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";

const {
  liveness,
  hasMatch,
  isPrivateMatch,
  matchVariant,
  matchFinished,
  matchStateLabel,
  matchStateTone,
  matchProgress,
  matchSettings,
  gameMode,
  players,
  heroPair,
  heroScoreLine,
  showRemaining,
  showPoints,
  scoreLabel,
  anySets,
  autodartsOrigin,
} = useControlCenterStatus();

/** Punkte-/Restanzeige nur, wenn sie für diese Variante gemeldet wird. */
const showScore = computed(() => showRemaining.value || showPoints.value);

const isLive = computed(() => hasMatch.value && !matchFinished.value && liveness.value === "live");

const eyebrow = computed(() => {
  if (!hasMatch.value) return "Match";
  if (matchFinished.value) return "Match beendet";
  return isLive.value ? "Live Match" : "Match";
});

/** Bei X01 gibt `settings.baseScore` den Startwert her (z.B. 501). */
const baseScoreLabel = computed(() => {
  const baseScore = matchSettings.value?.baseScore;
  return baseScore !== null && baseScore !== undefined ? String(baseScore) : null;
});

/** In/Out-Modus nur, wenn gemeldet. */
const modeLabel = computed(() => {
  const settings = matchSettings.value;
  if (!settings) return gameMode.value;
  const parts: string[] = [];
  if (settings.inMode) parts.push(`In: ${settings.inMode}`);
  if (settings.outMode) parts.push(`Out: ${settings.outMode}`);
  if (parts.length > 0) return parts.join(" · ");
  return settings.gameMode ?? gameMode.value;
});

const centerNote = computed(() => {
  const progress = matchProgress.value;
  if (!progress) return null;
  const parts: string[] = [];
  if (progress.set !== null) parts.push(`Set ${progress.set}`);
  if (progress.leg !== null) parts.push(`Leg ${progress.leg}`);
  if (progress.round !== null) parts.push(`Runde ${progress.round}`);
  return parts.length > 0 ? parts.join(" · ") : null;
});

const extraPlayers = computed(() => heroPair.value?.extra ?? 0);

function formatAvg(value: number | undefined): string {
  return value !== undefined ? value.toFixed(2) : "–";
}

function goToMatchSection(): void {
  window.location.hash = "match";
}
</script>
