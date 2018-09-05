const debug = require('debug')('gwtcp2:tcp-parse-data')
const shortid = require('shortid')

module.exports = (app) => {
  const data = {}
  const regex = {}

  regex.isGreeting = /^8[0-9]{14}$/gi
  regex.isAuto = /^8[0-9]{14}\|1,[0-9\-,.]*\|[0-9]{1,4},[0-9]{1,4}$/gi
  regex.isAutoBatt = /^8[0-9]{14}\|0|[0-9]{1,4},[0-9]{1,4}$/gi
  regex.isTcp = /^1,[0-9\-,.]*\|[0-9]{1,4},[0-9]{1,4}$/gi
  regex.isTcpBatt = /^0|[0-9]{1,4},[0-9]{1,4}$/gi
  regex.isAck = /ack/
  regex.isFail = /fail/

  /**
   * Ejecuta las expresiones regulares de arriba para determinar que tipo
   * de datos se nos envía y en función de esto llamar al método apropiado
   * para parsearlo
   *
   * @param {String} data
   */
  data.parse = (data) => {
    if (regex.isGreeting.test(data)) return this.parseGreeting(data)
    else if (regex.isAuto.test(data)) return this.parseAuto(data)
    else if (regex.isAutoBatt.test(data)) return this.parseAutoBatt(data)
    else if (regex.isTcp.test(data)) return this.parseTcp(data)
    else if (regex.isTcpBatt.test(data)) return this.parseTcpBatt(data)
    else if (regex.isAck.test(data)) return this.parseAck(data)
    else if (regex.isFail.test(data)) return this.parseFail(data)
    else return null
  }

  data.createPosition = (imei, tracking, batt) => {
    // 0 - 1, - position type
    // 1 -> 20180904152756.000 -> date time
    // 2 -> 39.519702 -> lat
    // 3 -> -0.454520 -> lon
    // 4 -> 42.928 -> alt
    // 5 -> 0.00 -> sog/speed
    // 6 -> 156.8 -> cog
    // 7 -> 0.8 -> HDOP
    // 8 -> 13 -> SATS
    // 9 -> GSM 0 -> GSM Quality
    const position = tracking.split(',')
    const battery = batt.split(',')

    return {
      _id: shortid.generate(),
      _device: null,
      gpsTime: app.utils.simcomDateTimeToTimestamp(position[1]),
      serverTime: Date.now(),
      data: {
        alt: position[4],
        battery: parseInt(battery[0], 10),
        extbattery: parseInt(battery[1], 10),
        raw: `${position},${batt}`,
        cog: parseInt(position[6], 10),
        gsm: parseInt(position[9], 10),
        gps: parseInt(position[7], 10),
        sats: parseInt(position[8], 10),
        loc: [parseInt(position[3], 10), parseInt(position[2], 10)],
        speed: parseInt(tracking[5], 10)
      }
    }
  }

  data.createEmptyPosition = (batt) => {
    const battery = batt.split(',')
    return {
      _id: shortid.generate(),
      _device: null,
      gpsTime: 0,
      serverTime: Date.now(),
      data: {
        alt: 0,
        battery: battery[0],
        extbattery: battery[1],
        raw: 0,
        cog: 0,
        gsm: 0,
        gps: 0,
        sats: 0,
        loc: [0, 0],
        speed: 0
      }
    }
  }

  data.parseGreeting = (data) => {
    debug('parse greeting', data)
    return {
      mode: 'greeting',
      imei: data,
      position: null
    }
  }

  data.parseAuto = (data) => {
    const groups = data.split('|')
    const imei = groups[0]
    const tracking = groups[1].split(',')
    const batt = groups[2].split(',')

    return {
      mode: 'auto',
      imei: imei,
      raw: data,
      position: data.createPosition(tracking, batt)
    }
  }

  data.parseAutoBatt = (data) => {
    const groups = data.split('|')
    const batt = groups[2].split(',')

    return {
      mode: 'auto-batt',
      device: data,
      position: data.createEmptyPosition(batt)
    }
  }

  data.parseTcp = (data) => {
    const groups = data.split('|')
    const tracking = groups[0].split(',')
    const batt = groups[1].split(',')

    return {
      mode: 'tcp',
      device: null,
      raw: data,
      position: data.createPosition(tracking, batt)
    }
  }

  data.parseTcpBatt = (data) => {
    const groups = data.split('|')
    const batt = groups[1].split(',')

    return {
      mode: 'tcp',
      device: null,
      raw: data,
      position: data.createEmptyPosition(batt)
    }
  }

  data.parseAck = (data) => {
    if (data === 'ack') {
      return {
        mode: 'ack'
      }
    }
  }

  data.parseFail = (data) => {
    if (data === 'ack') {
      return {
        mode: 'ack'
      }
    }
  }

  app.data = data
}
