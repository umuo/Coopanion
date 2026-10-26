import { describe, expect, it } from 'vitest';
import { createPet } from '../packages/cortico-world-desktop-pet/web/kit/body.js';
import { cooFigure, defaultSkin } from '../packages/cortico-world-desktop-pet/web/coo/coo.js';

function advance(body, seconds) {
    for (let i = 0; i < seconds * 60; i++) {
        body.step(1 / 60);
        body.render();
    }
}

function setup() {
    const bounds = { W: 1200, H: 800, floorY: 780, S: .42 };
    const element = () => ({ setAttribute() {}, innerHTML: '' });
    const events = [];
    const body = createPet({ petG: element(), shadowEl: element(), fxG: element() }, {
        figure: cooFigure(), skin: defaultSkin(), roam: 'off',
        bounds: () => bounds,
        sfx: { play() {} },
        onEvent: (kind, detail) => events.push({ kind, ...detail }),
    });
    advance(body, 1);
    return { body, bounds, events };
}

function carry(body, x, y) {
    const hit = body.layout().hit[0];
    expect(body.pointerDown({ x: hit.x, y: hit.y, t: 0 })).toBe(true);
    body.pointerMove({ x, y, t: 500 });
    expect(body.pet.mode).toBe('drag');
    advance(body, 1);
    body.pointerMove({ x, y, t: 1500 });
    advance(body, 1);
}

function release(body, x, y) {
    carry(body, x, y);
    body.pointerUp({ x, y, t: 1600 });
    advance(body, 3);
    return body.pet.fy;
}

describe('walking at the height where the body was released', () => {
    it('walks and lands after a jump at the released height', () => {
        const { body, bounds, events } = setup();
        const height = release(body, 600, 260);
        expect(height).toBeLessThan(bounds.floorY);
        expect(body.walkTo(300, false, 'walk')).toBe(true);
        advance(body, 8);
        expect(events).toContainEqual(expect.objectContaining({ kind: 'arrived', walkId: 'walk' }));
        expect(Math.abs(body.pet.x - 300)).toBeLessThan(2);
        expect(body.pet.fy).toBeCloseTo(height);
        body.act('jump');
        advance(body, .35);
        expect(body.pet.fy).toBeLessThan(height);
        advance(body, 3);
        expect(body.pet.fy).toBeCloseTo(height);
    });

    it('can be dragged below its previous walking height and back to the bottom', () => {
        const { body, bounds } = setup();
        const high = release(body, 600, 200);
        const low = release(body, 600, 450);
        expect(low).toBeGreaterThan(high + 100);
        expect(release(body, 600, bounds.floorY)).toBe(bounds.floorY);
    });

    it('preserves the relative height on resize and keeps the body visible when scaled up', () => {
        const { body, bounds } = setup();
        const height = release(body, 600, 260);
        const ratio = height / bounds.floorY;
        bounds.H *= .75;
        bounds.floorY *= .75;
        body.resize();
        expect(body.pet.fy).toBeCloseTo(bounds.floorY * ratio);
        bounds.S = 1.6;
        body.resize();
        advance(body, 1);
        expect(body.layout().box.y).toBeGreaterThanOrEqual(0);
        expect(body.pet.fy).toBeLessThanOrEqual(bounds.floorY);
    });

    it('sets the walking height on the destination display after a cross-display drop', () => {
        const { body, bounds } = setup();
        carry(body, 600, 260);
        bounds.W = 900;
        bounds.H = 600;
        bounds.floorY = 580;
        body.resize();
        body.shiftDrag(-200, -100);
        body.dropAt({ x: 300, y: 150 });
        advance(body, 3);
        const height = body.pet.fy;
        expect(body.pet.x).toBe(300);
        expect(height).toBeGreaterThan(150);
        expect(height).toBeLessThan(bounds.floorY);
        expect(body.walkTo(600, true, 'run')).toBe(true);
        advance(body, 4);
        expect(body.pet.x).toBeCloseTo(600);
        expect(body.pet.fy).toBeCloseTo(height);
    });

    it('keeps throw velocity and lands on the new walking height', () => {
        const { body, bounds, events } = setup();
        carry(body, 600, 260);
        body.pointerMove({ x: 600, y: 260, t: 2000 });
        body.pointerMove({ x: 680, y: 230, t: 2040 });
        advance(body, 1 / 60);
        body.pointerUp({ x: 680, y: 230, t: 2041 });
        const height = body.bounds.floorY;
        expect(body.pet.vx).toBeGreaterThan(0);
        expect(body.pet.vy).toBeLessThan(0);
        expect(events).toContainEqual(expect.objectContaining({ kind: 'throw' }));
        advance(body, 6);
        expect(body.pet.fy).toBeCloseTo(height);
        expect(height).toBeLessThan(bounds.floorY);
    });
});
