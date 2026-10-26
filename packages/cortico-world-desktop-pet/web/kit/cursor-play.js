/** Recognizes two deliberate horizontal reversals without treating pointer jitter as play. */
export function createCursorWiggle() {
    let lastAt = -Infinity, startedAt = 0, edge = 0, direction = 0, turns = 0;

    function reset() {
        lastAt = -Infinity;
        direction = 0;
        turns = 0;
    }

    function observe(point, scale) {
        if (point.t - lastAt > 400 || point.t < lastAt || point.t - startedAt > 1400) {
            reset();
        }
        if (lastAt === -Infinity) {
            edge = point.x;
            startedAt = point.t;
        }
        lastAt = point.t;
        const delta = point.x - edge;
        const threshold = Math.max(12, 32 * scale);
        if (!direction) {
            if (Math.abs(delta) >= threshold) {
                direction = Math.sign(delta);
                edge = point.x;
            }
        } else if (delta * direction >= 0) {
            edge = point.x;
        } else if (Math.abs(delta) >= threshold) {
            direction *= -1;
            edge = point.x;
            turns++;
        }
        if (turns >= 2) {
            reset();
            return true;
        }
        return false;
    }

    return { observe, reset };
}
