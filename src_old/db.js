/**
 * Exporta el método "app.db.collection("COLL_NAME)" con el que se puede optener
 * una instacia del objeto collection de la db.
 *
 * ejem:
 * module.exports = (app) => {
 *   const Devices = app.db.collection('devices')
 *   Devices.find({})...
 * }
 */

const MongoClient = require('mongodb').MongoClient

module.exports = (app, cb) => {
  MongoClient.connect(app.conf.dbUri, {useNewUrlParser: true}, (err, client) => {
    if (err) throw err
    console.log('- MongoDB Connected -')
    app.db = client.db(app.conf.dbName)
    cb()
  })
}
