/**
 * BUBBLE HUNTER 2D - VERSIÓN "GOLD MASTER"
 * Características: Física Estable, Partículas, Combos, Récords y Screen Shake.
 * Desarrollado por: Luis Enrique Cabrera García
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 1. INYECCIÓN DE UI PARA EL RÉCORD ---
const statsCard = document.querySelector('.card-body');
if (!document.getElementById('high-score-display')) {
    const highScoreContainer = document.createElement('p');
    highScoreContainer.className = "card-text";
    highScoreContainer.innerHTML = `🏆 Récord: <span id="high-score-display" class="fw-bold text-warning">0</span>`;
    // Insertar después del puntaje actual
    statsCard.insertBefore(highScoreContainer, statsCard.children[2]); 
}
const highScoreDisplay = document.getElementById('high-score-display');

// --- CONFIGURACIÓN GLOBAL ---
const GAME_CONFIG = {
    TOTAL_OBJECTS: 150,
    GROUP_SIZE: 10,
    MIN_RADIUS: 15,
    MAX_RADIUS: 35,
    SPAWN_CHANCE: 0.05,
    PARTICLE_COUNT: 15,
    COMBO_TIME_LIMIT: 60,
    MAX_SPEED: 8, // 🔥 Límite de velocidad para evitar "catapultas"
    COLORS: ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#33FFF5', '#F5FF33']
};

// --- ELEMENTOS DEL DOM ---
const ui = {
    level: document.getElementById('level-display'),
    score: document.getElementById('score-display'),
    percent: document.getElementById('percent-display'),
    progressBar: document.getElementById('progress-bar'),
    restartBtn: document.getElementById('restart-btn'),
    overlay: document.getElementById('game-overlay')
};

// --- ESTADO DEL JUEGO ---
let savedHighScore = localStorage.getItem('bubbleHunter_record') || 0;
highScoreDisplay.innerText = savedHighScore;

let state = {
    objects: [],
    particles: [],
    floatingTexts: [],
    eliminatedCount: 0,
    highScore: parseInt(savedHighScore),
    currentLevel: 1,
    spawnedInLevel: 0,
    animationId: null,
    totalLevels: GAME_CONFIG.TOTAL_OBJECTS / GAME_CONFIG.GROUP_SIZE,
    
    // Combos
    comboCount: 0,
    comboTimer: 0,
    
    // Efectos
    screenShake: 0,
    newRecordCelebrated: false,
    
    // UI
    levelMessage: { text: "", opacity: 0, timer: 0 }
};

const mouse = { x: undefined, y: undefined };

// --- AJUSTE DE PANTALLA ---
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- EVENTOS DEL MOUSE ---
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});

canvas.addEventListener('mouseleave', () => {
    mouse.x = undefined;
    mouse.y = undefined;
});

canvas.addEventListener('click', () => {
    let hit = false;
    // Iteramos al revés para dar prioridad a los objetos visualmente "encima"
    for (let i = state.objects.length - 1; i >= 0; i--) {
        const obj = state.objects[i];
        if (!obj.isFading && obj.isHovered(mouse.x, mouse.y)) {
            obj.explode();
            hit = true;
            break; // Solo explotar uno a la vez
        }
    }
    
    if (!hit) state.comboCount = 0;
});

ui.restartBtn.addEventListener('click', () => location.reload());

// --- UTILIDADES FÍSICAS ---

function rotate(velocity, angle) {
    return {
        x: velocity.x * Math.cos(angle) - velocity.y * Math.sin(angle),
        y: velocity.x * Math.sin(angle) + velocity.y * Math.cos(angle)
    };
}

// 🔥 GESTOR DE COLISIONES ESTABILIZADO
function handleCollisions() {
    const objects = state.objects;
    
    for (let i = 0; i < objects.length; i++) {
        for (let j = i + 1; j < objects.length; j++) {
            const p1 = objects[i];
            const p2 = objects[j];

            if (p1.isFading || p2.isFading) continue;

            const xDist = p2.x - p1.x;
            const yDist = p2.y - p1.y;
            const dist = Math.hypot(xDist, yDist);
            const combinedRadius = p1.radius + p2.radius;

            // DETECCIÓN DE CHOQUE
            if (dist < combinedRadius) {
                // 1. CORRECCIÓN DE POSICIÓN SUAVE (Anti-superposición)
                if (dist === 0) { p1.x -= 1; continue; } // Evitar división por cero

                const overlap = combinedRadius - dist;
                const dx = xDist / dist;
                const dy = yDist / dist;
                
                // Fuerza suave (0.2) para separar poco a poco y evitar saltos bruscos
                const correctionForce = 0.2; 
                
                p1.x -= dx * overlap * correctionForce;
                p1.y -= dy * overlap * correctionForce;
                p2.x += dx * overlap * correctionForce;
                p2.y += dy * overlap * correctionForce;

                // 2. REBOTE ELÁSTICO CON PÉRDIDA DE ENERGÍA
                const xVelocityDiff = p1.velocity.x - p2.velocity.x;
                const yVelocityDiff = p1.velocity.y - p2.velocity.y;

                // Solo calcular si se están acercando
                if (xVelocityDiff * xDist + yVelocityDiff * yDist >= 0) {
                    const angle = -Math.atan2(p2.y - p1.y, p2.x - p1.x);
                    const m1 = p1.mass;
                    const m2 = p2.mass;
                    const u1 = rotate(p1.velocity, angle);
                    const u2 = rotate(p2.velocity, angle);
                    
                    // Elasticidad 0.9 = pierden 10% de velocidad en cada choque (estabilidad)
                    const elasticity = 0.9; 

                    const v1 = { 
                        x: (u1.x * (m1 - m2) + 2 * m2 * u2.x) / (m1 + m2) * elasticity, 
                        y: u1.y 
                    };
                    const v2 = { 
                        x: (u2.x * (m2 - m1) + 2 * m1 * u1.x) / (m1 + m2) * elasticity, 
                        y: u2.y 
                    };

                    const vFinal1 = rotate(v1, -angle);
                    const vFinal2 = rotate(v2, -angle);
                    p1.velocity.x = vFinal1.x;
                    p1.velocity.y = vFinal1.y;
                    p2.velocity.x = vFinal2.x;
                    p2.velocity.y = vFinal2.y;
                }
            }
        }
    }
}

function triggerShake(amount) {
    state.screenShake = amount;
}

// --- CLASES ---

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.radius = Math.random() * 3 + 2; 
        this.color = color;
        this.opacity = 1;
        
        const velocity = Math.random() * 5 + 2; 
        const angle = Math.random() * Math.PI * 2; 
        
        this.velocity = {
            x: Math.cos(angle) * velocity,
            y: Math.sin(angle) * velocity
        };
        
        this.friction = 0.94; 
        this.gravity = 0.25;  
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.draw(); // ✅ Importante: Dibujar en cada frame
        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;
        this.velocity.y += this.gravity;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.opacity -= 0.03; 
    }
}

class FloatingText {
    constructor(text, x, y, size, color) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.size = size;
        this.color = color;
        this.opacity = 1;
        this.velocityY = -1.5; 
        this.life = 50; 
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.font = `bold ${this.size}px Arial`;
        ctx.fillStyle = this.color;
        ctx.textAlign = "center";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 3;
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }

    update() {
        this.draw();
        this.y += this.velocityY;
        this.life--;
        if (this.life < 15) this.opacity -= 0.1;
    }
}

class Circle {
    constructor(x, y, radius, level) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.mass = radius;
        const speedBase = 1 + (level * 0.5); 
        this.velocity = { x: (Math.random() - 0.5) * 2, y: -speedBase };
        this.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
        this.hoverColor = '#ffc107'; 
        this.opacity = 1;
        this.isFading = false;
        this.markedForDeletion = false;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        
        if (!this.isFading && this.isHovered(mouse.x, mouse.y)) {
            ctx.fillStyle = this.hoverColor;
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            ctx.fillStyle = this.color;
        }
        
        ctx.fill();
        ctx.closePath();
        ctx.restore();
    }

    update() {
        this.draw();

        if (this.isFading) {
            this.markedForDeletion = true;
            state.eliminatedCount++;
            updateStats();
            return;
        }

        // 🔥 SPEED CLAMP (Límite de velocidad)
        // Esto evita el efecto "catapulta" si la física falla
        const currentSpeed = Math.hypot(this.velocity.x, this.velocity.y);
        if (currentSpeed > GAME_CONFIG.MAX_SPEED) {
            const scale = GAME_CONFIG.MAX_SPEED / currentSpeed;
            this.velocity.x *= scale;
            this.velocity.y *= scale;
        }

        // Paredes
        if (this.x + this.radius >= canvas.width || this.x - this.radius <= 0) {
            this.velocity.x = -this.velocity.x;
            // Corrección simple para no quedarse pegado a la pared
            if(this.x + this.radius >= canvas.width) this.x = canvas.width - this.radius;
            if(this.x - this.radius <= 0) this.x = this.radius;
        }
        
        // Piso
        if (this.y + this.radius >= canvas.height && this.velocity.y > 0) {
             this.velocity.y = -this.velocity.y * 0.8;
             this.y = canvas.height - this.radius;
        }

        this.x += this.velocity.x;
        this.y += this.velocity.y;

        if (this.y + this.radius < 0) this.markedForDeletion = true;
    }

    isHovered(mx, my) {
        if (mx === undefined || my === undefined) return false;
        return Math.hypot(this.x - mx, this.y - my) < this.radius;
    }

    explode() {
        if (!this.isFading) {
            this.isFading = true;
            
            triggerShake(8);

            // Generar Partículas
            for (let i = 0; i < GAME_CONFIG.PARTICLE_COUNT; i++) {
                state.particles.push(new Particle(this.x, this.y, this.color));
            }

            // Sistema de Combo
            state.comboCount++;
            state.comboTimer = GAME_CONFIG.COMBO_TIME_LIMIT;
            
            let comboText = "+1";
            let color = "#FFF";
            let size = 20;

            if (state.comboCount > 1) {
                comboText = `${state.comboCount}x COMBO!`;
                color = "#FFD700"; 
                size = 30;
                if(state.comboCount > 4) { size = 50; color = "#FF0000"; }
            }

            state.floatingTexts.push(new FloatingText(comboText, this.x, this.y, size, color));
        }
    }
}

// --- GESTIÓN DE JUEGO ---

function showLevelUpMessage(level) {
    state.levelMessage.text = `¡NIVEL ${level}!`;
    state.levelMessage.opacity = 1;
    state.levelMessage.timer = 120; 
}

function updateStats() {
    ui.score.innerText = state.eliminatedCount;
    
    // Check High Score
    if (state.eliminatedCount > state.highScore) {
        state.highScore = state.eliminatedCount;
        highScoreDisplay.innerText = state.highScore;
        localStorage.setItem('bubbleHunter_record', state.highScore);

        if (!state.newRecordCelebrated) {
            state.newRecordCelebrated = true;
            state.floatingTexts.push(new FloatingText("¡NUEVO RÉCORD!", canvas.width/2, canvas.height/2, 40, "#39ff14"));
            triggerShake(20);
        }
    }

    const percent = Math.round((state.eliminatedCount / GAME_CONFIG.TOTAL_OBJECTS) * 100);
    ui.percent.innerText = `${percent}%`;
    ui.progressBar.style.width = `${percent}%`;
}

function spawnEnemies() {
    if (state.spawnedInLevel < GAME_CONFIG.GROUP_SIZE) {
        if (Math.random() < GAME_CONFIG.SPAWN_CHANCE) { 
            let radius = Math.random() * (GAME_CONFIG.MAX_RADIUS - GAME_CONFIG.MIN_RADIUS) + GAME_CONFIG.MIN_RADIUS;
            let x = Math.random() * (canvas.width - radius * 2) + radius;
            let y = canvas.height + radius + (Math.random() * 100);
            
            // Checkeo de seguridad para no spawnear encima de otro
            let safeToSpawn = true;
            for(let obj of state.objects) {
                if(Math.hypot(x - obj.x, y - obj.y) < radius + obj.radius) {
                    safeToSpawn = false; break;
                }
            }
            
            if(safeToSpawn) {
                state.objects.push(new Circle(x, y, radius, state.currentLevel));
                state.spawnedInLevel++;
            }
        }
    }
}

function checkLevelStatus() {
    if (state.spawnedInLevel === GAME_CONFIG.GROUP_SIZE && state.objects.length === 0) {
        if (state.currentLevel < state.totalLevels) {
            state.currentLevel++;
            state.spawnedInLevel = 0;
            ui.level.innerText = state.currentLevel;
            showLevelUpMessage(state.currentLevel);
        } else {
            cancelAnimationFrame(state.animationId);
            ui.overlay.style.display = 'block';
            ui.restartBtn.style.display = 'block';
        }
    }
}

// --- BUCLE PRINCIPAL ---
function animate() {
    state.animationId = requestAnimationFrame(animate);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Screen Shake
    ctx.save();
    if (state.screenShake > 0) {
        const dx = (Math.random() - 0.5) * state.screenShake;
        const dy = (Math.random() - 0.5) * state.screenShake;
        ctx.translate(dx, dy);
        state.screenShake *= 0.9;
        if (state.screenShake < 0.5) state.screenShake = 0;
    }

    if (state.comboTimer > 0) state.comboTimer--;
    else state.comboCount = 0;

    spawnEnemies();

    // 1. FÍSICA CENTRALIZADA (Antes de mover objetos)
    handleCollisions();

    // 2. ACTUALIZAR OBJETOS
    state.objects.forEach(obj => obj.update());
    state.objects = state.objects.filter(obj => !obj.markedForDeletion);

    // 3. EFECTOS VISUALES
    state.particles.forEach((p, i) => {
        if (p.opacity <= 0) state.particles.splice(i, 1);
        else p.update();
    });

    state.floatingTexts.forEach((ft, i) => {
        if (ft.life <= 0 || ft.opacity <= 0) state.floatingTexts.splice(i, 1);
        else ft.update();
    });

    ctx.restore();

    // 4. UI OVERLAY (Level Up)
    if (state.levelMessage.opacity > 0) {
        ctx.save();
        ctx.globalAlpha = state.levelMessage.opacity;
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(0, canvas.height/2 - 70, canvas.width, 140);
        ctx.font = "900 60px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "black";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#39ff14"; 
        ctx.fillText(state.levelMessage.text, canvas.width/2, canvas.height/2);
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.strokeText(state.levelMessage.text, canvas.width/2, canvas.height/2);
        ctx.restore();
        state.levelMessage.timer--;
        if (state.levelMessage.timer <= 0) state.levelMessage.opacity -= 0.05;
    }

    checkLevelStatus();
}

animate();