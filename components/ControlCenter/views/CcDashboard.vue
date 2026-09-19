<template>
  <div class="cc-home" data-testid="cc-dashboard">
    <!-- ── 1. HERO BAND ─────────────────────────────────────────────────── -->
    <CcHeroBand />

    <!-- ── 2. QUICK PLAY ────────────────────────────────────────────────── -->
    <CcQuickPlay />

    <!-- ── 3. AKTIVITÄT — state-dependent: Live Match Teaser oder letztes Match ── -->
    <div>
      <div class="cc-section-title">Aktivität</div>
      <CcLiveMatchTeaser v-if="hasMatch && !matchFinished" />
      <CcRecentActivity v-else />
    </div>

    <!-- ── 4. PERFORMANCE ──────────────────────────────────────────────── -->
    <div>
      <div class="cc-section-title">Performance</div>
      <CcPerformanceStrip />
    </div>

    <!-- ── 5+6. FREUNDE / PARTY  +  TRAINING ───────────────────────────── -->
    <div class="cc-home-split">
      <CcHomeFriends />
      <CcHomeTraining />
    </div>

    <!-- ── 7. BOARD / SYSTEM (quiet footer) ────────────────────────────── -->
    <CcSystemStatusFooter />
  </div>
</template>

<script setup lang="ts">
/**
 * Elite Home Dashboard (Wave 2) — reine Komposition, wie zuvor.
 *
 * Jede Teilkomponente holt sich ihre Daten selbst (über das geteilte
 * `useControlCenterStatus()`-Singleton oder ihren eigenen Storage-Zugriff,
 * je nachdem, was die jeweilige bestehende Komponente schon so macht).
 * Ersetzt die vorherige mehrkartige Zusammenstellung (Board/Verbindung/
 * Quick Stats/Players/MatchDetails/ToolsStatus/DashboardSummary) durch die
 * genehmigte, fusionierte Elite-Home-Dashboard-Ansicht.
 */
import CcHeroBand from "../CcHeroBand.vue";
import CcQuickPlay from "../CcQuickPlay.vue";
import CcLiveMatchTeaser from "../CcLiveMatchTeaser.vue";
import CcRecentActivity from "../CcRecentActivity.vue";
import CcPerformanceStrip from "../CcPerformanceStrip.vue";
import CcHomeFriends from "../CcHomeFriends.vue";
import CcHomeTraining from "../CcHomeTraining.vue";
import CcSystemStatusFooter from "../CcSystemStatusFooter.vue";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";

const { hasMatch, matchFinished } = useControlCenterStatus();
</script>
