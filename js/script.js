/**
 * BUBBLE HUNTER 2D - Versión Visual (Partículas)
 * Desarrollado por: Luis Enrique Cabrera García
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- CONFIGURACIÓN GLOBAL ---
const GAME_CONFIG = {
    TOTAL_OBJECTS: 150,
    GROUP_SIZE: 10,
    MIN_RADIUS: 15,
    MAX_RADIUS: 35,
    SPAWN_CHANCE: 0.05,
    PARTICLE_COUNT: 12, // Cantidad de fragmentos por explosión
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
let state = {
    objects: [],
    particles: [], // Nuevo array para efectos visuales
    eliminatedCount: 0,
    currentLevel: 1,
    spawnedInLevel: 0,
    animationId: null,
    totalLevels: GAME_CONFIG.TOTAL_OBJECTS / GAME_CONFIG.GROUP_SIZE
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
    state.objects.forEach(obj => {
        if (!obj.isFading && obj.isHovered(mouse.x, mouse.y)) {
            obj.explode(); // Ahora llamamos a explode en lugar de solo fade
        }
    });
});

ui.restartBtn.addEventListener('click', () => location.reload());

// --- UTILIDADES DE FÍSICA ---
function rotate(velocity, angle) {
    return {
        x: velocity.x * Math.cos(angle) - velocity.y * Math.sin(angle),
        y: velocity.x * Math.sin(angle) + velocity.y * Math.cos(angle)
    };
}

function resolveCollision(particle, otherParticle) {
    const xVelocityDiff = particle.velocity.x - otherParticle.velocity.x;
    const yVelocityDiff = particle.velocity.y - otherParticle.velocity.y;
    const xDist = otherParticle.x - particle.x;
    const yDist = otherParticle.y - particle.y;

    if (xVelocityDiff * xDist + yVelocityDiff * yDist >= 0) {
        const angle = -Math.atan2(otherParticle.y - particle.y, otherParticle.x - particle.x);
        const m1 = particle.mass;
        const m2 = otherParticle.mass;

        const u1 = rotate(particle.velocity, angle);
        const u2 = rotate(otherParticle.velocity, angle);

        const v1 = { x: u1.x * (m1 - m2) / (m1 + m2) + u2.x * 2 * m2 / (m1 + m2), y: u1.y };
        const v2 = { x: u2.x * (m1 - m2) / (m1 + m2) + u1.x * 2 * m1 / (m1 + m2), y: u2.y };

        const vFinal1 = rotate(v1, -angle);
        const vFinal2 = rotate(v2, -angle);

        particle.velocity.x = vFinal1.x;
        particle.velocity.y = vFinal1.y;
        otherParticle.velocity.x = vFinal2.x;
        otherParticle.velocity.y = vFinal2.y;
    }
}

// --- CLASE PARTÍCULA (NUEVO) ---
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.radius = Math.random() * 3 + 2; // Tamaño aleatorio pequeño
        this.color = color;
        this.opacity = 1;
        
        // Explosión rápida en todas direcciones
        const velocityMultiplier = Math.random() * 5 + 2; 
        const angle = Math.random() * Math.PI * 2;
        
        this.velocity = {
            x: Math.cos(angle) * velocityMultiplier,
            y: Math.sin(angle) * velocityMultiplier
        };
        
        this.friction = 0.95; // Para que se frenen gradualmente
        this.gravity = 0.2;   // Para que caigan un poco
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
        this.draw();
        
        // Física simple
        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;
        this.velocity.y += this.gravity;
        
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        
        // Desvanecer
        this.opacity -= 0.03;
    }
}

// --- CLASE CÍRCULO ---
class Circle {
    constructor(x, y, radius, level) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.mass = radius;
        const speedBase = 1 + (level * 0.5); 
        this.velocity = {
            x: (Math.random() - 0.5) * 2, 
            y: -speedBase 
        };
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

    update(circles) {
        this.draw();

        // Si explota, se desvanece MUY rápido para dar paso a las partículas
        if (this.isFading) {
            this.opacity -= 0.2; // Desaparece casi al instante
            this.radius += 2;    // Expansión rápida antes de desaparecer
            if (this.opacity <= 0) {
                this.markedForDeletion = true;
                state.eliminatedCount++;
                updateStats();
            }
            return;
        }

        // Colisiones
        for (let i = 0; i < circles.length; i++) {
            if (this === circles[i]) continue;
            if (circles[i].isFading) continue;

            const dist = Math.hypot(this.x - circles[i].x, this.y - circles[i].y);
            if (dist - (this.radius + circles[i].radius) < 0) {
                resolveCollision(this, circles[i]);
            }
        }

        // Rebotes
        if (this.x + this.radius >= canvas.width || this.x - this.radius <= 0) {
            this.velocity.x = -this.velocity.x;
            if(this.x + this.radius >= canvas.width) this.x = canvas.width - this.radius;
            if(this.x - this.radius <= 0) this.x = this.radius;
        }
        
        if (this.y + this.radius >= canvas.height && this.velocity.y > 0) {
             this.velocity.y = -this.velocity.y * 0.8;
             this.y = canvas.height - this.radius;
        }

        this.x += this.velocity.x;
        this.y += this.velocity.y;

        if (this.y + this.radius < 0) {
            this.markedForDeletion = true;
        }
    }

    isHovered(mx, my) {
        if (mx === undefined || my === undefined) return false;
        return Math.hypot(this.x - mx, this.y - my) < this.radius;
    }

    // Nuevo método que combina el fade con la generación de partículas
    explode() {
        if (!this.isFading) {
            this.isFading = true;
            this.velocity.x = 0;
            this.velocity.y = 0;
            
            // Generar partículas en la posición actual
            for (let i = 0; i < GAME_CONFIG.PARTICLE_COUNT; i++) {
                state.particles.push(new Particle(this.x, this.y, this.color));
            }
        }
    }
}

// --- LÓGICA DE CONTROL ---
function updateStats() {
    ui.score.innerText = state.eliminatedCount;
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
            
            state.objects.push(new Circle(x, y, radius, state.currentLevel));
            state.spawnedInLevel++;
        }
    }
}

function checkLevelStatus() {
    if (state.spawnedInLevel === GAME_CONFIG.GROUP_SIZE && state.objects.length === 0) {
        if (state.currentLevel < state.totalLevels) {
            state.currentLevel++;
            state.spawnedInLevel = 0;
            ui.level.innerText = state.currentLevel;
        } else {
            cancelAnimationFrame(state.animationId);
            ui.overlay.style.display = 'block';
            ui.restartBtn.style.display = 'block';
        }
    }
}

function animate() {
    state.animationId = requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    spawnEnemies();

    // 1. Actualizar burbujas
    state.objects.forEach(obj => obj.update(state.objects));
    state.objects = state.objects.filter(obj => !obj.markedForDeletion);

    // 2. Actualizar partículas (Efectos Visuales)
    state.particles.forEach((particle, index) => {
        if (particle.opacity <= 0) {
            // Eliminar partículas invisibles para no saturar memoria
            state.particles.splice(index, 1);
        } else {
            particle.update();
        }
    });

    checkLevelStatus();
}

// Iniciar
animate();