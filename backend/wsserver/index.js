'use strict';

var logger = require('../core/logger');
var io = require('socket.io');
var express = require('express');

var WEBSOCKETS_NAMESPACES = ['/ws'];

var wsserver = {
  server: null,
  port: null,
  started: false,
  namespaces: WEBSOCKETS_NAMESPACES
};

exports = module.exports = wsserver;

var websockets = {};
function getSocketForUser(user) {
  if (!user) {
    return null;
  }
  return websockets[user];
}
wsserver.getSocketForUser = getSocketForUser;

function start(port, callback) {
  if (arguments.length === 0) {
    logger.error('Websocket server start method should have at least 1 argument');
    process.exit(1);
  }

  callback = callback || function() {};

  function listenCallback(err) {
    wsserver.server.removeListener('listening', listenCallback);
    wsserver.server.removeListener('error', listenCallback);
    callback(err);
  }

  if (wsserver.started) {
    return callback();
  }
  wsserver.started = true;

  var webserver = require('../webserver');
  wsserver.port = port;
  var realCallback = callback;
  if (webserver && webserver.server && webserver.port === wsserver.port) {
    logger.debug('websocket server will be attached to the Express server');
    wsserver.server = webserver.server;
  } else {
    logger.debug('websocket server will launch a new Express server');
    wsserver.server = express().listen(wsserver.port);
    wsserver.server.on('listening', listenCallback);
    wsserver.server.on('error', listenCallback);
    realCallback = function() {};
  }

  var sio = io.listen(wsserver.server);
  if (sio) {
    sio.configure(function() {
      sio.set('authorization', require('./auth/token'));
    });

    sio.sockets.on('connection', function(socket) {
      var user = socket.handshake.user;
      websockets[user] = socket;

      socket.on('disconnect', function() {
        logger.info('Socket is disconnected for user = ', user);
        delete websockets[user];
      });
    });

    wsserver.io = sio;
    require('./events')(sio);
  }
  return realCallback();
}

wsserver.start = start;
