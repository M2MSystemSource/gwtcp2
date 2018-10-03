const express = require('express')
const http = express()
var bodyParser = require('body-parser')

http.use(bodyParser.json())
http.use(bodyParser.urlencoded({ extended: true }))

module.exports = (app) => {
  http.post('/transmit-cmd/:deviceId', (req, res) => {
    const deviceId = req.params.deviceId
    const cmdId = req.body.cmdId
    const cmd = req.body.cmd
    const eventName = 'ack-' + cmdId
    let ackTimeout

    /**
     * Este método se encargará de enviar la respuesta a la Api en cuanto tenga
     * un ack de tcp.js o se produzca un timeout, lo que venga primero.
     */
    const sentResponse = () => {
      client.waitingAck = null
      app.off(eventName)
      res.json(result)
    }

    const result = {
      alive: false,
      sent: false,
      bussy: false
    }

    if (!app.tcp.isAlive(deviceId)) {
      return res.json(result)
    }

    // else...
    result.alive = true

    const client = app.tcp.getClient(deviceId)
    if (client.waitingAck) {
      // Este client ya está esperando un ACK, no podemos gestionar dos ack
      // al mismo tiempo ya y que los cmdId no se están enviando al tracker
      // y este cuando responde un ACK no sabe a que comando lo está haciendo
      result.bussy = true
      return res.json(result)
    }

    // esperamos resuesta del tracker a través. Será el método processAck() de
    // tcp.js quien emita este evento cuando reciba el ack del tracker
    // si el dispositivo en lugar de ack devuele fail (el comando ha sido enviado
    // pero no es válido), entonces será el método processFail() quien se encargue
    // de emitir este evento (eventName) y pasará el parámetro ack=false
    app.on(eventName, (ack) => {
      clearTimeout(ackTimeout) // el ack se ha cumplido, eliminamos el timeout
      result.sent = true
      sentResponse()
    })

    // cabe la posibilidad de que el ack nunca se produzca
    // establecemos un
    ackTimeout = setTimeout(() => {
      app.off(eventName)
      sentResponse()
    }, 5000)

    // que zeus nos pille confesaos'
    app.tcp.transmitCmd(deviceId, cmdId, cmd)
  })

  http.get('/alive/:deviceId', (req, res) => {

  })

  http.listen(app.conf.httpPort, () => console.log(`- HTTP on port ${app.conf.httpPort} -`))

  app.http = http
}
