import net from "net";
import http from "http";

import { EventData, EventHubProducerClient } from "@azure/event-hubs";
import { envOrThrow } from "@inrixia/helpers/object";

import { config } from "dotenv";
config();

(async () => {
	const eventHubProducer = new EventHubProducerClient(await envOrThrow("EVENTHUB_CONNECTION_STRING"), envOrThrow("EVENTHUB_NAME"));

	const tcpIP = await envOrThrow("TCP_IP");
	const tcpPORT = +(await envOrThrow("TCP_PORT"));

	const prefixStation = process.env["STATION_PREFIX"];

	const stats = {
		version: process.env.npm_package_version,
		received: {
			lines: 0,
			bytes: 0,
			lastLine: "",
		},
		sent: {
			lines: 0,
			bytes: 0,
		},
		queued: {
			lines: 0,
			bytes: 0,
		},
	};
	let queuedMessages: Array<EventData> = [];

	const sendData = () =>
		setTimeout(async () => {
			if (queuedMessages.length !== 0) {
				stats.sent.bytes += stats.queued.bytes;
				stats.sent.lines += queuedMessages.length;

				// Copy and clear queuedMessages before sending so we dont clear messages that are added while sending
				const linesToSend = [...queuedMessages];
				queuedMessages = [];
				await eventHubProducer.sendBatch(linesToSend).catch((err) => {
					console.error(err);
					process.exit();
				});

				stats.queued.lines = 0;
				stats.queued.bytes = 0;
			}
			sendData();
		}, 5000);
	sendData();

	http
		.createServer((req, res) => {
			res.write(JSON.stringify(stats));
			res.end();
		})
		.listen(80);

	let lineBuffer = "";
	let lineBytes = 0;
	const ingestSocket = new net.Socket();

	ingestSocket.on("close", () => {
		throw new Error("Connection closed");
	});

	ingestSocket.on("data", async (data) => {
		stats.received.bytes += data.byteLength;
		lineBytes += data.byteLength;
		lineBuffer += data.toString();

		let startIndex = 0;
		let messageEndIndex = 0;
		while ((messageEndIndex = lineBuffer.indexOf("\n", startIndex)) !== -1) {
			let joinedLine = lineBuffer.slice(startIndex, messageEndIndex).replace("\n", "").replace("\r", "");
			stats.received.lines++;

			// Skip first message as its most likely incomplete, also filter only AIS messages
			if (stats.received.lines !== 1 /*&& joinedLine.includes("AIVDM")*/) {
				// Send the batch to the event hub.
				if (prefixStation !== undefined) joinedLine = `\\s:${prefixStation}${joinedLine}`;
				stats.received.lastLine = joinedLine;
				queuedMessages.push({
					body: joinedLine,
					properties: {
						receivedTime: Date.now(),
					},
				});
				stats.queued.lines = queuedMessages.length;
				stats.queued.bytes += lineBytes;
				lineBytes = 0;
			}

			startIndex = messageEndIndex + 1;
		}
		if (startIndex !== 0) lineBuffer = lineBuffer.slice(startIndex);
	});

	ingestSocket.connect(tcpPORT, tcpIP, () => console.log(`Connected to ingest tcp socket on ${tcpIP}:${tcpPORT}`));
})();
