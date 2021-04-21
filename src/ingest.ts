import net from 'net';
import http from 'http';

let linesReceived = 0;
let receivedBytes = 0;
let lastReceivedLine = "";

http.createServer((req, res) => {
	res.write(JSON.stringify({
		linesReceived: linesReceived-1,
		receivedBytes,
		lastReceivedLine
	}))
	res.end();
}).listen(80);

let dataBuffer = ""
const ingestSocket = new net.Socket();

ingestSocket.on('close', () => {
	throw new Error('Connection closed')
})

ingestSocket.on('data', data => {
	receivedBytes += data.byteLength
	dataBuffer += data.toString();

	let startIndex = 0;
	let messageEndIndex = 0;
	while ((messageEndIndex = dataBuffer.indexOf('\n', startIndex)) !== -1) {
		linesReceived++

		lastReceivedLine = dataBuffer.slice(startIndex, messageEndIndex).replace("\n", "").replace("\r", "")

		startIndex = messageEndIndex + 1;

		// if (linesReceived !== 1) {
		// 	process.stdout.write(`${JSON.stringify(lastReceivedLine)}\nReceived: ${linesReceived-1}, ${(receivedBytes/1000/1000).toFixed(2)} MB\r`)
		// };
	}
	if (startIndex !== 0) dataBuffer = dataBuffer.slice(startIndex);
})

const ip = '202.12.104.70';
const port = 4004;

ingestSocket.connect(port, ip, () => console.log(`Connected to ingest tcp socket on ${ip}:${port}`));