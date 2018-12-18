module.exports = (app) => {
  return (data) => {
    let values

    // la forma de separar valores siempre debería ser con punto y coma (;),
    // por retrocompatibilidad se acepta solo coma (,)
    if (data.search(';')) {
      values = data.split(';')
    } else if (data.search(',')) {
      values = data.split(',')
    }

    if (!values.length) return []

    return values.map((v) => (isNaN(v)) ? 0 : parseFloat(v))
  }
}
