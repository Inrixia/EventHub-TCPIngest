import net from "net";
import http from "http";

// import { EventHubProducerClient } from "@azure/event-hubs";

import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";

const getSecret = async () => {
	if (process.env["KEYVAULTURI"] === undefined) return "Enviroment variable KEYVAULTURI is undefined!";
	const client = new SecretClient(process.env["KEYVAULTURI"], new DefaultAzureCredential());
	return await client.getSecret("cake");
};

// const producer = new EventHubProducerClient(connectionString, eventHubName);

http.createServer(async (req, res) => {
	res.write(JSON.stringify(await getSecret().catch(err => {
		if (err.name === "AggregateAuthenticationError") err.desc = "DefaultAzureCredential() failed to authenticate!";
		return err;
	})));
	res.end();
}).listen(80);

// let receivedLines = 0;
// let receivedBytes = 0;
// let lastReceivedLine = "";

// let sentLines = 0;
// let sentBytes = 0;
// let lastSentLine = "";

// http.createServer((req, res) => {
// 	res.write(JSON.stringify({
// 		version: process.env.npm_package_version,
// 		received: {
// 			lines: receivedLines-1,
// 			bytes: receivedBytes,
// 			lastLine: lastReceivedLine,
// 		},
// 		sent: {
// 			lines: sentLines,
// 			bytes: sentBytes,
// 			lastLine: lastSentLine,
// 		}
// 	}));
// 	res.end();
// }).listen(80);

// let lineBuffer = "";
// let lineBytes = 0;
// const ingestSocket = new net.Socket();

// ingestSocket.on("close", () => {
// 	throw new Error("Connection closed");
// });

// ingestSocket.on("data", async data => {
// 	receivedBytes += data.byteLength;
// 	lineBytes += data.byteLength;
// 	lineBuffer += data.toString();
	
// 	let startIndex = 0;
// 	let messageEndIndex = 0;
// 	while ((messageEndIndex = lineBuffer.indexOf("\n", startIndex)) !== -1) {
// 		const joinedLine = lineBuffer.slice(startIndex, messageEndIndex).replace("\n", "").replace("\r", "");
// 		lastReceivedLine = joinedLine;
// 		receivedLines++;

// 		if (receivedLines !== 1) {
// 			// process.stdout.write(`${JSON.stringify(lastReceivedLine)}\nReceived: ${receivedLines-1}, ${(receivedBytes/1000/1000).toFixed(2)} MB\r`)

// 			// Send the batch to the event hub.
// 			await producer.sendBatch([{
// 				body: joinedLine,
// 				properties: {
// 					receivedTime: Date.now()
// 				}
// 			}]).catch(console.error);
// 			lastSentLine = joinedLine;
// 			sentLines++;
// 			sentBytes += lineBytes;
// 		}

// 		startIndex = messageEndIndex + 1;
// 	}
// 	if (startIndex !== 0) lineBuffer = lineBuffer.slice(startIndex);
// });

// const ip = "202.12.104.70";
// const port = 4004;

// ingestSocket.connect(port, ip, () => console.log(`Connected to ingest tcp socket on ${ip}:${port}`));