/* Física em movimento — modelos contínuos em unidades SI.
 * Instalação: substitua somente este arquivo e style.css.
 * Os HTMLs e os caminhos de imagens/vídeos não são alterados.
 * 1ª lei: empurrão finito, atrito e câmera móvel; o relógio não termina.
 * 2ª lei: aceleração constante, sem limite de tempo ou distância.
 * 3ª lei: colisão elástica 1D, molas nos para-choques e forças simultâneas.
 */
(() => {
    "use strict";
    const EPS = 1e-10;
    const GREEN = "#245b4d";
    const COPPER = "#a54b2f";
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const $ = (root, selector) => root.querySelector(selector);
    const clamp = (x, min, max) => Math.max(min, Math.min(x, max));
    const fmt = (x, digits = 2) => {
        if (Math.abs(x) < 1e-10) x = 0;
        const absolute = Math.abs(x);
        const scientific = absolute >= 1e6 || (absolute > 0 && absolute < 0.01);
        return x.toLocaleString("pt-BR", {
            notation: scientific ? "scientific" : "standard",
            minimumFractionDigits: scientific ? 0 : digits,
            maximumFractionDigits: digits
        }).replace(/-/g, "−");
    };
    const text = (node, value) => {
        if (node.textContent !== value) node.textContent = value;
    };
    const value = (node, number, unit, digits = 2) => {
        node.dataset.raw = String(number);
        text(node, `${fmt(number, digits)}${unit ? " " + unit : ""}`);
    };
    const svgNode = (tag, attrs = {}) => {
        const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
        Object.entries(attrs).forEach(([key, val]) => node.setAttribute(key, val));
        return node;
    };
    const attr = (node, attrs) => {
        Object.entries(attrs).forEach(([key, val]) => node.setAttribute(key, val));
    };

    // Sem término automático, limite de distância ou avanço artificial para um
    // "quadro final". As integrações aceitam intervalos longos, inclusive ao
    // retornar a uma aba que o navegador deixou de desenhar.
    const createClock = (advance, render) => {
        let handle = null;
        let last = 0;
        let started = false;
        let paused = false;
        const flush = () => {
            if (!started || paused) return;
            const now = performance.now();
            const dt = Math.max(0, (now - last) / 1000);
            last = now;
            advance(dt);
        };
        const tick = () => {
            handle = null;
            if (!started || paused) return;
            flush();
            render();
            handle = requestAnimationFrame(tick);
        };
        const start = () => {
            if (started && !paused) { render(); return; }
            started = true;
            paused = false;
            last = performance.now();
            render();
            handle = requestAnimationFrame(tick);
        };
        const reset = () => {
            if (handle !== null) cancelAnimationFrame(handle);
            handle = null;
            started = false;
            paused = false;
            last = 0;
        };
        const toggle = () => {
            if (!started) return;
            if (paused) start();
            else {
                flush();
                paused = true;
                if (handle !== null) cancelAnimationFrame(handle);
                handle = null;
                render();
            }
        };
        return { start, reset, toggle, flush,
            get started() { return started; }, get paused() { return paused; } };
    };

    const numericControl = (parent, prefix, config, changed) => {
        const id = `${prefix}-${config.key}`;
        const unitSuffix = config.unit ? ` ${config.unit}` : "";
        const root = document.createElement("div");
        root.className = "range-control physics-number-control";
        root.innerHTML = `
            <div class="range-heading">
                <label for="${id}">${config.label}</label>
                <div class="physics-number-wrap">
                    <input id="${id}" type="number" inputmode="decimal" step="any"
                        min="${config.min}" max="${config.max}" value="${config.initial}"
                        data-control="${config.key}" aria-describedby="${id}-limit ${id}-error">
                    ${config.unit ? `<span aria-hidden="true">${config.unit}</span>` : ""}
                </div>
            </div>
            <input type="range" min="${config.min}" max="${config.max}" step="any"
                value="${config.initial}" data-slider="${config.key}"
                aria-label="Ajustar ${config.label.toLowerCase()} pelo controle deslizante">
            <p class="physics-limit" id="${id}-limit">${fmt(config.min, config.min % 1 ? 1 : 0)} a ${fmt(config.max, 0)}${unitSuffix}${config.unit ? "" : " · sem unidade"}</p>
            <p class="physics-error" id="${id}-error" role="alert" hidden></p>`;
        parent.append(root);
        const input = $(root, 'input[type="number"]');
        const range = $(root, 'input[type="range"]');
        const error = $(root, ".physics-error");
        let committed = config.initial;
        let valid = true;
        const commit = () => {
            const next = Number(input.value);
            valid = input.value.trim() !== "" && Number.isFinite(next)
                && next >= config.min && next <= config.max && !input.validity.badInput;
            input.setAttribute("aria-invalid", String(!valid));
            const errorText = `Digite um valor de ${fmt(config.min, config.min % 1 ? 1 : 0)} a ${fmt(config.max, 0)}${unitSuffix}. O valor inválido não é aplicado.`;
            input.setCustomValidity(valid ? "" : errorText);
            error.hidden = valid;
            if (!valid) {
                text(error, errorText);
                changed(false);
                return;
            }
            const different = next !== committed;
            committed = next;
            range.value = String(next);
            changed(different);
        };
        input.addEventListener("input", commit);
        input.addEventListener("change", commit);
        range.addEventListener("input", () => {
            input.value = String(Number(Number(range.value).toFixed(2)));
            commit();
        });
        return { input, range, get value() { return committed; }, get valid() { return valid; } };
    };

    const createUI = (simulation, options) => {
        const kind = simulation.dataset.simulation;
        const prefix = `physics-${kind}`;
        simulation.classList.add("physics-ready");
        simulation.setAttribute("aria-labelledby", `${prefix}-title`);
        // Somente o conteúdo da simulação é reconstruído. Nenhum elemento de
        // mídia, navegação ou conteúdo das leis é modificado.
        simulation.innerHTML = `
            <div class="simulation-heading">
                <p class="eyebrow">Simulação interativa · ${options.eyebrow}</p>
                <h2 id="${prefix}-title">${options.title}</h2>
                <p>${options.description}</p>
            </div>
            <div class="simulation-layout">
                <div class="simulation-scene">
                    <div class="scene-readout">
                        <div><span class="readout-label">${options.primaryLabel}</span>
                        <output class="readout-value" data-output="${options.primaryKey}" aria-live="off">0</output></div>
                        <span class="scene-tag">${options.tag}</span>
                    </div>
                    <div class="physics-status-row">
                        <span class="physics-status">Pronto</span>
                        <span class="physics-playback">Tempo contínuo</span>
                    </div>
                    <figure class="physics-stage">
                        <svg class="physics-world" aria-hidden="true" focusable="false"></svg>
                        <figcaption class="physics-camera">Escala fixa · posições em metros · sentido positivo →</figcaption>
                    </figure>
                    <div class="physics-legend">${options.legend}</div>
                    <dl class="physics-metrics">${options.metrics.map(([key, label]) =>
                        `<div class="physics-metric"><dt>${label}</dt><dd data-metric="${key}" aria-live="off">0</dd></div>`).join("")}</dl>
                    <p class="scene-message" data-output="message" role="status" aria-atomic="true"></p>
                    <p class="physics-summary">${options.summary}</p>
                </div>
                <div class="simulation-controls">
                    <div class="physics-fields"></div>
                    <div class="physics-extra"></div>
                    <div class="simulation-buttons">
                        <button type="button" data-action="apply">${options.action}</button>
                        <button type="button" class="button-secondary" data-action="pause" disabled>Pausar</button>
                        <button type="button" class="button-secondary" data-action="reset">Reiniciar</button>
                    </div>
                    <p class="control-hint">${options.hint}</p>
                    <div class="physics-view-controls">
                        <label class="physics-rate-label" for="${prefix}-rate">Velocidade da reprodução
                            <select id="${prefix}-rate" data-control="playback">
                                <option value="0.01">0,01× · valores muito altos</option>
                                <option value="0.05">0,05× · muito lenta</option>
                                <option value="0.1">0,1× · bem lenta</option>
                                <option value="0.25">0,25× · mais lenta</option>
                                <option value="0.5">0,5× · lenta</option>
                                <option value="1">1× · tempo real</option>
                                <option value="2">2× · rápida</option>
                            </select>
                        </label>
                        <label class="check-control"><input type="checkbox" data-control="reduced-motion">
                            <span>Ocultar animação (valores ao vivo)</span></label>
                    </div>
                    <details class="physics-model"><summary>Como este modelo funciona</summary><p>${options.model}</p></details>
                </div>
            </div>`;
        const fields = $(simulation, ".physics-fields");
        const inputs = {};
        let rate = options.rate || 1;
        const ui = {
            simulation, inputs,
            primary: $(simulation, ".readout-value"),
            primaryLabel: $(simulation, ".readout-label"),
            tag: $(simulation, ".scene-tag"),
            status: $(simulation, ".physics-status"),
            playback: $(simulation, ".physics-playback"),
            world: $(simulation, ".physics-world"),
            camera: $(simulation, ".physics-camera"),
            message: $(simulation, '[data-output="message"]'),
            summary: $(simulation, ".physics-summary"),
            extra: $(simulation, ".physics-extra"),
            apply: $(simulation, '[data-action="apply"]'),
            pause: $(simulation, '[data-action="pause"]'),
            reset: $(simulation, '[data-action="reset"]'),
            metrics: {}, onInput: () => {}, beforeRateChange: () => {}, onView: () => {},
            get rate() { return rate; },
            get valid() { return Object.values(inputs).every(control => control.valid); },
            get motionOff() { return motion.checked; }
        };
        options.controls.forEach(config => {
            inputs[config.key] = numericControl(fields, prefix, config, different => ui.onInput(different, config.key));
        });
        options.metrics.forEach(([key]) => { ui.metrics[key] = $(simulation, `[data-metric="${key}"]`); });
        const speedSelect = $(simulation, '[data-control="playback"]');
        speedSelect.value = String(rate);
        speedSelect.addEventListener("change", () => {
            ui.beforeRateChange();
            rate = Number(speedSelect.value);
            ui.onView();
        });
        const motion = $(simulation, '[data-control="reduced-motion"]');
        motion.checked = preference.matches;
        let chosenMotion = false;
        motion.addEventListener("change", () => { chosenMotion = true; ui.onView(); });
        preference.addEventListener("change", () => {
            if (!chosenMotion) { motion.checked = preference.matches; ui.onView(); }
        });
        ui.update = (clock, phase, label, message, actualRate = rate, disableApply = false) => {
            simulation.dataset.phase = clock.paused ? "paused" : phase;
            ui.status.dataset.phase = clock.paused ? "paused" : phase;
            text(ui.status, clock.paused ? "Pausado por você" : label);
            text(ui.playback, `${phase === "contact" ? "Contato em câmera lenta" : "Reprodução"}: ${fmt(actualRate, 2)}×`);
            ui.pause.disabled = !clock.started;
            text(ui.pause, clock.paused ? "Continuar" : "Pausar");
            ui.apply.disabled = !ui.valid || disableApply;
            ui.world.toggleAttribute("hidden", ui.motionOff);
            if (ui.motionOff) text(ui.camera, "Animação oculta: o relógio e os valores físicos continuam sendo atualizados.");
            text(ui.message, clock.paused ? "Você pausou a reprodução. Clique em Continuar para retomar do mesmo instante." : message);
        };
        return ui;
    };

    // Escala espacial constante: 64 px/m, chassis de 44 px. Não existe zoom.
    // Na colisão, duas câmeras independentes passam a acompanhar os corpos
    // depois que a separação já permite dividir a vista sem encolher os objetos.
    const createWorld = ui => {
        const svg = ui.world;
        const PX_PER_METRE = 64;
        const CHASSIS_WIDTH = 44;
        const GAP = 16;
        const prefix = `view-${ui.simulation.dataset.simulation}`;
        const defs = svgNode("defs");
        svg.append(defs);
        const makeView = name => {
            const id = `${prefix}-${name}`;
            const clip = svgNode("clipPath", { id, clipPathUnits: "userSpaceOnUse" });
            const clipRect = svgNode("rect", { y: 0, height: 222 });
            clip.append(clipRect);
            defs.append(clip);
            const root = svgNode("g", { "clip-path": `url(#${id})`, "data-view": name });
            const grid = svgNode("g", { class: "physics-grid" });
            const ground = svgNode("line", { class: "physics-ground", y1: 176, y2: 176 });
            const actors = svgNode("g");
            root.append(grid, ground, actors);
            svg.append(root);
            const ticks = Array.from({ length: 24 }, () => {
                const group = svgNode("g");
                const line = svgNode("line", { y1: 30, y2: 183 });
                const caption = svgNode("text", { y: 205, "text-anchor": "middle" });
                group.append(line, caption);
                grid.append(group);
                return { group, line, caption };
            });
            return { root, clipRect, ground, actors, ticks, project: x => x };
        };
        const views = { full: makeView("full"), a: makeView("a"), b: makeView("b") };
        const divider = svgNode("g", { class: "physics-split-divider" });
        const seam = svgNode("rect", { y: 0, height: 222, width: GAP });
        const labelA = svgNode("text", { y: 16, "text-anchor": "middle", class: "physics-view-label" });
        const labelB = svgNode("text", { y: 16, "text-anchor": "middle", class: "physics-view-label" });
        text(labelA, "Câmera A");
        text(labelB, "Câmera B");
        divider.append(seam, labelA, labelB);
        svg.append(divider);
        const vectors = svgNode("g");
        svg.append(vectors);
        const actors = new Map();
        const arrows = new Map();
        let width = 500;
        let mode = "single";
        let compression = 0;

        const measure = () => {
            width = Math.max(180, svg.getBoundingClientRect().width || $(ui.simulation, ".simulation-scene").clientWidth - 44);
            attr(svg, { viewBox: `0 0 ${width} 222` });
            svg.dataset.scale = String(PX_PER_METRE);
        };
        const configure = (view, left, viewWidth, centre, split = false) => {
            view.root.style.display = "";
            attr(view.clipRect, { x: left, width: viewWidth });
            attr(view.ground, { x1: left, x2: left + viewWidth });
            const screenCentre = left + viewWidth / 2;
            view.project = x => screenCentre + (x - centre) * PX_PER_METRE;
            const first = Math.floor(centre - viewWidth / (2 * PX_PER_METRE));
            const labelWidth = fmt(centre, 0).length * 6 + 15;
            const every = labelWidth <= 58 ? 1 : labelWidth <= 118 ? 2 : 5;
            view.ticks.forEach((tick, i) => {
                const worldX = first + i;
                const x = view.project(worldX);
                tick.group.style.display = x >= left && x <= left + viewWidth ? "" : "none";
                attr(tick.line, { x1: x, x2: x, y1: split ? 30 : 18 });
                attr(tick.caption, { x });
                tick.caption.style.display = x > left + 25 && x < left + viewWidth - 25 && worldX % every === 0 ? "" : "none";
                text(tick.caption, `${fmt(worldX, 0)} m`);
            });
        };
        const show = nextMode => {
            mode = nextMode;
            svg.dataset.mode = mode;
            views.full.root.style.display = mode === "split" ? "none" : "";
            views.a.root.style.display = views.b.root.style.display = mode === "split" ? "" : "none";
            divider.style.display = mode === "split" ? "" : "none";
        };
        const single = position => {
            measure();
            show("single");
            const start = 60;
            const followAt = clamp(width * 0.65, 110, width - 90);
            const cameraLeft = Math.max(-start / PX_PER_METRE, position - followAt / PX_PER_METRE);
            const centre = cameraLeft + width / (2 * PX_PER_METRE);
            configure(views.full, 0, width, centre);
            svg.dataset.camera = String(cameraLeft);
            text(ui.camera, "Escala fixa · a pista passa quando a câmera acompanha o objeto · posições em metros.");
        };
        const pair = (xA, xB, phase, deformation = 0) => {
            measure();
            compression = deformation;
            const distance = Math.abs(xB - xA);
            const paneWidth = (width - GAP) / 2;
            // Nesse ponto os corpos já estão praticamente nos centros das duas
            // vistas. A troca não precisa alterar tamanho nem escala espacial.
            const split = phase === "separated" && distance * PX_PER_METRE >= (width + GAP) / 2;
            show(split ? "split" : "shared");
            if (split) {
                configure(views.a, 0, paneWidth, xA, true);
                configure(views.b, paneWidth + GAP, paneWidth, xB, true);
                attr(seam, { x: paneWidth });
                attr(labelA, { x: paneWidth / 2 });
                attr(labelB, { x: paneWidth + GAP + paneWidth / 2 });
                text(ui.camera, `Duas câmeras independentes, na mesma escala · distância entre os centros: ${fmt(distance)} m.`);
            } else {
                configure(views.full, 0, width, (xA + xB) / 2);
                text(ui.camera, "Vista conjunta · escala fixa, sem zoom · só as molas dos para-choques se comprimem.");
            }
        };
        const viewFor = key => mode === "split" ? views[key === "a" || key === "on-a" ? "a" : "b"] : views.full;
        const body = (key, worldX, label, color, cart = false) => {
            let actor = actors.get(key);
            if (!actor) {
                const group = svgNode("g", { "data-body": key });
                const rect = svgNode("rect", { rx: 4, stroke: "#173e36", "stroke-width": 1, "data-part": "chassis" });
                const makeWheel = () => {
                    const wheel = svgNode("g");
                    const circle = svgNode("circle", { r: 4.5, fill: "#173e36" });
                    const spoke = svgNode("line", { x1: -3, x2: 3, y1: 0, y2: 0, stroke: "#c3d4c7", "stroke-width": 1.2 });
                    wheel.append(circle, spoke);
                    return wheel;
                };
                const wheelA = makeWheel(), wheelB = makeWheel();
                const bumper = svgNode("g", { "data-part": "bumper" });
                const spring = svgNode("path", { fill: "none", stroke: "#596866", "stroke-width": 1.4 });
                const plate = svgNode("line", { y1: 143, y2: 158, stroke: "#173e36", "stroke-width": 2.2 });
                bumper.append(spring, plate);
                const caption = svgNode("text", { "text-anchor": "middle", class: "physics-body-label" });
                group.append(rect, wheelA, wheelB, bumper, caption);
                actor = { group, rect, wheelA, wheelB, bumper, spring, plate, caption };
                actors.set(key, actor);
            }
            const view = viewFor(key);
            if (actor.group.parentNode !== view.actors) view.actors.append(actor.group);
            const x = view.project(worldX);
            attr(actor.group, { transform: `translate(${x} 0)`, "data-position": worldX });
            attr(actor.rect, { x: -CHASSIS_WIDTH / 2, y: cart ? 134 : 138, width: CHASSIS_WIDTH, height: cart ? 33 : 38, fill: color });
            actor.wheelA.style.display = actor.wheelB.style.display = cart ? "" : "none";
            const angle = ((worldX * PX_PER_METRE) % (2 * Math.PI * 4.5)) / 4.5 * 180 / Math.PI;
            attr(actor.wheelA, { transform: `translate(-12.32 171) rotate(${angle})` });
            attr(actor.wheelB, { transform: `translate(12.32 171) rotate(${angle})` });
            const collisionBody = key === "a" || key === "b";
            actor.bumper.style.display = collisionBody ? "" : "none";
            if (collisionBody) {
                const direction = key === "a" ? 1 : -1;
                const start = direction * CHASSIS_WIDTH / 2;
                const length = Math.max(1, (PX_PER_METRE * (1 - compression) - CHASSIS_WIDTH) / 2);
                const end = start + direction * length;
                attr(actor.spring, { d: `M ${start} 150.5 L ${start + direction * length * 0.25} 147.5 L ${start + direction * length * 0.5} 153.5 L ${start + direction * length * 0.75} 147.5 L ${end} 150.5` });
                attr(actor.plate, { x1: end, x2: end });
            }
            attr(actor.caption, { x: 0, y: cart ? 156 : 162, fill: "#fffefa" });
            text(actor.caption, label);
            return x;
        };
        const vector = (key, worldX, force, maximum, label, color, y = 48, align = "middle") => {
            let arrow = arrows.get(key);
            if (!arrow) {
                const group = svgNode("g", { "data-vector": key });
                const guide = svgNode("line", { class: "physics-vector-guide" });
                const line = svgNode("line", { "stroke-width": 2.5, "stroke-linecap": "round" });
                const head = svgNode("path");
                const caption = svgNode("text", { class: "physics-vector-label" });
                group.append(guide, line, head, caption);
                vectors.append(group);
                arrow = { group, guide, line, head, caption };
                arrows.set(key, arrow);
            }
            arrow.group.dataset.force = String(force);
            arrow.group.style.display = Math.abs(force) > EPS ? "" : "none";
            if (Math.abs(force) <= EPS) return;
            const x = viewFor(key).project(worldX);
            const length = Math.min(72, width * 0.2) * Math.min(1, Math.abs(force) / Math.max(maximum, EPS));
            const direction = Math.sign(force);
            const end = x + direction * length;
            const tip = Math.min(6, length * 0.4);
            arrow.group.dataset.length = String(length);
            attr(arrow.guide, { x1: x, x2: x, y1: y + 8, y2: 128 });
            attr(arrow.line, { x1: x, x2: end - direction * tip * 0.5, y1: y, y2: y, stroke: color });
            attr(arrow.head, { d: `M ${end} ${y} L ${end - direction * tip} ${y - tip * 0.65} L ${end - direction * tip} ${y + tip * 0.65} Z`, fill: color });
            const estimate = label.length * 5.7;
            const labelX = align === "end" ? clamp(x - 4, estimate + 3, width - 3)
                : align === "start" ? clamp(x + 4, 3, width - estimate - 3)
                : clamp((x + end) / 2, estimate / 2 + 3, width - estimate / 2 - 3);
            attr(arrow.caption, { x: labelX, y: y - 11, "text-anchor": align, fill: color });
            text(arrow.caption, label);
        };
        return { single, pair, body, vector };
    };
    const connect = (ui, clock, render, reset) => {
        ui.pause.addEventListener("click", clock.toggle);
        ui.reset.addEventListener("click", reset);
        ui.beforeRateChange = clock.flush;
        ui.onView = render;
        if ("ResizeObserver" in window) new ResizeObserver(render).observe($(ui.simulation, ".simulation-scene"));
        else window.addEventListener("resize", render);
    };
    const forceControl = (initial = 10) => ({ key: "force", label: "Força aplicada", unit: "N", min: 0, max: 1000, initial });
    const massControl = (key = "mass", label = "Massa do objeto", initial = 2) => ({ key, label, unit: "kg", min: 0.1, max: 1000, initial });

    const initializeInertia = simulation => {
        const MASS = 2;
        const GRAVITY = 9.8;
        const ui = createUI(simulation, {
            eyebrow: "1ª lei", title: "O movimento continua?",
            description: "Escolha o coeficiente de atrito μ e compare: depois do empurrão, o corpo mantém a velocidade sem atrito ou desacelera quando há atrito.",
            primaryKey: "speed", primaryLabel: "Velocidade", tag: "Massa: 2 kg",
            legend: '<span class="physics-key-green">→ Empurrão</span><span class="physics-key-copper">← Atrito</span>',
            metrics: [["time", "Tempo físico"], ["position", "Deslocamento"], ["net-force", "Força resultante"]],
            controls: [
                { ...forceControl(4), label: "Força do empurrão" },
                { key: "mu", label: "Coeficiente de atrito (μ)", unit: "", min: 0, max: 1, initial: 0.1 }
            ], action: "Empurrar",
            hint: "μ = 0 significa sem atrito. Você pode mudar μ durante o movimento, sem reiniciar o relógio. Cada empurrão dura 0,5 s; para sair do repouso, ele precisa superar μ · m · g.",
            summary: "A câmera acompanha o objeto; não há parede nem limite de distância. As setas mostram apenas forças que estão atuando.",
            model: "Corpo de 2 kg sobre uma superfície horizontal, com g = 9,8 m/s². A força normal é m · g = 19,6 N. O coeficiente μ não tem unidade; durante o deslizamento, a intensidade do atrito é μ · m · g. Em repouso, o atrito estático se ajusta ao empurrão até esse limite, em vez de agir sempre com a intensidade máxima. Para simplificar, este modelo usa o mesmo μ para o atrito cinético e para o limite estático. A faixa de 0 a 1 é uma escolha didática; coeficientes reais podem ser maiores que 1. μ = 0 ou a caixa desmarcada eliminam o atrito. Alterar μ ou a caixa tem efeito imediato e não reinicia o movimento. Cada empurrão dura 0,5 s; alterar sua força vale para o próximo empurrão. Peso e normal se equilibram. O atrito não inverte o sentido do movimento. A escala fica fixa e o relógio continua após a parada."
        });
        ui.extra.innerHTML = '<label class="check-control"><input type="checkbox" data-control="friction" checked><span>Superfície com atrito</span></label>';
        const friction = $(ui.extra, "input");
        ui.summary.innerHTML = '<strong>Atrito atuando agora: <output data-output="friction-force" aria-live="off">0,00 N</output></strong><br><span data-output="friction-details"></span>';
        const frictionOutput = $(ui.summary, '[data-output="friction-force"]');
        const frictionDetails = $(ui.summary, '[data-output="friction-details"]');
        ui.apply.dataset.action = "push";
        const world = createWorld(ui);
        let state;
        let clock;
        const forces = () => {
            const applied = state.remaining > EPS ? state.pushForce : 0;
            const limit = state.mu * MASS * GRAVITY;
            const frictionForce = !state.friction ? 0 : state.v > EPS ? limit : Math.min(applied, limit);
            return { applied, friction: frictionForce, limit, net: applied - frictionForce };
        };
        const render = () => {
            const f = forces();
            const acceleration = f.net / MASS;
            const pushing = state.remaining > EPS;
            value(ui.primary, state.v, "m/s");
            value(ui.metrics.time, state.t, "s");
            value(ui.metrics.position, state.x, "m");
            value(ui.metrics["net-force"], f.net, "N");
            value(frictionOutput, f.friction, "N");
            ui.summary.dataset.mu = String(state.mu);
            ui.summary.dataset.limit = String(f.limit);
            const muText = state.mu.toLocaleString("pt-BR", {
                notation: state.mu > 0 && state.mu < 0.0001 ? "scientific" : "standard",
                maximumSignificantDigits: 6
            });
            text(frictionDetails, state.friction
                ? `μ · m · g ≈ ${muText} × 2 × 9,8 ≈ ${fmt(f.limit)} N. ${state.mu === 0 ? "μ = 0: superfície ideal sem atrito." : "Esse é o atrito ao deslizar e o limite estático deste modelo. Em repouso, o atrito pode ser menor."}`
                : `Atrito desligado pela caixa. O coeficiente escolhido (${muText}) está guardado; ao ligar, μ · m · g ≈ ${fmt(f.limit)} N.`);
            const resisting = f.friction > EPS;
            const phase = pushing ? "pushing" : state.v > EPS ? "moving" : "rest";
            const label = pushing ? "Empurrão em andamento" : state.v > EPS ? (resisting ? "Desacelerando" : "Velocidade constante") : "Em repouso";
            const message = pushing
                ? f.applied <= EPS
                    ? (resisting ? "O empurrão é de 0 N. Só o atrito reduz a velocidade." : "Um empurrão de 0 N não altera o movimento do corpo.")
                    : f.net > EPS ? "A força resultante acelera o objeto para a direita."
                    : state.v > EPS
                        ? (f.net < -EPS ? "O atrito supera o empurrão: o objeto perde velocidade mesmo enquanto a força é aplicada." : "Empurrão e atrito se equilibram: o corpo mantém sua velocidade.")
                        : "O atrito estático equilibra esse empurrão: ele não é suficiente para tirar o objeto do repouso."
                : state.v > EPS
                    ? (resisting ? "Só o atrito atua na horizontal. A velocidade diminui até chegar a zero." : "Empurrão encerrado e resultante nula: o objeto segue em movimento, sem prazo para parar.")
                    : clock.started ? "O objeto está parado, mas o relógio continua. Reduzir ou desligar o atrito não o faz sair do repouso; dê um novo empurrão." : "Escolha a força e o coeficiente μ, depois empurre. Compare μ = 0 com valores maiores.";
            ui.update(clock, phase, label, message, ui.rate, pushing || clock.paused);
            text(ui.apply, pushing ? "Empurrando…" : "Empurrar");
            if (!ui.motionOff) {
                world.single(state.x, state.v, acceleration);
                world.body("object", state.x, "m", COPPER);
                const scale = Math.max(10, f.applied, f.friction);
                world.vector("applied", state.x, f.applied, scale, `Empurrão: ${fmt(f.applied, 1)} N`, GREEN, 46);
                world.vector("friction", state.x, -f.friction, scale, `Atrito: ${fmt(f.friction)} N`, COPPER, 98);
            }
        };
        const advance = realDt => {
            let dt = realDt * ui.rate;
            state.t += dt;
            // Integra exatamente cada trecho de aceleração constante, inclusive
            // o fim do empurrão e o instante de parada, sem v negativa artificial.
            while (dt > EPS) {
                const acceleration = forces().net / MASS;
                let step = Math.min(dt, state.remaining > EPS ? state.remaining : Infinity);
                if (acceleration < 0 && state.v > EPS) step = Math.min(step, state.v / -acceleration);
                state.x += state.v * step + 0.5 * acceleration * step * step;
                state.v = Math.max(0, state.v + acceleration * step);
                if (state.v < EPS) state.v = 0;
                state.remaining = Math.max(0, state.remaining - step);
                if (state.remaining < EPS) state.remaining = 0;
                dt -= step;
            }
        };
        clock = createClock(advance, render);
        const reset = () => {
            clock.reset();
            state = { t: 0, x: 0, v: 0, remaining: 0, pushForce: 0, friction: friction.checked, mu: ui.inputs.mu.value };
            render();
        };
        ui.apply.addEventListener("click", () => {
            if (!ui.valid || clock.paused || state.remaining > EPS) return;
            clock.flush();
            state.pushForce = ui.inputs.force.value;
            state.remaining = 0.5;
            clock.start();
        });
        friction.addEventListener("change", () => {
            clock.flush();
            state.friction = friction.checked;
            render();
        });
        ui.onInput = (different, key) => {
            if (different && key === "mu") {
                // Integra até este instante com o μ anterior antes de aplicar o
                // novo valor; a posição, a velocidade e o relógio são preservados.
                clock.flush();
                state.mu = ui.inputs.mu.value;
            }
            render();
        };
        reset();
        connect(ui, clock, render, reset);
    };

    const initializeForce = simulation => {
        const ui = createUI(simulation, {
            eyebrow: "2ª lei", title: "Força, massa e aceleração",
            description: "Digite seus próprios valores. A força continua atuando e o carrinho segue em frente, sem congelar o tempo.",
            primaryKey: "acceleration", primaryLabel: "Aceleração prevista", tag: "Sem atrito",
            legend: '<span class="physics-key-green">→ Força resultante horizontal</span>',
            metrics: [["time", "Tempo físico"], ["position", "Deslocamento"], ["speed", "Velocidade"]],
            controls: [forceControl(), massControl()], action: "Aplicar força",
            hint: "Força: 0 a 1.000 N. Massa: 0,1 a 1.000 kg. Alterar um valor válido prepara um novo ensaio; clique em Aplicar força. Valores fora da faixa são recusados.",
            summary: "F = m · a. Quilogramas medem massa, não peso. A câmera acompanha o corpo sem zoom: o tamanho do objeto e o espaçamento da régua permanecem constantes.",
            model: "O corpo parte do repouso, tem massa constante e recebe força horizontal constante, sem atrito: a = F/m, v = a·t e Δx = a·t²/2. Não existe fim de pista nem duração máxima: o relógio e o movimento seguem até você pausar ou reiniciar. Peso e normal se equilibram. O tamanho da seta é adaptado à cena; a intensidade exata é mostrada em newtons. Para valores muito grandes, use a reprodução mais lenta."
        });
        const world = createWorld(ui);
        let state;
        let clock;
        const render = () => {
            const f = ui.inputs.force.value;
            const m = ui.inputs.mass.value;
            const a = f / m;
            const v = a * state.t;
            const x = 0.5 * a * state.t ** 2;
            value(ui.primary, a, "m/s²");
            text(ui.primaryLabel, clock.started ? "Aceleração" : "Aceleração prevista");
            text(ui.tag, `${fmt(f, 1)} N ÷ ${fmt(m, 1)} kg`);
            value(ui.metrics.time, state.t, "s");
            value(ui.metrics.position, x, "m");
            value(ui.metrics.speed, v, "m/s");
            ui.update(clock, clock.started ? (f ? "moving" : "rest") : "idle",
                clock.started ? (f ? "Aceleração constante" : "Força nula · em repouso") : "Prévia dos valores",
                !clock.started ? "A seta mostra a força configurada. Clique em Aplicar força para começar do repouso."
                    : f ? "O carrinho continua acelerando. A pista se desloca porque a câmera o acompanha, sem mudar a escala, parar o relógio ou reiniciar a posição."
                        : "Com força nula e velocidade inicial nula, o corpo permanece parado. O tempo continua correndo.");
            text(ui.apply, clock.started ? "Repetir ensaio" : "Aplicar força");
            if (!ui.motionOff) {
                world.single(x, v, a);
                world.body("object", x, "m", GREEN, true);
                world.vector("resultant", x, f, Math.max(10, f), `ΣF = ${fmt(f, 1)} N`, GREEN, 58);
            }
        };
        clock = createClock(dt => { state.t += dt * ui.rate; }, render);
        const reset = () => { clock.reset(); state = { t: 0 }; render(); };
        ui.apply.addEventListener("click", () => { if (ui.valid) { reset(); clock.start(); } });
        ui.onInput = different => { if (different) reset(); else render(); };
        reset();
        connect(ui, clock, render, reset);
    };

    // Colisão elástica de dois corpos em 1D, ligados apenas durante o contato
    // por uma mola ideal. Solução analítica no referencial do centro de massa.
    // A rigidez é escolhida antes de cada ensaio para limitar a compressão e
    // evitar que os corpos atravessem um ao outro mesmo nos valores extremos.
    const collisionModel = (massA, massB, speedA, speedB) => {
        const uA = speedA;
        const uB = -speedB;
        const relative = uA - uB;
        const total = massA + massB;
        const reduced = massA * massB / total;
        const centreVelocity = (massA * uA + massB * uB) / total;
        const contactTime = relative > EPS ? 2 / relative : Infinity;
        const omega = Math.max(Math.PI / 0.8, relative / 0.24);
        const duration = Math.PI / omega;
        const stiffness = reduced * omega * omega;
        const peakForce = reduced * omega * relative;
        const xAc = Number.isFinite(contactTime) ? -1.5 + uA * contactTime : -1.5;
        const xBc = Number.isFinite(contactTime) ? 1.5 + uB * contactTime : 1.5;
        const centreAtContact = (massA * xAc + massB * xBc) / total;
        const finalA = centreVelocity - massB / total * relative;
        const finalB = centreVelocity + massA / total * relative;
        const sample = t => {
            if (t < contactTime) return {
                phase: relative > EPS ? "approach" : "rest", xA: -1.5 + uA * t, xB: 1.5 + uB * t,
                vA: uA, vB: uB, force: 0, compression: 0,
                energy: 0.5 * massA * uA ** 2 + 0.5 * massB * uB ** 2
            };
            const elapsed = t - contactTime;
            if (elapsed < duration) {
                const angle = omega * elapsed;
                const compression = relative / omega * Math.sin(angle);
                const separation = 1 - compression;
                const centre = centreAtContact + centreVelocity * elapsed;
                const vA = centreVelocity + massB / total * relative * Math.cos(angle);
                const vB = centreVelocity - massA / total * relative * Math.cos(angle);
                return { phase: "contact", xA: centre - massB / total * separation,
                    xB: centre + massA / total * separation, vA, vB,
                    force: Math.max(0, stiffness * compression), compression,
                    energy: 0.5 * massA * vA ** 2 + 0.5 * massB * vB ** 2 + 0.5 * stiffness * compression ** 2 };
            }
            const centre = centreAtContact + centreVelocity * duration;
            const after = elapsed - duration;
            return { phase: "separated", xA: centre - massB / total + finalA * after,
                xB: centre + massA / total + finalB * after, vA: finalA, vB: finalB,
                force: 0, compression: 0,
                energy: 0.5 * massA * finalA ** 2 + 0.5 * massB * finalB ** 2 };
        };
        return { sample, contactTime, duration, peakForce, relative };
    };

    const initializeCollision = simulation => {
        const ui = createUI(simulation, {
            eyebrow: "3ª lei", title: "Colisão: ação e reação",
            description: "Faça os corpos se aproximarem e colidirem. Durante o contato, cada um exerce uma força igual e oposta sobre o outro.",
            primaryKey: "forces", primaryLabel: "Intensidade da força em cada corpo", tag: "Colisão elástica · sem atrito",
            legend: '<span class="physics-key-copper">← B exerce força em A</span><span class="physics-key-green">A exerce força em B →</span>',
            metrics: [["time", "Tempo físico"], ["speed-a", "Velocidade de A"], ["speed-b", "Velocidade de B"],
                ["acceleration-a", "Aceleração de A"], ["acceleration-b", "Aceleração de B"], ["momentum", "Momento total"]],
            controls: [massControl("mass-a", "Massa de A", 1), massControl("mass-b", "Massa de B", 1),
                { key: "speed-a", label: "Velocidade inicial de A →", unit: "m/s", min: 0, max: 20, initial: 2 },
                { key: "speed-b", label: "Velocidade inicial de B ←", unit: "m/s", min: 0, max: 20, initial: 2 }],
            action: "Iniciar colisão", rate: 0.5,
            hint: "Experimente massas de 1 kg e 100 kg. O contato aparece em câmera lenta, sem parar o relógio. Alterar um valor válido prepara um novo ensaio.",
            summary: "Forças só durante o contato: B age em A para a esquerda e A age em B para a direita. Mesmo com massas diferentes, as duas setas têm o mesmo comprimento.",
            model: "Colisão elástica unidimensional, sem atrito. As velocidades iniciais são escolhidas por você. Os centros começam separados por 3 m. Molas ideais nos para-choques representam o contato: as forças são iguais e opostas e variam ao longo do choque. A rigidez limita a compressão total das molas a 0,24 m, sem deformar o chassis dos carrinhos; não representa um material específico. Conservam-se o momento total e a energia (cinética + elástica durante o contato). Fora do contato, as forças horizontais são zero. A força não é escolhida independentemente: é calculada a partir das massas, das velocidades e do modelo de contato, podendo superar 1.000 N. A reprodução desacelera no contato para mostrar as setas, mas o tempo físico continua avançando. Não há zoom: os carrinhos mantêm o tamanho. Quando se afastam, duas vistas identificadas como Câmera A e Câmera B acompanham cada corpo na mesma escala. Essas duas vistas não representam um único trecho contínuo da pista. A distância física aparece abaixo do desenho; os corpos não param nas bordas."
        });
        const world = createWorld(ui);
        let state;
        let model;
        let clock;
        const contactRate = () => Math.min(ui.rate, model.duration / 1.4);
        const render = () => {
            const s = model.sample(state.t);
            const mA = ui.inputs["mass-a"].value;
            const mB = ui.inputs["mass-b"].value;
            value(ui.primary, s.force, "N");
            value(ui.metrics.time, state.t, "s");
            value(ui.metrics["speed-a"], s.vA, "m/s");
            value(ui.metrics["speed-b"], s.vB, "m/s");
            value(ui.metrics["acceleration-a"], -s.force / mA, "m/s²");
            value(ui.metrics["acceleration-b"], s.force / mB, "m/s²");
            value(ui.metrics.momentum, mA * s.vA + mB * s.vB, "kg·m/s");
            ui.world.dataset.energy = String(s.energy);
            const label = !clock.started ? "Pronto para colidir" : s.phase === "approach" ? "Aproximação" : s.phase === "contact" ? "Contato · forças em pares" : s.phase === "rest" ? "Em repouso" : "Após a colisão";
            const message = !clock.started ? "Escolha as massas e as velocidades de aproximação. As setas surgem somente quando há contato."
                : s.phase === "approach" ? "Os corpos se aproximam com velocidades constantes. Ainda não há força de contato."
                : s.phase === "contact" ? "Contato em câmera lenta: as forças são simultâneas, de mesma intensidade e sentidos opostos. As acelerações dependem das massas."
                : s.phase === "rest" ? "As duas velocidades iniciais são zero. Não há colisão espontânea, mas o relógio continua."
                : "Contato encerrado: as forças são zero. Os corpos se afastam um do outro com suas novas velocidades; o tempo e a animação continuam.";
            ui.update(clock, !clock.started ? "idle" : s.phase, label, message, s.phase === "contact" ? contactRate() : ui.rate);
            text(ui.apply, clock.started ? "Repetir colisão" : "Iniciar colisão");
            if (!ui.motionOff) {
                world.pair(s.xA, s.xB, s.phase, s.compression);
                world.body("a", s.xA, "A", COPPER, true);
                world.body("b", s.xB, "B", GREEN, true);
                world.vector("on-a", s.xA, -s.force, model.peakForce, `B→A: ${fmt(-s.force, 1)} N`, COPPER, 52, "end");
                world.vector("on-b", s.xB, s.force, model.peakForce, `A→B: ${fmt(s.force, 1)} N`, GREEN, 52, "start");
            }
        };
        const advance = realDt => {
            // Separa os eventos exatamente. Mesmo um quadro muito longo não
            // atravessa o contato sem aplicar a solução física correspondente.
            let remaining = realDt;
            for (let i = 0; remaining > EPS && i < 4; i++) {
                let boundary = Infinity;
                let rate = ui.rate;
                if (state.t < model.contactTime - EPS) boundary = model.contactTime;
                else if (state.t < model.contactTime + model.duration - EPS) {
                    boundary = model.contactTime + model.duration;
                    rate = contactRate();
                }
                const realStep = Math.min(remaining, (boundary - state.t) / rate);
                state.t += realStep * rate;
                remaining -= realStep;
                if (Number.isFinite(boundary) && Math.abs(state.t - boundary) < EPS) state.t = boundary;
            }
        };
        clock = createClock(advance, render);
        const reset = () => {
            clock.reset();
            state = { t: 0 };
            model = collisionModel(ui.inputs["mass-a"].value, ui.inputs["mass-b"].value,
                ui.inputs["speed-a"].value, ui.inputs["speed-b"].value);
            render();
        };
        ui.apply.addEventListener("click", () => { if (ui.valid) { reset(); clock.start(); } });
        ui.onInput = different => { if (different) reset(); else render(); };
        reset();
        connect(ui, clock, render, reset);
    };

    const initializers = { inertia: initializeInertia, force: initializeForce, "action-reaction": initializeCollision };
    document.querySelectorAll("[data-simulation]").forEach(simulation => {
        if (simulation.classList.contains("physics-ready")) return;
        const initialize = initializers[simulation.dataset.simulation];
        if (initialize) initialize(simulation);
    });
})();
