const net = require('net')
const debug = require('debug')('gwtcp2:tcp')
const clients = {}

module.exports = (app) => {
  const self = {}
  const deviceRegistry = require('./register-device')(app)

  self.getClient = (imei) => clients[imei] || null
  self.eachClient = (cb) => Object.keys(clients).forEach((imei) => cb(imei, clients[imei]))

  net.createServer((socket) => {
    socket.setTimeout(300 * 1000)

    debug('new connection: ' + socket.remoteAddress + ':' + socket.remotePort)

    socket.on('data', (rawData) => {
      const data = rawData.toString('utf8')
      let imei = (socket.imei) ? socket.imei : ''

      // enviamos los datos recibidos al parser, este nos dirá que tenemos que
      // hacer con ellos. Hay multiples opciones
      const message = app.data.parse(data.toString('utf8'))
      if (!message) {
        debug('Invalid incoming data ->')
        debug(data)
        socket.destroy()
        return null
      }

      if (message.imei) {
        imei = socket.imei = message.imei
      }

      const device = app.cache.get(imei)
      if (device) {
        debug('>', imei, device.name, data)
      } else {
        debug('> UNKNOW', imei, data)
      }

      switch (message.mode) {
        case 'greeting': processGreetings(message, socket); break
        case 'alive': processAlive(message, socket); break
        // case 'auto': processAuto(message, socket); break
        // case 'auto-batt': processAuto(message, socket); break
        case 'tcp': processTcp(message, socket); break
        // case 'tcp-batt': processTcp(message, socket); break
        case 'ack': processAck(message, socket); break
        case 'ack2': processAck2(message, socket); break
        case 'sensing': processSensing(message, socket); break
        case 'msg': processMsg(data, socket); break
        case 'electronobo': processElectronoboTerminateSession(message, socket); break
        case 'electronoboSession': processElectronoboCreateSession(message, socket); break
        case 'feria': processFeria(message, socket); break
        case 'reg': processReg(message, socket); break
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
    if (socket) {
      socket.destroy()
    }
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
  self.addCmd = (client, cmdId, cmd, cache, version = '0.3') => {
    client.waitingAck = true
    client.cmd = {cmdId, cmd, version, sent: false}

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

    if (client.cmd.version === '0.4') {
      useId = true
    }

    let cmd = client.cmd.cmd
    if (useId) {
      let cmdId = client.cmd.cmdId
      cmd = `$${cmdId}=${cmd.replace(/^#|\$$/g, '')}#`
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
    if (!validateImeiOrCloseTcp(position.imei, socket)) {
      return console.log('BIG FAIL! GREETINGS invalid imei')
    }

    const device = app.cache.get(position.imei)
    if (!device) {
      debug('no device')
      socket.write('ko\n')
      self.closeSocket(position.imei, socket)
    }

    // console.log('write')
    // socket.write('8ksdj3234=#CFG|pwr:1$')

    // comprobamos si hay algún comando para enviar
    app.cmd.check(position.imei, socket, (err, closeTcp) => {
      if (err) return console.log('[ERR] cmd check', err)
      app.setIOStatus(position.imei, -1, position.version)

      app.utils.sayOk(socket, Date.now())

      if (!position.keepAlive) {
        self.closeSocket(position.imei, socket)
        console.log('CLOSE SOCKET - NO KEEP ALIVE')
      } else {
        self.saveSocket(position.imei, socket)
      }

      // notificamos que se ha realizado login
      position._device = position.imei
      app.watcher.post(position, 'greetings')
    })
  }

  /*
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
  */

  const processSensing = (sensing, socket) => {
    let imei = sensing._device || socket.imei

    return console.log('okok', sensing)

    if (!validateImeiOrCloseTcp(imei)) {
      console.log('BIG FAIL! invalid imei antes de savePosition!!!')
      app.utils.sayKo(socket)
      self.closeSocket(null, socket)
      return
    }

    sensing._device = imei
    self.saveSesing(sensing)
    app.watcher.post(sensing, 'sensing')

    app.cmd.check(imei, socket, (err) => {
      if (err) return console.log('[ERR] cmd check', err)
      if (sensing.keepAlive) { // TODO: what??? contradictorio...
        self.closeSocket(imei, socket)
      }
    })
  }

  const processMsg = (msg, socket) => {
    app.utils.sayOk(socket)
    socket.destroy()
  }

  const processReg = (data, socket) => {
    deviceRegistry.run(data.imei, data.iccid, (err, result) => {
      if (err) return socket.write(`ERROR|${err.message}`)
      app.utils.sayOk(socket, result)
    })
  }

  const processElectronoboTerminateSession = (data, socket) => {
    app.electronobo.terminateSession(data.operationId, data.litres, (err) => {
      if (err) {
        app.utils.sayKo(socket)
      } else {
        app.utils.sayOk(socket)
      }
    })
  }

  const processElectronoboCreateSession = (data, socket) => {
    app.electronobo.createSession(data, (err, opNumber) => {
      if (err) {
        if (err.message.search('bad-litres') >= 0) {
          return app.utils.sayOk(socket, 'BADLITRES')
        } else {
          return app.utils.sayOk(socket, 'NOAUTH')
        }
      }

      app.utils.sayOk(socket, `AUTH|${opNumber}`)
    })
  }

  const processFeria = (position, socket) => {
    socket.write('Co2 = 120\n')
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

  const processAck2 = (ack, socket) => {
    const client = clients[socket.imei]
    if (!client) return self.closeSocket(null, socket)

    if (!ack.cmdId) {
      return app.debug('INVALID ACK - NO cmdId')
    }

    ack._device = socket.imei
    ack.time = Date.now()

    app.setIOStatus(ack._device, ack.iostatus, null, ack.time)
    app.cmd.setDone(ack.cmdId)

    app.watcher.post(ack, 'ack')

    client.waitingAck = false
  }

  /**
   * Comunica a watcher.io que un dispositivo está vivo.
   * @param {Net.Socket} socket
   */
  const processAlive = (data, socket) => {
    const client = clients[socket.imei]
    if (!client) return self.closeSocket(null, socket)
    data._device = socket.imei
    data.time = Date.now()

    if (data.iostatus !== null) {
      app.setIOStatus(data._device, data.iostatus, data.version, data.time)
    }

    // enviamos el alive al watcher
    app.watcher.post(data, 'alive')

    // buscamos comandos en cache
    setTimeout(() => self.transmitCmd(client), 1000)

    // Buscamos comandos en DB
    app.cmd.check(data._device, socket, (err) => {
      if (err) return console.log('[ERR] cmd check', err)
    })
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
      self.closeSocket(imei, socket)
      return false
    }

    return true
  }

  console.log(`- TCP on port ${app.conf.tcpPort} -`)
  app.tcp = self
}
