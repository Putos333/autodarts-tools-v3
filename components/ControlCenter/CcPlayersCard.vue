<template>
  <CcCard
    title="Spieler"
    subtitle="Spielstand und Statistik je Spieler"
    icon="icon-[pixelarticons--users]"
    accent="muted"
    data-testid="cc-card-players"
  >
    <template #status>
      <CcStatusPill
        v-if="players.length"
        :label="`${players.length} Spieler`"
        tone="idle"
        class="is-sm"
      />
    </template>

    <template v-if="players.length">
      <div
        v-for="(player, index) in players"
        :key="`${player.seat}-${player.name}`"
        :class="[ 'cc-player', player.isActive && 'is-active', player.isWinner && 'is-winner' ]"
        :data-testid="`cc-player-${player.seat}`"
      >
        <CcPlayerBadge
          :name="player.name"
          :is-bot="player.isBot"
          :variant="player.isWinner ? 'gold' : index === 0 ? 'red' : index === 1 ? 'blue' : 'plain'"
          size="md"
        />

        <div class="cc-player-main">
          <div class="cc-player-name">{{ player.name }}</div>
          <div class="cc-player-tags">
            <span class="cc-tag">Platz {{ player.seat }}</span>
            <span v-if="player.isBot" class="cc-tag">Bot</span>
            <span v-if="player.isActive" class="cc-tag is-accent">Am Wurf</span>
            <span v-if="player.isWinner" class="cc-tag is-gold">Gewinner</span>
          </div>
        </div>

        <div class="cc-player-stats">
          <div v-if="showRemaining" class="cc-stat">
            <div class="cc-stat-label">Rest</div>
            <div :class="[ 'cc-stat-value', player.remaining === undefined && 'is-unknown' ]">
              {{ player.remaining ?? "–" }}
            </div>
          </div>
          <div class="cc-stat">
            <div class="cc-stat-label">Legs</div>
            <div :class="[ 'cc-stat-value', player.legs === undefined && 'is-unknown' ]">
              {{ player.legs ?? "–" }}
            </div>
          </div>
          <div v-if="anySets" class="cc-stat">
            <div class="cc-stat-label">Sets</div>
            <div :class="[ 'cc-stat-value', player.sets === undefined && 'is-unknown' ]">
              {{ player.sets ?? "–" }}
            </div>
          </div>
          <div class="cc-stat">
            <div class="cc-stat-label">Average</div>
            <div :class="[ 'cc-stat-value', player.average === undefined && 'is-unknown' ]">
              {{ player.average !== undefined ? player.average.toFixed(2) : "–" }}
            </div>
          </div>
          <div class="cc-stat">
            <div class="cc-stat-label">180er</div>
            <div :class="[ 'cc-stat-value', player.total180 === undefined && 'is-unknown' ]">
              {{ player.total180 ?? "–" }}
            </div>
          </div>
          <div class="cc-stat">
            <div class="cc-stat-label">Darts</div>
            <div :class="[ 'cc-stat-value', player.dartsThrown === undefined && 'is-unknown' ]">
              {{ player.dartsThrown ?? "–" }}
            </div>
          </div>
        </div>
      </div>
    </template>

    <CcEmptyState
      v-else
      icon="icon-[pixelarticons--human]"
      title="Keine Spielerdaten"
      text="Spieler erscheinen, sobald ein Match läuft oder ein Ergebnis vorliegt."
    />

    <template #footer>
      „–" heißt unbekannt, nicht 0.
    </template>
  </CcCard>
</template>

<script setup lang="ts">
import CcCard from "./CcCard.vue";
import CcStatusPill from "./CcStatusPill.vue";
import CcEmptyState from "./CcEmptyState.vue";
import CcPlayerBadge from "./CcPlayerBadge.vue";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";

const { players, showRemaining, anySets } = useControlCenterStatus();
</script>
