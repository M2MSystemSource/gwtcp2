const debug = require('debug')('gwtcp2:update-status')

module.exports = (app) => {
  const dbDevice = app.db.collection('devices')

  app.setIOStatus = (imei, status, firmwareVersion = null) => {
    const device = app.cache.get(imei)
    if (!device) return

    let set = {}
    set['status.status'] = status
    set['status.updated'] = Date.now()

    if (firmwareVersion !== null && firmwareVersion !== undefined) {
      set['status.version'] = firmwareVersion
    }

    dbDevice.updateOne({_id: imei}, {$set: set}, (err) => {
      if (err) debug('[err]', err)
    })
  }
}
