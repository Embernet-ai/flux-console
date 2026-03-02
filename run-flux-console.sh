#!/bin/bash
#
# Flux Console entrypoint script
# Based on OpenZiti ZAC, licensed under Apache 2.0
#
# This script runs the Flux Console within a container.
# It adds two symlinks required to run the server with TLS:
# - the private key: server.key -> ${FLUX_CONSOLE_SERVER_KEY}
# - certificate chain, including any intermediates: server.chain.pem -> ${FLUX_CONSOLE_SERVER_CERT_CHAIN}

if [[ "${FLUX_CONSOLE_SERVER_KEY}" != "" ]]; then
  while [ ! -f "${FLUX_CONSOLE_SERVER_KEY}" ]; do
    echo "waiting for server key to exist..."
    sleep 3
  done

  echo "Flux Console will use this key for TLS: ${FLUX_CONSOLE_SERVER_KEY}"
  ln -s "${FLUX_CONSOLE_SERVER_KEY}" /usr/src/app/server.key
fi
if [[ "${FLUX_CONSOLE_SERVER_CERT_CHAIN}" != "" ]]; then
  while [ ! -f "${FLUX_CONSOLE_SERVER_CERT_CHAIN}" ]; do
    echo "waiting for server cert chain to exist..."
    sleep 3
  done

  echo "Flux Console will present this pem for TLS: ${FLUX_CONSOLE_SERVER_CERT_CHAIN}"
  ln -s "${FLUX_CONSOLE_SERVER_CERT_CHAIN}" /usr/src/app/server.chain.pem
fi

if [[ "${FLUX_CTRL_EDGE_ADVERTISED_ADDRESS}" != "" ]]; then
if [[ "${FLUX_CTRL_EDGE_ADVERTISED_PORT}" != "" ]]; then
if [[ "${FLUX_CTRL_NAME}" == "" ]]; then
  FLUX_CTRL_NAME="flux-controller"
fi
  echo "emitting settings.json"
  cat > /usr/src/app/assets/data/settings.json <<HERE
{
    "edgeControllers":[{
        "name":"${FLUX_CTRL_NAME}",
        "url":"https://${FLUX_CTRL_EDGE_ADVERTISED_ADDRESS}:${FLUX_CTRL_EDGE_ADVERTISED_PORT}",
        "default":true
    }],
    "editable": true,
    "update": false,
    "location": "../flux",
    "port": 1408,
    "portTLS": 8443,
    "logo": "",
    "primary": "",
    "secondary": "",
    "allowPersonal":  true,
    "rejectUnauthorized": false,
    "mail": {
        "host": "",
        "port": 25,
        "secure": false,
        "auth": {
            "user": "",
            "pass": ""
        }
    },
    "from": "",
    "to": ""
}
HERE
else
  echo FLUX_CTRL_EDGE_ADVERTISED_ADDRESS set but FLUX_CTRL_EDGE_ADVERTISED_PORT not set. cannot create default server
fi
fi

if [[ "$1" == "classic" ]]; then
  echo "Running Classic Flux Console Application"
  exec node /usr/src/app/server.js classic
elif [[ "$1" == "edge-api" ]]; then
  echo "Running Flux Console server with Edge API integration"
  exec node /usr/src/app/server-edge.js
elif (( $#)); then
  echo "Running: server.js $*"
  exec node /usr/src/app/server.js $*
else
  echo "Running Flux Console Server with Node API Integration"
  exec node /usr/src/app/server.js node-api
fi
