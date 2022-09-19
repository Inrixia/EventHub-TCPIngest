import net from "net";

import { EventData, EventHubProducerClient } from "@azure/event-hubs";
import { envOrThrow } from "@inrixia/helpers/object";

import { promisify } from "util";
const sleep = promisify(setTimeout);

import { config } from "dotenv";
config();

(async () => {
	const eventHubProducer = new EventHubProducerClient(envOrThrow("EVENTHUB_CONNECTION_STRING"), envOrThrow("EVENTHUB_NAME"));

	const tcpIP = envOrThrow("TCP_IP");
	const tcpPORT = +envOrThrow("TCP_PORT");

	const prefixStation = process.env["STATION_PREFIX"];

	let queuedMessages: EventData[] = [];
	let receivedLines = 0;
	let sentLines = 0;

	const sendData = async () => {
		if (queuedMessages.length !== 0) {
			// Copy and clear queuedMessages before sending so we dont clear messages that are added while sending
			const linesToSend = [...queuedMessages];
			queuedMessages = [];
			await eventHubProducer.sendBatch(linesToSend).catch((err) => {
				console.error(err);
				process.exit();
			});
			sentLines += linesToSend.length;
		}
		await sleep(5000);
		sendData();
	};
	sendData();

	let lineBuffer = "";
	const ingestSocket = new net.Socket();

	ingestSocket.on("close", (hadError) => {
		throw new Error(hadError ? "Socket closed with error!" : "Socket closed!");
	});
	ingestSocket.on("error", (err) => {
		throw err;
	});
	ingestSocket.on("timeout", () => {
		throw new Error("Socket timed out!");
	});
	ingestSocket.on("end", () => {
		throw new Error("Socket ended!");
	});

	ingestSocket.on("data", async (data) => {
		lineBuffer += data.toString();

		let startIndex = 0;
		let messageEndIndex = 0;
		while ((messageEndIndex = lineBuffer.indexOf("\n", startIndex)) !== -1) {
			let joinedLine = lineBuffer.slice(startIndex, messageEndIndex).replace("\n", "").replace("\r", "");
			receivedLines++;

			// Skip first message as its most likely incomplete, also filter only AIS messages
			if (receivedLines !== 1) {
				// Send the batch to the event hub.
				if (prefixStation !== undefined) joinedLine = `\\s:${prefixStation}${joinedLine}`;
				queuedMessages.push({
					body: joinedLine,
					properties: {
						receivedTime: Date.now(),
					},
				});
			}
			startIndex = messageEndIndex + 1;
		}
		if (startIndex !== 0) lineBuffer = lineBuffer.slice(startIndex);
		process.stdout.write(`\rReceived: ${receivedLines}, Sent: ${sentLines}`);
	});
	ingestSocket.connect(tcpPORT, tcpIP, () => console.log(`Connected to ingest tcp socket on ${tcpIP}:${tcpPORT}`));
})();
