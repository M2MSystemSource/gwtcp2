const net = require('net')
const debug = require('debug')('gwtcp2:tcp')
const clients = {}

module.exports = (app) => {
  const self = {}

  self.getClient = (imei) => clients[imei] || null
  self.eachClient = (cb) => Object.keys(clients).forEach((imei) => cb(imei, clients[imei]))

  net.createServer((socket) => {
    socket.setKeepAlive(true)

    debug('new connection: ' + socket.remoteAddress + ':' + socket.remotePort)

    socket.on('data', (rawData) => {
      const data = rawData.toString('utf8')
      const imei = (socket.imei) ? socket.imei : ''
      debug('> ' + imei, data)
      const position = app.data.parse(data.toString('utf8'))
      if (!position) {
        debug('Invalid incoming data')
        return null
      }

      switch (position.mode) {
        case 'greeting': processGreetings(position, socket); break
        case 'auto': processAuto(position, socket); break
        case 'auto-batt': processAuto(position, socket); break
        case 'tcp': processTcp(position, socket); break
        case 'tcp-batt': processTcp(position, socket); break
        case 'ack': processAck(socket); break
        case 'ko': processKo(socket); break
        default: socket.destroy()
      }
    })

    // Add a 'close' event handler to this instance of socket
    socket.on('close', (data) => {
      debug('CLOSED: ' + socket.remoteAddress + ' ' + socket.remotePort)
      self.closeSocket()
    })

    // Add a 'close' event handler to this instance of socket
    socket.on('end', (data) => {
      debug('END: ' + socket.remoteAddress + ' ' + socket.remotePort)
      self.closeSocket()
    })

    socket.on('error', (err) => {
      console.log('[ERR]', err)
      console.log('[ERR] code', err.code)
    })

  }).listen(app.conf.tcpPort)

  self.closeSocket = (imei, socket) => {
    if (socket) socket.destroy()
    if (!imei) return

    if (clients[imei] && clients[imei].socket) {
      clients[imei].socket.destroy()
      clients[imei].socket = null
    } else {
      clients[imei] = {}
    }
  }

  self.saveSocket = (imei, socket) => {
    socket.imei = imei
    clients[imei] = clients[imei] || {}
    clients[imei].socket = socket
    clients[imei].waitingAck = false
  }

  self.savePosition = (imei, position) => {
    app.position.insert(imei, position, (err) => {
      if (err) console.error('insert position', err)
    })
  }

  self.isAlive = (imei, cb = function () {}) => {
    const client = clients[imei]
    if (!client) return false

    try {
      client.socket.write('\n', cb)
      return true
    } catch (e) {
      console.log('[Err] tcp.isAlive', e)
      return false
    }
  }

  /**
   * @param {Object} position
   * @param {NetClient} socket
   */
  const processGreetings = (position, socket) => {
    if (!validateImeiOrCloseTcp(position.imei)) return

    const device = app.cache.get(position.imei)
    if (!device) {
      socket.write('ko-001\n')
      self.closeSocket(position.imei, socket)
    }

    // comprobamos si hay algún comando para enviar
    app.cmd.check(position.imei, socket, (err, closeTcp) => {
      if (err) return console.log('[ERR] cmd check', err)
      if (!position.keepAlive) {
        self.closeSocket(position.imei, socket)
      } else {
        self.saveSocket(position.imei, socket)
        // notificamos que se ha realizado login
        app.io.local.emit('gwtcp2/login', {
          deviceId: position.imei,
          account: device._account
        })
      }
    })
  }

  const processAuto = (position, socket) => {
    if (!validateImeiOrCloseTcp(position.imei)) return

    self.savePosition(position.imei, position.position)
    app.io.local.emit('gwtcp2/position', position)
    app.cmd.check(position.imei, socket, (err) => {
      if (err) return console.log('[ERR] cmd check', err)
      self.closeSocket(position.imei, socket)
    })
  }

  const processTcp = (position, socket) => {
    const client = clients[socket.imei]
    if (!client) return self.closeSocket(socket.imei, socket)
    position.imei = socket.imei
    position.position._device = socket.imei

    self.saveSocket(position.imei, socket)
    self.savePosition(position.imei, position.position)
    app.io.local.emit('gwtcp2/position', position)
    app.cmd.check(position.imei, socket, (err) => {
      if (err) return console.log('[ERR] cmd.check', err)
    })
  }

  const processAck = (socket) => {
    console.log('processAck')
    const client = clients[socket.imei]
    if (!client) return

    if (client.waitingAck) {
      app.io.local.emit('gwtcp2/ack', {deviceId: socket.imei, ack: client.waitingAck})
      client.waitingAck = null
    }
  }

  const processKo = (socket) => {
    app.io.local.emit('gwtcp2/fail', {device: socket.imei})
  }

  const validateImeiOrCloseTcp = (imei, socket) => {
    const client = app.cache.get(imei)
    if (!client) {
      self.closeSocket(imei, socket)
      return false
    }

    return client
  }

  console.log('Server listening on port ' + app.conf.tcpPort)
  app.tcp = self
}
