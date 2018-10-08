const debug = require('debug')('gwtcp2:tcp:parse')
const shortid = require('shortid')

module.exports = (app) => {
  const self = {}
  const regex = {}

  // 867857039426874|1
  regex.isGreeting = /^8[0-9]{14}\|(1|2)$/

  // 867857039426874|1,20180907065405.000,39.519982,-0.454391,88.715,0.00,302.2,1.2,11|10208,38694
  regex.isAuto = /^8[0-9]{14}\|1,[0-9\-,.]*\|[0-9]{1,4},[0-9]{1,5}$/

  // 867857039426874|0|5000,38694
  regex.isAutoBatt = /^8[0-9]{14}\|0\|[0-9]{1,5},[0-9]{1,5}$/

  // 1,20180907065405.000,39.519982,-0.454391,88.715,0.00,302.2,1.2,11|4129,38694
  regex.isTcp = /^1,[0-9\-,.]*\|[0-9]{1,5},[0-9]{1,5}$/

  // 1,20180907065405.000,39.519982,-0.454391,88.715,0.00,302.2,1.2,11|4129,38694,0
  regex.isTcpVSYS = /^1,[0-9\-,.]*\|[0-9]{1,5},[0-9]{1,5},[0-9]{1,5}$/

  // 0|5000,38694
  regex.isTcpBatt = /^0\|[0-9]{1,5},[0-9]{1,5}$/

  // 0,12|5000,38694,0 // incluye GSM y VSYS
  regex.isTcpBattVSYS = /^0,[0-9]{1,5}\|[0-9]{1,5},[0-9]{1,5},[0-9]{1,5}$/

  regex.isAck = /ack/
  regex.isFail = /ko/

  /**
   * Ejecuta las expresiones regulares de arriba para determinar que tipo
   * de datos se nos envía y en función de esto llamar al método apropiado
   * para parsearlo
   *
   * @param {String} data
   */
  self.parse = (data) => {
    if (regex.isGreeting.test(data)) return self.parseGreeting(data)

    else if (regex.isAuto.test(data)) return self.parseAuto(data)
    else if (regex.isAutoBatt.test(data)) return self.parseAutoBatt(data)

    else if (regex.isTcpVSYS.test(data)) return self.parseTcp(data)
    else if (regex.isTcpBattVSYS.test(data)) return self.parseTcpBattVSYS(data)

    else if (regex.isTcp.test(data)) return self.parseTcp(data)
    else if (regex.isTcpBatt.test(data)) return self.parseTcpBatt(data)

    else if (data === 'ack') return self.parseAck(data)
    else if (data === 'ko') return self.parseFail(data)

    else {
      debug('regex big fail!')
      return null
    }
  }

  self.parseGreeting = (data) => {
    // extraemos el ultimo caracter de la cadena de bienvenida. Esta cadena
    // suele tener el formato [IMEI]|1 o [IMEI]|0. El 1 indicaría que el dispositivo
    // está solicitando mantener el TCP abierto para comunicación bidireccional.
    // el 0 (o cualquier otra cosa) indica que no se requiere TCP abierto
    const keepAlive = parseInt(data.slice(-1), 10)
    debug('parse greeting', keepAlive, data)
    return {
      mode: 'greeting',
      keepAlive: keepAlive === 1,
      imei: data.split('|')[0],
      position: null
    }
  }

  self.parseAuto = (data) => {
    const groups = data.split('|')
    const imei = groups[0]
    const tracking = groups[1].split(',')
    const batt = groups[2].split(',')

    return {
      mode: 'auto',
      imei: imei,
      raw: data,
      position: self.createPosition(tracking, batt)
    }
  }

  self.parseAutoBatt = (data) => {
    const groups = data.split('|')
    const imei = groups[0]
    const batt = groups[2].split(',')

    return {
      mode: 'auto-batt',
      device: data,
      imei: imei,
      position: self.createEmptyPosition(batt)
    }
  }

  self.parseTcp = (data) => {
    const groups = data.split('|')
    const tracking = groups[0].split(',')
    const batt = groups[1].split(',')

    return {
      mode: 'tcp',
      device: null,
      raw: data,
      position: self.createPosition(tracking, batt)
    }
  }

  self.parseTcpBatt = (data) => {
    const groups = data.split('|')
    const batt = groups[1].split(',')
    const gsm = groups[1]

    return {
      mode: 'tcp',
      device: null,
      raw: data,
      position: self.createEmptyPosition(batt, gsm)
    }
  }

  self.parseTcpBattVSYS = (data) => {
    const groups = data.split('|')
    const batt = groups[1].split(',')
    const gsm = groups[0].split(',')[1]

    return {
      mode: 'tcp',
      device: null,
      raw: data,
      position: self.createEmptyPosition(batt, gsm)
    }
  }

  self.parseAck = (data) => {
    if (data === 'ack') {
      return {
        mode: 'ack'
      }
    }
  }

  self.parseFail = (data) => {
    return {
      mode: 'ko'
    }
  }

  /**
   *
   * @param {Array} position
   * @param {Array} battery
   */
  self.createPosition = (position, battery) => {
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
    return {
      _id: shortid.generate(),
      _device: null,
      gpstime: app.utils.simcomDateTimeToTimestamp(position[1]),
      servertime: Date.now(),
      data: {
        alt: position[4],
        battery: parseInt(battery[0], 10),
        extbattery: parseInt(battery[1], 10),
        vsys: parseInt(battery[2], 10) || 0,
        raw: `${position.join(',')}|${battery.join(',')}`,
        cog: parseInt(position[6], 10),
        gsm: parseInt(position[9], 10),
        gps: parseFloat(position[7]),
        sats: parseInt(position[8], 10),
        loc: [parseFloat(position[3]), parseFloat(position[2])],
        speed: parseInt(position[5], 10)
      }
    }
  }

  self.createEmptyPosition = (batt, gsm = 0) => {
    return {
      _id: shortid.generate(),
      _device: null,
      gpstime: 0,
      servertime: Date.now(),
      data: {
        alt: 0,
        battery: batt[0],
        extbattery: batt[1],
        vsys: batt[2] || 0,
        raw: 0,
        cog: 0,
        gsm: gsm,
        gps: 0,
        sats: 0,
        loc: [0, 0],
        speed: 0
      }
    }
  }

  app.data = self
}
