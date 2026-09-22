/**
 * BUBBLE HUNTER 2D - VERSIÓN GOLD MASTER
 * Incluye: Física Estable, Audio Sintetizado, Partículas, Combos, Récords, Screen Shake,
 *          Delta Time (física independiente del FPS), Sprites pre-renderizados,
 *          Sistema de Vidas / Game Over, Pausa, Silencio y Soporte táctil.
 * Desarrollado por: Luis Enrique Cabrera García
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 1. SISTEMA DE AUDIO (Web Audio API) ---
class SoundSystem {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.3; // Volumen al 30%
        this.muted = false;
    }

    setMuted(muted) {
        this.muted = muted;
        this.masterGain.gain.value = muted ? 0 : 0.3;
    }

    toggleMute() {
        this.setMuted(!this.muted);
        return this.muted;
    }

    playTone(freq, type, duration) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playPop() {
        // Sonido de burbuja (Variación aleatoria)
        const freq = 600 + Math.random() * 200; 
        this.playTone(freq, 'sine', 0.1);
    }

    playCombo(multiplier) {
        // Sonido arcade que sube de tono
        const baseFreq = 300;
        this.playTone(baseFreq + (multiplier * 100), 'square', 0.15);
    }

    playLevelUp() {
        // Acorde triunfal
        [440, 554, 659, 880].forEach((freq, i) => { 
            setTimeout(() => this.playTone(freq, 'triangle', 0.4), i * 100);
        });
    }

    playHighscore() {
        // Alarma de victoria
        this.playTone(880, 'sawtooth', 0.1);
        setTimeout(() => this.playTone(1100, 'sawtooth', 0.2), 100);
        setTimeout(() => this.playTone(1760, 'sawtooth', 0.4), 200);
    }

    playHit() {
        // Burbuja escapada
        this.playTone(130, 'sawtooth', 0.25);
    }

    playGameOver() {
        // Descenso trágico
        [300, 220, 150, 90].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'sawtooth', 0.35), i * 150);
        });
    }
}
const sfx = new SoundSystem();

// --- 2. CONFIGURACIÓN GLOBAL ---
const GAME_CONFIG = {
    TOTAL_OBJECTS: 150,
    GROUP_SIZE: 10,
    MIN_RADIUS: 15,
    MAX_RADIUS: 35,
    SPRITE_PADDING: 12, // Margen para no recortar el brillo neón
    SPAWN_CHANCE: 0.05, // Porcentaje por frame (a 60 fps ≈ 3 burbujas/seg)
    PARTICLE_COUNT: 15,
    COMBO_TIME_LIMIT: 1.0, // Segundos reales para encadenar combo
    MAX_SPEED: 9, // Límite de velocidad (Anti-Catapulta)
    MAX_LIVES: 3,
    COLORS: ['#00f3ff', '#39ff14', '#ff00ff', '#ffe600', '#ff3333', '#ffffff'] // Colores Neón
};

// --- 3. SPRITES PRE-RENDERIZADOS (evita shadowBlur por frame) ---
function makeCircleSprite(color) {
    const radius = GAME_CONFIG.MAX_RADIUS;
    const pad = GAME_CONFIG.SPRITE_PADDING;
    const size = (radius + pad) * 2;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const s = c.getContext('2d');
    s.beginPath();
    s.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
    s.shadowBlur = 15;
    s.shadowColor = color;
    s.fillStyle = color;
    s.fill();
    return { canvas: c, radius };
}

function buildSprites() {
    const sprites = {};
    GAME_CONFIG.COLORS.forEach(color => { sprites[color] = makeCircleSprite(color); });
    sprites.hover = makeCircleSprite('#ffffff'); // Brillo blanco al pasar el mouse
    return sprites;
}
GAME_CONFIG.SPRITES = buildSprites();

// --- 4. ELEMENTOS DEL DOM ---
const ui = {
    level: document.getElementById('level-display'),
    score: document.getElementById('score-display'),
    lives: document.getElementById('lives-display'),
    percent: document.getElementById('percent-display'),
    progressBar: document.getElementById('progress-bar'),
    muteBtn: document.getElementById('mute-btn'),
    pauseBtn: document.getElementById('pause-btn'),
    restartBtn: document.getElementById('restart-btn'),
    overlay: document.getElementById('game-overlay'),
    gameOverOverlay: document.getElementById('game-over-overlay')
};
const highScoreDisplay = document.getElementById('high-score-display');

// --- 5. ESTADO DEL JUEGO ---
let savedHighScore = parseInt(localStorage.getItem('bubbleHunter_record')) || 0;
highScoreDisplay.innerText = savedHighScore;

let state = {
    objects: [],
    particles: [],
    floatingTexts: [],
    score: 0,
    eliminatedCount: 0,
    highScore: savedHighScore,
    currentLevel: 1,
    spawnedInLevel: 0,
    animationId: null,
    totalLevels: GAME_CONFIG.TOTAL_OBJECTS / GAME_CONFIG.GROUP_SIZE,
    comboCount: 0,
    comboTimer: 0,
    screenShake: 0,
    lives: GAME_CONFIG.MAX_LIVES,
    maxLives: GAME_CONFIG.MAX_LIVES,
    paused: false,
    gameOver: false,
    gameWon: false,
    newRecordCelebrated: false,
    lastTime: performance.now(),
    levelMessage: { text: "", opacity: 0, timer: 0 }
};

const mouse = { x: undefined, y: undefined };
let lastTouchTime = 0;
let bg = null; // Fondo de estrellas pre-renderizado

// --- 6. AJUSTE DE PANTALLA + FONDO ---
function generateBackground() {
    bg = document.createElement('canvas');
    bg.width = canvas.width;
    bg.height = canvas.height;
    const bctx = bg.getContext('2d');
    for (let i = 0; i < 120; i++) {
        const x = Math.random() * bg.width;
        const y = Math.random() * bg.height;
        const r = Math.random() * 1.5 + 0.4;
        const a = (Math.random() * 0.6 + 0.1).toFixed(2);
        const base = i % 3 === 0 ? '0,243,255' : i % 3 === 1 ? '255,0,255' : '255,255,255';
        bctx.beginPath();
        bctx.arc(x, y, r, 0, Math.PI * 2);
        bctx.fillStyle = `rgba(${base},${a})`;
        bctx.fill();
    }
}

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    generateBackground();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- 7. EVENTOS DEL MOUSE / TÁCTIL ---
function handleClick() {
    if (sfx.ctx.state === 'suspended') sfx.ctx.resume();

    let hit = false;
    // Iterar al revés para priorizar objetos visualmente encima
    for (let i = state.objects.length - 1; i >= 0; i--) {
        const obj = state.objects[i];
        if (!obj.isFading && obj.isHovered(mouse.x, mouse.y)) {
            obj.explode();
            hit = true;
            break;
        }
    }
    if (!hit) state.comboCount = 0;
}

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});

canvas.addEventListener('mouseleave', () => { mouse.x = undefined; mouse.y = undefined; });

canvas.addEventListener('click', () => {
    // Evita el doble disparo en móviles (touch + click)
    if (performance.now() - lastTouchTime < 400) return;
    handleClick();
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const t = e.touches[0];
    mouse.x = t.clientX - rect.left;
    mouse.y = t.clientY - rect.top;
}, { passive: false });

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    lastTouchTime = performance.now();
    const rect = canvas.getBoundingClientRect();
    const t = e.touches[0];
    mouse.x = t.clientX - rect.left;
    mouse.y = t.clientY - rect.top;
    handleClick();
}, { passive: false });

// --- 8. CONTROL DE UI ---
function togglePause() {
    state.paused = !state.paused;
    ui.pauseBtn.innerText = state.paused ? "▶️ Reanudar" : "⏸️ Pausa";
}

function toggleMuteUI() {
    const muted = sfx.toggleMute();
    ui.muteBtn.innerText = muted ? "🔇 Silencio" : "🔊 Sonido";
}

ui.muteBtn.addEventListener('click', toggleMuteUI);
ui.pauseBtn.addEventListener('click', togglePause);

window.addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'P' || e.key === ' ') {
        e.preventDefault();
        togglePause();
    }
    if (e.key === 'm' || e.key === 'M') toggleMuteUI();
});

// --- 9. UTILIDADES FÍSICAS ---
function rotate(velocity, angle) {
    return {
        x: velocity.x * Math.cos(angle) - velocity.y * Math.sin(angle),
        y: velocity.x * Math.sin(angle) + velocity.y * Math.cos(angle)
    };
}

function triggerShake(amount) {
    state.screenShake = amount;
}

// 🔥 GESTOR DE COLISIONES MAESTRO
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

            if (dist < combinedRadius) {
                // 1. CORRECCIÓN DE POSICIÓN (Suave)
                if (dist === 0) { p1.x -= 1; continue; }

                const overlap = combinedRadius - dist;
                const dx = xDist / dist;
                const dy = yDist / dist;
                const correctionForce = 0.2;

                p1.x -= dx * overlap * correctionForce;
                p1.y -= dy * overlap * correctionForce;
                p2.x += dx * overlap * correctionForce;
                p2.y += dy * overlap * correctionForce;

                // 2. REBOTE ELÁSTICO
                const xVelocityDiff = p1.velocity.x - p2.velocity.x;
                const yVelocityDiff = p1.velocity.y - p2.velocity.y;

                if (xVelocityDiff * xDist + yVelocityDiff * yDist >= 0) {
                    const angle = -Math.atan2(p2.y - p1.y, p2.x - p1.x);
                    const m1 = p1.mass;
                    const m2 = p2.mass;
                    const u1 = rotate(p1.velocity, angle);
                    const u2 = rotate(p2.velocity, angle);

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

// --- 10. CLASES ---
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.radius = Math.random() * 3 + 2;
        this.color = color;
        this.opacity = 1;
        const v = Math.random() * 5 + 2;
        const a = Math.random() * Math.PI * 2;
        this.velocity = { x: Math.cos(a) * v, y: Math.sin(a) * v };
        this.friction = 0.94;
        this.gravity = 0.25;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(this.opacity, 0);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }

    update(dt) {
        this.draw();
        this.velocity.x *= Math.pow(this.friction, dt);
        this.velocity.y *= Math.pow(this.friction, dt);
        this.velocity.y += this.gravity * dt;
        this.x += this.velocity.x * dt;
        this.y += this.velocity.y * dt;
        this.opacity -= 0.03 * dt;
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
        this.life = 50; // Frames (~0.8s)
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(this.opacity, 0);
        ctx.font = `bold ${this.size}px 'Orbitron'`;
        ctx.fillStyle = this.color;
        ctx.textAlign = "center";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 3;
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }

    update(dt) {
        this.draw();
        this.y += this.velocityY * dt;
        this.life -= dt;
        if (this.life < 15) this.opacity -= 0.1 * dt;
    }
}

class Circle {
    constructor(x, y, radius, level) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.mass = radius;
        // Velocidad aumenta ligeramente con el nivel
        const speedBase = 1 + (level * 0.4);
        this.velocity = { x: (Math.random() - 0.5) * 3, y: -speedBase };
        this.color = GAME_CONFIG.COLORS[Math.floor(Math.random() * GAME_CONFIG.COLORS.length)];
        this.opacity = 1;
        this.isFading = false;
        this.markedForDeletion = false;
    }

    draw() {
        const hovered = !this.isFading && this.isHovered(mouse.x, mouse.y);
        const sprite = hovered ? GAME_CONFIG.SPRITES.hover : GAME_CONFIG.SPRITES[this.color];
        if (!sprite) return;

        const scale = this.radius / sprite.radius;
        const pad = GAME_CONFIG.SPRITE_PADDING * scale;
        const size = (this.radius + pad) * 2;

        ctx.save();
        ctx.globalAlpha = Math.max(this.opacity, 0);
        ctx.drawImage(sprite.canvas, this.x - size / 2, this.y - size / 2, size, size);
        ctx.restore();
    }

    update(dt) {
        this.draw();

        if (this.isFading) {
            // Desvanecimiento del pop
            this.opacity -= 0.2 * dt;
            if (this.opacity <= 0) this.markedForDeletion = true;
            return;
        }

        // 🔥 SPEED CLAMP (Límite de velocidad)
        const currentSpeed = Math.hypot(this.velocity.x, this.velocity.y);
        if (currentSpeed > GAME_CONFIG.MAX_SPEED) {
            const scale = GAME_CONFIG.MAX_SPEED / currentSpeed;
            this.velocity.x *= scale;
            this.velocity.y *= scale;
        }

        // Paredes
        if (this.x + this.radius >= canvas.width || this.x - this.radius <= 0) {
            this.velocity.x = -this.velocity.x;
            if (this.x + this.radius >= canvas.width) this.x = canvas.width - this.radius;
            if (this.x - this.radius <= 0) this.x = this.radius;
        }

        // Piso
        if (this.y + this.radius >= canvas.height && this.velocity.y > 0) {
            this.velocity.y = -this.velocity.y * 0.8;
            this.y = canvas.height - this.radius;
        }

        this.x += this.velocity.x * dt;
        this.y += this.velocity.y * dt;

        // Burbuja que escapa por el techo
        if (this.y + this.radius < 0) {
            this.markedForDeletion = true;
            loseLife();
        }
    }

    isHovered(mx, my) {
        if (mx === undefined || my === undefined) return false;
        return Math.hypot(this.x - mx, this.y - my) < this.radius;
    }

    explode() {
        if (this.isFading) return;
        this.isFading = true;
        state.eliminatedCount++;
        triggerShake(8);

        // Generar Partículas
        for (let i = 0; i < GAME_CONFIG.PARTICLE_COUNT; i++) {
            state.particles.push(new Particle(this.x, this.y, this.color));
        }

        // Sistema de Combo, Puntos y Sonido
        state.comboCount++;
        state.comboTimer = GAME_CONFIG.COMBO_TIME_LIMIT;

        // La racha de combos multiplica los puntos de esta burbuja
        const gained = state.comboCount;
        state.score += gained;

        if (state.comboCount > 1) {
            sfx.playCombo(state.comboCount);
            const isBig = state.comboCount > 4;
            state.floatingTexts.push(new FloatingText(
                `${state.comboCount}x COMBO!`,
                this.x, this.y, isBig ? 50 : 30, isBig ? "#ff3333" : "#ffe600"
            ));
            state.floatingTexts.push(new FloatingText(`+${gained}`, this.x, this.y - 30, 18, "#ffffff"));
        } else {
            sfx.playPop();
            state.floatingTexts.push(new FloatingText("+1", this.x, this.y, 20, "#ffffff"));
        }

        updateStats();
    }
}

// --- 11. GESTIÓN DE JUEGO ---
function showLevelUpMessage(level) {
    state.levelMessage.text = `¡NIVEL ${level}!`;
    state.levelMessage.opacity = 1;
    state.levelMessage.timer = 120;
    sfx.playLevelUp();
}

function updateLives() {
    const lost = Math.max(0, state.maxLives - Math.max(0, state.lives));
    ui.lives.innerText = "❤️".repeat(Math.max(0, state.lives)) + "🖤".repeat(lost);
}

function loseLife() {
    if (state.gameOver || state.gameWon) return;
    state.lives--;
    updateLives();
    state.floatingTexts.push(new FloatingText("¡BURBUJA ESCAPÓ!", canvas.width / 2, canvas.height / 2 - 60, 24, "#ff3333"));
    triggerShake(12);
    sfx.playHit();

    if (state.lives <= 0) {
        state.gameOver = true;
        endGame();
    }
}

function updateStats() {
    ui.score.innerText = state.score;

    // Check High Score
    if (state.score > state.highScore) {
        state.highScore = state.score;
        highScoreDisplay.innerText = state.highScore;
        localStorage.setItem('bubbleHunter_record', state.highScore);

        if (!state.newRecordCelebrated) {
            state.newRecordCelebrated = true;
            state.floatingTexts.push(new FloatingText("¡NUEVO RÉCORD!", canvas.width / 2, canvas.height / 2, 40, "#39ff14"));
            triggerShake(20);
            sfx.playHighscore();
        }
    }

    const percent = Math.round((state.eliminatedCount / GAME_CONFIG.TOTAL_OBJECTS) * 100);
    ui.percent.innerText = `${percent}%`;
    ui.progressBar.style.width = `${percent}%`;
}

function spawnEnemies(dt) {
    if (state.spawnedInLevel < GAME_CONFIG.GROUP_SIZE) {
        // La probabilidad se escala con dt para ser independiente de los FPS
        if (Math.random() < GAME_CONFIG.SPAWN_CHANCE * dt) {
            let radius = Math.random() * (GAME_CONFIG.MAX_RADIUS - GAME_CONFIG.MIN_RADIUS) + GAME_CONFIG.MIN_RADIUS;
            let x = Math.random() * (canvas.width - radius * 2) + radius;
            let y = canvas.height + radius + (Math.random() * 100);

            const safeToSpawn = state.objects.every(obj => {
                return Math.hypot(x - obj.x, y - obj.y) >= radius + obj.radius;
            });

            if (safeToSpawn) {
                state.objects.push(new Circle(x, y, radius, state.currentLevel));
                state.spawnedInLevel++;
            }
        }
    }
}

function endGame() {
    cancelAnimationFrame(state.animationId);
    ui.restartBtn.style.display = 'block';
    if (state.gameWon) {
        ui.overlay.style.display = 'block';
    } else {
        ui.gameOverOverlay.style.display = 'block';
        sfx.playGameOver();
    }
}

function checkLevelStatus() {
    if (state.gameOver || state.gameWon) return;
    if (state.spawnedInLevel === GAME_CONFIG.GROUP_SIZE && state.objects.length === 0) {
        if (state.currentLevel < state.totalLevels) {
            state.currentLevel++;
            state.spawnedInLevel = 0;
            ui.level.innerText = state.currentLevel;
            showLevelUpMessage(state.currentLevel);
        } else {
            state.gameWon = true;
            endGame();
        }
    }
}

function resetGame() {
    cancelAnimationFrame(state.animationId);

    state.objects = [];
    state.particles = [];
    state.floatingTexts = [];
    state.score = 0;
    state.eliminatedCount = 0;
    state.currentLevel = 1;
    state.spawnedInLevel = 0;
    state.comboCount = 0;
    state.comboTimer = 0;
    state.screenShake = 0;
    state.lives = state.maxLives;
    state.paused = false;
    state.gameOver = false;
    state.gameWon = false;
    state.newRecordCelebrated = false;
    state.levelMessage = { text: "", opacity: 0, timer: 0 };

    ui.level.innerText = state.currentLevel;
    ui.overlay.style.display = 'none';
    ui.gameOverOverlay.style.display = 'none';
    ui.restartBtn.style.display = 'none';
    ui.pauseBtn.innerText = "⏸️ Pausa";

    updateLives();
    updateStats();

    state.lastTime = performance.now();
    state.animationId = requestAnimationFrame(animate);
}

function drawPauseOverlay() {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "900 48px 'Orbitron'";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#00f3ff";
    ctx.shadowColor = "#00f3ff";
    ctx.shadowBlur = 15;
    ctx.fillText("PAUSA", canvas.width / 2, canvas.height / 2);
    ctx.font = "16px 'Poppins'";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.shadowBlur = 0;
    ctx.fillText("Pulsa P o Espacio para continuar", canvas.width / 2, canvas.height / 2 + 40);
    ctx.restore();
}

function drawSceneStatic() {
    if (bg) ctx.drawImage(bg, 0, 0);
    state.objects.forEach(o => o.draw());
    state.particles.forEach(p => p.draw());
    state.floatingTexts.forEach(ft => ft.draw());
}

// --- 12. BUCLE PRINCIPAL ---
function animate(timestamp) {
    state.animationId = requestAnimationFrame(animate);

    // Delta time normalizado a 60fps (independiente de la frecuencia del monitor)
    const dt = Math.min((timestamp - state.lastTime) / (1000 / 60), 3);
    state.lastTime = timestamp;

    if (state.paused) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawSceneStatic();
        drawPauseOverlay();
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // Screen Shake
    if (state.screenShake > 0) {
        const dx = (Math.random() - 0.5) * state.screenShake;
        const dy = (Math.random() - 0.5) * state.screenShake;
        ctx.translate(dx, dy);
        state.screenShake *= Math.pow(0.9, dt);
        if (state.screenShake < 0.5) state.screenShake = 0;
    }

    if (bg) ctx.drawImage(bg, 0, 0);

    // Timer de Combo
    if (state.comboTimer > 0) state.comboTimer -= dt;
    else state.comboCount = 0;

    spawnEnemies(dt);

    // 1. FÍSICA CENTRALIZADA
    handleCollisions();

    // 2. ACTUALIZAR Y FILTRAR OBJETOS (sin saltarse elementos)
    state.objects.forEach(obj => obj.update(dt));
    state.objects = state.objects.filter(obj => !obj.markedForDeletion);

    state.particles.forEach(p => p.update(dt));
    state.particles = state.particles.filter(p => p.opacity > 0);

    state.floatingTexts.forEach(ft => ft.update(dt));
    state.floatingTexts = state.floatingTexts.filter(ft => ft.life > 0 && ft.opacity > 0);

    ctx.restore();

    // UI Overlay (Level Up)
    if (state.levelMessage.opacity > 0) {
        ctx.save();
        ctx.globalAlpha = state.levelMessage.opacity;
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(0, canvas.height / 2 - 70, canvas.width, 140);
        ctx.font = "900 60px 'Orbitron'";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "black";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#39ff14";
        ctx.fillText(state.levelMessage.text, canvas.width / 2, canvas.height / 2);
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.strokeText(state.levelMessage.text, canvas.width / 2, canvas.height / 2);
        ctx.restore();
        state.levelMessage.timer -= dt;
        if (state.levelMessage.timer <= 0) state.levelMessage.opacity -= 0.05 * dt;
    }

    checkLevelStatus();
}

// --- 13. ARRANQUE ---
ui.restartBtn.addEventListener('click', resetGame);
document.getElementById('overlay-restart-btn').addEventListener('click', resetGame);
document.getElementById('game-over-restart-btn').addEventListener('click', resetGame);

updateLives();
updateStats();
animate(performance.now());