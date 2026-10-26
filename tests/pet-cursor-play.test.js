import { describe, expect, it } from 'vitest';
import { createPet } from '../packages/cortico-world-desktop-pet/web/kit/body.js';
import { cooFigure, defaultSkin } from '../packages/cortico-world-desktop-pet/web/coo/coo.js';

function advance(body, seconds) {
    for (let i = 0; i < seconds * 60; i++) {
        body.step(1 / 60);
        body.render();
    }
}

function setup(options = {}) {
    const element = () => ({ setAttribute() {}, innerHTML: '' });
    const events = [];
    const body = createPet({ petG: element(), shadowEl: element(), fxG: element() }, {
        figure: cooFigure(), skin: defaultSkin(), roam: 'free', startX: 600,
        bounds: () => ({ W: 1200, H: 800, floorY: 780, S: .42 }),
        sfx: { play() {} }, onEvent: (kind, detail) => events.push({ kind, detail }),
        ...options,
    });
    body.pet.nextAt = Infinity;
    advance(body, .1);
    return { body, events };
}

function move(body, x, y = body.pet.fy - 128 * body.bounds.S) {
    body.observeCursor({ x, y, t: body.time * 1000 });
    advance(body, .1);
}

function wiggle(body, center, amplitude = 18, y) {
    for (const offset of [-amplitude, amplitude, -amplitude, amplitude]) {
        move(body, center + offset, y);
    }
}

describe('playing with the observed mouse cursor', () => {
    it('ignores a passing cursor, small jitter and movement far above the body', () => {
        const { body } = setup();
        for (const x of [740, 760, 780, 800]) {
            move(body, x);
        }
        wiggle(body, 780, 3);
        wiggle(body, 780, 18, 50);
        expect(body.pet.x).toBe(600);
        expect(body.pet.mode).toBe('idle');
        expect(body.pet.pulse).toBeNull();
    });

    it('chases a wiggled cursor along the walking height and waves when close', () => {
        const { body, events } = setup();
        const height = body.pet.fy;
        wiggle(body, 780);
        expect(body.pet.mode).toBe('walk');
        expect(body.pet.x).toBeGreaterThan(600);
        for (let i = 0; i < 30; i++) {
            move(body, 798);
        }
        expect(body.pet.x).toBeGreaterThan(700);
        expect(body.pet.fy).toBe(height);
        expect(body.pet.mode).toBe('idle');
        expect(events.some((event) => event.kind === 'touch')).toBe(false);
        expect(events.some((event) => event.kind === 'arrived')).toBe(false);
        expect(body.pet.lastAct).toBe('wave');
    });

    it('dodges when the mouse is wiggled just beside the body', () => {
        const { body } = setup();
        wiggle(body, 656, 10);
        expect(body.pet.mode).toBe('run');
        expect(body.pet.target).toBeLessThan(600);
        advance(body, 1);
        expect(body.pet.x).toBeLessThan(600);
    });

    it('waves toward a cursor within reach and waits before reacting again', () => {
        const { body } = setup();
        wiggle(body, 685);
        expect(body.pet.pulse?.kind).toBe('wave');
        expect(body.pet.facing).toBe(1);
        expect(body.pet.x).toBe(600);
        advance(body, 2);
        wiggle(body, 685);
        expect(body.pet.pulse).toBeNull();
    });

    it.each(['off', 'dialog', 'listening', 'thinking', 'command', 'gesture'])('does not start playing during %s', (state) => {
        const { body } = setup({ dialogOpen: () => state === 'dialog', cursorPlayPaused: () => state === 'command' });
        if (state === 'off') {
            body.setRoam('off');
        } else if (state === 'listening') {
            body.setListening(true);
        } else if (state === 'thinking') {
            body.setThinking(true);
        } else if (state === 'gesture') {
            body.act('wave');
        }
        wiggle(body, 780);
        expect(body.pet.x).toBe(600);
        expect(['walk', 'run']).not.toContain(body.pet.mode);
    });

    it('leaves an ordered walk running and reports its arrival once', () => {
        const { body, events } = setup();
        body.walkTo(300, false, 'ordered');
        wiggle(body, 780);
        advance(body, 8);
        expect(events.filter((event) => event.kind === 'arrived')).toEqual([
            { kind: 'arrived', detail: { walkId: 'ordered', x: expect.any(Number) } },
        ]);
        expect(events.some((event) => event.kind === 'interrupted')).toBe(false);
    });

    it.each(['leave', 'dialog', 'command', 'thinking'])('ends a chase on %s', (reason) => {
        let dialog = false, command = false;
        const { body } = setup({ dialogOpen: () => dialog, cursorPlayPaused: () => command });
        wiggle(body, 780);
        expect(body.pet.mode).toBe('walk');
        if (reason === 'leave') {
            body.observeCursor(null);
        } else if (reason === 'dialog') {
            dialog = true;
        } else if (reason === 'command') {
            command = true;
        } else {
            body.setThinking(true);
        }
        advance(body, .1);
        expect(body.pet.mode).toBe('idle');
        const x = body.pet.x;
        advance(body, .2);
        expect(body.pet.x).toBe(x);
    });

    it('keeps dragging available without cursor play', () => {
        const { body, events } = setup();
        const hit = body.layout().hit[0];
        expect(body.pointerDown({ x: hit.x, y: hit.y, t: 0 })).toBe(true);
        body.pointerMove({ x: hit.x + 20, y: hit.y, t: 100 });
        wiggle(body, 780);
        expect(body.pet.mode).toBe('drag');
        expect(events).toContainEqual({ kind: 'touch', detail: { kind: 'grab' } });
        expect(events.some((event) => event.kind === 'arrived')).toBe(false);
    });

    it('ends cursor movement when a gesture or a move to the current position is requested', () => {
        for (const command of ['wave', 'stay']) {
            const { body } = setup();
            wiggle(body, 780);
            expect(body.pet.mode).toBe('walk');
            const x = body.pet.x;
            if (command === 'wave') {
                body.act('wave');
            } else {
                body.walkTo(x, false, 'stay');
            }
            advance(body, .3);
            expect(body.pet.x).toBe(x);
            expect(body.pet.mode).toBe('idle');
        }
    });

    it('does not combine reversals separated by a long pause', () => {
        const { body } = setup();
        move(body, 762);
        move(body, 798);
        advance(body, 1);
        move(body, 762);
        move(body, 798);
        expect(body.pet.x).toBe(600);
        expect(body.pet.mode).toBe('idle');
    });

    it('responds once a conversation is closed even while its roaming hold remains', () => {
        let dialog = true;
        const { body } = setup({ dialogOpen: () => dialog });
        body.holdRoam(20);
        wiggle(body, 780);
        expect(body.pet.mode).toBe('idle');
        dialog = false;
        wiggle(body, 780);
        expect(body.pet.mode).toBe('walk');
    });

    it.each(['sit', 'sleep', 'look', 'walk', 'run'])('responds during an ambient %s', (mode) => {
        const { body } = setup();
        body.act(mode);
        wiggle(body, 780);
        expect(body.pet.mode).toBe('walk');
        expect(body.pet.target).toBeGreaterThan(body.pet.x);
    });

    it('still delivers head pats from pointer input while observed positions stay on the body', () => {
        const { body, events } = setup();
        const hit = body.layout().hit[0];
        body.pointerMove({ x: hit.x, y: hit.y, t: 0 });
        advance(body, 3);
        events.length = 0;
        for (let i = 0; i < 30; i++) {
            const p = { x: hit.x + (i % 2 ? -16 : 16), y: hit.y, t: 3000 + i * 50 };
            body.pointerMove(p);
            body.observeCursor(p);
            advance(body, .05);
        }
        expect(events).toContainEqual(expect.objectContaining({ kind: 'touch', detail: { kind: 'pet', asleep: false } }));
        expect(body.pet.x).toBe(600);
    });
});
