const net = require('net')
const debug = require('debug')('gwtcp2:tcp')
const clients = {}

module.exports = (app) => {
  const self = {}

  self.getClient = (imei) => clients[imei] || null
  self.eachClient = (cb) => Object.keys(clients).forEach((imei) => cb(imei, clients[imei]))

  net.createServer((socket) => {
    socket.setTimeout(300 * 1000)

    debug('new connection: ' + socket.remoteAddress + ':' + socket.remotePort)

    socket.on('data', (rawData) => {
      const data = rawData.toString('utf8')
      const imei = (socket.imei) ? socket.imei : ''

      // enviamos los datos recibidos al parser, este nos dirá que tenemos que
      // hacer con ellos. Hay multiples opciones
      const position = app.data.parse(data.toString('utf8'))
      if (!position) {
        debug('Invalid incoming data ->')
        debug(data)
        socket.destroy()
        return null
      }

      const device = app.cache.get(imei)
      if (device) {
        debug('>', imei, device.name, data)
      } else {
        debug('> UNKNOW', imei, data)
      }

      switch (position.mode) {
        case 'greeting': processGreetings(position, socket); break
        case 'auto': processAuto(position, socket); break
        case 'auto-batt': processAuto(position, socket); break
        case 'tcp': processTcp(position, socket); break
        case 'tcp-batt': processTcp(position, socket); break
        case 'ack': processAck(position, socket); break
        case 'alive': processAlive(position, socket); break
        case 'sensing': processSensing(position, socket); break
        case 'msg': processMsg(data, socket); break
        case 'electronobo':
          app.io.local.emit('gwtcp2/electronobo', {
            operationId: position.operationId,
            litres: position.litres
          })
          socket.write('ok\n')
          break
        case 'electronoboSession':
          debug('Create Electronobo Session:')
          console.log('Request ->\n', data)

          let opId = Math.floor(Math.random() * (99999 - 99999)) + 99999
          socket.write(`OK|AUTH|${opId}\n`)

          break
        default:
          socket.destroy()
      }
    })

    socket.on('close', (data) => {
      debug('CLOSED: ' + socket.remoteAddress + ' ' + socket.remotePort)
      self.closeSocket(socket.imei, socket)
    })

    socket.on('end', (data) => {
      debug('END: ' + socket.remoteAddress + ' ' + socket.remotePort)
      self.closeSocket()
    })

    socket.on('error', (err) => {
      console.log('[ERR]', err)
      console.log('[ERR] code', err.code)
    })

    socket.on('timeout', () => {
      if (socket.imei) {
        const device = clients[socket.imei]
        if (device) {
          console.log('TIMEOUT:', device.name)
        } else {
          console.log('TIMEOUT:', socket.imei)
        }
      } else {
        console.log('TIMEOUT: UNKNOW DEVICE')
      }

      socket.destroy()
    })
  }).listen(app.conf.tcpPort)

  self.closeSocket = (imei, socket) => {
    if (socket) socket.destroy()
    if (!imei) return

    app.setIOStatus(imei, 0)

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
      delete clients[imei].socket
      clients[imei].socket = socket
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

  self.saveSesing = (sensing) => {
    app.sensing.insert(sensing, (err) => {
      if (err) console.error('insert sensing', err)
    })
  }

  /**
   * Comprueba si un dispositivo está online. Veririfica el estado del socket
   * y realiza una comprobación de fecha de la última conexión realizada, donde
   * se espera que el dispositivo se haya conecto en los útlimos 15 segundos.
   *
   * @param {*} deviceId
   * @param {*} cb
   */
  self.isAlive = (deviceId) => {
    const client = clients[deviceId]
    if (!client) return false
    if (!client.socket) return false
    if (client.socket.destroyed) return false
    const now = Date.now()
    if ((now - client.lastConnection) > 12) {
      // hace más de 15 segundos que no envía nada... lo damos por desconectado
      return false
    }

    return true
  }

  /**
   * Añade un comando a un dispositivo. Se transmitirá la próxima vez que el
   * dispositivo envíe un dato, bien sea un Alive o una posición
   *
   * @param {Object} client
   * @param {String} cmdId
   * @param {String} cmd
   */
  self.addCmd = (client, cmdId, cmd, cache) => {
    client.waitingAck = true
    client.cmd = {cmdId, cmd, sent: false}

    if (cache === false) {
      console.log('no cache, haya que vamos!', cmd)
      self.transmitCmd(client, true)
    }
  }

  /**
   * Comprueba si hay un comando en espera de ser enviado a `client`
   *
   * @param {Object} client
   */
  self.hasCmd = (client) => {
    if (client.waitingAck && client.cmd) {
      return true
    }
    return false
  }

  /**
   * Transmite un comando. Utiliza el método `hasCmd` para comprobar si tiene
   * algo que enviar. Se cerrará el socket si se produce un error al realizar
   * la escritura del comando con socket.write().
   *
   * @param {Object} client
   * @return {Boolean}
   */
  self.transmitCmd = (client, useId = false) => {
    if (!self.hasCmd(client)) return false

    let cmd = client.cmd.cmd
    if (useId) {
      let cmdId = client.cmd.cmdId
      cmd = `${cmdId}=${cmd}`
    }

    try {
      client.cmd.sent = true
      client.socket.write(cmd)
      return true
    } catch (e) {
      console.log('[ERR] socket write fail', e)
      app.tcp.closeSocket(client.socket.deviceId)
      return false
    }
  }

  /**
   * Permite cancelar el envío de un comando en espera de ser enviado.
   * Comprobará que el `client.cmd.snet` sea `false`, en caso de `true` el
   * comando ya ha sido enviado y no puede cancelarse.
   *
   * @param {Object} client
   * @return {Boolean}
   */
  self.cancelCmd = (client) => {
    if (client.cmd.sent === false) {
      client.waitingAck = false
      client.cmd = null
      return true
    }

    return false
  }

  /**
   * El gretting es el mensaje de bienvenida del dispositivo. Nos indicará cual
   * es su deviceId (generalmente el IMEI) y el modo de conexión, auto o tcp.
   *
   * @param {Object} position
   * @param {NetClient} socket
   */
  const processGreetings = (position, socket) => {
    if (!validateImeiOrCloseTcp(position.imei)) return

    const device = app.cache.get(position.imei)
    if (!device) {
      debug('no device')
      socket.write('ko\n')
      self.closeSocket(position.imei, socket)
    }

    // comprobamos si hay algún comando para enviar
    app.cmd.check(position.imei, socket, (err, closeTcp) => {
      if (err) return console.log('[ERR] cmd check', err)
      app.setIOStatus(position.imei, -1, position.version)

      socket.write('OK|' + Date.now() + '\n')

      if (!position.keepAlive) {
        self.closeSocket(position.imei, socket)
        console.log('CLOSE SOCKET - NO KEEP ALIVE')
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
      console.log('BIG FAIL! invalid imei antes de savePosition!!!')
      return
    }

    self.savePosition(position.imei, position.position)
    app.cmd.check(position.imei, socket, (err) => {
      if (err) return console.log('[ERR] cmd check', err)
      self.closeSocket(position.imei, socket)
    })
  }

  const processSensing = (sensing, socket) => {
    let imei = sensing._device || socket.imei

    if (!validateImeiOrCloseTcp(imei)) {
      console.log('BIG FAIL! invalid imei antes de savePosition!!!')
      return
    }

    self.saveSesing(sensing)

    app.cmd.check(imei, socket, (err) => {
      if (err) return console.log('[ERR] cmd check', err)
      if (sensing.keepAlive) {
        self.closeSocket(imei, socket)
      }
    })
  }

  const processMsg = (msg, socket) => {
    socket.write('OK\n')
  }

  const processTcp = (position, socket) => {
    const client = clients[socket.imei]
    if (!client) return self.closeSocket(socket.imei, socket)
    position.imei = socket.imei
    position.position._device = socket.imei

    self.saveSocket(position.imei, socket)
    self.savePosition(position.imei, position.position)

    app.io.local.emit('gwtcp2/position', position)

    setTimeout(() => {
      self.transmitCmd(client)
    }, 1000)
  }

  const processAck = (ack, socket) => {
    const client = clients[socket.imei]
    if (!client) return

    console.log('set status', socket.imei, ack.iostatus)
    app.setIOStatus(socket.imei, ack.iostatus)

    if (ack.cmdId) {
      ack._device = socket.imei
      app.watcher.post(ack)
      app.cmd.setDone(ack.cmdId)
    }

    if (client.waitingAck) {
      app.emit('ack-' + ack.cmdId || client.cmd.cmdId)
    }

    client.waitingAck = false
  }

  /**
   * Comunica a watcher.io que un dispositivo está vivo.
   *
   * @param {Net.Socket} socket
   */
  const processAlive = (position, socket) => {
    const client = clients[socket.imei]
    if (!client) return self.closeSocket(null, socket)
    position.imei = socket.imei

    if (position.io6Status !== null) {
      app.setIOStatus(position.imei, position.io6Status, position.version)
    }

    setTimeout(() => {
      self.transmitCmd(client)
    }, 1000)
  }

  /**
   * Comprueba si un imei tiene permitido conectarse al servidor. Básicamente
   * se podrán conectar aquellos clientes que existan en la caché de app.cache.
   * Esta caché se crea cada 5 minutos realizando una consulta a Mongo. Serán
   * válidos los dispositivos que tengan la propiedad `version = 2`
   *
   * @param {String} imei
   * @param {net.Socket} socket
   * @return {Boolean}
   */
  const validateImeiOrCloseTcp = (imei, socket) => {
    const client = app.cache.get(imei)
    if (!client) {
      console.log('invalid imei')
      self.closeSocket(imei, socket)
      return false
    }

    return true
  }

  console.log(`- TCP on port ${app.conf.tcpPort} -`)
  app.tcp = self
}
