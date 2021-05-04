import net from "net";
import http from "http";

import { EventData, EventHubProducerClient } from "@azure/event-hubs";
import { DefaultAzureCredential } from "@azure/identity";

if (process.env["EVENTHUB_FULLYQUALIFIED_NAMESPACE"] === undefined) throw new Error("Enviroment variable EVENTHUB_FULLYQUALIFIED_NAMESPACE is undefined!");
if (process.env["EVENTHUB_NAME"] === undefined) throw new Error("Enviroment variable EVENTHUB_NAME is undefined!");

if (process.env["KORDIA_IP"] === undefined) throw new Error("Enviroment variable KORDIA_IP is undefined!");
if (process.env["KORDIA_PORT"] === undefined) throw new Error("Enviroment variable KORDIA_PORT is undefined!");

const eventHubProducer = new EventHubProducerClient(process.env["EVENTHUB_FULLYQUALIFIED_NAMESPACE"], process.env["EVENTHUB_NAME"], new DefaultAzureCredential());

const kordiaIP = process.env["KORDIA_IP"];
const kordiaPort = process.env["KORDIA_PORT"];

let receivedLines = 0;
let receivedBytes = 0;
let lastReceivedLine = "";

let sentLines = 0;
let sentBytes = 0;

let queuedBytes = 0;
let queuedMessages: Array<EventData> = [];

const sendData = () => setTimeout(async () => {
	if (queuedMessages.length !== 0) {
		sentBytes += queuedBytes;
		queuedBytes = 0;

		sentLines += queuedMessages.length;
		// Copy and clear queuedMessages before sending so we dont clear messages that are added while sending
		const linesToSend = [...queuedMessages];
		queuedMessages = [];
		await eventHubProducer.sendBatch(linesToSend).catch(console.error);
	}
	sendData();
});
sendData();

http.createServer((req, res) => {
	res.write(JSON.stringify({
		version: process.env.npm_package_version,
		received: {
			lines: receivedLines-1,
			bytes: receivedBytes,
			lastLine: lastReceivedLine,
		},
		queued: {
			lines: queuedMessages.length,
			bytes: queuedBytes
		},
		sent: {
			lines: sentLines,
			bytes: sentBytes
		}
	}));
	res.end();
}).listen(80);

let lineBuffer = "";
let lineBytes = 0;
const ingestSocket = new net.Socket();

ingestSocket.on("close", () => {
	throw new Error("Connection closed");
});

ingestSocket.on("data", async data => {
	receivedBytes += data.byteLength;
	lineBytes += data.byteLength;
	lineBuffer += data.toString();
	
	let startIndex = 0;
	let messageEndIndex = 0;
	while ((messageEndIndex = lineBuffer.indexOf("\n", startIndex)) !== -1) {
		const joinedLine = lineBuffer.slice(startIndex, messageEndIndex).replace("\n", "").replace("\r", "");
		lastReceivedLine = joinedLine;
		receivedLines++;

		if (receivedLines !== 1) {
			// process.stdout.write(`${JSON.stringify(lastReceivedLine)}\nReceived: ${receivedLines-1}, ${(receivedBytes/1000/1000).toFixed(2)} MB\r`)

			// Send the batch to the event hub.
			queuedMessages.push({
				body: joinedLine,
				properties: {
					receivedTime: Date.now()
				}
			});
			queuedBytes += lineBytes;
			lineBytes = 0;
		}

		startIndex = messageEndIndex + 1;
	}
	if (startIndex !== 0) lineBuffer = lineBuffer.slice(startIndex);
});

ingestSocket.connect(+kordiaPort, kordiaIP, () => console.log(`Connected to ingest tcp socket on ${kordiaIP}:${+kordiaPort}`));