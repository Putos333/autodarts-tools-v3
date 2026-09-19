<template>
  <div class="cc-grid cc-matchcenter-shell" data-testid="cc-matchcenter-shell">
    <section class="cc-col-3 cc-matchcenter-region" data-testid="cc-matchcenter-left">
      <CcQuickPlay />
    </section>

    <section class="cc-col-6 cc-matchcenter-region" data-testid="cc-matchcenter-center">
      <CcMatchHero />
    </section>

    <section class="cc-col-3 cc-matchcenter-region" data-testid="cc-matchcenter-right">
      <div class="cc-section-title">Aktivität</div>
      <CcRecentActivity />
      <CcSystemStatusFooter />
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * Phase 2C — Design Tokens + UI Shell (Vorbereitung).
 *
 * Reine Layout-Komposition der 3/6/3-Grundstruktur aus den beiden lokalen
 * Referenzbildern (references/ui/reference-1.png = Live Match/Game On,
 * reference-2.png = Challenge/Match-Setup): LEFT = Navigation/Quick-Context,
 * CENTER = Match-Hero-Fläche, RIGHT = Aktivitäts-/Status-Kontext. Nutzt
 * ausschließlich das bestehende `.cc-grid`/`.cc-col-*`-System (kein neues
 * Layout-System) und vier bereits fertige, andernorts bereits produktiv
 * gemountete Komponenten (CcQuickPlay, CcMatchHero, CcRecentActivity,
 * CcSystemStatusFooter aus CcDashboard.vue) — keine neue Geschäftslogik,
 * keine neuen Daten, keine erfundenen Platzhalterwerte: jede Kindkomponente
 * bezieht ihre Daten wie bisher aus `useControlCenterStatus()` bzw. dem
 * bestehenden Canonical-Match-Result-Storage.
 *
 * Inzwischen real unter `#matchcenter` geroutet (`ControlCenter.vue`s
 * `sectionComponents`-Map) — kein reines, unverdrahtetes Vorschau-Fragment
 * mehr wie zuvor CcPreviewSection.vue/CcDashboardSummary.vue. `sections.ts`
 * markiert den Eintrag weiterhin mit `preview: true` ("bald"-Badge in der
 * Sidebar), weil das Feature funktional noch nicht abgeschlossen ist.
 */
import CcQuickPlay from "./CcQuickPlay.vue";
import CcMatchHero from "./CcMatchHero.vue";
import CcRecentActivity from "./CcRecentActivity.vue";
import CcSystemStatusFooter from "./CcSystemStatusFooter.vue";
</script>

<style scoped>
.cc-matchcenter-region {
  display: flex;
  flex-direction: column;
  gap: var(--cc-space-4);
}
</style>
