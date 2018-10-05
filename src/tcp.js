const net = require('net')
const debug = require('debug')('gwtcp2:tcp')
const clients = {}
const TIMEOUT = 1000 * 30

module.exports = (app) => {
  const self = {}

  self.getClient = (imei) => clients[imei] || null
  self.eachClient = (cb) => Object.keys(clients).forEach((imei) => cb(imei, clients[imei]))

  net.createServer((socket) => {
    socket.setTimeout(TIMEOUT)

    console.log('')
    debug('new connection: ' + socket.remoteAddress + ':' + socket.remotePort)

    socket.on('data', (rawData) => {
      const data = rawData.toString('utf8')
      const imei = (socket.imei) ? socket.imei : ''
      const position = app.data.parse(data.toString('utf8'))
      if (!position) {
        debug('Invalid incoming data')
        debug(data)
        socket.destroy()
        return null
      }

      console.log('position', position)

      const device = app.cache.get(imei)
      if (device) {
        debug('>', imei, device.name, data)
      } else {
        debug('>', imei, data)
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

    socket.on('timeout', () => {
      console.log('timeout')
      self.closeSocket()
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

    if (clients[imei]) {
      clients[imei].socket.setTimeout(0)
      delete clients[imei].socket
      clients[imei].socket = socket
      clients[imei].socket.setTimeout(TIMEOUT)
    } else {
      clients[imei] = clients[imei] || {}
      clients[imei].socket = socket
      clients[imei].waitingAck = false
    }
  }

  self.savePosition = (imei, position) => {
    app.position.insert(imei, position, (err) => {
      if (err) console.error('insert position', err)
    })
  }

  self.isAlive = (imei, cb = function () {}) => {
    const client = clients[imei]
    if (!client) return false

    if (!client.socket) {
      return false
    }

    if (client.socket.destroyed) {
      return false
    }

    try {
      client.socket.write('\n', cb)
      return true
    } catch (e) {
      console.log('[Err] tcp.isAlive', e)
      return false
    }
  }

  self.transmitCmd = (deviceId, cmdId, cmd) => {
    if (!app.tcp.isAlive(deviceId)) {
      console.log('Fail writting to the socket')
      return false
    }

    const client = app.tcp.getClient(deviceId)
    if (!client) {
      console.log('Not client found on this node')
      return false
    }

    console.log('CLIENT FOUND!, writting command', cmd)
    client.waitingAck = cmdId
    try {
      client.socket.write(cmd)
    } catch (e) {
      console.log('[ERR] socket write fail', e)
      app.tcp.closeSocket(deviceId)
      return false
    }

    return true
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
    if (!validateImeiOrCloseTcp(position.imei)) {
      console.log('BIF FAIL! invalid imei antes de savePosition!!!')
      return
    }

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
      console.log('processACK OK')
      app.emit('ack-' + client.waitingAck)
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

  console.log(`- TCP on port ${app.conf.tcpPort} -`)
  app.tcp = self
}
