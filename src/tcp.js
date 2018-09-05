const net = require('net')
const debug = require('debug')('gwtcp2:tcp')
const clients = {}

module.exports = (app) => {
  net.createServer((socket) => {
    debug('new connection: ' + socket.remoteAddress + ':' + socket.remotePort)

    socket.on('data', (data) => {
      const position = data.parse(data)

      switch (position.mode) {
        case 'greeting': processGreetings(position, socket); break
        case 'auto': processAuto(position, socket); break
        case 'auto-batt': processAuto(position, socket); break
        case 'tcp': processTcp(position, socket); break
        case 'tcp-batt': processTcp(position, socket); break
        case 'ack': processAck(socket); break
        case 'fail': processFail(socket); break
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

    // notificamos que se ha realizado login
    app.watcher.emmit('gwtcp2/login', position)
    // comprobamos si hay algún comando para enviar
    app.cmd.check(clients[position.imei], (err, closeTcp) => {
      if (err) return console.log('[ERR] greetings', err)
      if (closeTcp) {
        closeSocket(position.imei, socket)
      } else {
        saveSocket(position.imei, socket)
      }
    })
  }

  const processAuto = (position, socket) => {
    if (!validateImeiOrCloseTcp(position.imei)) return
    debug('pocessAuto')

    savePosition(position.imei, position.position)
    app.watcher.emit('gwtcp2/position', position)
    app.cmd.check(clients[position.imei], socket, (err) => {
      if (err) return console.log('[ERR] greetings', err)
      closeSocket(position.imei, socket)
    })
  }

  const processTcp = (position, socket) => {
    debug('processTcp')
    const client = clients[socket.imei]
    if (!client) return closeSocket(socket.imei, socket)
    position.imei = socket.imei
    savePosition(position.imei, position.position)
    app.watcher.emit('gwtcp2/position', position)
    app.cmd.check(clients[position.imei], socket, (err) => {
      if (err) return console.log('[ERR] greetings', err)
    })
  }

  const processAck = (socket) => {
    debug('processAck')
    app.watcher.emit('gwtcp2/ack', {device: socket.imei})
  }

  const processFail = (socket) => {
    debug('processFail')
    app.watcher.emit('gwtcp2/fail', {device: socket.imei})
  }

  const validateImeiOrCloseTcp = (imei, socket) => {
    const client = app.cache.get(imei)
    if (!client) {
      closeSocket(imei, socket)
      return false
    }

    return client
  }

  const closeSocket = (imei, socket) => {
    if (clients[imei] && clients[imei].socket) {
      clients[imei].socket.destroy()
      clients[imei].socket = null
    } else {
      clients[imei].socket = clients[imei].socket || null
    }
  }

  const saveSocket = (imei, socket) => {
    socket.imei = imei
    clients[imei] = clients[imei] || {}
    clients[imei].socket = socket
  }

  const savePosition = (position, imei) => {
    app.position.insert(imei, position, (err) => {
      if (err) console.error('insert position', err)
    })
  }

  console.log('Server listening on port ' + app.conf.tcpPort)
}
