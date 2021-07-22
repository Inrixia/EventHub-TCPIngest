FROM node:latest

LABEL Description="Kordia RAW tcp ingest container"

# Create Directory for the Container
WORKDIR /app

# Define volumes to be mountable
VOLUME /app/db

# Install typescript so we can use the tsc command
RUN npm install -g typescript

# Copy package configs into working Directory
COPY ./package.json ./package-lock.json ./tsconfig.json /app/

# Install required packages
RUN npm install

# Copy src files into Working Directory
COPY ./src /app/src

# Compile the project
RUN tsc

# Runs container start
CMD npm start