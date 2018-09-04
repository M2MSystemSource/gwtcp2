const MongoClient = require('mongodb').MongoClient

module.exports = (app, cb) => {
  MongoClient.connect(app.conf.dbUri, {useNewUrlParser: true}, (err, client) => {
    if (err) throw err
    console.log('- MongoDB Connected -')
    app.db = client.db(app.conf.dbName)
    cb()
  })
}
