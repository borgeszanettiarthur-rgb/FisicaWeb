(() => {
    const formatNumber = (value, digits = 1) => value.toLocaleString("pt-BR", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Em uma animação, o primeiro quadro precisa receber um delta pequeno e fixo.
    // performance.now() pode ser maior que o timestamp do requestAnimationFrame e
    // gerar um delta enorme (ou negativo) no primeiro passo.
    const firstDelta = 1 / 60;

    const initializeInertia = (simulation) => {
        const laneFree = {
            track: simulation.querySelector('[data-role="track-free"]'),
            object: simulation.querySelector('[data-role="object-free"]'),
            speed: simulation.querySelector('[data-output="speed-free"]')
        };
        const laneFriction = {
            track: simulation.querySelector('[data-role="track-friction"]'),
            object: simulation.querySelector('[data-role="object-friction"]'),
            speed: simulation.querySelector('[data-output="speed-friction"]')
        };
        const forceFree = simulation.querySelector('[data-output="force-free"]');
        const forceFriction = simulation.querySelector('[data-output="force-friction"]');
        const showForceInput = simulation.querySelector('[data-control="show-force"]');
        const messageOutput = simulation.querySelector('[data-output="message"]');

        const MASS = 2;          // kg
        const PUSH = 4;          // N
        const PUSH_TIME = 0.5;   // s
        const FRICTION_DECEL = 0.9; // m/s²
        const TRACK_METERS = 5;  // comprimento de pista mostrado na cena

        const state = {
            freePosition: 0,
            freeVelocity: 0,
            frictionPosition: 0,
            frictionVelocity: 0,
            previousTime: 0,
            frame: 0
        };

        const percent = (position) => Math.min(position / TRACK_METERS, 1);

        const render = () => {
            const freeRange = Math.max(0, laneFree.track.clientWidth - laneFree.object.offsetWidth);
            const frictionRange = Math.max(0, laneFriction.track.clientWidth - laneFriction.object.offsetWidth);
            laneFree.object.style.transform = `translateX(${percent(state.freePosition) * freeRange}px)`;
            laneFriction.object.style.transform = `translateX(${percent(state.frictionPosition) * frictionRange}px)`;
            laneFree.speed.textContent = `${formatNumber(state.freeVelocity)} m/s`;
            laneFriction.speed.textContent = `${formatNumber(state.frictionVelocity)} m/s`;
        };

        const stop = () => {
            cancelAnimationFrame(state.frame);
            state.frame = 0;
            state.previousTime = 0;
        };

        const finish = (messages) => {
            messageOutput.textContent = messages;
            render();
            stop();
        };

        const animate = (time) => {
            const elapsed = state.previousTime
                ? Math.min(Math.max((time - state.previousTime) / 1000, 0), 0.05)
                : firstDelta;
            state.previousTime = time;

            // Sem atrito: nenhuma força resultante age, então a velocidade não muda.
            state.freePosition = Math.min(TRACK_METERS, state.freePosition + state.freeVelocity * elapsed);

            // Com atrito: a força resultante (atrito) é contrária ao movimento e freia o corpo.
            state.frictionVelocity = Math.max(0, state.frictionVelocity - FRICTION_DECEL * elapsed);
            state.frictionPosition = Math.min(TRACK_METERS, state.frictionPosition + state.frictionVelocity * elapsed);
            render();

            const freeArrived = state.freePosition >= TRACK_METERS;
            const frictionStopped = state.frictionVelocity <= 0.01 && state.frictionPosition > 0;

            if (freeArrived && frictionStopped) {
                finish(`O corpo sem atrito percorreu a pista mantendo ${formatNumber(state.freeVelocity)} m/s, enquanto o outro parou em ${formatNumber(state.frictionPosition)} m.`);
            } else if (frictionStopped) {
                finish("O corpo com atrito parou. O outro continua em movimento retilíneo uniforme: ΣF = 0, então v é constante.");
            } else if (freeArrived) {
                finish("O corpo sem atrito chegou ao fim da pista sem perder velocidade.");
            } else {
                state.frame = requestAnimationFrame(animate);
            }
        };

        const applyPush = () => {
            // Impulso: F · Δt = m · Δv  =>  Δv = 4 · 0,5 / 2 = 1,0 m/s (igual para os dois)
            const deltaV = (PUSH * PUSH_TIME) / MASS;
            state.freeVelocity += deltaV;
            state.frictionVelocity += deltaV;
            messageOutput.textContent = "Mesmo empurrão: os dois saem com 1,0 m/s. Agora observe qual mantém a velocidade.";
            if (!state.frame) {
                state.previousTime = 0;
                state.frame = requestAnimationFrame(animate);
            }
            render();
        };

        const reset = () => {
            stop();
            state.freePosition = 0;
            state.freeVelocity = 0;
            state.frictionPosition = 0;
            state.frictionVelocity = 0;
            messageOutput.textContent = "Os dois corpos estão em repouso. Empurre os dois ao mesmo tempo.";
            render();
        };

        const syncForce = () => {
            const visible = showForceInput.checked;
            forceFree.hidden = !visible;
            forceFriction.hidden = !visible;
        };

        simulation.querySelector('[data-action="push"]').addEventListener("click", applyPush);
        simulation.querySelector('[data-action="reset"]').addEventListener("click", reset);
        showForceInput.addEventListener("change", syncForce);

        syncForce();
        render();
    };

    const initializeForce = (simulation) => {
        const track = simulation.querySelector('[data-role="track"]');
        const object = simulation.querySelector('[data-role="object"]');
        const forceInput = simulation.querySelector('[data-control="force"]');
        const massInput = simulation.querySelector('[data-control="mass"]');
        const accelerationOutput = simulation.querySelector('[data-output="acceleration"]');
        const equationOutput = simulation.querySelector('[data-output="equation"]');
        const messageOutput = simulation.querySelector('[data-output="message"]');
        let transitionFrame = 0;

        const update = () => {
            const force = Number(forceInput.value);
            const mass = Number(massInput.value);
            const acceleration = force / mass;
            simulation.querySelector('[data-value="force"]').textContent = `${force} N`;
            simulation.querySelector('[data-value="mass"]').textContent = `${mass} kg`;
            accelerationOutput.textContent = `${formatNumber(acceleration)} m/s²`;
            equationOutput.textContent = `${force} N ÷ ${mass} kg`;
            messageOutput.textContent = `A aceleração calculada é ${formatNumber(acceleration)} m/s².`;
            cancelAnimationFrame(transitionFrame);
            object.style.transition = "none";
            object.style.transform = "translateX(0px)";
            // A aceleração máxima possível é 20 N / 1 kg; a escala do deslocamento
            // precisa usar esse mesmo teto, senão massas diferentes deslocam igual.
        };

        simulation.querySelector('[data-action="apply"]').addEventListener("click", () => {
            const acceleration = Number(forceInput.value) / Number(massInput.value);
            const travelRange = Math.max(0, track.clientWidth - object.offsetWidth);
            // Deslocamento proporcional a "½·a·t²" na escala da cena.
            const travel = Math.min(1, acceleration / 20) * travelRange * 0.9;
            cancelAnimationFrame(transitionFrame);
            object.style.transition = "none";
            object.style.transform = "translateX(0px)";
            transitionFrame = requestAnimationFrame(() => {
                void object.offsetWidth;
                object.style.transition = reduceMotion ? "none" : "transform 1.4s ease-out";
                object.style.transform = `translateX(${travel}px)`;
            });
            messageOutput.textContent = "A mesma força acelera mais o carrinho de menor massa.";
        });

        simulation.querySelector('[data-action="reset"]').addEventListener("click", () => {
            update();
            messageOutput.textContent = "Carrinho parado. Ajuste força ou massa e aplique a força.";
        });
        forceInput.addEventListener("input", update);
        massInput.addEventListener("input", update);
        update();
    };

    const initializeActionReaction = (simulation) => {
        const track = simulation.querySelector('[data-role="track"]');
        const bodyA = simulation.querySelector('[data-role="body-a"]');
        const bodyB = simulation.querySelector('[data-role="body-b"]');
        const forceInput = simulation.querySelector('[data-control="force"]');
        const massAInput = simulation.querySelector('[data-control="mass-a"]');
        const massBInput = simulation.querySelector('[data-control="mass-b"]');
        const forceOutput = simulation.querySelector('[data-output="forces"]');
        const accelerationAOutput = simulation.querySelector('[data-output="acceleration-a"]');
        const accelerationBOutput = simulation.querySelector('[data-output="acceleration-b"]');
        const messageOutput = simulation.querySelector('[data-output="message"]');
        let transitionFrame = 0;

        const update = () => {
            const force = Number(forceInput.value);
            const massA = Number(massAInput.value);
            const massB = Number(massBInput.value);
            const accelerationA = force / massA;
            const accelerationB = force / massB;
            simulation.querySelector('[data-value="force"]').textContent = `${force} N`;
            simulation.querySelector('[data-value="mass-a"]').textContent = `${massA} kg`;
            simulation.querySelector('[data-value="mass-b"]').textContent = `${massB} kg`;
            forceOutput.textContent = `${force} N e −${force} N`;
            accelerationAOutput.textContent = `${formatNumber(accelerationA)} m/s²`;
            accelerationBOutput.textContent = `${formatNumber(accelerationB)} m/s²`;
            cancelAnimationFrame(transitionFrame);
            bodyA.style.transition = "none";
            bodyB.style.transition = "none";
            bodyA.style.transform = "translateX(0px)";
            bodyB.style.transform = "translateX(0px)";
        };

        simulation.querySelector('[data-action="apply"]').addEventListener("click", () => {
            const force = Number(forceInput.value);
            const accelerationA = force / Number(massAInput.value);
            const accelerationB = force / Number(massBInput.value);
            const halfWidth = track.clientWidth / 2;
            const rangeA = Math.max(0, halfWidth - bodyA.offsetWidth - 16);
            const rangeB = Math.max(0, halfWidth - bodyB.offsetWidth - 16);
            // Mesma escala para os dois corpos: só assim o recuo maior aparece
            // no corpo de menor massa (a = F/m).
            const scale = 10;
            const travelA = Math.min(1, accelerationA / scale) * rangeA * 0.85;
            const travelB = Math.min(1, accelerationB / scale) * rangeB * 0.85;
            cancelAnimationFrame(transitionFrame);
            bodyA.style.transition = "none";
            bodyB.style.transition = "none";
            bodyA.style.transform = "translateX(0px)";
            bodyB.style.transform = "translateX(0px)";
            transitionFrame = requestAnimationFrame(() => {
                void bodyA.offsetWidth;
                void bodyB.offsetWidth;
                bodyA.style.transition = reduceMotion ? "none" : "transform 1.2s ease-out";
                bodyB.style.transition = reduceMotion ? "none" : "transform 1.2s ease-out";
                bodyA.style.transform = `translateX(${-travelA}px)`;
                bodyB.style.transform = `translateX(${travelB}px)`;
            });
            messageOutput.textContent = `Ambos recebem forças de ${force} N em sentidos opostos; as acelerações dependem das massas.`;
        });

        simulation.querySelector('[data-action="reset"]').addEventListener("click", () => {
            update();
            messageOutput.textContent = "As forças têm sentidos opostos e atuam em corpos diferentes.";
        });
        forceInput.addEventListener("input", update);
        massAInput.addEventListener("input", update);
        massBInput.addEventListener("input", update);
        update();
    };

    const initializers = {
        inertia: initializeInertia,
        force: initializeForce,
        "action-reaction": initializeActionReaction
    };

    document.querySelectorAll("[data-simulation]").forEach((simulation) => {
        const initialize = initializers[simulation.dataset.simulation];
        if (initialize) {
            initialize(simulation);
        }
    });
})();