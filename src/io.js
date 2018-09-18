var io = require('socket.io-client')

module.exports = (app) => {
  const self = {}

  self.local = io.connect(app.conf.ioUrl, {reconnect: true})

  self.local.on('connect', function () {
    console.log('- Socket.io Connected -')
  })

  // se solicita la transmissión de un comando a un dispositivo
  self.local.on('gwtcp2/transmitCmd', (data) => {
    self.receiveCmd(data)
  })

  self.local.on('gwtcp2/findAlive', (data) => {
    let alive = false

    if (app.tcp.isAlive(data.deviceId)) {
      alive = true
    }

    self.local.emit('gwtcp2/alive', {alive, deviceId: data.deviceId})
  })

  /**
   * Enviamos un comando al dispositivo (escribimos en el socket)
   * Aquí no obtendremos una respuesta inmediata del dispositivo, deberemos
   * esperar a que este procese el comando y envíe un ack. Este ack se procesará
   * en el método `processAck` del archivo `tcp.js`. Este mismo método se
   * encarga de realizar un emit en socket.io para notificar al watcher de que
   * el comando se ha enviado al correctamente.
   *
   * @param {Object} data
   */
  self.receiveCmd = (data) => {
    if (!app.tcp.isAlive(data.deviceId)) {
      return console.log('Fail writting to the socket')
    }

    const client = app.tcp.getClient(data.deviceId)
    if (!client) return console.log('Not client found on this node')

    console.log('CLIENT FOUND!')
    client.waitingAck = data.cmdId
    try {
      client.socket.write(data.cmd)
    } catch (e) {
      console.log('[ERR] socket write fail')
      app.tcp.closeSocket(data.deviceId)
    }
  }

  app.io = self
}
