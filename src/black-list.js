const __LIST = {}

module.exports = () => {
  const self = {}

  self.getIp = (socket) => {
    let ipAddress = socket.connection.remoteAddress
    if (!ipAddress) return '0.0.0.0'

    if (ipAddress.substr(0, 7) === '::ffff:') {
      ipAddress = ipAddress.substr(7)
    }

    return ipAddress
  }

  self.add = (socket) => {
    const ipAddress = self.getIp()

    if (__LIST.hasOwnProperty(ipAddress)) {
      updateList(ipAddress)
    } else {
      __LIST[ipAddress] = {
        count: 1,
        time: Date.now()
      }
    }
  }

  const updateList = (socket, ipAddress) => {
    __LIST[ipAddress].count++

    const timeDiff = Date.now() - __LIST.time
    if (timeDiff > 20000) {
      return reset(ipAddress)
    }

    if (__LIST[ipAddress].count > 10) {
      socket.close()
    }

    __LIST[ipAddress].time = Date.now()
  }

  const reset = (ipAddress) => {
    __LIST[ipAddress].count = 0
    __LIST[ipAddress].time = 0
  }

  return self
}
