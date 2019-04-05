/**
 * Mantiene una cache de dispositivos, actualizado cada 60 segundos.
 *
 * Se cargan todos los dispositivos de la DB en un array (objeto literal).
 * Cada vz que se inicia un socket se espera que este indique su IMEI en la
 * trama, y este imei debe existir en esta caché. Se deniega el acceso a
 * aquellos dispositvos que no están en la trama.
 */

const imeis = {}

module.exports = (app) => {
  const cache = {}

  cache.devices = () => {
    const devices = app.db.collection('devices')

    devices.find({freeze: false}).toArray((err, docs) => {
      if (err) console.log(err)
      docs.forEach((doc) => {
        imeis[doc._id] = doc
      })
    })
  }

  cache.get = (imei) => {
    return imeis[imei] || null
  }

  cache.exists = (imei) => {
    return imeis.hasOwnProperty(imei)
  }

  // run cache at startup and each 60 seconds
  cache.devices()
  setInterval(() => cache.devices(), app.conf.cacheDevicesTimeout)

  app.cache = cache
}
