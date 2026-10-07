<template>
  <aside class="cc-sidebar" data-testid="cc-sidebar">
    <div class="cc-brand">
      <span class="cc-brand-mark"><span class="icon-[pixelarticons--bullseye]" aria-hidden="true" /></span>
      <div class="cc-brand-text">
        <div class="cc-brand-title">Control Center</div>
        <div class="cc-brand-sub">Autodarts Tools v{{ version }}</div>
      </div>
    </div>

    <!--
      Gruppierte Navigation (UI-2B): dieselbe Section-Registry, nur nach `group` gegliedert. Jede Gruppe ist
      eine benannte Region (role="group" + aria-labelledby) mit echter Liste. `role="list"` explizit, weil
      Safari/VoiceOver Listen mit `list-style: none` sonst nicht als Liste ausgibt. In der
      Icon-Rail (max-width:1080px, UI-2C) bleiben die Gruppen echte Boxen (Trennlinie); Gruppen- und Eintragslabel
      sind dort nur visuell versteckt, der Accessible Name bleibt das Label (`title` ergänzt ihn als Tooltip).
    -->
    <nav class="cc-nav" aria-label="Control-Center-Bereiche">
      <div
        v-for="group in groups"
        :key="group.id"
        class="cc-nav-group"
        role="group"
        :aria-labelledby="`cc-nav-group-${group.id}`"
        :data-testid="`cc-nav-group-${group.id}`"
      >
        <span :id="`cc-nav-group-${group.id}`" class="cc-nav-group-label">{{ group.label }}</span>
        <ul class="cc-nav-list" role="list">
          <li v-for="section in group.sections" :key="section.id">
            <button
              @click="$emit('navigate', section.id)"
              :class="[ 'cc-nav-item', section.id === active && 'is-active' ]"
              :aria-current="section.id === active ? 'page' : undefined"
              :title="section.label"
              :data-testid="`cc-nav-${section.id}`"
              type="button"
            >
              <span class="cc-nav-icon"><span :class="section.icon" aria-hidden="true" /></span>
              <span class="cc-nav-label">{{ section.label }}</span>
              <span v-if="section.preview" class="cc-nav-badge">bald</span>
            </button>
          </li>
        </ul>
      </div>
    </nav>

    <!-- Live-Match-Widget: erscheint nur bei echten Matchdaten -->
    <CcLiveMatchWidget />

    <div class="cc-sidebar-foot">
      Die klassische Einstellungsansicht bleibt unverändert erreichbar.
    </div>
  </aside>

  <!--
    Mobile Navigation (#8): dieselbe Section-Liste, dasselbe Emit — nur als
    fixierte Leiste unten statt Icon-Rail. Reine CSS-Sichtbarkeitsumschaltung
    (siehe .cc-bottom-nav / .cc-sidebar in style.css, @media max-width:640px),
    exakt dasselbe Muster wie .cc-live-widget/.cc-live-rail in
    CcLiveMatchWidget.vue. Kein zweiter Navigations-Zustand, keine zweite
    Datenquelle — beide Listen lesen `active`/`sections` und emittieren
    dasselbe "navigate".
  -->
  <nav class="cc-bottom-nav" aria-label="Control-Center-Bereiche (mobil)">
    <!--
      Code-Review-Fund (#8): .cc-sidebar wird bei max-width:640px vollständig
      ausgeblendet — damit verschwand das einzige Live-Match-Widget (nur dort
      gerendert) ersatzlos, obwohl es bis 1080px (Icon-Rail) durchgehend
      sichtbar war. Dieselbe Komponente hier ein zweites Mal zu montieren ist
      sicher: useControlCenterStatus() ist ein Refcount-Singleton (siehe
      composables/useControlCenterStatus.ts), keine zweiten Watcher, keine
      neue Datenquelle. .cc-live-rail greift automatisch — dieselbe Regel
      (@media max-width:1080px) ist bei ≤640px ohnehin schon aktiv.
    -->
    <div class="cc-bottom-nav-live"><CcLiveMatchWidget id-suffix="-mobile" /></div>
    <!--
      UI-2C: Die Einträge liegen in einem eigenen horizontalen Scrollbereich (neun Einträge passen bei 390px
      nicht in 44px-Ziele). Das Live-Widget bleibt außerhalb und scrollt nicht mit. Halb angeschnittene Einträge
      am rechten Rand zeigen, dass die Leiste scrollt; der aktive Eintrag wird bei Bereichswechsel sichtbar gehalten.
    -->
    <div ref="bottomScroller" class="cc-bottom-nav-scroll" @focusin="revealFocusedBottomItem">
      <button
        @click="$emit('navigate', section.id)"
        v-for="section in sections"
        :key="section.id"
        :class="[ 'cc-bottom-nav-item', section.id === active && 'is-active' ]"
        :aria-current="section.id === active ? 'page' : undefined"
        :title="section.label"
        :data-testid="`cc-bottom-nav-${section.id}`"
        type="button"
      >
        <span class="cc-bottom-nav-icon">
          <span :class="section.icon" aria-hidden="true" />
          <span v-if="section.preview" class="cc-bottom-nav-badge" aria-hidden="true" />
        </span>
        <span class="cc-bottom-nav-label">{{ section.shortLabel ?? section.label }}</span>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import CcLiveMatchWidget from "./CcLiveMatchWidget.vue";
import { CC_SECTION_GROUPS, CC_SECTIONS, getCcSectionsByGroup, type TCcSectionId } from "./sections";

const props = defineProps<{
  active: TCcSectionId;
  version: string;
}>();

defineEmits<{ (e: "navigate", id: TCcSectionId): void }>();

const sections = CC_SECTIONS;
const groups = CC_SECTION_GROUPS
  .map(group => ({ ...group, sections: getCcSectionsByGroup(group.id) }))
  .filter(group => group.sections.length > 0);

// Bottom-Navigation (UI-2C): Einträge vollständig im Scrollbereich halten — der aktive (z. B. Deep-Link #settings)
// und der fokussierte (der Browser scrollt einen nur teilweise sichtbaren Eintrag beim Fokussieren nicht nach,
// Fokusring und Label wären abgeschnitten). Nur Scroll-Position der Leiste, kein Navigationszustand. Direktes
// Setzen von scrollLeft ist sofort (kein smooth) und damit auch mit „reduzierte Bewegung“ unproblematisch; bei
// ausgeblendeter Leiste (>640px) ist clientWidth 0 und nichts passiert.
const bottomScroller = ref<HTMLElement | null>(null);

function revealBottomItem(item: HTMLElement | null | undefined): void {
  const scroller = bottomScroller.value;
  if (!scroller || !item || scroller.clientWidth === 0) return;
  const start = item.offsetLeft;
  const end = start + item.offsetWidth;
  if (start < scroller.scrollLeft) scroller.scrollLeft = start;
  else if (end > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = end - scroller.clientWidth;
}

function revealActiveBottomItem(): void {
  revealBottomItem(bottomScroller.value?.querySelector<HTMLElement>("[aria-current=\"page\"]"));
}

function revealFocusedBottomItem(event: FocusEvent): void {
  revealBottomItem((event.target as HTMLElement | null)?.closest<HTMLElement>(".cc-bottom-nav-item"));
}

// Der Scrollbereich ändert seine Breite auch ohne Bereichswechsel (z. B. erscheint die Seiten-Scrollleiste erst
// nach dem Laden der Inhalte); dann muss der aktive Eintrag erneut eingepasst werden.
let resizeObserver: ResizeObserver | undefined;

onMounted(() => {
  revealActiveBottomItem();
  if (typeof ResizeObserver !== "undefined" && bottomScroller.value) {
    resizeObserver = new ResizeObserver(revealActiveBottomItem);
    resizeObserver.observe(bottomScroller.value);
  }
});
onBeforeUnmount(() => resizeObserver?.disconnect());
watch(() => props.active, () => { void nextTick(revealActiveBottomItem); });
</script>
