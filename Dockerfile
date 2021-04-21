FROM node:latest

LABEL Description="Kordia RAW tcp ingest container"

# Install typescript so we can use the tsc command
RUN npm install -g typescript

# Copy package configs into working Directory
COPY ./package.json ./package-lock.json ./tsconfig.json /

# Install required packages
RUN npm install

# Copy src files
COPY ./ingest.js /ingest.js

# Copy src files into Working Directory
COPY ./src /src

# Compile the project
RUN tsc

# Runs container start
CMD node ./dist/ingest.js