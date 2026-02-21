// Genera la lista de ECG disponibles sin forzar 10 si no existen
(function () {
  "use strict";

  const total = Number(window.HK_ECG_TOTAL || window.HK_ECG_MAX || 10);
  const max = Math.min(total, 10);

  const pad3 = (n) => String(n).padStart(3, "0");

  window.HK_ECG_IMAGES = Array.from({ length: max }, (_, i) => {
    const n = i + 1;
    return {
      src: `assets/images/ecg/hk_${pad3(n)}.png`,
      label: `HK ${pad3(n)}`
    };
  });
})();