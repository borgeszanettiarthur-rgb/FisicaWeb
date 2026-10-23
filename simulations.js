(() => {
    const formatNumber = (value, digits = 1) => value.toLocaleString("pt-BR", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });

    const initializeInertia = (simulation) => {
        const track = simulation.querySelector('[data-role="track"]');
        const object = simulation.querySelector('[data-role="object"]');
        const forceInput = simulation.querySelector('[data-control="force"]');
        const frictionInput = simulation.querySelector('[data-control="friction"]');
        const speedOutput = simulation.querySelector('[data-output="speed"]');
        const messageOutput = simulation.querySelector('[data-output="message"]');
        let position = 0;
        let velocity = 0;
        let previousTime = 0;
        let frame = 0;

        const render = () => {
            const travelRange = Math.max(0, track.clientWidth - object.offsetWidth);
            object.style.transform = `translateX(${Math.min(position / 5, 1) * travelRange}px)`;
            speedOutput.textContent = `${formatNumber(velocity)} m/s`;
        };

        const animate = (time) => {
            const elapsed = Math.min((time - previousTime) / 1000, 0.05);
            previousTime = time;

            if (frictionInput.checked) {
                velocity = Math.max(0, velocity - 0.8 * elapsed);
            }

            position = Math.min(5, position + velocity * elapsed);
            render();

            if (position >= 5) {
                velocity = 0;
                messageOutput.textContent = "O objeto chegou ao fim da pista.";
                render();
                frame = 0;
            } else if (velocity <= 0.01) {
                velocity = 0;
                messageOutput.textContent = "O atrito parou o objeto. Sem atrito, ele seguiria em movimento.";
                render();
                frame = 0;
            } else {
                frame = requestAnimationFrame(animate);
            }
        };

        simulation.querySelector('[data-action="push"]').addEventListener("click", () => {
            velocity += (Number(forceInput.value) / 2) * 0.5;
            messageOutput.textContent = frictionInput.checked
                ? "O objeto foi empurrado; o atrito reduz sua velocidade."
                : "O objeto foi empurrado e seguirá sem perder velocidade.";
            if (!frame) {
                previousTime = performance.now();
                frame = requestAnimationFrame(animate);
            }
            render();
        });

        simulation.querySelector('[data-action="reset"]').addEventListener("click", () => {
            cancelAnimationFrame(frame);
            frame = 0;
            position = 0;
            velocity = 0;
            messageOutput.textContent = "Objeto em repouso. Escolha o atrito e empurre.";
            render();
        });

        forceInput.addEventListener("input", () => {
            simulation.querySelector('[data-value="force"]').textContent = `${forceInput.value} N`;
        });
        frictionInput.addEventListener("change", () => {
            messageOutput.textContent = frictionInput.checked
                ? "Atrito ligado: o objeto perde velocidade ao se mover."
                : "Atrito desligado: o objeto mantém a velocidade após o empurrão.";
        });

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
        };

        simulation.querySelector('[data-action="apply"]').addEventListener("click", () => {
            const acceleration = Number(forceInput.value) / Number(massInput.value);
            const travelRange = Math.max(0, track.clientWidth - object.offsetWidth);
            const travel = Math.min(0.82, acceleration / 20 * 0.82) * travelRange;
            cancelAnimationFrame(transitionFrame);
            object.style.transition = "none";
            object.style.transform = "translateX(0px)";
            transitionFrame = requestAnimationFrame(() => {
                void object.offsetWidth;
                object.style.transition = "transform 1.4s ease-out";
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
            const travelA = Math.min(0.75, accelerationA / 10 * 0.75) * rangeA;
            const travelB = Math.min(0.75, accelerationB / 10 * 0.75) * rangeB;
            cancelAnimationFrame(transitionFrame);
            bodyA.style.transition = "none";
            bodyB.style.transition = "none";
            bodyA.style.transform = "translateX(0px)";
            bodyB.style.transform = "translateX(0px)";
            transitionFrame = requestAnimationFrame(() => {
                void bodyA.offsetWidth;
                void bodyB.offsetWidth;
                bodyA.style.transition = "transform 1.2s ease-out";
                bodyB.style.transition = "transform 1.2s ease-out";
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