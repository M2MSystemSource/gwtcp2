const debug = require('debug')('gwtcp2:update-status')

module.exports = (app) => {
  const dbDevice = app.db.collection('devices')

  app.setIOStatus = (imei, status) => {
    const device = app.cache.get(imei)
    if (!device) return

    let set = {}
    set['status.status'] = status
    set['status.updated'] = Date.now()

    dbDevice.updateOne({_id: imei}, {$set: set}, (err) => {
      if (err) debug('[err]', err)
    })
  }
}
