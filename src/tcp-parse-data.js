const debug = require('debug')('gwtcp2:tcp:parse')
const shortid = require('shortid')

module.exports = (app) => {
  const self = {}
  const regex = {}

  // 867857039426874|1
  regex.isGreeting = /^8[0-9]{14}\|(1|2)$/

  // 867857039426874|0.3.0
  regex.isGreetingVersion = /^8[0-9]{14}\|[0-9a-zA-Z.]{1,10}$/

  // @id:i234234,v:0.3.3,iccid:923923492349$
  regex.isGreetingFull = /^@(.)*\$$/

  // 867857039426874|1,20180907065405.000,39.519982,-0.454391,88.715,0.00,302.2,1.2,11|10208,38694
  regex.isAuto = /^8[0-9]{14}\|1,[0-9\-,.]*\|[0-9]{1,5},[0-9]{1,5},[0-9]{1,5}$/

  // 867857039426874|0|5000,38694
  regex.isAutoBatt = /^8[0-9]{14}\|0\|[0-9]{1,5},[0-9]{1,5},[0-9]{1,5}$/

  // 1,20180907065405.000,39.519982,-0.454391,88.715,0.00,302.2,1.2,11|4129,38694
  // regex.isTcp = /^1,[0-9\-,.]*\|[0-9]{1,5},[0-9]{1,5}$/

  // 1,20180907065405.000,39.519982,-0.454391,88.715,0.00,302.2,1.2,11|4129,38694,0
  regex.isTcpVSYS = /^1,[0-9\-,.]*\|[0-9]{1,5},[0-9]{1,5},[0-9]{1,5}$/

  // 0,12|5000,38694,0 // incluye GSM y VSYS
  regex.isTcpBattVSYS = /^0,[0-9]{1,5}\|[0-9]{1,5},[0-9]{1,5},[0-9]{1,5}$/

  // 0|5000,38694
  // regex.isTcpBatt = /^0\|[0-9]{1,5},[0-9]{1,5}$/

  // msg|temp:2394$co2:22$
  // regex.isMsg = /^msg\|(.)*\$?$/

  // is sensing auto
  regex.isSensing = /^([0-9]{3,15}\|)?s\|.*(\|[0-9]{1,5},[0-9]{1,5},[0-9]{1,5})?$/

  regex.isElectronobo = /^EN\|[0-9]{3,15}\|([0-9])+,([0-9])+$/
  regex.isElectronoboSession = /^EN\|[0-9]{3,15}\|(.)*\$?$/

  regex.isAck = /^ack\|(0|1)(\|[0-9A-Za-z_-]+)?$/
  regex.isAck2 = /^#ack\|id(.)*\$$/
  regex.isFail = /ko/

  /**
   * Ejecuta las expresiones regulares de arriba para determinar que tipo
   * de datos se nos envía y en función de esto llamar al método apropiado
   * para parsearlo
   *
   * @param {String} data
   */
  self.parse = (data) => {
    data = data.trim()

    if (data === '%') return self.parseAlive(data)
    if (data == '0') return self.parseAlive(data)
    if (data == '1') return self.parseAlive(data)
    else if (regex.isTcpVSYS.test(data)) return self.parseTcp(data)
    else if (regex.isTcpBattVSYS.test(data)) return self.parseTcpBattVSYS(data)
    // else if (regex.isTcp.test(data)) return self.parseTcp(data)
    // else if (regex.isTcpBatt.test(data)) return self.parseTcpBatt(data)
    else if (regex.isGreeting.test(data)) return self.parseGreeting(data, false)
    else if (regex.isGreetingVersion.test(data)) return self.parseGreeting(data, true)
    else if (regex.isGreetingFull.test(data)) return self.parseGreetingFull(data, true)
    else if (regex.isAuto.test(data)) return self.parseAuto(data)
    else if (regex.isAutoBatt.test(data)) return self.parseAutoBatt(data)
    // else if (regex.isMsg.test(data)) return self.parseMsg(data)
    else if (regex.isAck2.test(data)) return self.parseAck2(data)
    else if (regex.isAck.test(data)) return self.parseAck(data)
    else if (data === 'ack') return self.parseAck(data)
    else if (regex.isSensing.test(data)) return self.parseSensing(data)
    else if (regex.isElectronobo.test(data)) return self.parseElectronobo(data)
    else if (regex.isElectronoboSession.test(data)) return self.parseElectronoboSession(data)
    else {
      debug('regex big fail!')
      return null
    }
  }

  self.parseGreeting = (data, hasVersion) => {
    // extraemos el ultimo caracter de la cadena de bienvenida. Esta cadena
    // suele tener el formato [IMEI]|1 o [IMEI]|0. El 1 indicaría que el dispositivo
    // está solicitando mantener el TCP abierto para comunicación bidireccional.
    // el 0 (o cualquier otra cosa) indica que no se requiere TCP abierto
    let keepAlive = parseInt(data.slice(-1), 10)
    debug('parse greeting', keepAlive, data)
    let version = null

    if (hasVersion) {
      version = data.split('|')[1]
      keepAlive = 1
    }

    return {
      version,
      mode: 'greeting',
      keepAlive: keepAlive === 1,
      imei: data.split('|')[0],
      position: null
    }
  }

  self.parseGreetingFull = (data) => {
    // eliminamos la arroba y dolar al inicio y fin y
    // hacemos split de la cadena separada por comas (id:23423,v:239,...)
    const msg = data.replace(/^@|\$$/g, '').split(',')

    const result = {
      mode: 'greeting',
      version: null,
      imei: null,
      iccid: null,
      mastergpio: null,
      iostatus: null,
      keepAlive: true
    }

    // parseamso el mensaje, puede contener multiples variables, pero al menos
    // debe tener una obligatoria, el id de dispositivo o imei
    msg.forEach((prop) => {
      const a = prop.split(':')
      if (a.length === 2) {
        if (a[0] === 'id') result.imei = a[1]
        if (a[0] === 'v') result.version = a[1]
        if (a[0] === 'iccid') result.iccid = a[1]
        if (a[0] === 'io') result.mastergpio = a[1]
        if (a[0] === 'iostatus') result.iostatus = a[1]
      }
    })

    return result
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

  self.parseMsg = (data) => {
    return {
      mode: 'msg',
      device: null,
      raw: data
    }
  }

  self.parseAck2 = (data) => {
    let body = data.split('|')[1].slice(0, -1)
    let props = body.split(';')

    let result = {
      mode: 'ack2',
      cmdId: null,
      iostatus: null,
      processedProps: null
    }

    props.forEach((prop) => {
      const a = prop.split(':')
      if (a[0] === 'id')  result.cmdId = a[1]
      else if (a[0] === 'io')  result.iostatus = a[1]
      else if (a[0] === 'props')  result.processedProps = a[1]
    })

    console.log('')
    console.log('')
    console.log('')
    debug('ACK2: ', result)
    console.log('')
    console.log('')
    console.log('')

    return result
  }

  self.parseAck = (data) => {
    const p = data.split('|')
    const iostatus = p[1] || -1
    const cmdId = p[2] || null

    return {
      cmdId,
      iostatus: parseInt(iostatus),
      mode: 'ack'
    }
  }

  self.parseSensing = (data) => {
    const groups = data.split('|')
    let imei
    let sensorsData
    let batt

    if (groups.length === 2) {
      // utiliza el grettings y mantiene la sesión activa
      imei = false
      sensorsData = groups[1].trim()
    } else if (groups.length === 3) {
      imei = groups[0]
      sensorsData = groups[2].trim()
    } else if (groups.length === 4) {
      imei = groups[0]
      sensorsData = groups[2].trim()
      batt = groups[3].split(',') // batt.length = 1-3 -> vbat[,vin,vsys]
    } else {
      console.log('INVALID SENSING', data)
      return
    }

    if (typeof sensorsData !== 'string' || sensorsData === '') {
      console.log('INVALID SENSING DATA FORMAT', sensorsData)
      return
    }

    let sensors = {}

    sensorsData = sensorsData.split('$').forEach((data) => {
      if (!data) return null
      data = data.replace(/^[^A-Za-z0-9]*|[^A-Z-a-z0-9]*$/gi, '')
      data = data.replace(/,+/gi, ',')

      const sensor = data.split(':')
      if (sensor.length !== 2) return null

      sensors[sensor[0]] = sensor[1]
    })

    return {
      _id: shortid.generate(),
      mode: 'sensing',
      _device: imei,
      keepAlive: false,
      time: Date.now(),
      data: self.createSensing(sensors, batt, data)
    }
  }

  self.parseElectronobo = (data) => {
    let groups = data.split('|')
    let operation = groups[2].split(',')
    if (groups.length === 3 || operation.length === 2) {
      let operationId = operation[1]
      let litres = operation[0]

      return {
        operationId,
        litres,
        mode: 'electronobo'
      }
    }

    return null
  }

  self.parseElectronoboSession = (data) => {
    let groups = data.split('|')
    let imei = groups[1]
    let request = groups[2].split('$')
    let user = request[0].replace('u:', '')
    let pass = request[1].replace('p:', '')
    let litres = request[2].replace('l:', '')
    let mode = 'electronoboSession'

    return {imei, user, pass, litres, mode}
  }

  self.parseAlive = (data) => {
    let iostatus = null
    let version = null

    if (data !== '%' && !isNaN(data)) {
      iostatus = parseInt(data)
    } else if (data === '%') {
      // Los dispositivos que envian el símbolo % utilizan el firmware 0.3.0b.
      // Estos dispositivos no envian su número de versión en el greetings
      // aprovechamos este momento para añadirlo
      version = '0.3.0b'
    }

    return {
      iostatus,
      version,
      mode: 'alive'
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

  self.createSensing = (sensorsData, battery, rawData) => {
    const data = sensorsData
    data.raw = rawData

    if (battery) {
      if (!isNaN(battery[0])) data.battery = parseFloat(battery[0])
      if (!isNaN(battery[1])) data.extbattery = parseFloat(battery[1])
      if (!isNaN(battery[2])) data.vsts = parseFloat(battery[2])
    }

    if (data.hasOwnProperty('loc') && typeof data.loc === 'string') {
      const loc = data.loc.split(',')
      data.loc = [loc[1], loc[0]]
    }

    if (data.hasOwnProperty('gloc') && typeof data.gloc === 'string') {
      const gloc = data.gloc.split(',')
      data.gloc = [gloc[1], gloc[0], gloc[2]] // lon, lat, precission
    }

    return data
  }

  app.data = self
}
