/**
 * Minimale, vollständig kontrollierte Ersatzseite für https://play.autodarts.io/.
 * Wird per context.route() ausgeliefert; es findet kein Netzwerkzugriff statt.
 */
export const FAKE_AUTODARTS_HTML = [
  "<!doctype html>",
  "<html lang=\"de\"><head><meta charset=\"utf-8\"><title>Autodarts E2E fake page</title></head>",
  "<body><h1 id=\"app\">Autodarts E2E fake page</h1></body></html>",
].join("");
