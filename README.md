# 🔵 BubbleHunter 2D - Cyber Arcade Edition

> Un juego de disparos arcade desarrollado con tecnologías web modernas, enfocado en simulación de física y generación de audio procedimental.

![Badge Status](https://img.shields.io/badge/Status-Terminado-success)
![Badge Tech](https://img.shields.io/badge/Tech-HTML5_Canvas_JS-blue)
![Badge School](https://img.shields.io/badge/ITICS-Tec_de_Pachuca-1b396a)

## 🎓 Información Académica

| Campo | Detalle |
| :--- | :--- |
| **Institución** | Instituto Tecnológico de Pachuca |
| **Carrera** | Ingeniería en Tecnologías de la Información y Comunicaciones (ITICS) |
| **Materia** | Desarrollo en Ambientes Virtuales |
| **Alumno** | **Luis Enrique Cabrera García** |
| **Semestre** | Enero - Junio 2026 |

---

## 🎮 Descripción del Proyecto

**BubbleHunter 2D** es un videojuego web que demuestra el uso avanzado de la API `Canvas` de HTML5. El objetivo es eliminar burbujas generadas dinámicamente antes de que se acumulen, utilizando un sistema de físicas para rebotes y colisiones realistas.

El proyecto destaca por no utilizar librerías de juegos externas (como Phaser o Unity Web), sino que todo el motor de física, el sistema de partículas y el audio fueron programados desde cero con **JavaScript Vanilla**.

## 🚀 Características Técnicas

Este proyecto implementa conceptos avanzados de ingeniería de software y programación gráfica:

* **⚡ Motor de Física Propio:** Detección de colisiones circulares, resolución de solapamiento y rebote elástico con conservación de momento.
* **🔊 Audio Sintetizado (Web Audio API):** No se utilizan archivos `.mp3`. Todos los efectos de sonido (disparos, combos, game over) se generan en tiempo real mediante osciladores y ondas matemáticas.
* **✨ Sistema de Partículas:** Efectos visuales de explosión con gravedad y fricción.
* **💾 Persistencia de Datos:** Uso de `localStorage` para guardar el Récord (High Score) del usuario permanentemente.
* **🎨 Diseño Cyberpunk:** Interfaz moderna con efectos de Neón y Glassmorphism usando CSS3 avanzado.
* **📱 Diseño Responsivo:** Adaptable a diferentes tamaños de pantalla.

## 🛠️ Tecnologías Utilizadas

* **HTML5:** Estructura semántica y elemento `<canvas>`.
* **CSS3:** Variables, Flexbox, Animaciones y efectos de luz.
* **JavaScript (ES6+):** Programación Orientada a Objetos (Clases), Arrow Functions y manipulación del DOM.
* **Bootstrap 5:** Framework para la maquetación de la interfaz de usuario (UI).

## 🕹️ Cómo Jugar

1.  **Clona o descarga** este repositorio.
2.  Abre el archivo `index.html` en tu navegador web favorito (Chrome, Edge, Firefox).
3.  Haz **clic** sobre las burbujas para eliminarlas.
4.  ¡Haz clic rápido para generar **COMBOS** y multiplicar tu puntuación!
5.  Evita que las burbujas saturen la pantalla.

## 📂 Estructura del Proyecto

```text
BubbleHunter2D/
├── css/
│   └── style.css       # Estilos Cyberpunk y Glassmorphism
├── js/
│   └── script.js       # Lógica del juego, física y audio
├── index.html          # Punto de entrada
└── README.md           # Documentación
© 2026 Luis Enrique Cabrera García. Proyecto educativo para el Tec de Pachuca.
