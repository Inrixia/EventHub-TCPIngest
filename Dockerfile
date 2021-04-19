FROM node:latest

LABEL Description="Kordia RAW tcp ingest container"

# Copy src files
COPY ./ingest.js /ingest.js

# Runs container start
CMD node ./ingest.js