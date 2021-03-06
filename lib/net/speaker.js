'use strict';

// Load NPM modules
const net = require('net');

// Load libs
const networkBase = require('./networkBase');

// Declare variables
var ERR_REQ_REFUSED = -1;
var MAX_WAITERS = 9999999;

// FUNCTION: Extend object
const extendsObj = function(child, parent) {
  for (var key in parent) {
    if ({}.hasOwnProperty.call(parent, key)) child[key] = parent[key];
  }
  function ctor() {
    this.constructor = child;
  }
  ctor.prototype = parent.prototype;
  child.prototype = new ctor();
  child.__super__ = parent.prototype;
  return child;
};

// FUNCTION: Speaker
const Speaker = (function(_super) {
  extendsObj(Speaker, _super);
  function Speaker(addresses) {
    var address, _i, _len;
    Speaker.__super__.constructor.call(this);
    this.uniqueId = 1;
    this.sockets = [];
    this.waiters = {};
    this.socketIterator = 0;
    for (_i = 0, _len = addresses.length; _i < _len; _i++) {
      address = addresses[_i];
      this.connect(address);
    }
  }
  Speaker.prototype.connect = function(address) {
    var host,
      port,
      self,
      socket,
      _this = this;
    self = this;
    host = this.getHostByAddress(address);
    port = this.getPortByAddress(address);
    socket = new net.Socket();
    socket.uniqueSocketId = this.generateUniqueId();
    socket.setEncoding('utf8');
    socket.setNoDelay(true);
    socket.setMaxListeners(Infinity);
    socket.connect(
      port,
      host,
      function() {
        console.log('NOTICE: Remote Host Connected Successfully!');
        return _this.sockets.push(socket);
      }
    );
    socket.on('data', function(data) {
      var message, messageText, _i, _len, _ref, _results;
      _ref = _this.tokenizeData(data);
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        messageText = _ref[_i];
        message = JSON.parse(messageText);
        if (!_this.waiters[message.id]) {
          continue;
        }
        _this.waiters[message.id](message.data);
        _results.push(delete _this.waiters[message.id]);
      }
      return _results;
    });
    socket.on('error', function() {});
    return socket.on('close', function() {
      console.log('NOTICE: Remote Host Closed Connection. Reconnecting...');
      var index, sock, _i, _len, _ref;
      index = 0;
      _ref = _this.sockets;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        sock = _ref[_i];
        if (sock.uniqueSocketId === socket.uniqueSocketId) {
          break;
        }
        index += 1;
      }
      _this.sockets.splice(index, 1);
      socket.destroy();
      return setTimeout(function() {
        return self.connect(address);
      }, 10);
    });
  };
  Speaker.prototype.request = function(subject, data, callback) {
    if (callback == null) {
      callback = null;
    }
    return this.send(subject, data, callback);
  };
  Speaker.prototype.send = function(subject, data, callback) {
    var messageId, payload;
    if (callback == null) {
      callback = null;
    }
    if (this.sockets.length === 0) {
      if (callback) {
        callback({
          error: ERR_REQ_REFUSED,
        });
      }
      return;
    }
    if (!this.sockets[this.socketIterator]) {
      this.socketIterator = 0;
    }
    if (callback) {
      messageId = this.generateUniqueId();
      this.waiters[messageId] = callback;
    }
    payload = this.prepareJsonToSend({
      id: messageId,
      subject: subject,
      data: data,
    });
    return this.sockets[this.socketIterator++].write(payload);
  };
  Speaker.prototype.shout = function(subject, data) {
    var payload, socket, _i, _len, _ref, _results;
    payload = {
      subject: subject,
      data: data,
    };
    _ref = this.sockets;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      socket = _ref[_i];
      _results.push(socket.write(this.prepareJsonToSend(payload)));
    }
    return _results;
  };
  Speaker.prototype.generateUniqueId = function() {
    var id, newId;
    id = 'id-' + this.uniqueId;
    if (!this.waiters[id]) {
      return id;
    }
    if (this.uniqueId++ === MAX_WAITERS) {
      this.uniqueId = 1;
    }
    if (this.waiters[(newId = 'id-' + this.uniqueId)]) {
      delete this.waiters[newId];
    }
    return this.generateUniqueId();
  };
  return Speaker;
})(networkBase);

// EXPORTS
module.exports = Speaker;
