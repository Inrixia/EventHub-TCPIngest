FROM node:latest

LABEL Description="EventHub-TCPIngest"

# Create Directory for the Container
WORKDIR /app

# Define volumes to be mountable
VOLUME /app/db

# Copy package configs into working Directory
COPY ./package.json ./package-lock.json ./tsconfig.json /app/

# Install required packages
RUN npm install

# Copy src files into Working Directory
COPY ./src /app/src

# Compile the project
RUN npx tsc

# Runs container start
CMD node ./dist/ingest.js