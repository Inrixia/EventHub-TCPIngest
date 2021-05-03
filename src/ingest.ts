import net from "net";
import http from "http";

import { EventHubProducerClient } from "@azure/event-hubs";
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
let lastSentLine = "";

http.createServer((req, res) => {
	res.write(JSON.stringify({
		version: process.env.npm_package_version,
		received: {
			lines: receivedLines-1,
			bytes: receivedBytes,
			lastLine: lastReceivedLine,
		},
		sent: {
			lines: sentLines,
			bytes: sentBytes,
			lastLine: lastSentLine,
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
			await eventHubProducer.sendBatch([{
				body: joinedLine,
				properties: {
					receivedTime: Date.now()
				}
			}]).catch(console.error);
			lastSentLine = joinedLine;
			sentLines++;
			sentBytes += lineBytes;
		}

		startIndex = messageEndIndex + 1;
	}
	if (startIndex !== 0) lineBuffer = lineBuffer.slice(startIndex);
});

ingestSocket.connect(+kordiaPort, kordiaIP, () => console.log(`Connected to ingest tcp socket on ${kordiaIP}:${+kordiaPort}`));