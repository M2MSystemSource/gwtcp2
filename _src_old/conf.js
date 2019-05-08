module.exports = {
  dbUri: 'mongodb://localhost:27018/m2m',
  dbName: 'm2m',
  cacheDevicesTimeout: 60000,
  ioUrl: 'http://45.76.37.219:5050/local', // socket.io channel
  watcherUrl: 'http://45.76.37.219:3010/', // HTTP watcher
  tcpPort: process.env.TCP_PORT,
  httpPort: process.env.HTTP_PORT
}
