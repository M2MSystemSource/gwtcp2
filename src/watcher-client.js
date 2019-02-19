/**
 * La aplicación watcher tiene habilitado un servidor HTTP por el que se
 * puede recibir datos que luego propaga a los clientes conectados al socket.
 *
 * Exportamos un método para realizar petición post desde este gwtpc2 a watcher
 */
const Client = require('node-rest-client').Client
const debug = require('debug')('gwtcp2:watcher')

module.exports = (app) => {
  /**
   * Utiliza la librería node-rest-client para hacer peticiones http.
   * @module watcher
   * @fires  watcher-ready
   * @see    https://github.com/aacerox/node-rest-client
   */
  const watcher = {}
  const client = new Client()

  /**
   */
  watcher.post = (position) => {
    const url = app.conf.watcherUrl
    const data = JSON.stringify(position)

    try {
      client
        .post(url, {
          data,
          headers: {'Content-Type': 'application/text'}
        }, (data) => {
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
