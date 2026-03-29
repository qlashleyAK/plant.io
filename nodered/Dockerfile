FROM nodered/node-red:latest

# Install Phidget and Dashboard 2.0 nodes
RUN npm install \
  node-red-contrib-phidget22 \
  @flowfuse/node-red-dashboard \
  node-red-node-smooth \
  node-red-contrib-tuya-smart-device

# flows.json is provided via volume mount to /data/flows.json
