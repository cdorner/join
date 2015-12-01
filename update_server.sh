#!/bin/bash

: ${JOIN_HOME:=~/workspace/join}
: ${JOIN_SERVER_HOME:=/home/ubuntu/sources}
: ${JOIN_API:=jointhegame1}
: ${JOIN_SERVER:=104.236.5.247}

TIMESTAMP=$(date +%Y-%m-%d:%H:%M:%S)

echo Creating Tar
tar -cf server.tar server
tar --delete -f server.tar server/node_modules

echo Uploading
scp ${JOIN_HOME}/server.tar ubuntu@104.236.5.247:~/sources/server.tar

echo Stopping services
ssh -t ubuntu@${JOIN_SERVER} pm2 stop all
echo Backup
ssh -t ubuntu@${JOIN_SERVER} tar -cf ${JOIN_SERVER_HOME}/server-$TIMESTAMP.tar ${JOIN_SERVER_HOME}/server
echo Installing
ssh -t ubuntu@${JOIN_SERVER} rm -rf  ${JOIN_SERVER_HOME}/server
ssh -t ubuntu@${JOIN_SERVER} tar -xf  ${JOIN_SERVER_HOME}/server.tar -C ${JOIN_SERVER_HOME}
ssh -t ubuntu@${JOIN_SERVER} sudo npm install --prefix ${JOIN_SERVER_HOME}/server

echo Starting
ssh -t ubuntu@${JOIN_SERVER} pm2 start all

sleep 2

echo Checking
ssh -t ubuntu@${JOIN_SERVER} pm2 list

rm -rf server.tar