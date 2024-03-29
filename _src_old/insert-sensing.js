const debug = require('debug')('gwtcp2:insert-sensing')
const parallel = require('async').parallel

module.exports = (app) => {
  const dbDevice = app.db.collection('devices')
  const self = {}

  self.insert = (sensing) => {
    const imei = sensing._device
    const device = app.cache.get(imei)
    if (!device) return

    // tenemos que descubrir la colección de sensing de este dispositivo
    // en función del account que pertenece (cada account tiene su colección
    // de sensing)
    const Sensing = app.db.collection('sensing_' + device._account)

    delete sensing.mode

    parallel([
      // añadimos la posición a colección de tracking
      (callback) => Sensing.insertOne(sensing, callback),
      // actualizamos el last data del device
      (callback) => {
        const updateDate = {
          $set: {
            sensing: {
              time: sensing.time,
              data: sensing.data
            }
          }
        }

        dbDevice.updateOne({_id: imei}, updateDate, callback)
      }
    ], (err, result) => {
      if (err) return debug('[ERR] save sensing', err)
      app.io.local.emit('gwtcp2/sensing', {sensing, customerId: device._account})
      // app.watcher.post(sensing)
    })
  }

  app.sensing = self
}
