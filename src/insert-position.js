const debug = require('debug')('gwtcp2:insert-position')
const parallel = require('async').parallel

module.exports = (app) => {
  const dbDevice = app.db.collection('devices')
  const self = {}

  self.insert = (imei, position) => {
    debug('insert')
    const device = app.cache.get(imei)
    if (!device) return

    // tenemos que descubrir la colección de tracking de este dispositivo
    // en función del account que pertenece (cada account tiene su clección
    // de tracking)
    const tracking = app.db.collection('trk_' + device._account)

    parallel([
      (callback) => tracking.insertOne(position, callback),
      (callback) => {
        let data = position

        if (position.gps === 0) {
          // actualizamos solo la batería
          // si no se incluyen datos de geolocalización
          data = {}
          data.servertime = position.servertime
          data.tracking = {
            battery: position.tracking.battery,
            extbattery: position.tracking.extbattery
          }
        }

        dbDevice.updateOne({_id: imei}, {$set: {tracking: data}}, callback)
      }
    ], (err, result) => {
      if (err) return debug('save position', err)
      debug('results insert', result[0].result, result[1].result)
    })
  }

  app.position = self
}
