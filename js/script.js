/**
 * BUBBLE HUNTER 2D - Lógica del Juego
 * Refactorizado para: Luis Enrique Cabrera García
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
    COLORS: ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#33FFF5', '#F5FF33'] // Colores predefinidos o aleatorios
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
            obj.startFadeOut();
        }
    });
});

ui.restartBtn.addEventListener('click', () => location.reload());

// --- UTILIDADES DE FÍSICA (Tu lógica original intacta) ---
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

    // Prevenir superposición accidental
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

// --- CLASE CÍRCULO ---
class Circle {
    // Constructor limpio: recibe valores ya calculados
    constructor(x, y, radius, level) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.mass = radius; 
        
        // Velocidad basada en el nivel
        const speedBase = 1 + (level * 0.5); 
        this.velocity = {
            x: (Math.random() - 0.5) * 2, 
            y: -speedBase // Flotan hacia arriba por defecto
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

        // Lógica de muerte (fade out)
        if (this.isFading) {
            this.opacity -= 0.05;
            this.radius += 0.5; // Efecto visual "pop"
            if (this.opacity <= 0) {
                this.markedForDeletion = true;
                state.eliminatedCount++;
                updateStats();
            }
            return;
        }

        // Detección de Colisiones
        for (let i = 0; i < circles.length; i++) {
            if (this === circles[i]) continue;
            if (circles[i].isFading) continue;

            const dist = Math.hypot(this.x - circles[i].x, this.y - circles[i].y);

            if (dist - (this.radius + circles[i].radius) < 0) {
                resolveCollision(this, circles[i]);
            }
        }

        // Rebote en paredes laterales
        if (this.x + this.radius >= canvas.width || this.x - this.radius <= 0) {
            this.velocity.x = -this.velocity.x;
            // Corrección simple para que no se pegue a la pared
            if(this.x + this.radius >= canvas.width) this.x = canvas.width - this.radius;
            if(this.x - this.radius <= 0) this.x = this.radius;
        }
        
        // Rebote en el piso (si caen por choque)
        // NOTA: Solo rebotan si ya estaban DENTRO del canvas.
        // Si están naciendo (y > canvas.height), dejamos que suban.
        if (this.y + this.radius >= canvas.height && this.velocity.y > 0) {
             this.velocity.y = -this.velocity.y * 0.8; // Rebote con fricción
             this.y = canvas.height - this.radius;
        }

        // Aplicar movimiento
        this.x += this.velocity.x;
        this.y += this.velocity.y;

        // Eliminar si sale por el techo completamente
        if (this.y + this.radius < 0) {
            this.markedForDeletion = true;
        }
    }

    isHovered(mx, my) {
        if (mx === undefined || my === undefined) return false;
        return Math.hypot(this.x - mx, this.y - my) < this.radius;
    }

    startFadeOut() {
        if (!this.isFading) {
            this.isFading = true;
            this.velocity.x = 0;
            this.velocity.y = 0;
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
            
            // 1. Calcular propiedades ANTES de crear el objeto
            let radius = Math.random() * (GAME_CONFIG.MAX_RADIUS - GAME_CONFIG.MIN_RADIUS) + GAME_CONFIG.MIN_RADIUS;
            let x = Math.random() * (canvas.width - radius * 2) + radius;
            let y = canvas.height + radius + (Math.random() * 100); // Nacen abajo
            
            // 2. Crear objeto limpio
            state.objects.push(new Circle(x, y, radius, state.currentLevel));
            state.spawnedInLevel++;
        }
    }
}

function checkLevelStatus() {
    // Si ya nacieron todos y ya no queda ninguno vivo en pantalla
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

    // Actualizar objetos
    state.objects.forEach(obj => obj.update(state.objects));

    // Limpieza de objetos marcados
    state.objects = state.objects.filter(obj => !obj.markedForDeletion);

    checkLevelStatus();
}

// Iniciar
animate();