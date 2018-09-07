const net = require('net')
const debug = require('debug')('gwtcp2:tcp')
const clients = {}

module.exports = (app) => {
  net.createServer((socket) => {
    debug('new connection: ' + socket.remoteAddress + ':' + socket.remotePort)

    socket.on('data', (rawData) => {
      const data = rawData.toString('utf8')
      debug('>', data)
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
    })

    // Add a 'close' event handler to this instance of socket
    socket.on('end', (data) => {
      debug('END: ' + socket.remoteAddress + ' ' + socket.remotePort)
    })
  }).listen(app.conf.tcpPort)

  /**
   * @param {Object} position
   * @param {NetClient} socket
   */
  const processGreetings = (position, socket) => {
    if (!validateImeiOrCloseTcp(position.imei)) return
    debug('process greeting', position)

    const device = app.cache.get(position.imei)
    if (!device) {
      socket.write('ko-001\n')
      closeSocket(position.imei, socket)
    }

    // comprobamos si hay algún comando para enviar
    app.cmd.check(position.imei, socket, (err, closeTcp) => {
      if (err) return console.log('[ERR] greetings', err)
      if (!position.keepAlive) {
        closeSocket(position.imei, socket)
      } else {
        saveSocket(position.imei, socket)
        // notificamos que se ha realizado login
        app.io.emit('gwtcp2/login', {
          imei: position.imei,
          account: device._account
        })
      }
    })
  }

  const processAuto = (position, socket) => {
    if (!validateImeiOrCloseTcp(position.imei)) return
    debug('pocessAuto')

    savePosition(position.imei, position.position)
    app.io.emit('gwtcp2/position', position)
    app.cmd.check(position.imei, socket, (err) => {
      if (err) return console.log('[ERR] greetings', err)
      closeSocket(position.imei, socket)
    })
  }

  const processTcp = (position, socket) => {
    const client = clients[socket.imei]
    if (!client) return closeSocket(socket.imei, socket)
    position.imei = socket.imei
    position.position._device = socket.imei

    savePosition(position.imei, position.position)
    app.io.emit('gwtcp2/position', position)
    app.cmd.check(position.imei, socket, (err) => {
      if (err) return console.log('[ERR] greetings', err)
    })
  }

  const processAck = (socket) => {
    debug('processAck')
    app.io.emit('gwtcp2/ack', {device: socket.imei})
  }

  const processKo = (socket) => {
    debug('processKo')
    app.io.emit('gwtcp2/fail', {device: socket.imei})
  }

  const validateImeiOrCloseTcp = (imei, socket) => {
    debug('validate imei %s', imei)
    const client = app.cache.get(imei)
    if (!client) {
      closeSocket(imei, socket)
      return false
    }

    return client
  }

  const closeSocket = (imei, socket) => {
    debug('close socket')
    if (socket) socket.destroy()
    if (!imei) return

    if (clients[imei] && clients[imei].socket) {
      clients[imei].socket.destroy()
      clients[imei].socket = null
    } else {
      clients[imei] = {}
    }
  }

  const saveSocket = (imei, socket) => {
    debug('save socket', imei)
    socket.imei = imei
    clients[imei] = clients[imei] || {}
    clients[imei].socket = socket
  }

  const savePosition = (imei, position) => {
    debug('save position')
    app.position.insert(imei, position, (err) => {
      if (err) console.error('insert position', err)
    })
  }

  console.log('Server listening on port ' + app.conf.tcpPort)
}
