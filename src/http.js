const express = require('express')
const http = express()
var bodyParser = require('body-parser')

http.use(bodyParser.json())
http.use(bodyParser.urlencoded({ extended: true }))

module.exports = (app) => {
  /**
   * Recibimos un comando para un dispositivo
   */
  http.post('/transmit-cmd/:deviceId', (req, res) => {
    const deviceId = req.params.deviceId
    const cmdId = req.body.cmdId
    const cmd = req.body.cmd
    const eventName = 'ack-' + cmdId
    let ackTimeout // contendrá el timer que espera la picorespuesta del dispositivo

    // el objeto que vamos a devolver a la api
    const result = {
      alive: false,
      sent: false,
      bussy: false,
      cmd: cmd
    }

    // comprobamos si el dispositivo edstá conectado
    if (!app.tcp.isAlive(deviceId)) {
      // si no lo está devolvemos respuesta inmediatamente
      return res.json(result)
    } else {
      // si no cambiamos el result y seguimos con el procedimiento
      result.alive = true
    }

    // si el dispositivo está alive tenemos la seguridad de que existe el cliente
    const client = app.tcp.getClient(deviceId)
    if (client.waitingAck) {
      // Este client ya está esperando un ACK, no podemos gestionar dos ack
      // al mismo tiempo ya y que los cmdId no se están enviando al dispositivo
      // y éste cuando responde un ACK no sabe a que comando (cmdId) lo está haciendo,
      // por lo que si le enviamos dos comandos al dispositivo, sin identificador,
      // este nos devolverá los ack sin que podamos saber a cual de los dos comandos
      // se refiere. salimos inmediatamente
      result.bussy = true
      return res.json(result)
    }

    /**
     * Este método se encargará de enviar la respuesta a la Api en cuanto tenga
     * un ack de tcp.js o se produzca el timeout, lo que venga primero.
     */
    const sentResponse = () => {
      client.waitingAck = null
      client.cmd = null
      app.off(eventName)
      res.json(result)
    }

    // esperamos resuesta del dispositivo. Será el método processAck() de
    // tcp.js quien emita este evento cuando reciba el ack del dispositivo
    // si el dispositivo en lugar de ack devuele fail (el comando ha sido enviado
    // pero no es válido), entonces será el método processFail() quien se encargue
    // de emitir este evento (eventName) y pasará el parámetro ack=false
    app.on(eventName, (ack) => {
      clearTimeout(ackTimeout) // el ack se ha cumplido, eliminamos el timeout
      result.sent = true
      sentResponse()
    })

    // cabe la posibilidad de que el ack nunca se produzca
    // establecemos un timeout
    ackTimeout = setTimeout(() => {
      app.tcp.cancelCmd(client)
      app.off(eventName)
      sentResponse()
    }, 18000)

    app.tcp.addCmd(client, cmdId, cmd)
    // app.tcp.transmitCmd(client)
  })

  /**
   * Petición para cancelar un comando. Se verifica si el comando ha sido enviado
   * utilizando `client.cmd.sent`. Si el comando ha sido enviado (true) entonces
   * no podremos cancelarlo, de lo contrario sí.
   * La verificación se realiza en la librería `tcp` a través de tcp.cancelCmd()
   */
  http.post('/cancel-cmd', (req, res) => {
    const deviceId = req.params.deviceId

    // esto es lo que vamos a devolver...
    const result = {
      alive: false,
      cancelled: false
    }

    // primera comprobación, el dispositivo debe estar disponible
    if (!app.tcp.isAlive(deviceId)) {
      // niau niau niau niau (con tono de voz decadente...)
      return res.json(result)
    } else {
      result.alive = true
    }

    // puesto que isAlive podemos obtener el cliente
    const client = app.tcp.getClient(deviceId)
    // cancelCmd() ejecuta la acción y devuelve true (si tiene éxito) o false
    result.cancelled = app.tcp.cancelCmd(client)
    // hasta la próxima baby!
    res.json(result)
  })

  http.get('/alive/:deviceId', (req, res) => {
  })

  // iniciamos el servidor HTTP y exportamos el objeto
  http.listen(app.conf.httpPort, () => console.log(`- HTTP on port ${app.conf.httpPort} -`))
  app.http = http
}
