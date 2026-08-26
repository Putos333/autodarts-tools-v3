<template>
  <div class="cc-quickplay" data-testid="cc-quickplay">
    <div class="cc-section-title">
      Quick Play
      <span class="cc-note" style="font-size: 11px; font-weight: 400; text-transform: none; letter-spacing: normal;">
        301/501/Cricket/Round the Clock öffnen Autodarts — der Modus wird dort wie gewohnt gewählt, nicht vorausgewählt
      </span>
    </div>
    <div class="cc-quickplay-grid">
      <button class="cc-quickplay-tile" type="button" data-testid="cc-quickplay-301" @click="openAutodarts(autodartsOrigin)">
        <span class="cc-quickplay-n">301</span>
        <span class="cc-quickplay-l">X01 · Autodarts öffnen</span>
      </button>
      <button class="cc-quickplay-tile" type="button" data-testid="cc-quickplay-501" @click="openAutodarts(autodartsOrigin)">
        <span class="cc-quickplay-n">501</span>
        <span class="cc-quickplay-l">X01 · Autodarts öffnen</span>
      </button>
      <button class="cc-quickplay-tile" type="button" data-testid="cc-quickplay-cricket" @click="openAutodarts(autodartsOrigin)">
        <span class="cc-quickplay-n"><span class="icon-[pixelarticons--bullseye]" /></span>
        <span class="cc-quickplay-l">Cricket · Autodarts öffnen</span>
      </button>
      <button class="cc-quickplay-tile" type="button" data-testid="cc-quickplay-atc" @click="openAutodarts(autodartsOrigin)">
        <span class="cc-quickplay-n"><span class="icon-[pixelarticons--clock]" /></span>
        <span class="cc-quickplay-l">Round the Clock · Autodarts öffnen</span>
      </button>
      <button class="cc-quickplay-tile is-accent" type="button" data-testid="cc-quickplay-training" @click="go('training')">
        <span class="cc-quickplay-n"><span class="icon-[pixelarticons--trending-up]" /></span>
        <span class="cc-quickplay-l">Training öffnen</span>
      </button>
      <button class="cc-quickplay-tile is-accent" type="button" data-testid="cc-quickplay-party" @click="go('party')">
        <span class="cc-quickplay-n"><span class="icon-[pixelarticons--users]" /></span>
        <span class="cc-quickplay-l">Freunde &amp; Party öffnen</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { openAutodarts } from "./open-autodarts";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";
import type { TCcSectionId } from "./sections";

const { autodartsOrigin } = useControlCenterStatus();

/**
 * Training und Freunde/Party sind eigene Bereiche dieser Erweiterung — ein
 * echter Sprung dorthin, kein Öffnen von Autodarts. 301/501/Cricket/Round the
 * Clock haben keine entsprechende eigene Ansicht und öffnen ehrlich nur
 * Autodarts, ohne eine Modus-Vorauswahl vorzutäuschen, die es nicht gibt
 * (`quickPlay()` in friends-api.ts erstellt nur Lobbys für einen konkreten
 * eingeladenen Freund, keine allgemeine "Solo-Match mit Variante X" Funktion).
 */
function go(id: TCcSectionId): void {
  window.location.hash = id;
}
</script>
