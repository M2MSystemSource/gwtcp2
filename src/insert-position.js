const debug = require('debug')('gwtcp2:insert-position')
const parallel = require('async').parallel

/**
 * Inserta una posición en la base de datos. Una vez `tcp.js` ha procesado y
 * validado la petición esta se recibe aquí. Se envía la posición al watcher
 * vía HTTP (watcher-client.js)
 */

module.exports = (app) => {
  const dbDevice = app.db.collection('devices')
  const self = {}

  self.insert = (imei, position) => {
    const device = app.cache.get(imei)
    if (!device) return

    // tenemos que descubrir la colección de tracking de este dispositivo
    // en función del account que pertenece (cada account tiene su colección
    // de tracking)
    const tracking = app.db.collection('trk_' + device._account)

    parallel([
      // añadimos la posición a colección de tracking
      (callback) => tracking.insertOne(position, callback),
      // actualizamos el last data del device
      (callback) => {
        let tracking = position

        if (position.data.gps === 0) {
          // actualizamos solo la batería
          // si no se incluyen datos de geolocalización
          tracking = {}
          tracking['tracking.servertime'] = position.servertime
          tracking['tracking.data.battery'] = position.data.battery
          tracking['tracking.data.extbattery'] = position.data.extbattery
          tracking['tracking.data.vsys'] = position.data.vsys
          tracking['tracking.data.gsm'] = position.data.gsm || -1

          dbDevice.updateOne({_id: imei}, {$set: tracking}, callback)
        } else {
          dbDevice.updateOne({_id: imei}, {$set: {tracking: tracking}}, callback)
        }
      }
    ], (err, result) => {
      if (err) return debug('[ERR] save position', err)
      // app.io.local.emit('gwtcp2/position', {position, customerId: device._account})
      app.watcher.post(position)
    })
  }

  app.position = self
}
