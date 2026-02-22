// js/app.js (reemplaza el tuyo por este)
/* global HK_ECG_IMAGES, HK_STUDY, HK_PRESENTATIONS_TEXT, HK_BIB, HK_TIPS, HK_SESSION_TOTAL, HK_SESSION_EXT, HK_SESSION_DIR, HK_ALGO_SRC */
(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);

  const screens = ["calc","algo","ecg","session","cases"];
  let activeScreenIndex = 0;

  let currentSeverity = "leve";
  let highRisk = false;

  let ecgIndex = 0;
  let sessIndex = 1;

  // 'native' fullscreen detected by document.fullscreenElement
  // 'pseudo' fullscreen controlled by CSS class
  let fsMode = null;      // null | 'ecg' | 'session' | 'algo'
  let pseudoMode = null;  // null | 'ecg' | 'session' | 'algo'

  const CASE_STATE = { current:null, answered:false };

  function pad3(n){ return String(n).padStart(3,'0'); }

  function openDrawer(){
    $("drawerOverlay").classList.add("open");
    $("drawerOverlay").setAttribute("aria-hidden","false");
  }
  function closeDrawer(){
    $("drawerOverlay").classList.remove("open");
    $("drawerOverlay").setAttribute("aria-hidden","true");
  }

  function openModal(which){
    const map = { bib:"modalBib", study:"modalStudy", tips:"modalTips", risk:"modalRiskInfo" };
    const id = map[which] || which;
    $(id).classList.add("open");
  }
  function closeModal(id){ $(id).classList.remove("open"); }
  function closeAllModals(){
    ["modalBib","modalStudy","modalTips","modalRiskInfo"].forEach(id=>$(id).classList.remove("open"));
  }

  function isAnyModalOpen(){
    return ["modalBib","modalStudy","modalTips","modalRiskInfo"].some(id=>$(id).classList.contains("open"));
  }

  function showExitButtons(on){
    ["ecgExit","sessExit","algoExit"].forEach(id=>{
      const el = $(id);
      if(!el) return;
      el.classList.toggle("show", !!on);
    });
  }

  function enterPseudoFullscreen(el, mode){
    pseudoMode = mode;
    fsMode = mode;
    el.classList.add("pseudo-fs");
    document.body.classList.add("pseudo-fs-on");
    showExitButtons(true);
  }
  function exitPseudoFullscreen(){
    pseudoMode = null;
    fsMode = null;
    document.querySelectorAll(".viewer.pseudo-fs").forEach(v=>v.classList.remove("pseudo-fs"));
    document.body.classList.remove("pseudo-fs-on");
    showExitButtons(false);
  }

  async function requestFullscreen(el, mode){
    if(!el) return;

    // Si ya estás en pseudo, salir
    if(pseudoMode){
      exitPseudoFullscreen();
      return;
    }

    // Intento nativo
    const canNative = !!(el.requestFullscreen && document.fullscreenEnabled);
    if(canNative){
      try{
        if(document.fullscreenElement) await document.exitFullscreen();
        await el.requestFullscreen();
        fsMode = mode;
        return;
      }catch(_e){
        // cae a pseudo
      }
    }

    // Fallback móvil (Safari iOS / GitHub Pages)
    enterPseudoFullscreen(el, mode);
  }

  function exitFullscreenAny(){
    if(pseudoMode){
      exitPseudoFullscreen();
      return;
    }
    if(document.fullscreenElement && document.exitFullscreen){
      document.exitFullscreen();
    }
  }

  function detectFsMode(){
    // Si hay fullscreen nativo, manda eso
    const fsEl = document.fullscreenElement;
    if(fsEl){
      const id = fsEl.id || "";
      if(id === "ecgViewer") fsMode = "ecg";
      else if(id === "sessViewer") fsMode = "session";
      else if(id === "algoViewer") fsMode = "algo";
      else fsMode = null;

      showExitButtons(true);
      return;
    }

    // Si no hay nativo, pero sí pseudo
    if(pseudoMode){
      fsMode = pseudoMode;
      showExitButtons(true);
      return;
    }

    fsMode = null;
    showExitButtons(false);
  }

  function setActiveScreen(key){
    const idx = screens.indexOf(key);
    if(idx >= 0) activeScreenIndex = idx;

    document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
    $(`screen-${key}`).classList.add("active");

    document.querySelectorAll("#menuList button[data-screen]").forEach(b=>{
      b.classList.toggle("active", b.dataset.screen === key);
    });

    closeDrawer();
  }
  function nextScreen(){
    activeScreenIndex = (activeScreenIndex + 1) % screens.length;
    setActiveScreen(screens[activeScreenIndex]);
  }
  function prevScreen(){
    activeScreenIndex = (activeScreenIndex - 1 + screens.length) % screens.length;
    setActiveScreen(screens[activeScreenIndex]);
  }

  function inferSeverityFromK(k){
    if(k >= 3.0) return "leve";
    if(k >= 2.5) return "moderada";
    return "grave";
  }

  function setSeverity(sev){
    currentSeverity = sev;
    document.querySelectorAll(".sev button").forEach(b=>{
      b.classList.toggle("active", b.dataset.sev === sev);
    });
    calculate();
  }

  function setRisk(on){
    highRisk = !!on;
    $("riskToggle").classList.toggle("active", highRisk);
    $("riskPill").classList.toggle("show", highRisk);
    calculate();
  }

  function calculate(){
    const k = parseFloat($("kCurrent").value);
    const weight = parseFloat($("weight").value) || 70;

    if(!Number.isNaN(k)){
      currentSeverity = inferSeverityFromK(k);
      document.querySelectorAll(".sev button").forEach(b=>{
        b.classList.toggle("active", b.dataset.sev === currentSeverity);
      });
    }

    if(Number.isNaN(k)){
      $("deficitResult").textContent = "--";
      $("targetResult").textContent = "--";
      $("recTitle").textContent = "Introduce K+ para recomendaciones";
      $("recBody").textContent = "La recomendación se ajusta automáticamente con K+, gravedad y riesgo.";
      $("ivLines").innerHTML = "Velocidad sugerida: --<br>Concentración sugerida: --<br>Disolvente: SSF 0.9%<br>Monitorización ECG: --<br>Control de K+: --";
      return;
    }

    const rawDef = (3.5 - k) * 300 * (weight/70);
    const deficit = Math.max(0, Math.round(rawDef));
    $("deficitResult").textContent = deficit>0 ? `~${deficit}` : "0";

    $("targetResult").textContent = highRisk ? "≥4.0" : "3.5–4.0";

    const isSevere = (k < 2.5);
    const isModerate = (k >= 2.5 && k < 3.0);
    const needsIV = isSevere || highRisk || isModerate;

    const recBox = $("recBox");
    recBox.classList.remove("danger","warning","ok");
    if(isSevere) recBox.classList.add("danger");
    else if(isModerate) recBox.classList.add("warning");
    else recBox.classList.add("ok");

    if(!needsIV && k >= 3.0){
      $("recTitle").textContent = "Vía oral preferente (si tolera)";
      $("recBody").textContent = "Reposición fraccionada VO + tratar causa. Si hay ECG patológico o clínica relevante, revalora como mayor riesgo.";
    }else{
      $("recTitle").textContent = "Vía intravenosa (según criterios)";
      $("recBody").textContent = "Perfusión controlada. Ajusta velocidad/concentración según gravedad y riesgo. Priorizando seguridad y controles.";
    }

    let rate="--", conc="--", monitor="--", control="--";

    if(k < 2.5 || highRisk){
      rate = "20 mEq/h (práctico). Considerar hasta 40 mEq/h solo en amenaza vital con acceso/monitorización adecuados";
      conc = "Periférico 20–40 mEq/L · Central hasta 100 mEq/L";
      monitor = "Continua";
      control = "Reevaluar K+ a las 2–4 h y seriado según evolución";
    }else if(k < 3.0){
      rate = "10–20 mEq/h (habitual en IV)";
      conc = "Periférico 20–40 mEq/L";
      monitor = "Si IV o si hay cambios ECG";
      control = "Reevaluar K+ a las 4 h (orientativo) y ajustar";
    }else{
      rate = "No IV de entrada si estable y tolera VO";
      conc = "—";
      monitor = "No precisa continua por este motivo si sin otros factores";
      control = "Según plan VO y evolución";
    }

    $("ivLines").innerHTML =
      `Velocidad sugerida: <strong>${rate}</strong><br>`+
      `Concentración sugerida: <strong>${conc}</strong><br>`+
      `Disolvente: <strong>SSF 0.9%</strong><br>`+
      `Monitorización ECG: <strong>${monitor}</strong><br>`+
      `Control de K+: <strong>${control}</strong>`;
  }

  // Utilidad: setear imagen con fallback de rutas
  function setImageWithFallback(imgEl, urls){
    if(!imgEl) return;
    let i = 0;
    imgEl.onerror = () => {
      i += 1;
      if(i < urls.length){
        imgEl.src = urls[i];
      }
    };
    imgEl.src = urls[0];
  }

  // ECG: si alguna no existe, se oculta sola (no rompe)
  function renderECGThumbs(){
    const host = $("ecgThumbs");
    host.innerHTML = "";
    const list = (window.HK_ECG_IMAGES || []);

    if(!list.length){
      host.innerHTML = "<div class='hint' style='padding:6px 4px'>Sin ECG cargados.</div>";
      return;
    }

    list.forEach((it, i)=>{
      const btn = document.createElement("div");
      btn.className = "thumb" + (i===ecgIndex ? " active" : "");
      const im = document.createElement("img");
      im.alt = "";
      im.src = it.src;
      im.onerror = () => { btn.remove(); };
      btn.appendChild(im);

      btn.addEventListener("click", ()=>setECG(i));
      host.appendChild(btn);
    });
  }

  function setECG(i){
    const list = (window.HK_ECG_IMAGES || []);
    if(!list.length) return;
    ecgIndex = (i + list.length) % list.length;
    $("ecgImage").src = list[ecgIndex].src;
    $("ecgCaption").textContent = list[ecgIndex].label || `ECG ${ecgIndex+1}`;
    renderECGThumbs();
  }

  function sessDir(){
    const d = (window.HK_SESSION_DIR || "sesion").replace(/^\/+|\/+$/g,'');
    return d.length ? d : "sesion";
  }

  function sessCandidates(n){
    const ext = (window.HK_SESSION_EXT || "png");
    const file = `${pad3(n)}.${ext}`;
    const base = sessDir();

    const cand = [];
    cand.push(`${base}/${file}`);

    // fallbacks típicos (por si moviste carpeta sin tocar config)
    if(!base.startsWith("assets/")) cand.push(`assets/${base}/${file}`);
    cand.push(`sesion/${file}`);
    cand.push(`assets/sesion/${file}`);
    cand.push(`assets/images/sesion/${file}`);
    return cand;
  }

  function setSession(n){
    const total = Number(window.HK_SESSION_TOTAL || 21);
    const clamped = Math.max(1, Math.min(total, n));
    sessIndex = clamped;

    setImageWithFallback($("sessImage"), sessCandidates(sessIndex));
    $("sessCaption").textContent = `Diapositiva ${pad3(sessIndex)} / ${pad3(total)}`;
  }

  function algoCandidates(){
    const src = (window.HK_ALGO_SRC || "assets/images/algo/algoritmo.png").replace(/^\/+/,'');
    const cand = [];
    cand.push(src);
    cand.push("assets/images/algo/algoritmo.png");
    cand.push("assets/images/algo/algo.png");
    return [...new Set(cand)];
  }

  function setAlgoImage(){
    setImageWithFallback($("algoImage"), algoCandidates());
    $("algoCaption").textContent = "Algoritmo";
  }

  function renderStudy(){
    const root = $("studyRoot");
    root.innerHTML = "";
    (window.HK_STUDY || []).forEach((sec, idx)=>{
      const acc = document.createElement("div");
      acc.className = "acc" + (idx===0 ? " open" : "");
      acc.id = `acc-${sec.id}`;

      const head = document.createElement("div");
      head.className = "acc-h";
      head.innerHTML = `${sec.title} <span class="chev">${idx===0 ? "▲" : "▼"}</span>`;
      head.addEventListener("click", ()=>{
        acc.classList.toggle("open");
        const chev = acc.querySelector(".chev");
        if(chev) chev.textContent = acc.classList.contains("open") ? "▲" : "▼";
      });

      const body = document.createElement("div");
      body.className = "acc-b";
      const ul = document.createElement("ul");
      ul.style.marginLeft = "18px";
      (sec.bullets || []).forEach(b=>{
        const li = document.createElement("li");
        li.innerHTML = b;
        li.style.margin = "6px 0";
        ul.appendChild(li);
      });
      body.appendChild(ul);

      acc.appendChild(head);
      acc.appendChild(body);
      root.appendChild(acc);
    });
  }

  function renderTips(){
    const ul = $("tipsList");
    ul.innerHTML = "";
    (window.HK_TIPS || [
      "<strong>ECG manda</strong>: si hay cambios ECG, maneja como mayor riesgo.",
      "<strong>Refractaria</strong>: piensa en Mg bajo o pérdidas activas.",
      "<strong>IV segura</strong>: nunca bolo; SSF 0,9% preferente; controles en horas según gravedad.",
      "<strong>Riesgo alto</strong>: cardiopatía/digoxina/QT largo → objetivos más altos y vigilancia más estrecha."
    ]).forEach(t=>{
      const li = document.createElement("li");
      li.innerHTML = t;
      ul.appendChild(li);
    });
  }

  function renderBib(){
    const ol = $("bibList");
    ol.innerHTML = "";
    (window.HK_BIB || []).forEach(item=>{
      const li = document.createElement("li");
      li.textContent = item;
      ol.appendChild(li);
    });
  }

  function ensureAccCSS(){
    if(document.getElementById("accCss")) return;
    const style = document.createElement("style");
    style.id = "accCss";
    style.textContent = `
      .acc{border:1px solid var(--border);border-radius:14px;overflow:hidden;background: rgba(15,23,42,.03);margin-bottom:10px}
      .acc-h{padding:12px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-weight:950;color: rgba(15,23,42,.90);gap:10px}
      .acc-b{padding:0 12px 12px 12px;display:none;color: rgba(15,23,42,.78)}
      .acc.open .acc-b{display:block}
      .acc .chev{opacity:.7}
    `;
    document.head.appendChild(style);
  }

  function pickWeighted(){
    // Menos “IV por defecto”: más casos leves
    const r = Math.random();
    if(r < 0.52) return "leve";
    if(r < 0.85) return "moderada";
    return "grave";
  }

  function shuffle(arr){
    for(let i = arr.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  function genCase(){
    const band = pickWeighted();
    let k = 3.2;
    if(band==="leve") k = pick([3.0,3.1,3.2,3.3,3.4]);
    if(band==="moderada") k = pick([2.5,2.6,2.7,2.8,2.9]);
    if(band==="grave") k = pick([2.0,2.1,2.2,2.3,2.4]);

    const riskHigh = Math.random() < 0.18; // antes 0.28
    const ecg = (band!=="leve" && Math.random() < 0.25) ? 1 : 0; // antes 0.35
    const symp = (band==="grave" && Math.random() < 0.35) ? 1 : 0; // antes 0.45
    const vo = (band==="grave" && Math.random() < 0.28) ? 0 : 1;
    const mg = Math.random() < 0.18;

    const riskEff = riskHigh || ecg || symp;
    const needsIV = (k < 2.5) || riskEff || (k < 3.0) || !vo;

    const correct = needsIV ? "IV" : "VO";

    const why = [];
    if(correct==="IV"){
      why.push("Criterios IV por K bajo y/o riesgo (síntomas/ECG/riesgo alto) y/o intolerancia VO.");
      if(k < 2.5 || riskEff){
        why.push("IV práctica: 20 mEq/h · periférico 20–40 mEq/L (central hasta 100) · SSF 0,9% · ECG continua · K+ 2–4 h.");
      }else{
        why.push("IV: 10–20 mEq/h · periférico 20–40 mEq/L · SSF 0,9% · ECG si IV/ECG patológico · K+ ~4 h.");
      }
    }else{
      why.push("VO por leve/estable y sin criterios de IV. Reposición fraccionada + tratar causa.");
      why.push("Si aparece ECG/síntomas o riesgo alto → escalar a manejo de mayor riesgo.");
    }
    if(mg) why.push("Mg: corregir/valorar porque puede hacer hipopotasemia refractaria.");

    const ctx = [
      `K+: ${k.toFixed(1)} mEq/L`,
      `Riesgo alto: ${riskHigh ? "sí" : "no"}`,
      `ECG: ${ecg ? "cambios" : "sin cambios"}`,
      `Síntomas: ${symp ? "sí" : "no"}`,
      `Tolera VO: ${vo ? "sí" : "no"}`,
      `Sospecha Mg bajo: ${mg ? "sí" : "no"}`
    ].join(" · ");

    const options = shuffle([
      { key:"VO", label:"Elegir vía oral fraccionada (si tolera) + tratar causa + seguimiento" },
      { key:"IV", label:"Elegir perfusión IV (sin bolo) + monitorización/controles según riesgo" },
      { key:"MIX", label:"Dar algo de IV “por si acaso” pero sin definir velocidad/concentración ni controles" }
    ]);

    return {
      title: "Caso",
      meta: ctx,
      body: "¿Cuál es la ruta inicial más coherente con el algoritmo?",
      correctKey: correct,
      options,
      explanation: why.join(" ")
    };
  }

  function renderCase(c){
    CASE_STATE.current = c;
    CASE_STATE.answered = false;

    $("caseTitle").textContent = c.title;
    $("caseMeta").textContent = c.meta;
    $("caseBody").textContent = c.body;

    const host = $("caseOptions");
    host.innerHTML = "";
    c.options.forEach(opt=>{
      const b = document.createElement("button");
      b.className = "opt";
      b.type = "button";
      b.textContent = opt.label;
      b.dataset.key = opt.key;
      b.addEventListener("click", ()=>answerCase(opt.key));
      host.appendChild(b);
    });

    $("caseFeedback").classList.remove("show");
    $("caseFeedback").textContent = "";
    $("resetCase").style.display = "none";
  }

  function answerCase(key){
    if(!CASE_STATE.current || CASE_STATE.answered) return;
    CASE_STATE.answered = true;

    const c = CASE_STATE.current;
    const isCorrect = (key === c.correctKey);

    document.querySelectorAll("#caseOptions .opt").forEach(b=>{
      const k = b.dataset.key;
      if(k === c.correctKey) b.classList.add("correct");
      if(k === key && !isCorrect) b.classList.add("wrong");
      b.disabled = true;
    });

    const fb = $("caseFeedback");
    fb.classList.add("show");
    fb.innerHTML = (isCorrect ? "<strong>Correcto.</strong> " : "<strong>No.</strong> ") + c.explanation;

    $("resetCase").style.display = "inline-block";
  }

  function enableNavigation(){
    let x0=null, y0=null, t0=0;
    const root = $("appRoot");

    root.addEventListener("touchstart",(e)=>{
      if(e.touches.length !== 1) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      t0 = Date.now();
    }, {passive:true});

    root.addEventListener("touchend",(e)=>{
      if(x0===null || y0===null) return;
      const dt = Date.now()-t0;
      const x1 = (e.changedTouches[0]||{}).clientX;
      const y1 = (e.changedTouches[0]||{}).clientY;
      const dx = x1 - x0;
      const dy = y1 - y0;

      x0=null; y0=null;

      if(isAnyModalOpen()) return;

      // En pseudo fullscreen: swipe cambia slides/ECG
      if(pseudoMode){
        if(Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)*1.4 && dt < 600){
          if(fsMode === "session"){
            if(dx < 0) setSession(sessIndex+1);
            else setSession(sessIndex-1);
          }else if(fsMode === "ecg"){
            if(dx < 0) setECG(ecgIndex+1);
            else setECG(ecgIndex-1);
          }
        }
        return;
      }

      // Normal: swipe cambia pantallas
      if(Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)*1.4 && dt < 500){
        if(dx < 0) nextScreen();
        else prevScreen();
      }
    }, {passive:true});

    document.addEventListener("keydown",(e)=>{
      if(isAnyModalOpen()) return;

      // fullscreen (nativo o pseudo)
      if(document.fullscreenElement || pseudoMode){
        if(fsMode === "session"){
          if(e.key === "ArrowRight") { setSession(sessIndex+1); return; }
          if(e.key === "ArrowLeft")  { setSession(sessIndex-1); return; }
        }
        if(fsMode === "ecg"){
          if(e.key === "ArrowRight") { setECG(ecgIndex+1); return; }
          if(e.key === "ArrowLeft")  { setECG(ecgIndex-1); return; }
        }
        if(e.key === "Escape"){
          exitFullscreenAny();
          return;
        }
        return;
      }

      if(e.key === "ArrowRight") nextScreen();
      if(e.key === "ArrowLeft") prevScreen();
      if(e.key === "Escape"){
        closeDrawer();
        closeAllModals();
      }
    });
  }

  function bind(){
    $("openMenu").addEventListener("click", openDrawer);
    $("closeMenu").addEventListener("click", closeDrawer);
    $("drawerOverlay").addEventListener("click",(e)=>{
      if(e.target && e.target.id === "drawerOverlay") closeDrawer();
    });

    $("menuList").addEventListener("click",(e)=>{
      const btn = e.target.closest("button");
      if(!btn) return;
      const scr = btn.dataset.screen;
      if(scr) setActiveScreen(scr);
    });

    $("openBib").addEventListener("click", ()=>openModal("bib"));
    $("openStudy").addEventListener("click", ()=>openModal("study"));
    $("openTips").addEventListener("click", ()=>openModal("tips"));

    $("openRiskInfo").addEventListener("click", ()=>openModal("risk"));
    $("applyRiskFromChecklist").addEventListener("click", ()=>{
      const any = Array.from(document.querySelectorAll("#riskChecklist input[type='checkbox']")).some(i=>i.checked);
      setRisk(!!any);
      closeModal("modalRiskInfo");
    });
    $("clearRiskChecklist").addEventListener("click", ()=>{
      document.querySelectorAll("#riskChecklist input[type='checkbox']").forEach(i=>{ i.checked=false; });
    });

    document.querySelectorAll("[data-close]").forEach(b=>{
      b.addEventListener("click", ()=>closeModal(b.dataset.close));
    });
    ["modalBib","modalStudy","modalTips","modalRiskInfo"].forEach(id=>{
      $(id).addEventListener("click",(e)=>{
        if(e.target && e.target.id === id) closeModal(id);
      });
    });

    document.querySelectorAll(".sev button").forEach(b=>{
      b.addEventListener("click", ()=>setSeverity(b.dataset.sev));
    });

    $("riskToggle").addEventListener("click", ()=>setRisk(!highRisk));

    $("kCurrent").addEventListener("input", calculate);
    $("weight").addEventListener("input", calculate);

    $("ecgPrev").addEventListener("click", ()=>setECG(ecgIndex-1));
    $("ecgNext").addEventListener("click", ()=>setECG(ecgIndex+1));
    $("ecgFS").addEventListener("click", ()=>requestFullscreen($("ecgViewer"), "ecg"));
    $("ecgExit").addEventListener("click", exitFullscreenAny);

    $("sessPrev").addEventListener("click", ()=>setSession(sessIndex-1));
    $("sessNext").addEventListener("click", ()=>setSession(sessIndex+1));
    $("sessFS").addEventListener("click", ()=>requestFullscreen($("sessViewer"), "session"));
    $("sessExit").addEventListener("click", exitFullscreenAny);
    $("sessJump").addEventListener("click", ()=>{
      const total = Number(window.HK_SESSION_TOTAL || 21);
      const n = prompt(`Ir a diapositiva (1–${total})`, String(sessIndex));
      const v = parseInt(n,10);
      if(!Number.isNaN(v)) setSession(v);
    });

    $("algoFS").addEventListener("click", ()=>requestFullscreen($("algoViewer"), "algo"));
    $("algoExit").addEventListener("click", exitFullscreenAny);

    $("newCase").addEventListener("click", ()=>renderCase(genCase()));
    $("resetCase").addEventListener("click", ()=>{ if(CASE_STATE.current) renderCase(CASE_STATE.current); });

    document.addEventListener("fullscreenchange", detectFsMode);

    enableNavigation();
  }

  function init(){
    ensureAccCSS();
    bind();

    renderStudy();
    renderTips();
    renderBib();

    $("presentationsText").textContent = (window.HK_PRESENTATIONS_TEXT || "");

    setRisk(false);

    renderECGThumbs();
    if((window.HK_ECG_IMAGES||[]).length) setECG(0);

    setSession(1);
    setAlgoImage();

    calculate();
    detectFsMode();
  }

  init();
})();