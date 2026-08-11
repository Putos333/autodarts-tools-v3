<template>
  <div class="regelwerk-container">
    <!-- Header -->
    <div class="rw-header">
      <div class="rw-header-left">
        <span class="rw-icon">📖</span>
        <div>
          <h1 class="rw-title">REGELWERK</h1>
          <p class="rw-subtitle">Spielanleitungen & Feature-Guides</p>
        </div>
      </div>
      <div class="rw-search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="🔍 Suchen..."
          class="rw-search-input"
        />
      </div>
    </div>

    <!-- Kategorie-Tabs -->
    <div class="rw-category-tabs">
      <button
        v-for="cat in categories"
        :key="cat.id"
        :class="['rw-cat-btn', { active: activeCategory === cat.id }]"
        @click="activeCategory = cat.id"
      >
        {{ cat.icon }} {{ cat.label }}
      </button>
    </div>

    <!-- Spiel-Karten -->
    <div class="rw-cards-grid">
      <div
        v-for="game in filteredGames"
        :key="game.id"
        :class="['rw-card', { expanded: expandedGame === game.id }]"
        @click="toggleGame(game.id)"
      >
        <!-- Karten-Header -->
        <div class="rw-card-header">
          <div class="rw-card-title-row">
            <span class="rw-card-icon">{{ game.icon }}</span>
            <div>
              <h2 class="rw-card-title">{{ game.title }}</h2>
              <p class="rw-card-tagline">{{ game.tagline }}</p>
            </div>
          </div>
          <div class="rw-card-meta">
            <span :class="['rw-badge', `badge-${game.difficulty}`]">{{ game.difficultyLabel }}</span>
            <span class="rw-badge badge-players">👥 {{ game.players }}</span>
            <span class="rw-expand-icon">{{ expandedGame === game.id ? '▲' : '▼' }}</span>
          </div>
        </div>

        <!-- Karten-Inhalt (ausgeklappt) -->
        <div v-if="expandedGame === game.id" class="rw-card-content" @click.stop>

          <!-- Bild -->
          <div v-if="game.image" class="rw-image-container">
            <img :src="game.image" :alt="game.title" class="rw-game-image" />
          </div>

          <!-- Ziel -->
          <div class="rw-section">
            <h3 class="rw-section-title">🎯 Das Ziel</h3>
            <p class="rw-text">{{ game.goal }}</p>
          </div>

          <!-- Regeln -->
          <div class="rw-section">
            <h3 class="rw-section-title">📋 Spielablauf Schritt für Schritt</h3>
            <ol class="rw-steps">
              <li v-for="(step, i) in game.steps" :key="i" class="rw-step">
                <span class="rw-step-num">{{ i + 1 }}</span>
                <span class="rw-step-text">{{ step }}</span>
              </li>
            </ol>
          </div>

          <!-- Tabelle (falls vorhanden) -->
          <div v-if="game.table" class="rw-section">
            <h3 class="rw-section-title">📊 {{ game.table.title }}</h3>
            <table class="rw-table">
              <thead>
                <tr>
                  <th v-for="col in game.table.headers" :key="col">{{ col }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in game.table.rows" :key="i">
                  <td v-for="(cell, j) in row" :key="j">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Tipp-Box -->
          <div v-if="game.tip" class="rw-tip-box">
            <span class="rw-tip-icon">💡</span>
            <span>{{ game.tip }}</span>
          </div>

          <!-- Warnung-Box -->
          <div v-if="game.warning" class="rw-warning-box">
            <span class="rw-warning-icon">⚠️</span>
            <span>{{ game.warning }}</span>
          </div>

        </div>
      </div>
    </div>

    <!-- Leer-Zustand -->
    <div v-if="filteredGames.length === 0" class="rw-empty">
      <p>Keine Einträge für "{{ searchQuery }}" gefunden.</p>
    </div>

    <!-- Footer -->
    <div class="rw-footer">
      <span>Autodarts Tools Extended Edition v2.5.0</span>
      <span class="rw-footer-author">by Arnonym2302</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const searchQuery = ref('')
const activeCategory = ref('alle')
const expandedGame = ref<string | null>(null)

const categories = [
  { id: 'alle', label: 'Alle', icon: '🎯' },
  { id: 'klassisch', label: 'Klassische Spiele', icon: '🏆' },
  { id: 'training', label: 'Training', icon: '💪' },
  { id: 'features', label: 'Features', icon: '⚡' },
]

function toggleGame(id: string) {
  expandedGame.value = expandedGame.value === id ? null : id
}

const games = [
  {
    id: 'x01',
    category: 'klassisch',
    icon: '🎯',
    title: 'X01 (301 / 501 / 701)',
    tagline: 'Der Klassiker – von der Pub-Runde bis zur WM',
    difficulty: 'mittel',
    difficultyLabel: '⭐⭐ Mittel',
    players: '1–4 Spieler',
    image: '/regelwerk/img_x01.png',
    goal: 'Jeder Spieler startet mit der gleichen Punktzahl (meist 501). Das Ziel ist es, diese Punkte exakt auf 0 herunterzuspielen. Wer zuerst auf 0 ist, gewinnt das Leg.',
    steps: [
      'Beide Spieler starten mit 501 Punkten.',
      'Spieler 1 wirft seine 3 Darts. Die Punkte werden vom Restscore abgezogen.',
      'Spieler 2 ist dran. So abwechselnd, bis jemand auf 0 kommt.',
      'DOUBLE OUT: Der letzte Dart muss in einem Doppel-Feld (äußerer Ring) oder im Bullseye (rote Mitte) landen.',
      'BUST (Überworfen): Wirfst du mehr Punkte als du Rest hast oder kommst auf 1 Punkt Rest, ist dein Wurf ungültig. Score wird zurückgesetzt.',
    ],
    table: {
      title: 'Punkteübersicht',
      headers: ['Feld', 'Punkte'],
      rows: [
        ['Einfaches Feld', 'Aufgedruckte Zahl (z.B. 20 = 20 Punkte)'],
        ['Doppel-Ring (äußerer Ring)', 'Doppelte Punkte (z.B. D20 = 40 Punkte)'],
        ['Triple-Ring (innerer Ring)', 'Dreifache Punkte (z.B. T20 = 60 Punkte)'],
        ['Bullseye (rote Mitte)', '50 Punkte – gilt als Doppel!'],
        ['Bull (grüner Ring)', '25 Punkte'],
      ],
    },
    tip: 'Die Erweiterung zeigt dir beim Spielen automatisch den optimalen Checkout-Weg an (z.B. "T20 · T19 · D12" für 167 Rest).',
    warning: 'BUST: Auf 1 Punkt Rest zu kommen ist genauso ein Bust wie zu überwerfen – der Score wird zurückgesetzt!',
  },
  {
    id: 'cricket',
    category: 'klassisch',
    icon: '🏏',
    title: 'Cricket',
    tagline: 'Taktik und Blockieren – das strategische Duell',
    difficulty: 'mittel',
    difficultyLabel: '⭐⭐ Mittel',
    players: '2–4 Spieler',
    image: '/regelwerk/img_cricket.png',
    goal: 'Du musst die Zahlen 15 bis 20 sowie das Bullseye jeweils dreimal treffen ("schließen") und am Ende die meisten Punkte haben.',
    steps: [
      'Beide Spieler starten mit 0 Punkten.',
      'Du kannst auf beliebige Zahlen zwischen 15 und 20 sowie das Bullseye werfen.',
      'Jeder Treffer zählt: Einfach = 1 Strich, Doppel = 2 Striche, Triple = 3 Striche.',
      'Sobald du eine Zahl dreimal getroffen hast, ist sie "offen" – du kannst Punkte darauf sammeln.',
      'Triffst du eine offene Zahl und dein Gegner hat sie noch nicht dreimal getroffen, sammelst du Punkte.',
      'Sobald auch dein Gegner die Zahl dreimal trifft, ist sie "geschlossen" – niemand sammelt mehr Punkte.',
      'Gewonnen hat, wer alle Zahlen (15–20 + Bull) geschlossen UND die meisten Punkte hat.',
    ],
    table: {
      title: 'Markierungsübersicht',
      headers: ['Treffer', 'Symbol', 'Bedeutung'],
      rows: [
        ['1. Treffer', '/', 'Erster Strich'],
        ['2. Treffer', 'X', 'Zwei Striche'],
        ['3. Treffer', '⊗', 'Geschlossen – Punkte möglich'],
      ],
    },
    tip: 'Strategie: Schließe zuerst die 20 und 19, da diese die meisten Punkte bringen. Dann blockiere die Zahlen deines Gegners!',
    warning: 'Du kannst Punkte führen und trotzdem verlieren, wenn dein Gegner alle Zahlen schließt und du noch offene Zahlen hast!',
  },
  {
    id: 'bobs27',
    category: 'training',
    icon: '🎓',
    title: "Bob's 27",
    tagline: 'Das härteste Doppel-Training der Welt',
    difficulty: 'schwer',
    difficultyLabel: '⭐⭐⭐ Schwer',
    players: '1–4 Spieler',
    image: '/regelwerk/img_bobs27.png',
    goal: 'Überlebe alle 21 Doppel-Felder (D1 bis D20 plus Bullseye), ohne dass dein Punktestand unter 0 fällt.',
    steps: [
      'Du startest mit 27 Punkten.',
      'In Runde 1 musst du auf Doppel-1 werfen, in Runde 2 auf Doppel-2, und so weiter bis D20 und abschließend das Bullseye.',
      'Für jeden Treffer im geforderten Doppel wird der Wert addiert (z.B. ein Treffer in D1 = +2 Punkte).',
      'Triffst du das geforderte Doppel mit KEINEM deiner 3 Darts, wird der Wert einmalig abgezogen (z.B. bei D20 werden 40 Punkte abgezogen).',
      'Fällt dein Score unter 0, bist du ausgeschieden.',
      'Wer am Ende (nach dem Bullseye) noch im Plus ist, hat gewonnen.',
    ],
    table: {
      title: 'Beispiel-Runden',
      headers: ['Runde', 'Ziel', 'Treffer bringt', 'Kein Treffer kostet'],
      rows: [
        ['1', 'Doppel-1', '+2 pro Treffer', '-2'],
        ['10', 'Doppel-10', '+20 pro Treffer', '-20'],
        ['20', 'Doppel-20', '+40 pro Treffer', '-40'],
        ['21', 'Bullseye', '+50 pro Treffer', '-50'],
      ],
    },
    tip: 'Ein Score über 100 am Ende gilt als sehr gutes Ergebnis. Die Profis spielen regelmäßig über 200!',
    warning: null,
  },
  {
    id: 'aroundclock',
    category: 'klassisch',
    icon: '🕐',
    title: 'Around the Clock',
    tagline: 'Rund um die Uhr – perfekt für Anfänger',
    difficulty: 'leicht',
    difficultyLabel: '⭐ Leicht',
    players: '2–8 Spieler',
    image: '/regelwerk/img_aroundclock.png',
    goal: 'Triff alle Zahlen von 1 bis 20 in der richtigen Reihenfolge und beende das Spiel mit dem Bullseye.',
    steps: [
      'Beide Spieler starten bei der Zahl 1.',
      'Du musst zuerst die 1 treffen. Solange du die 1 nicht triffst, darfst du nicht auf die 2 werfen.',
      'Es zählen alle Felder der Zahl (Einfach, Doppel und Triple). Ein Triple-Treffer zählt aber nur als ein Treffer.',
      'Sobald du die aktuelle Zahl getroffen hast, geht es zur nächsten Zahl weiter.',
      'Nach der 20 muss das Bullseye (rote Mitte) getroffen werden, um das Spiel zu beenden.',
      'Wer zuerst das Bullseye trifft, gewinnt.',
    ],
    table: null,
    tip: 'Variante für Fortgeschrittene: Jede Zahl muss im Doppel-Ring getroffen werden. Das macht das Spiel deutlich schwieriger!',
    warning: null,
  },
  {
    id: 'training',
    category: 'features',
    icon: '💪',
    title: 'Trainings-Modus',
    tagline: 'Setze dir Ziele und werde messbar besser',
    difficulty: 'leicht',
    difficultyLabel: '⭐ Einfach',
    players: '1 Spieler',
    image: '/regelwerk/img_training.png',
    goal: 'Setze dir vor dem Spiel persönliche Ziele (Average, 180er, Checkout-Quote) und verfolge deinen Fortschritt live während des Matches.',
    steps: [
      'Öffne das Erweiterungsmenü und gehe auf den Tab "Training".',
      'Klicke auf "Neues Trainingsziel setzen".',
      'Wähle deine Ziele: z.B. Mindest-Average 65, mindestens 2x 140+, Checkout-Quote 30%.',
      'Starte ein normales X01 Match auf autodarts.io.',
      'Während du spielst, siehst du oben rechts ein Overlay mit Fortschrittsbalken in Echtzeit.',
      'Nach dem Spiel erscheint automatisch eine Auswertung: Grün = Ziel erreicht ✅, Rot = Ziel verfehlt ❌.',
      'Im Unter-Tab "Verlauf" siehst du deine Entwicklung über die letzten Matches.',
    ],
    table: null,
    tip: 'Setze dir realistische Ziele! Wenn dein aktueller Average bei 55 liegt, ist 65 ein gutes nächstes Ziel – nicht 90.',
    warning: null,
  },
  {
    id: 'buzzer',
    category: 'features',
    icon: '🔔',
    title: 'Party-Buzzer',
    tagline: 'Bis zu 4 Spieler – Handy als Buzzer',
    difficulty: 'leicht',
    difficultyLabel: '⭐ Einfach',
    players: '2–4 Spieler',
    image: '/regelwerk/img_buzzer.png',
    goal: 'Jeder Spieler nutzt sein Smartphone als Buzzer. Wer zuerst drückt, darf als nächstes werfen – perfekt für gesellige Dart-Abende!',
    steps: [
      'Öffne das Erweiterungsmenü und gehe auf den Tab "Party-Buzzer".',
      'Aktiviere den Buzzer mit dem Schalter.',
      'Auf dem TV erscheint ein Panel mit farbigen Buzzern und ein QR-Code in der Ecke.',
      'Deine Freunde scannen den QR-Code mit der Handy-Kamera – keine App-Installation nötig!',
      'Jeder Spieler sieht auf seinem Handy einen riesigen, farbigen Buzzer-Button.',
      'Wer zuerst buzzt, darf als nächstes werfen. Der Name blinkt groß auf dem TV auf.',
      'Klicke auf "Reset" um die nächste Buzzer-Runde freizugeben.',
    ],
    table: null,
    tip: 'Ideal für Killer-Runden oder Shanghai! Einfach QR-Code scannen und sofort mitspielen.',
    warning: null,
  },
  {
    id: 'handicap',
    category: 'features',
    icon: '⚖️',
    title: 'Dynamisches Handicap',
    tagline: 'Faire Chancen für Anfänger gegen Profis',
    difficulty: 'leicht',
    difficultyLabel: '⭐ Automatisch',
    players: '2 Spieler',
    image: '/regelwerk/img_handicap.png',
    goal: 'Das System gleicht Unterschiede im Spielniveau automatisch aus, damit auch Anfänger gegen Profis eine faire Chance haben.',
    steps: [
      'Das System vergleicht automatisch die historischen Averages beider Spieler.',
      'Wenn der Unterschied mehr als 10 Punkte beträgt, wird das Handicap aktiviert.',
      'Beim Spielstart erscheint ein Banner: "HANDICAP AKTIV" mit der Erklärung.',
      'Der stärkere Spieler startet bei einem höheren Score (z.B. 701), der schwächere bei 501.',
      'So haben beide Spieler am Ende die Chance, gleichzeitig auf ein entscheidendes Doppel zu werfen.',
      'Das Handicap kann in den Einstellungen unter "Gameplay Extras" jederzeit deaktiviert werden.',
    ],
    table: {
      title: 'Handicap-Stufen',
      headers: ['Average-Unterschied', 'Handicap', 'Beispiel'],
      rows: [
        ['Unter 10 Punkte', 'Kein Handicap', 'Beide starten bei 501'],
        ['10–20 Punkte', 'Punkte-Handicap', 'Profi: 601, Anfänger: 501'],
        ['Über 20 Punkte', 'Großes Handicap', 'Profi: 701, Anfänger: 501'],
      ],
    },
    tip: 'Das Handicap macht Spiele zwischen unterschiedlich starken Spielern deutlich spannender und motivierender für beide Seiten!',
    warning: null,
  },
]

const filteredGames = computed(() => {
  return games.filter(game => {
    const matchesCategory = activeCategory.value === 'alle' || game.category === activeCategory.value
    const matchesSearch = searchQuery.value === '' ||
      game.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      game.tagline.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      game.goal.toLowerCase().includes(searchQuery.value.toLowerCase())
    return matchesCategory && matchesSearch
  })
})
</script>

<style scoped>
.regelwerk-container {
  background: #0D1B2A;
  color: #ffffff;
  font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;
  padding: 0;
  min-height: 100%;
}

.rw-header {
  background: linear-gradient(135deg, #0D1B2A 0%, #1a2d42 100%);
  border-bottom: 3px solid #E8002D;
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.rw-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.rw-icon {
  font-size: 36px;
}

.rw-title {
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 3px;
  color: #ffffff;
  margin: 0;
  text-transform: uppercase;
}

.rw-subtitle {
  font-size: 14px;
  color: #F5C842;
  margin: 2px 0 0 0;
  letter-spacing: 1px;
}

.rw-search-input {
  background: rgba(255,255,255,0.08);
  border: 2px solid rgba(232,0,45,0.4);
  border-radius: 8px;
  color: #fff;
  font-size: 16px;
  padding: 10px 16px;
  width: 220px;
  outline: none;
  font-family: inherit;
  transition: border-color 0.2s;
}

.rw-search-input:focus {
  border-color: #E8002D;
}

.rw-search-input::placeholder {
  color: rgba(255,255,255,0.4);
}

.rw-category-tabs {
  display: flex;
  gap: 4px;
  padding: 12px 24px;
  background: rgba(0,0,0,0.3);
  border-bottom: 1px solid rgba(255,255,255,0.1);
  flex-wrap: wrap;
}

.rw-cat-btn {
  background: transparent;
  border: 2px solid rgba(255,255,255,0.2);
  border-radius: 6px;
  color: rgba(255,255,255,0.6);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  padding: 8px 16px;
  cursor: pointer;
  font-family: inherit;
  text-transform: uppercase;
  transition: all 0.2s;
}

.rw-cat-btn:hover {
  border-color: rgba(232,0,45,0.6);
  color: #fff;
}

.rw-cat-btn.active {
  background: #E8002D;
  border-color: #E8002D;
  color: #fff;
}

.rw-cards-grid {
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rw-card {
  background: rgba(255,255,255,0.04);
  border: 2px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s;
}

.rw-card:hover {
  border-color: rgba(232,0,45,0.5);
}

.rw-card.expanded {
  border-color: #E8002D;
}

.rw-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  gap: 12px;
  flex-wrap: wrap;
}

.rw-card-title-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.rw-card-icon {
  font-size: 28px;
}

.rw-card-title {
  font-size: 20px;
  font-weight: 900;
  letter-spacing: 2px;
  color: #fff;
  margin: 0;
  text-transform: uppercase;
}

.rw-card-tagline {
  font-size: 13px;
  color: rgba(255,255,255,0.55);
  margin: 2px 0 0 0;
}

.rw-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rw-badge {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  padding: 4px 10px;
  border-radius: 4px;
  text-transform: uppercase;
}

.badge-leicht { background: rgba(0,200,83,0.2); color: #00C853; border: 1px solid #00C853; }
.badge-mittel { background: rgba(245,200,66,0.2); color: #F5C842; border: 1px solid #F5C842; }
.badge-schwer { background: rgba(232,0,45,0.2); color: #E8002D; border: 1px solid #E8002D; }
.badge-players { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.2); }

.rw-expand-icon {
  font-size: 14px;
  color: rgba(255,255,255,0.5);
  margin-left: 4px;
}

.rw-card-content {
  border-top: 1px solid rgba(255,255,255,0.1);
  padding: 20px;
  cursor: default;
}

.rw-image-container {
  margin-bottom: 20px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid rgba(232,0,45,0.3);
}

.rw-game-image {
  width: 100%;
  height: auto;
  display: block;
  max-height: 280px;
  object-fit: cover;
}

.rw-section {
  margin-bottom: 20px;
}

.rw-section-title {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 2px;
  color: #F5C842;
  text-transform: uppercase;
  margin: 0 0 12px 0;
  border-bottom: 1px solid rgba(245,200,66,0.3);
  padding-bottom: 6px;
}

.rw-text {
  font-size: 15px;
  line-height: 1.6;
  color: rgba(255,255,255,0.85);
  margin: 0;
}

.rw-steps {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rw-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.rw-step-num {
  background: #E8002D;
  color: #fff;
  font-size: 13px;
  font-weight: 900;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.rw-step-text {
  font-size: 15px;
  line-height: 1.5;
  color: rgba(255,255,255,0.85);
}

.rw-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.rw-table th {
  background: rgba(232,0,45,0.2);
  color: #F5C842;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 10px 14px;
  text-align: left;
  border-bottom: 2px solid #E8002D;
}

.rw-table td {
  padding: 9px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.8);
}

.rw-table tr:last-child td {
  border-bottom: none;
}

.rw-table tr:nth-child(even) td {
  background: rgba(255,255,255,0.03);
}

.rw-tip-box {
  background: rgba(0,200,83,0.1);
  border: 1px solid rgba(0,200,83,0.4);
  border-left: 4px solid #00C853;
  border-radius: 6px;
  padding: 12px 16px;
  font-size: 14px;
  color: rgba(255,255,255,0.85);
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-top: 12px;
}

.rw-tip-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.rw-warning-box {
  background: rgba(232,0,45,0.1);
  border: 1px solid rgba(232,0,45,0.4);
  border-left: 4px solid #E8002D;
  border-radius: 6px;
  padding: 12px 16px;
  font-size: 14px;
  color: rgba(255,255,255,0.85);
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-top: 12px;
}

.rw-warning-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.rw-empty {
  text-align: center;
  padding: 48px 24px;
  color: rgba(255,255,255,0.4);
  font-size: 18px;
}

.rw-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-top: 1px solid rgba(255,255,255,0.1);
  font-size: 12px;
  color: rgba(255,255,255,0.3);
  letter-spacing: 1px;
  margin-top: 8px;
}

.rw-footer-author {
  color: #F5C842;
  font-weight: 700;
}
</style>
