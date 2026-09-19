module.exports = {
  env: {
    webextensions: true,
    browser: true,
    es2021: true,
  },
  overrides: [],
  extends: [ "@creazy231/eslint-config" ],
  rules: {
    // Enforce component order matching vue-file-structure.mdc guidelines
    "vue/component-tags-order": [ "error", {
      order: [ "template", "script", "style" ],
    } ],
    "vue/order-in-components": [ "error", {
      order: [
        "definePageMeta",
        "name",
        "components",
        "props",
        "data",
        "computed",
        "watch",
        "beforeCreate",
        "created",
        "beforeMount",
        "mounted",
        "beforeUpdate",
        "updated",
        "activated",
        "deactivated",
        "beforeDestroy",
        "beforeUnmount",
        "destroyed",
        "unmounted",
        "methods",
        "render",
      ],
    } ],
    // Custom script setup ordering
    "vue/script-setup-uses-vars": "error",
    // Setup custom rules for enforcing function order
    "vue/define-macros-order": [ "error", {
      order: [ "defineProps", "defineEmits", "definePageMeta" ],
    } ],
    // Recommend correct import order
    "import/order": [ "warn", {
      "groups": [ "builtin", "external", "internal", "parent", "sibling", "index", "object", "type" ],
      "newlines-between": "always",
    } ],
  },
};
