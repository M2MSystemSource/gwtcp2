const debug = require('debug')('gwtcp2:insert-position')
const parallel = require('async').parallel

module.exports = (app) => {
  const tracking = app.db.collection('tracking')
  const device = app.db.collection('devices')
  const self = {}

  self.insert = (imei, position, cb) => {
    debug('app.position', imei, position)
    parallel([
      (callback) => tracking.insert(position, callback),
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

        device.updateOne({_id: imei}, {$set: {data: position}}, callback)
      }
    ], cb)
  }

  app.position = self
}
