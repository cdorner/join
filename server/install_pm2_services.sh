#!/bin/bash

: ${JOIN_HOME:=~/workspace/join/server}
: ${JOIN_API:=jointhegame1}

if [ $# -lt 1 ]
  then
    echo "Usage: install_pm2_services.sh <secret>"
    exit -1
fi

SECRET=$1

pm2 start ${JOIN_HOME}/bin/app.default_services.js -- -FIREBASE="https://${JOIN_API}.firebaseio.com" -SECRET="$1" --name=join-message_delivery
pm2 start ${JOIN_HOME}/bin/app.message_delivery.js -- -FIREBASE="https://${JOIN_API}.firebaseio.com" -SECRET="$1" --name=join-default_services
pm2 start ${JOIN_HOME}/bin/app.notification_delivery.js -- -FIREBASE="https://${JOIN_API}.firebaseio.com" -SECRET="$1" --name=join-notification_delivery