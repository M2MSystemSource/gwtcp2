/**
 * Actualiza el estado de la línea ON/OFF de un dispositivo.
 *
 * La línea ON/OFF corresponde a un puerto digital en el dispositivo. Dicho
 * puerto establece si un elemento externo del hardware está encendido o apagado.
 * Por ejemplo en el caso de los patinetes, dicha línea es la IO6 y establece
 * si el patinete está encendido o apagado. El hecho de que esté encendido implica
 * que el alquiler está en marcha.
 */

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
