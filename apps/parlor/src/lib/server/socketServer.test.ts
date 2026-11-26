/**
 * Regression for CORE-AUDIT F-01 on `lobby:selectGame`: a non-function ack used
 * to crash the whole process. Real socket.io server + client, using the real
 * parlor wiring (all games registered).
 */
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import type { AppServer } from '@parlor/multiplayer';
import { setupParlorSocketHandlers } from './socketServer.js';

const BAD_ACKS: unknown[] = [1, 0, 'x', true, {}, [], null];

let http: HttpServer;
let io: AppServer;
let client: ClientSocket;
let uncaught: unknown[];
const onUncaught = (err: unknown) => uncaught.push(err);

function ackOnce<T extends unknown[]>(emit: (cb: (...args: T) => void) => void): Promise<T> {
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => reject(new Error('no ack within 2s')), 2000);
		emit((...args) => {
			clearTimeout(t);
			resolve(args);
		});
	});
}

const settle = () => new Promise((r) => setTimeout(r, 50));

beforeEach(async () => {
	uncaught = [];
	process.on('uncaughtException', onUncaught);
	http = createServer();
	io = new Server(http);
	setupParlorSocketHandlers(io);
	await new Promise<void>((r) => http.listen(0, r));
	const { port } = http.address() as AddressInfo;
	client = ioc(`http://localhost:${port}`, { transports: ['websocket'], reconnection: false });
	await new Promise<void>((r) => client.on('connect', () => r()));
});

afterEach(async () => {
	process.off('uncaughtException', onUncaught);
	client.close();
	await io.close();
});

describe('lobby:selectGame malformed ack (F-01)', () => {
	it.each(BAD_ACKS)('ack=%j does not crash, and the server keeps serving', async (bad) => {
		await ackOnce((cb) => client.emit('lobby:create', 'Host', cb));

		// Success path, invalid-game path, and the null-clear path, all with a bad ack.
		client.emit('lobby:selectGame', 'quixx', bad);
		client.emit('lobby:selectGame', 'no-such-game', bad);
		client.emit('lobby:selectGame', null, bad);
		await settle();

		expect(uncaught).toEqual([]);
		const [ok] = await ackOnce<[boolean, string?]>((cb) =>
			client.emit('lobby:selectGame', 'crazy-eights', cb),
		);
		expect(ok).toBe(true);
	});

	it('bad ack before joining a room does not crash', async () => {
		client.emit('lobby:selectGame', 'quixx', 1);
		await settle();
		expect(uncaught).toEqual([]);
		const [ok] = await ackOnce<[boolean, string?]>((cb) => client.emit('lobby:selectGame', 'quixx', cb));
		expect(ok).toBe(false);
	});
});
