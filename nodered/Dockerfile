FROM nodered/node-red:latest

# Install Phidget and Dashboard 2.0 nodes
RUN npm install \
  node-red-contrib-phidget22 \
  @flowfuse/node-red-dashboard \
  node-red-node-smooth

# tinytuya for reliable Tuya v3.5 device polling (tuyapi has ECONNRESET issues with v3.5)
USER root
RUN apk add --no-cache python3 py3-pip && \
    pip3 install --break-system-packages tinytuya
USER node-red

# flows.json is provided via volume mount to /data/flows.json
