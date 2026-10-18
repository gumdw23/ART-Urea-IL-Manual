(() => {
  "use strict";

  const app = document.getElementById("app");
  const state = {
    data: null,
    mode: "single",
    focus: null,
    animation: null,
    nodes: new Map(),
    shell: null,
    svg: null,
    layoutButton: null,
  };

  const $ = (parent, tag, cls = "", text = null) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== null && text !== undefined) el.textContent = text;
    parent.appendChild(el);
    return el;
  };

  const svgEl = (tag, attrs = {}) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    return el;
  };

  const getLib = (mode = state.mode) => {
    if (mode === "single") return state.data.singleCore;
    if (mode === "double") return state.data.doubleCore;
    return state.data.controlCore;
  };

  const modeLabel = (mode = state.mode) =>
    mode === "single" ? "Urea Single-Core" :
    mode === "double" ? "Urea Double-Core" : "Urea-Linker Control";

  const cardId = (card) => card.uid || card.id;
  const clampZoom = (z) => Math.max(0.15, Math.min(2, Math.round(z * 100) / 100));

  function stopAnimation() {
    if (state.animation) cancelAnimationFrame(state.animation);
    state.animation = null;
  }

  function legendItem(parent, label, stateName) {
    const wrap = $(parent, "span", "uil-legend-item");
    $(wrap, "span", `uil-dot ${stateName}`);
    $(wrap, "span", "", label);
  }

  function renderTop(root) {
    const top = $(root, "div", "uil-topbar");
    const titleWrap = $(top, "div", "uil-title-wrap");
    $(titleWrap, "div", "uil-kicker", "ART · UREA IL");
    $(titleWrap, "h2", "uil-title", "Visual Library");
    $(titleWrap, "div", "uil-subtitle", "Structure map · screening · synthesis route · experiment memory");
    $(titleWrap, "span", "uil-public-badge", "PUBLIC VIEW");

    const legend = $(top, "div", "uil-legend");
    legendItem(legend, "Untested", "untested");
    legendItem(legend, "PASS", "pass");
    legendItem(legend, "FAIL", "fail");
    legendItem(legend, "HIT", "hit");
    $(legend, "span", "uil-route-legend", "→ actual synthesis");

    const tabs = $(root, "div", "uil-tabs");
    [["single", "Urea Single-Core"], ["double", "Urea Double-Core"], ["control", "Urea-Linker Control"]]
      .forEach(([key, label]) => {
        const b = $(tabs, "button", `uil-tab${state.mode === key ? " active" : ""}`, label);
        b.onclick = () => {
          stopAnimation();
          state.mode = key;
          state.focus = null;
          render();
        };
      });

    const route = $(root, "div", "uil-project-route");
    $(route, "span", "uil-project-route-title", "Actual project route");
    (state.data.project?.routeHistory || []).forEach((step, i, arr) => {
      const s = $(route, "span", `uil-project-route-step ${step.state || ""}`);
      $(s, "strong", "", step.label || "");
      if (step.detail) $(s, "span", "uil-project-route-detail", step.detail);
      if (i < arr.length - 1) $(route, "span", "uil-project-route-arrow", "→");
    });
  }

  function render() {
    stopAnimation();
    app.innerHTML = "";
    const root = $(app, "div", "uil-root uil-manual-active");
    renderTop(root);
    const body = $(root, "div", "uil-body");
    const host = $(body, "div", "uil-library-host uil-manual-host");
    renderManual(host);
  }

  function ensureMindmap(lib) {
    if (!lib.mindmap) lib.mindmap = {};
    const mm = lib.mindmap;
    if (!mm.positions) mm.positions = {};
    if (!Array.isArray(mm.edges)) mm.edges = [];
    if (typeof mm.showRelationEdges !== "boolean") mm.showRelationEdges = true;
    if (typeof mm.layoutFrozen !== "boolean") mm.layoutFrozen = true;
    if (typeof mm.zoom !== "number") mm.zoom = 1;
    if (typeof mm.panX !== "number") mm.panX = 24;
    if (typeof mm.panY !== "number") mm.panY = 24;
    return mm;
  }

  function renderManual(root) {
    const lib = getLib();
    const cards = lib.cards || [];
    const mm = ensureMindmap(lib);
    const toolbar = $(root, "div", "uil-mindmap-toolbar");
    const zoomGroup = $(toolbar, "div", "uil-zoom-group");
    const zoomOut = $(zoomGroup, "button", "uil-zoom-btn", "−");
    const zoomLabel = $(zoomGroup, "button", "uil-zoom-label", `${Math.round(mm.zoom * 100)}%`);
    const zoomIn = $(zoomGroup, "button", "uil-zoom-btn", "+");
    const zoomFit = $(zoomGroup, "button", "uil-zoom-fit", "Fit");

    const layoutButton = $(toolbar, "button",
      `uil-layout-mode ${mm.layoutFrozen ? "frozen" : "auto"}`,
      mm.layoutFrozen ? "📌 Frozen · manual move" : "◉ Auto layout");
    state.layoutButton = layoutButton;

    const relationLabel = $(toolbar, "label", "uil-check");
    const relationToggle = $(relationLabel, "input");
    relationToggle.type = "checkbox";
    relationToggle.checked = mm.showRelationEdges !== false;
    $(relationLabel, "span", "", "Structure links");

    const resetBtn = $(toolbar, "button", "uil-view-btn", "Reset layout");
    const printBtn = $(toolbar, "button", "uil-view-btn uil-vector-pdf-btn", "Vector PDF · A3");
    printBtn.title = "현재 Manual map만 A3 landscape 한 장에 맞춰 벡터 PDF로 인쇄합니다.";
    $(toolbar, "span", "uil-public-note", "read-only · drag / zoom / highlight enabled");

    const shell = $(root, "div", "uil-mindmap-shell");
    const world = $(shell, "div", "uil-mindmap-world");
    const stage = $(world, "div", "uil-mindmap-stage");
    state.shell = shell;
    const stageWidth = 100000;
    const stageHeight = 100000;
    world.style.width = `${stageWidth}px`;
    world.style.height = `${stageHeight}px`;
    stage.style.width = `${stageWidth}px`;
    stage.style.height = `${stageHeight}px`;

    const applyCamera = () => {
      world.style.transform = `translate(${mm.panX}px,${mm.panY}px) scale(${clampZoom(mm.zoom)})`;
      zoomLabel.textContent = `${Math.round(mm.zoom * 100)}%`;
    };
    const applyZoom = (nextZoom, anchorX = null, anchorY = null) => {
      const oldZoom = clampZoom(mm.zoom);
      const next = clampZoom(nextZoom);
      if (anchorX !== null && anchorY !== null) {
        const lx = (anchorX - mm.panX) / oldZoom;
        const ly = (anchorY - mm.panY) / oldZoom;
        mm.panX = anchorX - lx * next;
        mm.panY = anchorY - ly * next;
      }
      mm.zoom = next;
      applyCamera();
    };
    applyCamera();

    const svg = svgEl("svg", {
      class: "uil-mindmap-svg",
      width: stageWidth,
      height: stageHeight,
      viewBox: `0 0 ${stageWidth} ${stageHeight}`,
    });
    stage.appendChild(svg);
    state.svg = svg;

    const defs = svgEl("defs");
    defs.innerHTML = '<marker id="uil-arrow-relation" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#98a2b3"/></marker>' +
      '<marker id="uil-arrow-actual" markerWidth="9" markerHeight="9" refX="8" refY="3.5" orient="auto"><path d="M0,0 L0,7 L8,3.5 z" fill="#2563eb"/></marker>' +
      '<marker id="uil-arrow-manual" markerWidth="9" markerHeight="9" refX="8" refY="3.5" orient="auto"><path d="M0,0 L0,7 L8,3.5 z" fill="#7c3aed"/></marker>';
    svg.appendChild(defs);

    const nodes = new Map();
    state.nodes = nodes;
    const positions = mm.positions;
    const cores = lib.cores || [];
    const tails = state.data.tails || [];
    const inters = state.data.intermediates || [];

    const ensurePos = (id, kind, idx, card = null) => {
      if (positions[id]) return positions[id];
      let x = 80, y = 80;
      if (kind === "tail") {
        x = 520 + idx * 280;
        y = 70;
      } else if (kind === "core") {
        x = 70;
        y = 340 + idx * (state.mode === "single" ? 880 : 860);
      } else if (card) {
        const ci = Math.max(0, cores.findIndex(c => c.code === card.core));
        const ti = Math.max(0, tails.findIndex(t => t.code === card.tailCode));
        x = 430 + (ti % 3) * 250;
        y = 260 + ci * (state.mode === "single" ? 880 : 860) + Math.floor(ti / 3) * 270;
      }
      positions[id] = { x, y };
      return positions[id];
    };

    const addNode = (id, kind, pos, el, w, h) => {
      el.style.left = `${pos.x}px`;
      el.style.top = `${pos.y}px`;
      el.dataset.nodeId = id;
      nodes.set(id, { id, kind, pos, el, w, h });
    };

    cores.forEach((core, idx) => {
      const iid = core.intermediateId || core.code;
      const id = `core:${iid}`;
      const pos = ensurePos(id, "core", idx);
      const src = inters.find(x => x.intermediateId === iid);
      const el = $(stage, "div", "uil-map-source uil-map-core");
      $(el, "div", "uil-map-source-code", iid);
      $(el, "div", "uil-map-source-name", core.name || src?.name || core.code);
      if (src?.svg) {
        const structure = $(el, "div", "uil-map-source-structure");
        structure.innerHTML = src.svg;
      }
      addNode(id, "core", pos, el, 190, src?.svg ? 150 : 90);
      bindNodeDrag(el, id, mm, nodes, svg, lib, false);
      bindSourceFocus(el, id, lib, nodes, svg);
    });

    tails.forEach((tail, idx) => {
      const id = `tail:${tail.code}`;
      const pos = ensurePos(id, "tail", idx);
      const el = $(stage, "div", "uil-map-source uil-map-tail");
      $(el, "div", "uil-map-source-code", tail.code);
      $(el, "div", "uil-map-source-name", tail.name);
      $(el, "div", "uil-map-source-meta", `${tail.reaction} · C${tail.carbon}`);
      if (tail.svg) {
        const structure = $(el, "div", "uil-map-source-structure");
        structure.innerHTML = tail.svg;
      }
      addNode(id, "tail", pos, el, 190, tail.svg ? 160 : 84);
      bindNodeDrag(el, id, mm, nodes, svg, lib, false);
      bindSourceFocus(el, id, lib, nodes, svg);
    });

    cards.forEach((card, idx) => {
      const id = cardId(card);
      const pos = ensurePos(id, "card", idx, card);
      const node = $(stage, "div", "uil-map-card-node");
      const dragHandle = renderCard(node, card);
      addNode(id, "card", pos, node, 184, 228);
      if (dragHandle) bindNodeDrag(dragHandle, id, mm, nodes, svg, lib, true, node);
    });

    drawEdges(svg, cards, lib, nodes);

    zoomOut.onclick = () => applyZoom(mm.zoom - 0.1);
    zoomIn.onclick = () => applyZoom(mm.zoom + 0.1);
    zoomLabel.onclick = () => applyZoom(1);
    zoomFit.onclick = () => fitView(shell, nodes, mm, applyCamera);

    relationToggle.onchange = () => {
      mm.showRelationEdges = relationToggle.checked;
      drawEdges(svg, cards, lib, nodes);
    };

    layoutButton.onclick = () => {
      mm.layoutFrozen = !mm.layoutFrozen;
      updateLayoutButton(mm);
      if (mm.layoutFrozen) stopAnimation();
      else startForceLayout(nodes, cards, lib, mm, svg, stageWidth, stageHeight,
        () => fitView(shell, nodes, mm, applyCamera));
    };

    resetBtn.onclick = () => {
      stopAnimation();
      mm.positions = {};
      mm.layoutVersion = 0;
      mm.layoutFrozen = false;
      render();
    };
    printBtn.onclick = () => prepareVectorPrint(stage, nodes, mm, lib);

    shell.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest(".uil-map-card-node,.uil-map-source,button,input,label")) return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY;
      const x0 = mm.panX, y0 = mm.panY;
      shell.classList.add("panning");
      const move = (ev) => {
        mm.panX = x0 + (ev.clientX - sx);
        mm.panY = y0 + (ev.clientY - sy);
        applyCamera();
      };
      const up = () => {
        shell.classList.remove("panning");
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });

    shell.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect = shell.getBoundingClientRect();
      const ax = e.clientX - rect.left;
      const ay = e.clientY - rect.top;
      applyZoom(mm.zoom + (e.deltaY < 0 ? 0.1 : -0.1), ax, ay);
    }, { passive: false });

    if (!mm.layoutFrozen) {
      startForceLayout(nodes, cards, lib, mm, svg, stageWidth, stageHeight,
        () => fitView(shell, nodes, mm, applyCamera));
      requestAnimationFrame(() => fitView(shell, nodes, mm, applyCamera));
    } else {
      requestAnimationFrame(() => fitView(shell, nodes, mm, applyCamera));
    }
  }

  function updateLayoutButton(mm) {
    if (!state.layoutButton) return;
    state.layoutButton.className = `uil-layout-mode ${mm.layoutFrozen ? "frozen" : "auto"}`;
    state.layoutButton.textContent = mm.layoutFrozen ? "📌 Frozen · manual move" : "◉ Auto layout";
  }

  function renderCard(parent, card) {
    const shell = $(parent, "div", `uil-card status-${card.screening || "untested"}`);
    const inner = $(shell, "div", "uil-flip-inner");
    const front = $(inner, "div", "uil-card-face uil-front");
    $(front, "div", "uil-card-id", card.displayId || card.targetId || card.id);
    const structure = $(front, "div", "uil-structure");
    structure.innerHTML = card.svg || "";

    front.onclick = (e) => {
      if (front.dataset.justDragged === "1") {
        front.dataset.justDragged = "0";
        return;
      }
      e.stopPropagation();
      shell.classList.add("flipped");
    };

    const back = $(inner, "div", "uil-card-face uil-back uil-readonly-back");
    const head = $(back, "div", "uil-back-head");
    $(head, "strong", "", card.displayId || card.targetId || card.id);
    $(head, "span", "uil-public-badge", "READ ONLY");

    const samples = (card.sampleHistory || []).map(x => x.sampleId).filter(Boolean).join(", ");
    const meta = [card.targetId || card.candidateKey || "", card.core, card.tailCode, card.reaction,
      card.mw ? `MW ${card.mw}` : "", samples ? `Sample: ${samples}` : ""].filter(Boolean).join(" · ");
    $(back, "div", "uil-back-meta", meta);
    readOnlyField(back, "Screening", (card.screening || "untested").toUpperCase());
    readOnlyField(back, "Actual synthesis", card.actualSynthesis ? "YES" : "NO");
    const notes = card.notes || {};
    [["physicalState", "Physical state / 물성"],
     ["reactionObservation", "Reaction observation / 반응 특이사항"],
     ["analysis", "Analysis / 분석 결과"],
     ["byproducts", "Byproducts / 부산물"],
     ["purification", "Purification / 정제"],
     ["memo", "Free memo / 메모"]].forEach(([key, label]) => {
      if (notes[key]) readOnlyNote(back, label, notes[key]);
    });
    if (card.smiles) readOnlyNote(back, "SMILES", card.smiles, true);

    back.onclick = (e) => {
      e.stopPropagation();
      shell.classList.remove("flipped");
    };
    return front;
  }

  function readOnlyField(parent, label, value) {
    const row = $(parent, "div", "uil-field-row");
    $(row, "label", "", label);
    $(row, "span", "", value || "—");
  }

  function readOnlyNote(parent, label, value, mono = false) {
    const box = $(parent, "div", mono ? "uil-smiles-box" : "uil-note-field");
    $(box, "label", "", label);
    const ta = $(box, "textarea", mono ? "uil-smiles" : "");
    ta.readOnly = true;
    ta.value = value || "";
  }

  function bindSourceFocus(el, nodeId, lib, nodes, svg) {
    el.addEventListener("click", (e) => {
      if (el.dataset.justDragged === "1") {
        el.dataset.justDragged = "0";
        return;
      }
      e.stopPropagation();
      const active = state.focus?.mode === state.mode && state.focus?.nodeId === nodeId;
      state.focus = active ? null : { mode: state.mode, nodeId };
      drawEdges(svg, lib.cards || [], lib, nodes);
    });
  }

  function bindNodeDrag(handle, nodeId, mm, nodes, svg, lib, cardHandle = false, nodeEl = null) {
    const target = nodeEl || handle;
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      handle.dataset.justDragged = "0";
      if (!mm.layoutFrozen) {
        mm.layoutFrozen = true;
        stopAnimation();
        updateLayoutButton(mm);
      }
      const pos = mm.positions[nodeId] || { x: 0, y: 0 };
      const sx = e.clientX, sy = e.clientY, x0 = pos.x, y0 = pos.y;
      let moved = false;
      const move = (ev) => {
        const z = clampZoom(mm.zoom || 1);
        const dx = (ev.clientX - sx) / z, dy = (ev.clientY - sy) / z;
        if (Math.abs(dx) + Math.abs(dy) > 3 / z) moved = true;
        pos.x = Math.max(0, x0 + dx);
        pos.y = Math.max(0, y0 + dy);
        mm.positions[nodeId] = pos;
        target.style.left = `${pos.x}px`;
        target.style.top = `${pos.y}px`;
        const meta = nodes.get(nodeId);
        if (meta) meta.pos = pos;
        if (moved && meta?.kind === "card") resolveCollision(nodeId, nodes, mm, 0.22);
        drawEdges(svg, lib.cards || [], lib, nodes);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (moved) {
          handle.dataset.justDragged = "1";
          resolveCollision(nodeId, nodes, mm, 0.85);
          drawEdges(svg, lib.cards || [], lib, nodes);
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  }

  function resolveCollision(nodeId, nodes, mm, strength = 0.5) {
    const me = nodes.get(nodeId);
    if (!me || me.kind !== "card") return;
    const cards = [...nodes.values()].filter(n => n.kind === "card");
    const active = new Set([nodeId]);
    const rounds = strength < 0.5 ? 1 : 5;
    const maxShift = strength < 0.5 ? 5 : 14;
    const gap = 18;
    for (let round = 0; round < rounds; round++) {
      let changed = false;
      for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
          const a = cards[i], b = cards[j];
          if (!active.has(a.id) && !active.has(b.id)) continue;
          const dx = (a.pos.x + a.w / 2) - (b.pos.x + b.w / 2);
          const dy = (a.pos.y + a.h / 2) - (b.pos.y + b.h / 2);
          const ox = (a.w + b.w) / 2 + gap - Math.abs(dx);
          const oy = (a.h + b.h) / 2 + gap - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue;
          changed = true;
          active.add(a.id); active.add(b.id);
          if (ox < oy) {
            const sign = dx === 0 ? (a.id < b.id ? -1 : 1) : Math.sign(dx);
            const push = Math.min(maxShift, Math.max(1.5, ox * 0.5 * strength));
            a.pos.x = Math.max(0, a.pos.x + sign * push);
            b.pos.x = Math.max(0, b.pos.x - sign * push);
          } else {
            const sign = dy === 0 ? (a.id < b.id ? -1 : 1) : Math.sign(dy);
            const push = Math.min(maxShift, Math.max(1.5, oy * 0.5 * strength));
            a.pos.y = Math.max(0, a.pos.y + sign * push);
            b.pos.y = Math.max(0, b.pos.y - sign * push);
          }
          [a, b].forEach(n => {
            mm.positions[n.id] = { x: n.pos.x, y: n.pos.y };
            n.el.style.left = `${n.pos.x}px`;
            n.el.style.top = `${n.pos.y}px`;
          });
        }
      }
      if (!changed) break;
    }
  }

  function drawEdges(svg, cards, lib, nodes) {
    svg.querySelectorAll(".uil-edge").forEach(x => x.remove());
    const focus = state.focus?.mode === state.mode ? state.focus : null;
    const connected = new Set();
    if (focus) {
      cards.forEach(card => {
        const cid = cardId(card);
        const core = (lib.cores || []).find(c => c.code === card.core);
        const coreId = `core:${core?.intermediateId || card.intermediateId || card.core}`;
        const tailId = `tail:${card.tailCode}`;
        if (focus.nodeId === coreId || focus.nodeId === tailId) connected.add(cid);
      });
    }

    nodes.forEach(n => {
      n.el.classList.remove("uil-focus-source", "uil-focus-match", "uil-focus-dim");
      if (!focus) return;
      if (n.id === focus.nodeId) n.el.classList.add("uil-focus-source");
      else if (n.kind === "card" && connected.has(n.id)) n.el.classList.add("uil-focus-match");
      else if (n.kind === "card") n.el.classList.add("uil-focus-dim");
    });

    const addLine = (fromId, toId, type) => {
      const a = nodes.get(fromId), b = nodes.get(toId);
      if (!a || !b) return;
      const line = svgEl("line", {
        x1: a.pos.x + a.w / 2,
        y1: a.pos.y + a.h / 2,
        x2: b.pos.x + b.w / 2,
        y2: b.pos.y + b.h / 2,
        class: `uil-edge ${type}`,
        "marker-end": `url(#uil-arrow-${type})`,
      });
      if (focus && type !== "manual") {
        const hit = connected.has(fromId) || connected.has(toId);
        line.classList.add(hit ? "focused" : "dimmed");
      }
      svg.appendChild(line);
    };

    cards.forEach(card => {
      const cid = cardId(card);
      const core = (lib.cores || []).find(c => c.code === card.core);
      const coreId = `core:${core?.intermediateId || card.intermediateId || card.core}`;
      const tailId = `tail:${card.tailCode}`;
      if (card.actualSynthesis) {
        addLine(coreId, cid, "actual");
        if (lib.mindmap.showRelationEdges !== false) addLine(tailId, cid, "relation");
      } else if (lib.mindmap.showRelationEdges !== false) {
        addLine(coreId, cid, "relation");
        addLine(tailId, cid, "relation");
      }
    });
    (lib.mindmap.edges || []).forEach(e => addLine(e.from, e.to, "manual"));
  }

  function getNodeBounds(nodes, margin = 0) {
    const list = [...nodes.values()];
    if (!list.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    list.forEach(n => {
      minX = Math.min(minX, n.pos.x);
      minY = Math.min(minY, n.pos.y);
      maxX = Math.max(maxX, n.pos.x + n.w);
      maxY = Math.max(maxY, n.pos.y + n.h);
    });
    return {
      minX: minX - margin,
      minY: minY - margin,
      maxX: maxX + margin,
      maxY: maxY + margin,
      width: Math.max(1, maxX - minX + margin * 2),
      height: Math.max(1, maxY - minY + margin * 2),
    };
  }

  function prepareVectorPrint(stage, nodes, mm, lib) {
    const bounds = getNodeBounds(nodes, 55);
    if (!bounds) return;
    document.querySelector(".uil-vector-print-root")?.remove();

    const root = $(document.body, "div", "uil-vector-print-root");
    const header = $(root, "div", "uil-vector-print-header");
    $(header, "div", "uil-vector-print-title", `ART Urea IL Visual Library · ${modeLabel()} Manual Map`);
    const stateText = mm.layoutFrozen ? "Frozen layout" : "Auto-layout snapshot";
    $(header, "div", "uil-vector-print-meta",
      `${stateText} · Structure links ${mm.showRelationEdges === false ? "OFF" : "ON"} · Blue = actual synthesis · Purple = manual link · VECTOR PDF`);

    const map = $(root, "div", "uil-vector-print-map");
    const scaler = $(map, "div", "uil-vector-print-scaler");
    const clone = stage.cloneNode(true);
    clone.classList.add("uil-vector-print-stage");
    clone.querySelectorAll(".flipped").forEach(x => x.classList.remove("flipped"));
    clone.querySelectorAll(".uil-focus-source,.uil-focus-match,.uil-focus-dim")
      .forEach(x => x.classList.remove("uil-focus-source", "uil-focus-match", "uil-focus-dim"));
    clone.style.transform = `translate(${-bounds.minX}px,${-bounds.minY}px)`;
    clone.style.transformOrigin = "0 0";

    const pageWpx = 1527, pageHpx = 1005;
    const scale = Math.min(pageWpx / bounds.width, pageHpx / bounds.height);
    const scaledW = bounds.width * scale, scaledH = bounds.height * scale;
    scaler.style.width = `${bounds.width}px`;
    scaler.style.height = `${bounds.height}px`;
    scaler.style.left = `${(pageWpx - scaledW) / 2}px`;
    scaler.style.top = `${(pageHpx - scaledH) / 2}px`;
    scaler.style.transform = `scale(${scale})`;
    scaler.appendChild(clone);

    window.addEventListener("afterprint", () => root.remove(), { once: true });
    requestAnimationFrame(() => setTimeout(() => window.print(), 120));
  }

  function fitView(shell, nodes, mm, applyCamera) {
    const list = [...nodes.values()];
    if (!list.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    list.forEach(n => {
      minX = Math.min(minX, n.pos.x);
      minY = Math.min(minY, n.pos.y);
      maxX = Math.max(maxX, n.pos.x + n.w);
      maxY = Math.max(maxY, n.pos.y + n.h);
    });
    const margin = 90;
    minX -= margin; minY -= margin; maxX += margin; maxY += margin;
    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);
    const usableW = Math.max(200, shell.clientWidth - 28);
    const usableH = Math.max(200, shell.clientHeight - 28);
    const fit = clampZoom(Math.min(usableW / contentW, usableH / contentH));
    mm.zoom = fit;
    mm.panX = (shell.clientWidth - contentW * fit) / 2 - minX * fit;
    mm.panY = (shell.clientHeight - contentH * fit) / 2 - minY * fit;
    applyCamera();
  }

  function startForceLayout(nodes, cards, lib, mm, svg, stageWidth, stageHeight, onSettled = null) {
    stopAnimation();
    const cores = lib.cores || [];
    const tails = state.data.tails || [];
    const targets = new Map();
    tails.forEach((tail, ti) => {
      const n = nodes.get(`tail:${tail.code}`);
      if (n) targets.set(n.id, { x: 360 + ti * 315, y: 110 + (ti % 2) * 105 });
    });

    const clusterCols = state.mode === "single" ? 4 : (state.mode === "double" ? 3 : 1);
    const clusterXGap = 1120;
    const clusterYGap = 980;
    const firstY = 650;
    cores.forEach((core, ci) => {
      const col = ci % clusterCols;
      const row = Math.floor(ci / clusterCols);
      const ox = 150 + col * clusterXGap;
      const oy = firstY + row * clusterYGap;
      const iid = core.intermediateId || core.code;
      const coreNode = nodes.get(`core:${iid}`);
      if (coreNode) targets.set(coreNode.id, { x: ox, y: oy + 335 });

      const coreCards = cards.filter(c => c.core === core.code).sort((a, b) =>
        tails.findIndex(t => t.code === a.tailCode) - tails.findIndex(t => t.code === b.tailCode));
      coreCards.forEach((card, i) => {
        const cc = i % 3, rr = Math.floor(i / 3);
        targets.set(cardId(card), { x: ox + 330 + cc * 250, y: oy + rr * 285 });
      });
    });

    nodes.forEach(n => {
      if (!targets.has(n.id)) targets.set(n.id, { x: n.pos.x, y: n.pos.y });
    });

    const firstRun = mm.layoutVersion !== 7;
    if (firstRun) {
      mm.layoutVersion = 7;
      [...nodes.values()].forEach((n, i) => {
        const t = targets.get(n.id);
        n.pos.x = Math.max(40, Math.min(stageWidth - n.w - 40, t.x + (((i * 37) % 80) - 40)));
        n.pos.y = Math.max(40, Math.min(stageHeight - n.h - 40, t.y + (((i * 61) % 70) - 35)));
        mm.positions[n.id] = { x: n.pos.x, y: n.pos.y };
        n.el.style.left = `${n.pos.x}px`;
        n.el.style.top = `${n.pos.y}px`;
      });
    }

    let frame = 0;
    const step = () => {
      if (mm.layoutFrozen) {
        state.animation = null;
        return;
      }
      frame++;
      let maxDelta = 0;
      nodes.forEach(n => {
        const t = targets.get(n.id);
        if (!t) return;
        const dx = t.x - n.pos.x, dy = t.y - n.pos.y;
        maxDelta = Math.max(maxDelta, Math.abs(dx), Math.abs(dy));
        n.pos.x += dx * 0.13;
        n.pos.y += dy * 0.13;
        mm.positions[n.id] = { x: n.pos.x, y: n.pos.y };
        n.el.style.left = `${n.pos.x}px`;
        n.el.style.top = `${n.pos.y}px`;
      });
      drawEdges(svg, cards, lib, nodes);
      if (frame < 90 && maxDelta > 0.5) {
        state.animation = requestAnimationFrame(step);
      } else {
        nodes.forEach(n => {
          const t = targets.get(n.id);
          if (!t) return;
          n.pos.x = t.x; n.pos.y = t.y;
          mm.positions[n.id] = { x: t.x, y: t.y };
          n.el.style.left = `${t.x}px`;
          n.el.style.top = `${t.y}px`;
        });
        drawEdges(svg, cards, lib, nodes);
        state.animation = null;
        if (typeof onSettled === "function") onSettled();
      }
    };
    state.animation = requestAnimationFrame(step);
  }

  async function init() {
    try {
      const response = await fetch("./manual-data.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.data = await response.json();
      render();
    } catch (err) {
      app.innerHTML = `<div style="padding:24px;font-family:Arial,sans-serif"><h2>UREA Manual failed to load</h2><pre>${String(err)}</pre></div>`;
    }
  }

  init();
})();
