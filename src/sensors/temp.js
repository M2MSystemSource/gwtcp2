module.exports = (app) => {
  return (values) => {
    if (isNaN(values)) return 0
    return parseFloat(values)
  }
}
