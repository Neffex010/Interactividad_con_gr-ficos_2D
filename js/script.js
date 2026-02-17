/**
 * Configuración Inicial y Variables Globales
 */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Elementos del DOM para estadísticas
const levelDisplay = document.getElementById('level-display');
const scoreDisplay = document.getElementById('score-display');
const percentDisplay = document.getElementById('percent-display');
const progressBar = document.getElementById('progress-bar');
const restartBtn = document.getElementById('restart-btn');
const overlay = document.getElementById('game-overlay');

// Ajustar canvas
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Configuración del Juego
const TOTAL_OBJECTS = 150;
const GROUP_SIZE = 10;
const TOTAL_LEVELS = TOTAL_OBJECTS / GROUP_SIZE; // 15 niveles

let objects = [];
let eliminatedCount = 0;
let currentLevel = 1;
let objectsSpawnedInLevel = 0;
let animationId;

// Mouse
const mouse = { x: undefined, y: undefined };

canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
});

canvas.addEventListener('mouseleave', () => {
    mouse.x = undefined;
    mouse.y = undefined;
});

canvas.addEventListener('click', () => {
    objects.forEach(obj => {
        // Solo eliminamos si no se está desvaneciendo ya
        if (!obj.isFading && obj.isHovered(mouse.x, mouse.y)) {
            obj.startFadeOut();
        }
    });
});

restartBtn.addEventListener('click', () => location.reload());

/**
 * FÍSICA DE COLISIONES
 * Función utilitaria para rotar los ejes de velocidad
 */
function rotate(velocity, angle) {
    const rotatedVelocities = {
        x: velocity.x * Math.cos(angle) - velocity.y * Math.sin(angle),
        y: velocity.x * Math.sin(angle) + velocity.y * Math.cos(angle)
    };
    return rotatedVelocities;
}

/**
 * Resuelve la colisión elástica entre dos partículas
 */
function resolveCollision(particle, otherParticle) {
    const xVelocityDiff = particle.velocity.x - otherParticle.velocity.x;
    const yVelocityDiff = particle.velocity.y - otherParticle.velocity.y;

    const xDist = otherParticle.x - particle.x;
    const yDist = otherParticle.y - particle.y;

    // Prevenir superposición accidental (evita que se peguen)
    if (xVelocityDiff * xDist + yVelocityDiff * yDist >= 0) {

        // Ángulo de colisión
        const angle = -Math.atan2(otherParticle.y - particle.y, otherParticle.x - particle.x);

        // Masas (usamos el radio como masa)
        const m1 = particle.mass;
        const m2 = otherParticle.mass;

        // Velocidad antes de la ecuación (rotada)
        const u1 = rotate(particle.velocity, angle);
        const u2 = rotate(otherParticle.velocity, angle);

        // Velocidad después de la colisión (ecuación de choque elástico 1D)
        const v1 = { x: u1.x * (m1 - m2) / (m1 + m2) + u2.x * 2 * m2 / (m1 + m2), y: u1.y };
        const v2 = { x: u2.x * (m1 - m2) / (m1 + m2) + u1.x * 2 * m1 / (m1 + m2), y: u2.y };

        // Rotar de vuelta a los ejes originales
        const vFinal1 = rotate(v1, -angle);
        const vFinal2 = rotate(v2, -angle);

        // Intercambiar velocidades
        particle.velocity.x = vFinal1.x;
        particle.velocity.y = vFinal1.y;

        otherParticle.velocity.x = vFinal2.x;
        otherParticle.velocity.y = vFinal2.y;
    }
}

/**
 * Clase Círculo
 */
class Circle {
    constructor(level) {
        this.radius = Math.random() * 20 + 15; 
        this.mass = this.radius; // La masa es proporcional al radio
        
        // Posición inicial aleatoria (evitando bordes extremos)
        this.x = Math.random() * (canvas.width - this.radius * 2) + this.radius;
        this.y = canvas.height + this.radius + (Math.random() * 100); 
        
        // Velocidad como vector
        const speedBase = 1 + (level * 0.5); 
        this.velocity = {
            x: (Math.random() - 0.5) * 2, // Movimiento lateral
            y: -speedBase // Hacia arriba
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

        // Si se está desvaneciendo, no se mueve ni colisiona
        if (this.isFading) {
            this.opacity -= 0.05;
            this.radius += 0.5;
            if (this.opacity <= 0) {
                this.markedForDeletion = true;
                eliminatedCount++;
                updateStats();
            }
            return; // Salir para no procesar movimiento
        }

        // Detección de Colisiones con otros círculos
        for (let i = 0; i < circles.length; i++) {
            // No checar colisión consigo mismo
            if (this === circles[i]) continue;
            // No chocar con objetos que están muriendo
            if (circles[i].isFading) continue;

            // Distancia entre centros
            const dist = Math.sqrt(Math.pow(this.x - circles[i].x, 2) + Math.pow(this.y - circles[i].y, 2));

            // Si la distancia es menor a la suma de radios -> Colisión
            if (dist - (this.radius + circles[i].radius) < 0) {
                resolveCollision(this, circles[i]);
            }
        }

        // Rebote en paredes laterales
        if (this.x + this.radius >= canvas.width || this.x - this.radius <= 0) {
            this.velocity.x = -this.velocity.x;
        }
        
        // Opcional: Rebote en el piso si caen por una colisión
        if (this.y - this.radius > canvas.height + 150) {
             // Si caen muy abajo, forzamos que suban de nuevo
             this.velocity.y = -Math.abs(this.velocity.y);
        }

        // Aplicar movimiento
        this.x += this.velocity.x;
        this.y += this.velocity.y;

        // Salir por arriba (Solo si sale completamente)
        if (this.y + this.radius < 0) {
            this.markedForDeletion = true;
        }
    }

    isHovered(mx, my) {
        if (mx === undefined || my === undefined) return false;
        const dist = Math.sqrt((this.x - mx) ** 2 + (this.y - my) ** 2);
        return dist < this.radius;
    }

    startFadeOut() {
        if (!this.isFading) {
            this.isFading = true;
            // Detener movimiento al morir
            this.velocity.x = 0;
            this.velocity.y = 0;
        }
    }
}

/**
 * Lógica del Juego
 */
function updateStats() {
    scoreDisplay.innerText = eliminatedCount;
    const percent = Math.round((eliminatedCount / TOTAL_OBJECTS) * 100);
    percentDisplay.innerText = `${percent}%`;
    progressBar.style.width = `${percent}%`;
}

function spawnEnemies() {
    if (objectsSpawnedInLevel < GROUP_SIZE) {
        // Generación un poco más rápida para ver las colisiones mejor
        if (Math.random() < 0.05) { 
            // Validar que no nazca encima de otro (opcional pero recomendado)
            let radius = Math.random() * 20 + 15;
            let x = Math.random() * (canvas.width - radius * 2) + radius;
            
            // Creamos objeto temporalmente
            let newCircle = new Circle(currentLevel);
            // Sobreescribimos con las coordenadas calculadas
            newCircle.x = x; 
            newCircle.radius = radius;
            
            objects.push(newCircle);
            objectsSpawnedInLevel++;
        }
    }
}

function checkLevelStatus() {
    // Si no quedan objetos vivos Y ya salieron todos los del nivel
    if (objectsSpawnedInLevel === GROUP_SIZE && objects.length === 0) {
        if (currentLevel < TOTAL_LEVELS) {
            currentLevel++;
            objectsSpawnedInLevel = 0;
            levelDisplay.innerText = currentLevel;
        } else {
            cancelAnimationFrame(animationId);
            overlay.style.display = 'block';
            restartBtn.style.display = 'block';
        }
    }
}

function animate() {
    animationId = requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    spawnEnemies();

    // Actualizar cada objeto pasándole la lista completa para checar colisiones
    objects.forEach(obj => obj.update(objects));

    // Limpieza de objetos marcados para borrar
    // Usamos filter para crear un nuevo array solo con los vivos
    objects = objects.filter(obj => !obj.markedForDeletion);

    checkLevelStatus();
}

animate();