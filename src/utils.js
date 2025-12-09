// utils.js — Helper functions for n0body

/**
 * Returns a random number between min and max
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Returns a random integer between min and max (inclusive)
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomIntBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a random element from an array
 * @param {Array} array
 * @returns {*}
 */
function randomFrom(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Clamps a value between min and max
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values
 * @param {number} a
 * @param {number} b
 * @param {number} t - 0 to 1
 * @returns {number}
 */
function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Formats milliseconds to mm:ss
 * @param {number} ms
 * @returns {string}
 */
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Formats milliseconds to hh:mm:ss (for long sessions)
 * @param {number} ms
 * @returns {string}
 */
function formatTimeHMS(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export { randomBetween, randomIntBetween, randomFrom, clamp, lerp, formatTime, formatTimeHMS };
