const imeis = {}

module.exports = (app) => {
  const cache = {}

  cache.devices = () => {
    const devices = app.db.collection('devices')

    devices.find({}).toArray((err, docs) => {
      if (err) console.log(err)
      docs.forEach((doc) => {
        imeis[doc._id] = doc
      })
    })
  }

  cache.get = (imei) => {
    return imeis[imei] || null
  }

  // run cache at startup and each 60 seconds
  cache.devices()
  setInterval(() => cache.devices(), app.conf.cacheDevicesTimeout)

  app.cache = cache
}
