/**
 * La aplicación watcher tiene habilitado un servidor HTTP por el que se
 * puede recibir datos que luego propaga a los clientes conectados al socket.
 *
 * Exportamos un método para realizar petición post desde este gwtpc2 a watcher
 */
const Client = require('node-rest-client').Client
const debug = require('debug')('gwtcp2:watcher')

module.exports = (app) => {
  const watcher = {}
  const client = new Client()

  watcher.post = (data, type) => {
    const url = app.conf.watcherUrl
    if (type) data = {data, type}
    const headers = {'Content-Type': 'application/text'}

    try {
      let response = JSON.stringify(data)
      client.post(url, {response, headers}, (data) => {
        data = data.toString()
        // watcher nos devuelve un "ok" si la solicitud es válida
        // cualquier otro valor se debería entender como un error.
        if (data !== 'ok') {
          debug('Watcher response error', data)
        }
      })
      .on('error', (err) => {
        console.log('err', err)
      })
    } catch (e) {
      console.log('e', e)
    }
  }

  app.watcher = watcher
}
