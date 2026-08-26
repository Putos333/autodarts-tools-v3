<template>
  <section :class="[ 'cc-hero', isLive && 'is-live', checkoutPath.visible && 'is-checkout' ]" data-testid="cc-hero">
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
      <div :class="[ 'cc-hero-side', 'is-left', heroPair.left.isActive && 'is-active-side' ]">
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
          <!-- Einziger Ort für Average/Checkout % in diesem Panel (siehe cc-perf-grid
               unten für die restlichen Kennzahlen) — kein zweites Vorkommen mehr. -->
          <div class="cc-hero-chips" style="justify-content: flex-start;">
            <div v-if="heroPair.left.average !== undefined" class="cc-hero-chip">
              <span class="k">Average</span><span class="v">{{ formatAvg(heroPair.left.average) }}</span>
            </div>
            <div v-if="heroPair.left.checkoutPercent !== undefined" class="cc-hero-chip">
              <span class="k">Checkout</span><span class="v">{{ heroPair.left.checkoutPercent.toFixed(0) }}%</span>
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

      <div :class="[ 'cc-hero-side', 'is-right', heroPair.right.isActive && 'is-active-side' ]">
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
          <div class="cc-hero-chips" style="justify-content: flex-end;">
            <div v-if="heroPair.right.average !== undefined" class="cc-hero-chip">
              <span class="k">Average</span><span class="v">{{ formatAvg(heroPair.right.average) }}</span>
            </div>
            <div v-if="heroPair.right.checkoutPercent !== undefined" class="cc-hero-chip">
              <span class="k">Checkout</span><span class="v">{{ heroPair.right.checkoutPercent.toFixed(0) }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Ein einzelner Spieler (z.B. Solo-Training): kein erfundener Gegner.
         Bewusst unverändert gegenüber Wave 1 — die genehmigte Konsolidierung
         betraf ausschließlich das Zwei-Spieler-Duell-Layout. -->
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

    <!-- ═══ EIN physischer Slot für Live-Darts / Checkout-Route ═══
         Nie beide gleichzeitig, nie eine Lücke ohne beides: `checkoutPath` und
         `liveThrow` sind reine Ableitungen desselben `match`-Snapshots und
         flippen im selben Render-Tick — der v-if/v-else-Zweig hier macht das
         strukturell unmöglich, dass beide oder keines von beiden zugleich
         gerendert wird. Datenquelle unverändert (deriveCheckoutPath /
         deriveLiveThrow, keine Logikänderung). -->
    <div v-if="heroPair && liveThrow.hasTurn" :class="[ 'cc-throw-zone', checkoutPath.visible && 'is-checkout' ]" data-testid="cc-throw-zone">
      <template v-if="checkoutPath.visible">
        <div class="cc-throw-track" data-testid="cc-checkout-path">
          <template v-for="(dart, index) in checkoutPath.darts" :key="`co-${index}`">
            <span
              :class="[ 'cc-throw-dart', 'is-checkout-dart', dart.hit && 'is-hit' ]"
              :data-testid="`cc-checkout-path-dart-${index + 1}`"
            >{{ dart.hit ? dart.label : "–" }}</span>
            <span
              v-if="index < checkoutPath.darts.length - 1"
              :class="[ 'cc-throw-line', 'is-checkout-line', dart.hit && 'is-hit' ]"
            />
          </template>
        </div>
        <div class="cc-throw-label">
          <span class="cc-throw-eyebrow">Checkout-Route</span>
          <span class="cc-throw-value" data-testid="cc-checkout-path-value">{{ checkoutPath.remaining }}</span>
        </div>
      </template>
      <template v-else>
        <div class="cc-throw-track" data-testid="cc-live-throw">
          <template v-for="(dart, index) in liveThrow.darts" :key="`lt-${index}`">
            <span
              :class="[ 'cc-throw-dart', dart.hit && 'is-hit' ]"
              :data-testid="`cc-live-dart-${index + 1}`"
            >{{ dart.hit ? dart.label : "–" }}</span>
            <span v-if="index < liveThrow.darts.length - 1" class="cc-throw-line" />
          </template>
        </div>
        <div class="cc-throw-label">
          <span class="cc-throw-eyebrow">Aktueller Visit</span>
          <span class="cc-throw-value" data-testid="cc-live-visit-score">{{ liveThrow.visitScore ?? "–" }}</span>
        </div>
      </template>
    </div>

    <!-- ═══ Unterstützender Streifen: letzte Visits + Leg-Fortschritt + Momentum + Performance ═══
         Bewusst leiser als Hero/Throw-Zone (kleinere Typografie, kein Gold
         außer beim Momentum-Aufwärtstrend-Symbol und den Achievement-Kacheln).
         "Voriger Visit" hat hier seine EINZIGE Heimat (oberste Zeile der
         Liste) — nicht mehr zusätzlich in der Throw-Zone. Datenquellen
         unverändert: recentVisits/momentum (utils/match-flow.ts), quickStats
         (useControlCenterStatus.ts) — nur ohne die Average/Checkout-Kacheln,
         die jetzt ausschließlich oben in den Chips stehen. -->
    <div v-if="heroPair" class="cc-support" data-testid="cc-support">
      <div class="cc-support-visits">
        <div class="cc-support-head">
          <span class="cc-support-title">Letzte Visits</span>
          <span v-if="momentum.visible" :class="[ 'cc-momentum', `is-${momentum.trend}` ]" data-testid="cc-flow-momentum">
            <span class="cc-momentum-icon">
              <span v-if="momentum.trend === 'up'" class="icon-[pixelarticons--chevron-up]" />
              <span v-else-if="momentum.trend === 'down'" class="icon-[pixelarticons--arrow-down]" />
              <span v-else class="icon-[pixelarticons--circle]" />
            </span>
            <span>{{ momentum.deltaPercent! >= 0 ? "+" : "" }}{{ momentum.deltaPercent!.toFixed(0) }}% ggü. Average</span>
          </span>
        </div>
        <div v-if="recentVisits.length === 0" class="cc-note" data-testid="cc-flow-visits-empty">
          Noch keine abgeschlossenen Visits in diesem Leg.
        </div>
        <div
          v-for="visit in recentVisits"
          :key="visit.id"
          class="cc-support-visit-row"
          data-testid="cc-flow-visit"
        >
          <span class="cc-support-who">
            <span :class="[ 'cc-who-dot', visit.playerIndex === 0 ? 'is-red' : visit.playerIndex === 1 ? 'is-blue' : 'is-plain' ]" />
            {{ visit.playerName }}
          </span>
          <span class="cc-support-darts">{{ visit.darts.length > 0 ? visit.darts.join(" ") : "—" }}</span>
          <span class="cc-support-score">{{ visit.score }}</span>
        </div>
      </div>

      <div class="cc-support-side">
        <div class="cc-support-head" style="margin-bottom: 4px;">
          <span class="cc-support-title">{{ anySets ? "Sets" : "Legs" }}</span>
        </div>
        <div class="cc-support-legs" data-testid="cc-flow-legs">
          <span
            v-for="n in (progressDotsLeft)"
            :key="`left-${n}`"
            class="cc-leg-dot is-red"
          />
          <span
            v-for="n in (progressDotsRight)"
            :key="`right-${n}`"
            class="cc-leg-dot is-blue"
          />
          <span v-if="progressDotsLeft === 0 && progressDotsRight === 0" class="cc-note" style="font-size: 11px;">
            {{ anySets ? "Noch kein Set entschieden" : "Noch kein Leg entschieden" }}
          </span>
        </div>

        <div class="cc-support-title" style="margin-top: 10px;">
          Performance{{ focusPlayer ? ` — ${focusPlayer.name}` : "" }}
        </div>
        <div class="cc-perf-grid" data-testid="cc-perf-grid">
          <div
            v-for="stat in performanceTiles"
            :key="stat.key"
            :class="[ 'cc-perf-tile', stat.accent === 'gold' && 'is-gold' ]"
            :data-testid="`cc-stat-${stat.key}`"
          >
            <div class="k">{{ stat.label }}</div>
            <div class="v">{{ stat.value !== null ? stat.value.toFixed(stat.decimals) + (stat.unit ?? "") : "–" }}</div>
          </div>
        </div>
      </div>
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
  anySets,
  showRemaining,
  showPoints,
  scoreLabel,
  autodartsOrigin,
  checkoutPath,
  liveThrow,
  recentVisits,
  momentum,
  focusPlayer,
  quickStats,
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

/**
 * RUNTIME-FIX (Checkpoint Review): der Fortschritts-Punkte-Streifen zeigte
 * bislang IMMER `.legs`, beschriftet fest "Legs" — bei einem Best-of-Sets-
 * Match (anySets) widerspricht das der bereits korrekt Sets-bewussten
 * `heroScoreLine` oben im selben Kärtchen. Dieselbe reale Quelle
 * (heroPair.left/right.sets, unverändert aus useControlCenterStatus.ts),
 * nur konsequent auf `anySets` umgeschaltet statt fest auf Legs.
 */
const progressDotsLeft = computed(() => (anySets.value ? heroPair.value?.left.sets : heroPair.value?.left.legs) ?? 0);
const progressDotsRight = computed(() => (anySets.value ? heroPair.value?.right.sets : heroPair.value?.right.legs) ?? 0);

/**
 * Dieselbe `quickStats`-Ableitung wie zuvor in CcQuickStats.vue — nur ohne
 * Average/Checkout, die jetzt ausschließlich in den Chips oben stehen.
 * `quickStats` selbst bleibt unverändert (useControlCenterStatus.ts); dies
 * ist ein rein präsentationsseitiger Filter, keine neue Ableitung.
 */
const performanceTiles = computed(() => quickStats.value.filter(stat => stat.key !== "average" && stat.key !== "checkout"));

function formatAvg(value: number | undefined): string {
  return value !== undefined ? value.toFixed(2) : "–";
}

function goToMatchSection(): void {
  window.location.hash = "match";
}
</script>
